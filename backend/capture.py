from scapy.layers.l2 import Ether
from scapy.layers.inet import IP
from scapy.sendrecv import sniff
import threading
from datetime import datetime
from db import store_packet
from network_scan import start_passive_sniffer, stop_passive_sniffer, record_packet

stop_event = threading.Event() # Signal to stop capture
capture_thread = None          # Sniffer thread
active_session_id = None       # Current session id

def start_capture(session_id: int):
    global capture_thread, active_session_id

    # Prevent multiple captures at once
    if active_session_id is not None:
        raise RuntimeError(f"Capture already running on session {active_session_id}")

    # Called for each captured packet
    def packet_callback(packet):
        if IP in packet:
            # Get packet metadata
            src = packet[IP].src
            dst = packet[IP].dst
            protocol = packet[IP].proto
            size = len(packet)
            print(f'IP | {src} → {dst} | Protocol: {protocol}')
            
            # Store packet metadata
            store_packet({
                'src_ip':    src,
                'dst_ip':    dst,
                'protocol':  protocol,
                'size':      size,
                'timestamp': datetime.now().isoformat(),
            }, session_id)

            # update device activity in the topology store
            record_packet(src, dst, size)

    active_session_id = session_id
    stop_event.clear()

    # Run packet sniffer in background
    capture_thread = threading.Thread(
        target=lambda: sniff(
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