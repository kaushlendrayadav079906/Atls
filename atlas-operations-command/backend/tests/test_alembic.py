import os
import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

def test_alembic_config_loads():
    """Verify that Alembic can load its configuration."""
    alembic_ini_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")
    assert os.path.exists(alembic_ini_path)
    
    config = Config(alembic_ini_path)
    script_location = config.get_main_option("script_location")
    assert script_location is not None
    assert script_location.endswith("migrations")

def test_alembic_migration_environment():
    """Verify that Alembic can locate the migration environment."""
    alembic_ini_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")
    config = Config(alembic_ini_path)
    
    # Needs a real absolute path for ScriptDirectory
    script_location = config.get_main_option("script_location")
    assert script_location is not None
    if script_location.startswith("%(here)s"):
        script_location = script_location.replace("%(here)s", os.path.dirname(alembic_ini_path))
    
    config.set_main_option("script_location", script_location)
    
    script = ScriptDirectory.from_config(config)
    assert script is not None
    assert os.path.exists(script.versions)

def test_alembic_metadata_access():
    """Verify that Alembic can access SQLAlchemy metadata."""
    # env.py imports settings and Base. We can just test that Base is accessible.
    from app.core.database import Base
    assert Base.metadata is not None
