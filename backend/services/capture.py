"""
services/capture.py
───────────────────────────────────────────────────────────────────────────────
Packet-capture service layer.

Responsibilities
────────────────
• start()  – validate the session, spin up Scapy sniffing in the background,
              start the passive ARP sniffer, wire the anomaly detector.
• stop()   – signal the sniffer threads to stop, wait for them to finish,
              persist the device snapshot for the session.
• get_status() – expose the currently-active session ID (None when idle).

The actual Scapy sniff loop lives in core/state.py's CaptureManager so that
it can be shared safely across FastAPI requests without re-importing Scapy
multiple times.
───────────────────────────────────────────────────────────────────────────────
"""

from datetime import datetime

from scapy.layers.inet import IP, TCP, UDP

from core.state import capture_manager
from db.packets import store_packet, count_packets
from db.alerts import save_alert
from db.devices import save_devices
from services.network_scan import (
    start_passive_sniffer, 
    stop_passive_sniffer, 
    record_packet, 
    get_devices,
)

def start(session_id: int) -> dict:
    """
    Begin packet capture for *session_id*.

    Raises
    ──────
    RuntimeError
        If the session already has captured data (each session is write-once).
    """
    if count_packets(session_id) > 0:
        raise RuntimeError(
            f'Session {session_id} already has capture data. ' 
            'Create a new session.'
        )

    def _on_packet(packet):
        """Per-packet callback executed in the capture thread."""
        try:
            # Only process IP packets; ignore ARP, Ethernet-only frames, etc.
            if IP not in packet:
                return

            src      = packet[IP].src
            dst      = packet[IP].dst
            protocol = packet[IP].proto
            size     = len(packet)

            # Drop broadcast and multicast packets
            if src == '255.255.255.255' or dst == '255.255.255.255':
                return

            # Extract the destination port for TCP/UDP (used by the port-scan detector).
            dst_port = None
            if TCP in packet:
                dst_port = packet[TCP].dport
            elif UDP in packet:
                dst_port = packet[UDP].dport

            pkt = {
                'src_ip':    src,
                'dst_ip':    dst,
                'protocol':  protocol,
                'dst_port':  dst_port,
                'size':      size,
                'timestamp': datetime.now().isoformat(),
            }

            # Persist packet and update per-device traffic counters.
            store_packet(pkt, session_id)
            record_packet(src, dst, size)

            # Run rule-based anomaly detection; persist any alerts immediately.
            for alert in capture_manager.detector.analyze_packet(pkt):
                save_alert(alert, session_id)
        except Exception:
            return

    result = capture_manager.start(session_id, _on_packet)

    # The passive sniffer listens for ARP replies to build the network map
    # without having to wait for an active scan.
    start_passive_sniffer()
    return result


def stop() -> dict:
    """
    Stop the running capture.

    Signals the capture thread and the passive sniffer, then waits for both
    to finish before persisting the final device snapshot.

    Returns the stop timestamp and session ID.
    """
    result = capture_manager.stop()
    stop_passive_sniffer()

    # Persist the device map as a session snapshot so the network graph can
    # be reproduced when the session is loaded later.
    completed_session_id = result.get('session_id')
    if completed_session_id and count_packets(completed_session_id) > 0:
        save_devices(completed_session_id, get_devices())

    return result


def get_status() -> int | None:
    """Return the session ID of the currently-running capture, or None."""
    return capture_manager.active_session_id
