import os
from dotenv import load_dotenv

load_dotenv()

_BASE_DIR = os.path.dirname(os.path.abspath(__file__)) 
_DEFAULT_DB = os.path.normpath(os.path.join(_BASE_DIR, '..', '..', 'netanalyzer.db'))

DB_PATH = os.getenv('DB_PATH', _DEFAULT_DB)
CAPTURE_INTERFACE = os.getenv('CAPTURE_INTERFACE', 'Wi-Fi')
CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')