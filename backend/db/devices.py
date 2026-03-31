"""
db/devices.py
───────────────────────────────────────────────────────────────────────────────
Database operations for the device topology snapshot.
Devices are written once when capture stops and read back when
a completed session is loaded.
"""

from sqlalchemy import insert, delete, select, func
from db import engine
from db.models import devices_table


def save_devices(session_id: int, devices: list[dict]) -> None:
    """
    Persist the device snapshot for a session, replacing any existing records.
    Called once when capture stops with the final in-memory device state.
    """
    with engine.connect() as conn:
        # Clear any previous snapshot for this session before inserting
        conn.execute(
            delete(devices_table).where(devices_table.c.session_id == session_id)
        )
        if devices:
            conn.execute(
                insert(devices_table),
                [
                    {
                        'session_id':   session_id,
                        'mac':          d['mac'],
                        'ip':           d['ip'],
                        'manufacturer': d['manufacturer'],
                        'first_seen':   d['first_seen'],
                        'last_seen':    d['last_seen'],
                        'bytes_seen':   d['bytes_seen'],
                        'packet_count': d['packet_count'],
                    }
                    for d in devices
                ],
            )
        conn.commit()


def load_devices(session_id: int) -> list[dict]:
    """
    Return the saved device snapshot for a session, ordered by bytes seen descending.
    Returns: [{ ip, mac, manufacturer, first_seen, last_seen, bytes_seen, packet_count }, ...]
    """
    query = (
        select(devices_table)
        .where(devices_table.c.session_id == session_id)
        .order_by(devices_table.c.bytes_seen.desc())
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [
        {
            'ip':           r._mapping['ip'],
            'mac':          r._mapping['mac'],
            'manufacturer': r._mapping['manufacturer'],
            'first_seen':   r._mapping['first_seen'],
            'last_seen':    r._mapping['last_seen'],
            'bytes_seen':   r._mapping['bytes_seen'],
            'packet_count': r._mapping['packet_count'],
        }
        for r in results
    ]


def has_devices(session_id: int) -> bool:
    """Return True if a device snapshot exists for the session."""
    query = (
        select(func.count())
        .select_from(devices_table)
        .where(devices_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        return conn.execute(query).fetchone()[0] > 0