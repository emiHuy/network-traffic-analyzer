from fastapi import APIRouter
from services.topology import get_topology, run_scan

router = APIRouter()


@router.get('/devices')
def get_live_devices():
    return get_topology()


@router.post('/scan', status_code=201)
def trigger_scan():
    return run_scan()
