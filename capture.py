from scapy.all import sniff, IP, ARP

# Capture packets being sent to and from network
def packet_callback(packet):
    if IP in packet:
        # Get source IP, destination IP, and protocol from packet
        src = packet[IP].src
        dst = packet[IP].dst
        protocol = packet[IP].proto
        print(f"IP | {src} → {dst} | Protocol: {protocol}")
    elif ARP in packet:
        print(f"ARP | {packet[ARP].psrc} → {packet[ARP].pdst}")

sniff(prn=packet_callback, store=False)
