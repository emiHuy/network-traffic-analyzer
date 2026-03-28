from sqlalchemy import Table, Column, String, Integer, MetaData

metadata = MetaData()

session_table = Table(
    'sessions', metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('name', String, unique=True),
    Column('created_at', String),
)

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