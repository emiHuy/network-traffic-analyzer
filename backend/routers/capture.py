from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.capture import start, stop, get_status

router = APIRouter()


class CaptureCreate(BaseModel):
    session_id: int


@router.get('/')
def capture_status():
    return {'active_session': get_status()}


@router.post('/', status_code=201)
def start_capture(body: CaptureCreate):
    try:
        return start(body.session_id)
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete('/', status_code=200)
def stop_capture():
    try:
        return stop()
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
