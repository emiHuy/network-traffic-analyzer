from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import CORS_ORIGINS
from routers import sessions, packets, capture, devices, alerts, network, websocket, ai_analysis

app = FastAPI()

_DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

app.add_middleware(
    CORSMiddleware,
    allow_origins= CORS_ORIGINS or _DEFAULT_CORS_ORIGINS,
    allow_methods=['*'],
    allow_headers=['*'],
)

# session-scoped resources
app.include_router(sessions.router,  prefix='/sessions',  tags=['sessions'])
app.include_router(packets.router,  prefix='/sessions',  tags=['packets'])
app.include_router(devices.router,   prefix='/sessions',  tags=['devices'])
app.include_router(alerts.router,    prefix='/sessions',  tags=['alerts'])
app.include_router(websocket.router, prefix='/sessions',  tags=['websocket'])

# standalone resources
app.include_router(capture.router,   prefix='/capture',   tags=['capture'])
app.include_router(network.router,   prefix='/network',   tags=['network'])
app.include_router(ai_analysis.router,  prefix='/ai',        tags=['ai'])

