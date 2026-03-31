"""
routers/network.py

Endpoints for network device discovery and topology retrieval.
"""

from fastapi import APIRouter
from services.topology import get_topology, run_scan

router = APIRouter()


@router.get('/devices')
def get_live_devices():
    """
    Return the current in-memory device list from the passive ARP sniffer.
    Returns: { subnet, source: 'live', nodes: [{ ip, mac, manufacturer, ... }] }
    """
    return get_topology()


@router.post('/scan', status_code=201)
def trigger_scan():
    """
    Trigger an active ARP scan of the detected /24 subnet (~2 s blocking).
    Returns: { subnet, nodes_found: int, nodes: [{ ip, mac, manufacturer, ... }] }
    """
    return run_scan()
