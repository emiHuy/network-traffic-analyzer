from sqlalchemy import select, func
from db import engine
from db.models import packet_table
from db.packets import get_packets, count_packets

def top_10_ips(session_id: int, limit: int = 10) -> list[dict]:
    query = (
        select(packet_table.c.src_ip, func.count().label('total'))
        .where(packet_table.c.session_id == session_id)
        .group_by(packet_table.c.src_ip)
        .order_by(func.count().desc())
        .limit(limit)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [{'ip': r[0], 'total': r[1]} for r in results]


def protocol_breakdown(session_id: int) -> list[dict]:
    query = (
        select(packet_table.c.protocol, func.count().label('total'))
        .where(packet_table.c.session_id == session_id)
        .group_by(packet_table.c.protocol)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [{'protocol': r[0], 'total': r[1]} for r in results]


def packets_per_minute(session_id: int) -> list[dict]:
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


def average_packet_size(session_id: int) -> float | None:
    query = (
        select(func.avg(packet_table.c.size))
        .where(packet_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        return conn.execute(query).fetchone()[0]
    

def active_hosts(session_id: int) -> int:
    query = (
        select(func.count(packet_table.c.src_ip.distinct()))
        .select_from(packet_table)
        .where(packet_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        return conn.execute(query).fetchone()[0]
    

def get_all_stats(session_id: int, limit: int = 50) -> dict:
    return {
        'top_10_ips':          top_10_ips(session_id),
        'protocol_breakdown':  protocol_breakdown(session_id),
        'packets_per_minute':  packets_per_minute(session_id),
        'total_packets':       count_packets(session_id),
        'average_packet_size': average_packet_size(session_id),
        'recent_packets':      get_packets(session_id, limit),
        'active_hosts':        active_hosts(session_id),
    }
