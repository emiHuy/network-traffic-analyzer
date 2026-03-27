from sqlalchemy import create_engine, insert, delete, select, Table, Column, String, Integer, MetaData, func
from datetime import datetime
import os

# ── Database setup ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "..", "netanalyzer.db")

engine = create_engine(f'sqlite:///{DB_PATH}')
metadata = MetaData()

# ── Sessions table ─────────────────────────────────────────────────────────────
session_table = Table(
    'sessions', metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('name', String, unique=True),
    Column('created_at', String),
)

# ── Packets table ──────────────────────────────────────────────────────────────
packet_table = Table(
    'packets', metadata,
    Column('id', Integer, primary_key=True),
    Column('session_id', Integer),
    Column('src_ip', String),
    Column('dst_ip', String),
    Column('protocol', Integer),
    Column('dst_port', Integer, nullable=True),
    Column('size', Integer),
    Column('timestamp', String),
)

# ── Devices table ──────────────────────────────────────────────────────────────
# Snapshot of network devices at the end of each capture session
devices_table = Table(
    'devices', metadata,
    Column('id',           Integer, primary_key=True, autoincrement=True),
    Column('session_id',   Integer),
    Column('mac',          String),
    Column('ip',           String),
    Column('manufacturer', String),
    Column('first_seen',   String),
    Column('last_seen',    String),
    Column('bytes_seen',   Integer),
    Column('packet_count', Integer),
)

# ── Alerts table -──────────────────────────────────────────────────────────────
alerts_table = Table(
    'alerts', metadata,
    Column('id',             Integer, primary_key=True, autoincrement=True),
    Column('session_id',     Integer),
    Column('timestamp',      String),
    Column('src_ip',         String),
    Column('dst_ip',         String),
    Column('rule_triggered', String),
    Column('severity',       String),
    Column('description',    String),
)

# Create tables if they do not exist
metadata.create_all(engine)


# ── Session functions ──────────────────────────────────────────────────────────

def create_session(name: str) -> int:
    """Create a new capture session and return its ID."""
    with engine.connect() as conn:
        result = conn.execute(insert(session_table).values(
            name=name,
            created_at=datetime.now().isoformat(),
        ))
        conn.commit()
        return result.lastrowid


def get_session(session_id: int):
    """Return basic session info (id, name) for the given ID, or None if not found."""
    query = select(session_table).where(session_table.c.id == session_id)
    with engine.connect() as conn:
        row = conn.execute(query).fetchone()
    if not row:
        return None
    return {'id': row._mapping['id'], 'name': row._mapping['name']}


def get_all_sessions():
    """Return all saved sessions with their packet counts."""
    query = (
        select(
            session_table.c.id,
            session_table.c.name,
            session_table.c.created_at,
            func.count(packet_table.c.id).label('packet_count')
        )
        .outerjoin(packet_table, packet_table.c.session_id == session_table.c.id)
        .group_by(session_table.c.id)
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [
        {
            'id': r._mapping['id'], 
            'name': r._mapping['name'], 
            'created_at': r._mapping['created_at'], 
            'packet_count': r._mapping['packet_count']
        } 
        for r in results
    ]


def clear_session(session_id: int):
    """Delete a session and all its associated data (packets and devices)."""
    with engine.connect() as conn:
        # Delete associated packets
        conn.execute(delete(packet_table).where(packet_table.c.session_id == session_id))
        # Delete associated devices
        conn.execute(delete(devices_table).where(devices_table.c.session_id == session_id))
        # Delete associated alerts
        conn.execute(delete(alerts_table).where(alerts_table.c.session_id == session_id))
        # Delete session
        conn.execute(delete(session_table).where(session_table.c.id == session_id))
        conn.commit()


# ── Packet functions ───────────────────────────────────────────────────────────

def store_packet(packet, session_id: int):
    """
    Store metadata for a single captured packet.
    Called during active capture.
    """
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

# ── Device functions ───────────────────────────────────────────────────────────

def save_devices(session_id: int, devices: list[dict]) -> None:
    """
    Snapshot the current device list for a session.
    Called when capture stops — overwrites any existing snapshot for this session.
    Each device dict comes from network_scan.get_devices():
      { ip, mac, manufacturer, first_seen, last_seen, bytes_seen, packet_count }
    """
    with engine.connect() as conn:
        # Clear any existing snapshot for this session
        conn.execute(
            delete(devices_table).where(devices_table.c.session_id == session_id)
        )
        # Insert the new snapshot
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
    Load the device snapshot for a session from the DB.
    Returns an empty list if no snapshot exists for this session.
    Result format matches network_scan.get_devices():
      [{ ip, mac, manufacturer, first_seen, last_seen, bytes_seen, packet_count }, ...]
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


def session_has_devices(session_id: int) -> bool:
    """Return True if a device snapshot exists for this session."""
    query = (
        select(func.count())
        .select_from(devices_table)
        .where(devices_table.c.session_id == session_id)
    )
    with engine.connect() as conn:
        return conn.execute(query).fetchone()[0] > 0

# ── Alert functions -───────────────────────────────────────────────────────────

def save_alert(alert: dict, session_id: int) -> None:
    with engine.connect() as conn:
        conn.execute(insert(alerts_table).values(
            session_id=session_id,
            timestamp=alert['timestamp'],
            src_ip=alert['src_ip'],
            dst_ip=alert['dst_ip'],
            rule_triggered=alert['rule_triggered'],
            severity=alert['severity'],
            description=alert['description'],
        ))
        conn.commit()


def get_alerts(session_id: int) -> list[dict]:
    query = (
        select(alerts_table)
        .where(alerts_table.c.session_id == session_id)
        .order_by(alerts_table.c.timestamp.desc())
    )
    with engine.connect() as conn:
        results = conn.execute(query).fetchall()
    return [
        {
            'id':             r._mapping['id'],
            'timestamp':      r._mapping['timestamp'],
            'src_ip':         r._mapping['src_ip'],
            'dst_ip':         r._mapping['dst_ip'],
            'rule_triggered': r._mapping['rule_triggered'],
            'severity':       r._mapping['severity'],
            'description':    r._mapping['description'],
        }
        for r in results
    ]
