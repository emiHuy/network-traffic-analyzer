from sqlalchemy import select, func
from store import engine, packet_table

protocol_names = {
    1: 'ICMP',
    2: 'IGMP',
    6: 'TCP',
    17: 'UDP',
    41: 'IPv6',
    89: 'OSPF',
}    

# Get top 10 src IPs
# Results format: [{src_ip: number of occurrences}, ...]
def top_10_ips():
    query = (
        select(packet_table.c.src_ip, func.count().label('total'))
        .group_by(packet_table.c.src_ip)
        .order_by(func.count().desc())
        .limit(10)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    formatted_results = []
    for r in results:
        formatted_results.append({'ip': r[0], 'total':r[1]})
    return formatted_results

# Get number of packets using each protocol
# Results format: [{protocol (string): number of packets}, ...]
def protocol_breakdown():
    query = (
        select(packet_table.c.protocol, func.count().label('total'))
        .group_by(packet_table.c.protocol)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    formatted_results = []
    for r in results:
        formatted_results.append({'protocol':protocol_names.get(r[0], 'Unknown'), 'total':r[1]})
    return formatted_results


# Get number of packets sent each 
# Results format: [{time: number of packets}, ...]
def packets_per_minute():
    query = (
        select(func.strftime('%Y-%m-%d %H:%M', packet_table.c.timestamp), func.count().label('packets_per_min'))
        .group_by(func.strftime('%Y-%m-%d %H:%M', packet_table.c.timestamp))
        .order_by(func.strftime('%Y-%m-%d %H:%M', packet_table.c.timestamp).asc())
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    formatted_results = []
    for r in results:
        formatted_results.append({'time':r[0], 'total':r[1]})
    return formatted_results

# Get total number of packets sent during captures
def total_packet_count():
    query = select(func.count()).select_from(packet_table)
    with engine.connect() as conn:
        results = conn.execute(query).fetchone()
    return results[0]

# Get average packet size
def average_packet_size():
    query = select(func.avg(packet_table.c.size))
    with engine.connect() as conn:
        results = conn.execute(query).fetchone()
    return results[0]

# Get X recent packets (default=100)
def recent_packets(limit=100):
    query = (
        select(packet_table)
        .order_by(packet_table.c.timestamp.desc())
        .limit(limit)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    formatted_results = []
    for r in results:
        formatted_results.append(
        {
            'src_ip': r[1],
            'dst_ip': r[2],
            'protocol': r[3],
            'size': r[4],
            'timestamp': r[5],
        })
    return formatted_results


def print_all_results():
    print("=== Top 10 IPs ===")
    top_ips = top_10_ips()
    for row in top_ips:
        print(f'{row['ip']} - {row['total']} packets')

    print("\n=== Protocol Breakdown ===")
    protocols = protocol_breakdown()
    for row in protocols:
        print(f'{row['protocol']} - {row['total']} packets')

    print("\n=== Packets per Minute ===")
    intervals = packets_per_minute()
    for row in intervals:
        print(f'{row['time']} - {row['total']} packets')

    print("\n=== Total Packets ===")
    print(total_packet_count())

    print("\n=== Average Packet Size ===")
    print(average_packet_size())

    print("\n=== Recent Packets ===")
    recent = recent_packets()
    for row in recent:
        print(f'{protocol_names[row['protocol']]} {row['src_ip']} → {row['dst_ip']}, size: {row['size']} @ {row['timestamp']}')