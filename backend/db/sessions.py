"""
sessions.py

This module handles all database operations related to capture sessions.

Responsibilities:
- Create and retrieve sessions
- List sessions with aggregated packet statistics
- Delete sessions and cascade related data (packets, devices, alerts)

Uses SQLAlchemy Core with a shared engine connection.
"""

from sqlalchemy import insert, delete, select, func
from datetime import datetime
from db import engine
from db.models import session_table, packet_table, devices_table, alerts_table

def create_session(name: str) -> int:
    """
    Create a new session.

    Args:
        name (str): Human-readable session name.

    Returns:
        int: The ID of the newly created session.
    """
    with engine.connect() as conn:
        result = conn.execute(insert(session_table).values(
            name=name,
            created_at=datetime.now().isoformat(),
        ))
        conn.commit()
        return result.lastrowid
    

def get_session(session_id: int) -> dict | None:
    """
    Retrieve a single session by ID.
    Returns: dict | None: Session data if found, otherwise None.
    """
    query = select(session_table).where(session_table.c.id == session_id)
    with engine.connect() as conn:
        row = conn.execute(query).fetchone()
    if not row:
        return None
    # Convert SQLAlchemy row to plain dictionary
    return {'id': row._mapping['id'], 'name': row._mapping['name']}


def get_all_sessions() -> list[dict]:
    """
    Retrieve all sessions with packet counts.

    Performs a LEFT JOIN with packets to include sessions with zero packets.

    Returns:
        list[dict]: List of session objects with metadata and packet count.
    """
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
    # Transform results into a list of dictionaries
    return [
        {
            'id': r._mapping['id'], 
            'name': r._mapping['name'], 
            'created_at': r._mapping['created_at'], 
            'packet_count': r._mapping['packet_count']
        } 
        for r in results
    ]


def delete_session(session_id: int) -> None:
    """Delete a session and all its associated data."""
    with engine.connect() as conn:
        conn.execute(delete(packet_table).where(packet_table.c.session_id == session_id))
        conn.execute(delete(devices_table).where(devices_table.c.session_id == session_id))
        conn.execute(delete(alerts_table).where(alerts_table.c.session_id == session_id))
        conn.execute(delete(session_table).where(session_table.c.id == session_id))
        conn.commit()