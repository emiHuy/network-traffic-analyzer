"""
db/__init__.py
───────────────────────────────────────────────────────────────────────────────
Creates the SQLAlchemy engine and initialises all tables on import.
The engine is imported by all db modules to acquire connections.
"""

from sqlalchemy import create_engine
from core.config import DB_PATH
from db.models import metadata

engine = create_engine(f'sqlite:///{DB_PATH}')

# Create all tables defined in models.py if they don't already exist
metadata.create_all(engine)