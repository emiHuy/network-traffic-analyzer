"""
routers/websocket.py

Streams live stats, topology, and alerts to the frontend once per second
for the duration of a capture session. Stops any active capture on disconnect.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio

from services.stats import get_all_stats
from services.capture import stop, get_status
from services.network_scan import get_devices
from db.alerts import get_alerts

router = APIRouter()


@router.websocket('/{session_id}/live')
async def live_stats(ws: WebSocket, session_id: int, limit: int = 18):
    """
    Push stats, topology, and alerts to the client once per second.
    Stops any active capture if the connection closes unexpectedly.

    Args:
        limit: max number of packets to return in stats; None returns all
    """
    try:
        await ws.accept()
        print(f'WebSocket accepted for session {session_id}')

        while True:
            await ws.send_json({
                'stats':    get_all_stats(session_id, limit),
                'topology': get_devices(),
                'alerts':   get_alerts(session_id),
            })
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        # Clean disconnect — client navigated away or closed the tab
        print(f'WebSocket disconnected for session {session_id}')
        if get_status():
            stop()

    except Exception as e:
        # Unexpected error — stop capture to avoid a dangling sniff thread
        print(f'WebSocket error: {e}')
        if get_status():
            stop()
        await ws.close()
