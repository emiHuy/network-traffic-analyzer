from network_scan import active_scan, get_devices, clear_devices, get_subnet
from db.devices import load_devices, has_devices

def get_topology(session_id: int | None = None) -> dict:
    if session_id:
        if has_devices(session_id):
            return {
                'subnet': get_subnet(),
                'source': 'snapshot',
                'nodes':  load_devices(session_id),
            }
        return {
            'subnet': get_subnet(),
            'source': 'empty',
            'nodes':  [],
        }

    return {
        'subnet': get_subnet(),
        'source': 'live',
        'nodes':  get_devices(),
    }


def run_scan() -> dict:
    clear_devices()
    nodes = active_scan(get_subnet())
    return {
        'subnet':      get_subnet(),
        'nodes_found': len(nodes),
        'nodes':       nodes,
    }
