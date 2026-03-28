from fastapi import APIRouter
from pydantic import BaseModel
from db.sessions import create_session, get_all_sessions, delete_session
from services.stats import get_all_stats

router = APIRouter()

class SessionCreate(BaseModel):
    name: str


@router.get('/')
def list_sessions():
    return get_all_sessions()


@router.post('/', status_code=201)
def new_session(body: SessionCreate):
    session_id = create_session(body.name)
    return {'session_id': session_id, 'name': body.name}


@router.delete('/{session_id}', status_code=204)
def remove_session(session_id: int):
    delete_session(session_id)


@router.get('/{session_id}/stats')
def get_stats(session_id: int, limit: int = 18):
    return get_all_stats(session_id, limit)
