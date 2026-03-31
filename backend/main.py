"""
main.py
───────────────────────────────────────────────────────────────────────────────
FastAPI application entry-point for NETAnalyzer.

Port strategy
─────────────
DEV  mode  Run the Vite dev-server (npm run dev, port 5173) alongside
           uvicorn (port 8000).  The Vite proxy in vite.config.js forwards
           API requests to 8000, so the browser only sees port 5173.

PROD mode  Build the frontend once:
               cd frontend && npm run build
           Then start FastAPI alone:
               uvicorn main:app --host 0.0.0.0 --port 8000
           FastAPI serves the React SPA from /backend/static/ and handles
           all /sessions, /capture, /network, /ai requests on the same
           port — no CORS, no proxy, one URL.

The static-file mount is skipped automatically if the build directory does
not exist (i.e. during development), so no code change is needed between
the two modes.
───────────────────────────────────────────────────────────────────────────────
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.config import CORS_ORIGINS
from routers import sessions, capture, network, websocket, ai_analysis

# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="NETAnalyzer",
    description="Live network packet capture, analysis, and anomaly detection.",
    version="1.0.0",
)

# ── CORS (only meaningful in DEV when Vite runs on a separate port) ───────────

_DEFAULT_CORS_ORIGINS = [
    'http://localhost:5173', 
    'http://127.0.0.1:5173',
]

app.add_middleware(
    CORSMiddleware,
    allow_origins= CORS_ORIGINS or _DEFAULT_CORS_ORIGINS,
    allow_methods=['*'],
    allow_headers=['*'],
)

# ── API routers ───────────────────────────────────────────────────────────────

# Session-scoped resources (all prefixed with /sessions/{id}/…)
app.include_router(sessions.router,  prefix='/sessions',  tags=['sessions'])
app.include_router(websocket.router, prefix='/sessions',  tags=['websocket'])

# Standalone resources
app.include_router(capture.router,   prefix='/capture',   tags=['capture'])
app.include_router(network.router,   prefix='/network',   tags=['network'])
app.include_router(ai_analysis.router,  prefix='/ai',        tags=['ai'])

# ── Static frontend (PROD only) ───────────────────────────────────────────────
# The React build is emitted to backend/static/ by `npm run build`.
# We mount it *after* the API routers so API paths always win.

_STATIC_DIR = Path(__file__).parent / "static"

if _STATIC_DIR.is_dir():
    # Serve JS/CSS/image assets under /assets (Vite's default chunk dir)
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="assets")

    # Serve any other static file that exists (favicon, etc.)
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static-root")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """
        Catch-all that returns index.html for any path that isn't an API
        route or a real static file.  This is the standard SPA pattern so
        client-side routing works after a hard refresh.
        """
        index = _STATIC_DIR / "index.html"
        if index.is_file():
            return FileResponse(index)
        # Fallback: 404 if somehow no build exists
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Frontend build not found.")

