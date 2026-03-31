"""
services/topology.py
───────────────────────────────────────────────────────────────────────────────
Network topology service layer.

Responsibilities
────────────────
• get_topology(session_id)
    Return a network topology snapshot:
        - From a saved session (if available)
        - Empty if session exists but has no devices
        - Live in-memory state if no session is provided

• run_scan()
    Perform an active network scan on the current subnet and
    return discovered devices.

This layer abstracts:
    - Live device tracking (network_scan)
    - Persisted device snapshots (db.devices)
───────────────────────────────────────────────────────────────────────────────
"""

from services.network_scan import active_scan, get_devices, clear_devices, get_subnet
from db.devices import load_devices, has_devices

def get_topology(session_id: int | None = None) -> dict:
    """
    Retrieve network topology data.

    Returns
    ───────
    dict
        {
            'subnet': str,
            'source': 'snapshot' | 'empty' | 'live',
            'nodes':  list
        }
    """
    # If session is requested, attempt to load persisted topology
    if session_id:
        if has_devices(session_id):
            # Snapshot exists -> return stored device map
            return {
                'subnet': get_subnet(),
                'source': 'snapshot',
                'nodes':  load_devices(session_id),
            }
        # Session exists but no devices were recorded
        return {
            'subnet': get_subnet(),
            'source': 'empty',
            'nodes':  [],
        }

    # No session specified -> return live topology from memory
    return {
        'subnet': get_subnet(),
        'source': 'live',
        'nodes':  get_devices(),
    }


def run_scan() -> dict:
    """
    Perform an active network scan.

    Returns
    ───────
    dict
        {
            'subnet': str,
            'nodes_found': int,
            'nodes': list
        }
    """
    # Clear any previously discovered devices (in-memory state)
    clear_devices()

    # Scan current subnet for active hosts
    nodes = active_scan(get_subnet())

    # Return the discovered nodes and metadata
    return {
        'subnet':      get_subnet(),
        'nodes_found': len(nodes),
        'nodes':       nodes,
    }
