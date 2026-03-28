from fastapi import APIRouter
from db.alerts import get_alerts

router = APIRouter()


@router.get('/{session_id}/alerts')
def list_alerts(session_id: int):
    return get_alerts(session_id)
