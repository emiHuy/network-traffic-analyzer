from sqlalchemy import select, func
from store import engine, packet_table

# Map protocol numbers to names
protocol_names = {
    1: 'ICMP',
    2: 'IGMP',
    6: 'TCP',
    17: 'UDP',
    41: 'IPv6',
    89: 'OSPF',
}

def top_10_ips(session_id: int):
    """Return top 10 source IPs by packet count."""
    # Result format: [{'ip': '192.168.1.1', 'total': 120}, ...]
    query = (
        select(packet_table.c.src_ip, func.count().label('total'))
        .where(packet_table.c.session_id == session_id)
        .group_by(packet_table.c.src_ip)
        .order_by(func.count().desc())
        .limit(10)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [{'ip': r[0], 'total': r[1]} for r in results]


def protocol_breakdown(session_id: int):
    """Return packet counts grouped by protocol."""
    # Result format: [{'protocol': 'TCP', 'total': 340}, ...]
    query = (
        select(packet_table.c.protocol, func.count().label('total'))
        .where(packet_table.c.session_id == session_id)
        .group_by(packet_table.c.protocol)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [{'protocol': protocol_names.get(r[0], 'Unknown'), 'total': r[1]} for r in results]


def packets_per_minute(session_id: int):
    """Return number of packets captured per minute."""
    # Result format: [{'time': '2026-03-16 14:32', 'total': 45}, ...]
    minute = func.strftime('%Y-%m-%d %H:%M', packet_table.c.timestamp)
    query = (
        select(minute, func.count().label('packets_per_min'))
        .where(packet_table.c.session_id == session_id)
        .group_by(minute)
        .order_by(minute.asc())
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [{'time': r[0], 'total': r[1]} for r in results]


def total_packet_count(session_id: int):
    """Return total packets in a session."""
    # Result format: int
    query = (
        select(func.count())
        .select_from(packet_table)
        .where(packet_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        return conn.execute(query).fetchone()[0]


def average_packet_size(session_id: int):
    """Return average packet size."""
    # Result format: float
    query = (
        select(func.avg(packet_table.c.size))
        .where(packet_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        return conn.execute(query).fetchone()[0]


def recent_packets(session_id: int, limit=100):
    """Return most recent packets for a session."""
    # Result format:
    # [
    #   {
    #     'src_ip': '192.168.1.5',
    #     'dst_ip': '8.8.8.8',
    #     'protocol': 6,
    #     'size': 74,
    #     'timestamp': '2026-03-16T14:32:10'
    #   },
    #   ...
    # ]
    query = (
        select(packet_table)
        .where(packet_table.c.session_id == session_id)
        .order_by(packet_table.c.timestamp.desc())
        .limit(limit)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [
        {
            'src_ip':    r[2],
            'dst_ip':    r[3],
            'protocol':  r[4],
            'size':      r[5],
            'timestamp': r[6],
        }
        for r in results
    ]

def get_all_stats(session_id: int, limit=100):
    # Result format:
    # {
    #   'top_10_ips': [...],
    #   'protocol_breakdown': [...],
    #   'packets_per_minute': [...],
    #   'total_packets': int,
    #   'average_packet_size': float,
    #   'recent_packets': [...]
    # }
    return {
        'top_10_ips':          top_10_ips(session_id),
        'protocol_breakdown':  protocol_breakdown(session_id),
        'packets_per_minute':  packets_per_minute(session_id),
        'total_packets':       total_packet_count(session_id),
        'average_packet_size': average_packet_size(session_id),
        'recent_packets':      recent_packets(session_id, limit),
    }
