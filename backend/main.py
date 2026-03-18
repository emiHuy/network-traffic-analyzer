from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import asyncio

from store import create_session, clear_session, get_all_sessions
from capture import start_capture, stop_capture, get_capture_status
from stats import get_all_stats, get_packets
from export import export_csv, export_excel

app = FastAPI()

# Allow frontent to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:5173', 
        'http://127.0.0.1:5173',
        'ws://127.0.0.1:8000',
    ],
    allow_methods=['*'],
    allow_headers=['*'],
)

# Request body for creating a session
class SessionCreate(BaseModel):
    name: str


@app.post('/sessions')
def new_session(body: SessionCreate):
    """Create a new capture session."""
    # Result format: {'session_id': 1, 'name': 'Test Session'}
    session_id = create_session(body.name)
    return {'session_id': session_id, 'name': body.name}


@app.get('/sessions')
def list_sessions():
    """Return all sessions."""
    # Result format: [{'id': 1, 'name': 'Test', 'created_at': '...', 'packet_count': 1}, ...]
    return get_all_sessions()


@app.delete('/sessions/{session_id}')
def delete_session(session_id: int):
    """Delete a session and its packets."""
    # Result format: {'deleted': 1}
    clear_session(session_id)
    return {'deleted': session_id}


@app.post('/capture/start/{session_id}')
def capture_start(session_id: int):
    """Start packet capture for a session."""
    # Result format: {'start_timestamp': '2026-03-16T14:32:10'}
    try:
        return start_capture(session_id)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post('/capture/stop')
def capture_stop():
    """Stop the active packet capture."""
    # Result format: {'stop_timestamp': '2026-03-16T14:35:02'}
    try:
        return stop_capture()
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get('/capture/status')
def capture_status():
    status = get_capture_status()
    return {'active_session': status}


@app.get('/stats/{session_id}')
def get_stats(session_id: int, limit: int = 18):
    """Return statistics for a session."""
    # Result format:
    # {
    #   'top_10_ips': [...],
    #   'protocol_breakdown': [...],
    #   'packets_per_minute': [...],
    #   'total_packets': int,
    #   'average_packet_size': float,
    #   'recent_packets': [...],
    #   'active_hosts': int
    # }
    return get_all_stats(session_id, limit)


@app.get('/packets/{session_id}')
def get_all_packets(session_id: int):
    """Return all packets for a session in ascending timestamp order."""
    return get_packets(session_id, limit=None, desc=False)


@app.get('/export/{session_id}/csv')
def export_session_csv(session_id: int):
    """Download all packets for a session as a CSV file."""
    try: 
        data, filename = export_csv(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=data,
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@app.get('/export/{session_id}/excel')
def export_session_excel(session_id: int):
    """Download all packets for a session as an Excel (.xlsx) file."""
    try:
        data, filename = export_excel(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return Response(
        content=data,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


# Web socket for live dashboard updates
@app.websocket('/ws/{session_id}')
async def websocket_endpoint(ws: WebSocket, session_id: int, limit: int = 18):
    try:
        await ws.accept()
        print(f'WebSocket accepted for session {session_id}')
        while True:
            await ws.send_json(get_all_stats(session_id, limit))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print(f'WebSocket disconnected for session {session_id}')
        if get_capture_status():
            stop_capture()
    except Exception as e:
        print(f"WebSocket error: {e}")
        if get_capture_status():
            stop_capture()
        await ws.close()