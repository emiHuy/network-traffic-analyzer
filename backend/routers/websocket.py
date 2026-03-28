from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
from services.stats import get_all_stats
from services.capture import stop, get_status
from db.alerts import get_alerts
from network_scan import get_devices

router = APIRouter()


@router.websocket('/{session_id}/live')
async def live_stats(ws: WebSocket, session_id: int, limit: int = 18):
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
        print(f'WebSocket disconnected for session {session_id}')
        if get_status():
            stop()
    except Exception as e:
        print(f'WebSocket error: {e}')
        if get_status():
            stop()
        await ws.close()
