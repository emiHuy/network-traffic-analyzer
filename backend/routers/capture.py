"""
routers/capture.py

Endpoints for starting, stopping, and checking the status of packet capture.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.capture import start, stop, get_status

router = APIRouter()


class CaptureCreate(BaseModel):
    session_id: int


@router.get('/')
def capture_status():
    """
    Return the currently active capture session, if any.
    """
    return {'active_session': get_status()}


@router.post('/', status_code=201)
def start_capture(body: CaptureCreate):
    """
    Start packet capture for the given session.
    Returns: { start_timestamp: str }

    Raises:
        409 if a capture is already running, or the session already has data
    """
    try:
        return start(body.session_id)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete('/', status_code=200)
def stop_capture():
    """
    Stop the active packet capture.
    Returns: { stop_timestamp: str, session_id: int }

    Raises:
        409 if no capture is currently running
    """
    try:
        return stop()
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
