from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from stats import get_all_stats
from capture import start_capture, stop_capture, get_capture_status
from store import create_session, clear_session, get_all_sessions

app = FastAPI()

# Allow frontent to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173'],
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
    # Result format: [{'id': 1, 'name': 'Test', 'created_at': '...'}, ...]
    return get_all_sessions()


@app.delete('/sessions/{session_id}')
def delete_session(session_id: int):
    """Delete a session and its packets."""
    # Result format: {'deleted': 1}
    clear_session(session_id)
    return {'deleted': session_id}


@app.get('/stats/{session_id}')
def get_stats(session_id: int, limit: int = 100):
    """Return statistics for a session."""
    # Result format:
    # {
    #   'top_10_ips': [...],
    #   'protocol_breakdown': [...],
    #   'packets_per_minute': [...],
    #   'total_packets': int,
    #   'average_packet_size': float,
    #   'recent_packets': [...]
    # }
    return get_all_stats(session_id, limit)


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


# Web socket for live dashboard updates
@app.websocket('/ws/{session_id}')
async def websocket_endpoint(ws: WebSocket, session_id: int, limit: int = 100):
    await ws.accept()
    try:
        while True:
            await ws.send_json(get_all_stats(session_id, limit))
            await asyncio.sleep(2)
    except:
        return