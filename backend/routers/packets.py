from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from db.packets import get_packets
from services.export import export_csv, export_excel

router = APIRouter()

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