from scapy.layers.l2 import Ether
from scapy.layers.inet import IP, TCP, UDP
from scapy.sendrecv import sniff
import threading
from datetime import datetime
from db import store_packet, save_alert
from network_scan import start_passive_sniffer, stop_passive_sniffer, record_packet
from anomaly import AnomalyDetector

stop_event = threading.Event() # Signal to stop capture
capture_thread = None          # Sniffer thread
active_session_id = None       # Current session 
detector = AnomalyDetector()


def start_capture(session_id: int):
    global capture_thread, active_session_id

    # Prevent multiple captures at once
    if active_session_id is not None:
        raise RuntimeError(f"Capture already running on session {active_session_id}")

    detector._reset_state()

    # Called for each captured packet
    def packet_callback(packet):
        if IP in packet:
            # Get packet metadata
            src = packet[IP].src
            dst = packet[IP].dst
            protocol = packet[IP].proto
            size = len(packet)

            dst_port = None
            if TCP in packet:
                dst_port = packet[TCP].dport
            elif UDP in packet:
                dst_port = packet[UDP].dport

            print(f'IP | {src} → {dst} | Protocol: {protocol}')

            pkt = {
                'src_ip':    src,
                'dst_ip':    dst,
                'protocol':  protocol,
                'dst_port':  dst_port,
                'size':      size,
                'timestamp': datetime.now().isoformat(),
            }
            
            # Store packet metadata
            store_packet(pkt, session_id)
            # update device activity in the topology store
            record_packet(src, dst, size)

            # Run anomaly detection
            alerts = detector.analyze_packet(pkt)
            for alert in alerts:
                save_alert(alert, session_id)

    active_session_id = session_id
    stop_event.clear()

    # Run packet sniffer in background
    capture_thread = threading.Thread(
        target=lambda: sniff(
            iface="Wi-Fi",
            prn=packet_callback,
            store=False,
            stop_filter=lambda x: stop_event.is_set(),
        )
    )
    capture_thread.start()
    # start passive ARP sniffer alongside packet capture
    start_passive_sniffer()
    return {'start_timestamp': datetime.now().isoformat()}


def stop_capture():
    global active_session_id, capture_thread

    # Ensure a capture is running
    if active_session_id is None:
        raise RuntimeError("No capture is currently running")

    completed_session_id = active_session_id
    
    # Signal sniffer to stop
    stop_event.set()
    stop_passive_sniffer()
    capture_thread.join()
    active_session_id = None
    
    return {'stop_timestamp': datetime.now().isoformat(), 'session_id': completed_session_id,}


def get_capture_status():
    return active_session_id