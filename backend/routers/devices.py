from fastapi import APIRouter
from services.topology import get_topology

router = APIRouter()


@router.get('/{session_id}/devices')
def get_devices(session_id: int):
    return get_topology(session_id)
