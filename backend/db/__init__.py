from sqlalchemy import create_engine
from core.config import DB_PATH
from db.models import metadata

engine = create_engine(f'sqlite:///{DB_PATH}')

metadata.create_all(engine)