"""
services/network_monitor.py
───────────────────────────────────────────────────────────────────────────────
ARP-based network device scanner.

Usage
─────
Active scanning of the local subnet:

    from network_monitor import active_scan
    devices = active_scan('192.168.1.0/24')

Start passive monitoring:

    from network_monitor import start_passive_sniffer, stop_passive_sniffer
    start_passive_sniffer()
    # devices will be automatically updated in the background
    stop_passive_sniffer()  # stop when done

Recording packet statistics (called from capture.py):

    from network_monitor import record_packet
    record_packet(src_ip, dst_ip, size)

Accessing or managing the device store:

    from network_monitor import get_devices, clear_devices, get_subnet
    all_devices = get_devices()
    clear_devices()         # clear store for a new session
    subnet = get_subnet()   # auto-detect local subnet

Device record format
────────────────────
    {
        "ip":           str,
        "mac":          str,
        "manufacturer": str,
        "first_seen":   ISO-8601 string,
        "last_seen":    ISO-8601 string,
        "bytes_seen":   int,
        "packet_count": int,
    }

State & concurrency
───────────────────
- Thread-safe access to the device store using a Lock.
- Passive sniffer runs in a daemon thread.
- _mac_parser is instantiated once at module load (slow, cached for efficiency).
───────────────────────────────────────────────────────────────────────────────
"""

import threading
import ipaddress
import socket
from datetime import datetime

import manuf
from scapy.layers.l2 import ARP, Ether
from scapy.sendrecv import srp, sniff

# ── MAC vendor parser — instantiated once at module level (slow to load) ──────
_mac_parser = manuf.MacParser()

_devices: dict[str, dict] = {}
_devices_lock = threading.Lock()

# ── Passive sniffer state ──────────────────────────────────────────────────────
_sniffer_thread: threading.Thread | None = None
_sniffer_stop   = threading.Event()


# ── Internal helpers ───────────────────────────────────────────────────────────

def _manufacturer(mac: str) -> str:
    """Look up manufacturer name from MAC address."""
    try:
        name = _mac_parser.get_manuf_long(mac)
        return name if name else 'Unknown'
    except Exception:
        return 'Unknown'


def _upsert_device(ip: str, mac: str) -> None:
    """Add a new device or refresh last_seen on an existing one."""
    mac = mac.lower()
    now = datetime.now().isoformat()
    with _devices_lock:
        if mac not in _devices:
            _devices[mac] = {
                'ip':           ip,
                'mac':          mac,
                'manufacturer': _manufacturer(mac),
                'first_seen':   now,
                'last_seen':    now,
                'bytes_seen':   0,
                'packet_count': 0,
            }
        else:
            # Update IP in case it changed (DHCP) and refresh last_seen
            _devices[mac]['ip']        = ip
            _devices[mac]['last_seen'] = now


def _arp_callback(packet) -> None:
    """Called for each sniffed ARP packet during passive sniffing."""
    # ARP reply (op=2) means a device is announcing itself
    if packet.haslayer(ARP) and packet[ARP].op == 2:
        ip  = packet[ARP].psrc
        mac = packet[ARP].hwsrc
        _upsert_device(ip, mac)


# ── Public API ─────────────────────────────────────────────────────────────────

def active_scan(subnet: str = '192.168.1.0/24') -> list[dict]:
    """
    Send ARP requests to every IP in the subnet and collect replies.
    Blocks for 2-3 seconds while waiting for responses.
    Returns the current device list after updating the store.
    """
    # Build broadcast ARP request for entire subnet
    arp_request = ARP(pdst=subnet)
    broadcast   = Ether(dst='ff:ff:ff:ff:ff:ff')
    packet      = broadcast / arp_request

    # srp = send/receive at layer 2; timeout=2s, verbose=0 suppresses scapy output
    answered, _ = srp(packet, timeout=2, verbose=0)

    for _, reply in answered:
        ip  = reply[ARP].psrc
        mac = reply[ARP].hwsrc
        _upsert_device(ip, mac)

    return get_devices()


def start_passive_sniffer() -> None:
    """
    Start background ARP sniffing to catch devices as they appear naturally.
    Safe to call multiple times — will not start a second sniffer if one is running.
    """
    global _sniffer_thread

    if _sniffer_thread and _sniffer_thread.is_alive():
        return  # already running

    _sniffer_stop.clear()

    _sniffer_thread = threading.Thread(
        target=lambda: sniff(
            filter='arp',
            prn=_arp_callback,
            store=False,
            stop_filter=lambda _: _sniffer_stop.is_set(),
        ),
        daemon=True,
    )
    _sniffer_thread.start()


def stop_passive_sniffer() -> None:
    """Signal the passive sniffer thread to stop."""
    _sniffer_stop.set()


def record_packet(src_ip: str, dst_ip: str, size: int) -> None:
    """
    Called by capture.py for each captured packet.
    Updates bytes_seen and packet_count for matching devices.
    Does nothing if the IP is not in the device store yet.
    """
    with _devices_lock:
        for device in _devices.values():
            if device['ip'] in (src_ip, dst_ip):
                device['bytes_seen']   += size
                device['packet_count'] += 1
                device['last_seen']     = datetime.now().isoformat()


def get_devices() -> list[dict]:
    """Return a snapshot of all known devices as a list."""
    with _devices_lock:
        return list(_devices.values())


def clear_devices() -> None:
    """
    Clear the device store.
    Called when a new capture session starts so the graph is fresh.
    """
    with _devices_lock:
        _devices.clear()


def get_subnet() -> str:
    """
    Attempt to auto-detect the local subnet from the machine's default interface.
    Falls back to 192.168.1.0/24 if detection fails.
    """
    try:
        # Get local IP by connecting a UDP socket (no data sent)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
        # Assume /24 subnet from local IP
        network = ipaddress.IPv4Network(f'{local_ip}/24', strict=False)
        return str(network)
    except Exception:
        return '192.168.1.0/24'
