from datetime import datetime
from scapy.layers.inet import IP, TCP, UDP
from core.state import capture_manager
from db.packets import store_packet, count_packets
from db.alerts import save_alert
from db.devices import save_devices
from network_scan import start_passive_sniffer, stop_passive_sniffer, record_packet, get_devices

def start(session_id: int) -> dict:
    if count_packets(session_id) > 0:
        raise RuntimeError(f'Session {session_id} already has capture data. Create a new session.')

    def packet_callback(packet):
        if IP not in packet:
            return

        src      = packet[IP].src
        dst      = packet[IP].dst
        protocol = packet[IP].proto
        size     = len(packet)

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

        store_packet(pkt, session_id)
        record_packet(src, dst, size)

        alerts = capture_manager.detector.analyze_packet(pkt)
        for alert in alerts:
            save_alert(alert, session_id)

    result = capture_manager.start(session_id, packet_callback)
    start_passive_sniffer()
    return result


def stop() -> dict:
    result = capture_manager.stop()
    stop_passive_sniffer()

    completed_session_id = result.get('session_id')
    if completed_session_id and count_packets(completed_session_id) > 0:
        save_devices(completed_session_id, get_devices())

    return result


def get_status() -> int | None:
    return capture_manager.active_session_id
