"""
config.py

Configuration: loads environment variables and sets defaults.
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Base directory of this file
_BASE_DIR = os.path.dirname(os.path.abspath(__file__)) 

# Default database path (relative to project root)
_DEFAULT_DB = os.path.normpath(os.path.join(_BASE_DIR, '..', '..', 'netanalyzer.db'))

# Configuration constants (can be overridden via environment)
DB_PATH = os.getenv('DB_PATH', _DEFAULT_DB)
CAPTURE_INTERFACE = os.getenv('CAPTURE_INTERFACE', 'Wi-Fi')
CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:8000').split(',')