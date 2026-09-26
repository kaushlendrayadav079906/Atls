from app.core.config import settings
from app.core.database import SessionLocal

def test_config_loading():
    assert settings.APP_ENV in ["development", "test", "production"]
    assert settings.DATABASE_URL is not None
    assert settings.SECRET_KEY is not None

def test_db_session_creation():
    db = SessionLocal()
    assert db is not None
    db.close()
