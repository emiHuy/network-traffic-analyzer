"""
routers/sessions.py

Session-scoped REST endpoints.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from db.alerts import get_alerts
from db.sessions import create_session, get_all_sessions, delete_session
from db.packets import get_packets
from services.export import export_csv, export_excel
from services.stats import get_all_stats
from services.topology import get_topology

router = APIRouter()

class SessionCreate(BaseModel):
    name: str

# ── Session management ────────────────────────────────────────────────────────

@router.get('/')
def list_sessions():
    """
    Return all sessions, ordered by creation time, as a list of dicts:
        [{ id, name, created_at, packet_count }, ...]
    """
    return get_all_sessions()


@router.post('/', status_code=201)
def new_session(body: SessionCreate):
    """Create a new named session and return its ID."""
    session_id = create_session(body.name)
    return {'session_id': session_id, 'name': body.name}


@router.delete('/{session_id}', status_code=204)
def remove_session(session_id: int):
    """Delete a session and all associated packets, devices, and alerts."""
    delete_session(session_id)

# ── Session packets ───────────────────────────────────────────────────────────

@router.get('/{session_id}/packets')
def list_packets(session_id: int, limit: int = None, order: str = 'desc'):
    """
    Return packets for a session.

    Args:
        limit: max number of packets to return (default: all)
        order: 'asc' or 'desc' by timestamp (default: 'desc')

    Returns:
        [{ src_ip, dst_ip, protocol, dst_port, size, timestamp }, ...]
    """
    desc = order != 'asc'
    return get_packets(session_id, limit=limit, desc=desc)


@router.get('/{session_id}/packets/export')
def export_packets(session_id: int, format: str = 'csv'):
    """
    Export all packets for a session as a downloadable file.

    Args:
        format: 'csv' (default) or 'excel'

    Returns:
        File download response with Content-Disposition attachment header.

    Raises:
        404 if the session does not exist
        500 if the export fails (e.g. missing openpyxl for Excel)
    """
    try:
        if format == 'excel':
            data, filename = export_excel(session_id)
            media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        else:
            data, filename = export_csv(session_id)
            media_type = 'text/csv'
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return Response(
        content=data,
        media_type=media_type,
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )

# ── Session stats ─────────────────────────────────────────────────────────────

@router.get('/{session_id}/stats')
def get_stats(session_id: int, limit: int = 18):
    """
    Return aggregated stats for a session. limit controls the recent packet count.
    { top_10_ips, protocol_breakdown, packets_per_minute, total_packets, average_packet_size, recent_packets, active_hosts }

    Args:
        limit: max number of packets to return; None returns all
    """
    return get_all_stats(session_id, limit)

# ── Session devices ───────────────────────────────────────────────────────────

@router.get('/{session_id}/devices')
def get_session_devices(session_id: int):
    """
    Return the device topology for a session.

    If the session has a saved device snapshot, returns that.
    Otherwise returns an empty node list.

    Returns: { subnet, source: 'snapshot' | 'empty', nodes: [{ ip, mac, manufacturer, ... }] }
    """
    return get_topology(session_id)

# ── Session alerts ────────────────────────────────────────────────────────────

@router.get('/{session_id}/alerts')
def list_alerts(session_id: int):
    """
    Return all alerts for a session, ordered by timestamp descending.
    Returns: [{ id, timestamp, src_ip, dst_ip, rule_triggered, severity, description }, ...]
    """
    return get_alerts(session_id)