"""
services/stats.py
───────────────────────────────────────────────────────────────────────────────
Network packet statistics and local IP analysis.

Provides functions to extract per-session metrics from captured packets,
including top local IPs, protocol breakdowns, packet rates, average sizes,
and active hosts.

Usage
─────
Calculate stats for a session:

    from db.stats import get_all_stats

    stats = get_all_stats(session_id=123, limit=50)
    print(stats['top_10_ips'])
    print(stats['protocol_breakdown'])
    print(stats['active_hosts'])

Notes
─────
- Local IP detection relies on dynamically detecting the subnet using
  `network_scan.get_subnet()`. Defaults to /24 if detection fails.
- Only local IPs are included in top IPs and active host calculations.
───────────────────────────────────────────────────────────────────────────────
"""

from sqlalchemy import select, func
from db import engine
from db.models import packet_table
from db.packets import get_packets, count_packets
from network_scan import get_subnet
import ipaddress

def _is_local(ip: str) -> bool:
    """
    Determine if an IP address belongs to the local network.

    Attempts to detect the local subnet dynamically using `get_subnet()`.
    Falls back to /24 if detection fails. Excludes multicast, network, and
    broadcast addresses.

    Returns True if IP is local, False otherwise.
    """
    try:
        addr = ipaddress.ip_address(ip)
        
        if addr.is_multicast:
            return False

        # Get local subnet from system, default to /24 if detection fails
        try:
            subnet = ipaddress.ip_network(get_subnet(), strict=False)
        except Exception:
            subnet = ipaddress.ip_network(f"{addr}/24", strict=False)

        # Check if IP is inside subnet
        if addr in subnet:
            if addr == subnet.network_address or addr == subnet.broadcast_address:
                return False
            return True
        
        return False

    except ValueError:
        # Invalid IP string
        return False
    

def _top_10_ips(session_id: int, limit: int = 10) -> list[dict]:
    """
    Retrieve the top local IP addresses by packet count in a session.
    Returns list[dict]: Each dict contains 'ip' and 'total' keys.
    """
    query = (
        select(packet_table.c.src_ip, packet_table.c.dst_ip)
        .where(packet_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()

    counts = {}
    for r in results:
        src = r._mapping['src_ip']
        dst = r._mapping['dst_ip']
        if _is_local(src):
            counts[src] = counts.get(src, 0) + 1
        if _is_local(dst):
            counts[dst] = counts.get(dst, 0) + 1
    sorted_ips = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    return [{'ip': ip, 'total': total} for ip, total in sorted_ips[:limit]]


def _protocol_breakdown(session_id: int) -> list[dict]:
    """
    Count packets per protocol in a session.
    Returns list[dict]: Each dict contains 'protocol' and 'total' keys.
    """
    query = (
        select(packet_table.c.protocol, func.count().label('total'))
        .where(packet_table.c.session_id == session_id)
        .group_by(packet_table.c.protocol)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [{'protocol': r[0], 'total': r[1]} for r in results]


def _packets_per_minute(session_id: int) -> list[dict]:
    """
    Count packets per minute for a session.
    Uses strftime to group timestamps by minute.

    Returns list[dict]: Each dict contains 'time' (YYYY-MM-DD HH:MM) and 'total'.
    """
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


def _average_packet_size(session_id: int) -> float | None:
    """
    Compute the average packet size for a session.
    Returns average size in bytes, or None if no packets.
    """
    query = (
        select(func.avg(packet_table.c.size))
        .where(packet_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        return conn.execute(query).fetchone()[0]
    

def _active_hosts(session_id: int) -> int:
    """
    Count the number of unique local hosts in a session.
    Returns number of unique local hosts.
    """
    query = (
        select(packet_table.c.src_ip, packet_table.c.dst_ip)
        .where(packet_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    
    unique_hosts = set()
    for r in results:
        src = r._mapping['src_ip']
        dst = r._mapping['dst_ip']
        if _is_local(src):
            unique_hosts.add(src)
        if _is_local(dst):
            unique_hosts.add(dst)
    return len(unique_hosts)
    

def get_all_stats(session_id: int, limit: int = 50) -> dict:
    """
    Retrieve all key statistics for a session.
    Returns a dictionary with all necessary statistics.
    """
    return {
        'top_10_ips':          _top_10_ips(session_id),
        'protocol_breakdown':  _protocol_breakdown(session_id),
        'packets_per_minute':  _packets_per_minute(session_id),
        'total_packets':       count_packets(session_id),
        'average_packet_size': _average_packet_size(session_id),
        'recent_packets':      get_packets(session_id, limit),
        'active_hosts':        _active_hosts(session_id),
    }
