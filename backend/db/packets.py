from sqlalchemy import insert, select, func
from db import engine
from db.models import packet_table


def store_packet(packet: dict, session_id: int):
    with engine.connect() as conn:
        conn.execute(insert(packet_table).values(
            session_id=session_id,
            src_ip=packet['src_ip'],
            dst_ip=packet['dst_ip'],
            protocol=packet['protocol'],
            dst_port=packet['dst_port'],
            size=packet['size'],
            timestamp=packet['timestamp'],
        ))
        conn.commit()


def get_packets(session_id: int, limit: int | None = 18, desc: bool = True) -> list[dict]:
    query = (
        select(packet_table)
        .where(packet_table.c.session_id == session_id)
    )
    if desc:
        query = query.order_by(packet_table.c.timestamp.desc())
    else:
        query = query.order_by(packet_table.c.timestamp.asc())
    
    if limit:
        query = query.limit(limit)

    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [
        {
            'src_ip':    r._mapping['src_ip'],
            'dst_ip':    r._mapping['dst_ip'],
            'protocol':  r._mapping['protocol'],
            'dst_port':  r._mapping['dst_port'],
            'size':      r._mapping['size'],
            'timestamp': r._mapping['timestamp'],
        }
        for r in results
    ]


def count_packets(session_id: int) -> int:
    query = (
        select(func.count())
        .select_from(packet_table)
        .where(packet_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        return conn.execute(query).fetchone()[0]
