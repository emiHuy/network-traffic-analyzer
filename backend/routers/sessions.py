from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from db.sessions import create_session, get_all_sessions, delete_session
from db.packets import get_packets
from services.export import export_csv, export_excel
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


@router.get('/{session_id}/packets')
def list_packets(session_id: int, limit: int = None, order: str = 'desc'):
    desc = order != 'asc'
    return get_packets(session_id, limit=limit, desc=desc)


@router.get('/{session_id}/packets/export')
def export_packets(session_id: int, format: str = 'csv'):
    try:
        if format == 'excel':
            data, filename = export_excel(session_id)
            media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        else:
            data, filename = export_csv(session_id)
            media_type = 'text/csv'
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return Response(
        content=data,
        media_type=media_type,
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )