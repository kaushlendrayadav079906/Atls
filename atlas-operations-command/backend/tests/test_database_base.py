from sqlalchemy import Column, String
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

def test_metadata_naming_conventions():
    """Verify that MetaData contains the correct naming conventions."""
    conventions = Base.metadata.naming_convention
    assert conventions["ix"] == "ix_%(column_0_label)s"
    assert conventions["fk"] == "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"

def test_mixins_presence():
    """Verify that mixins are available and contain expected columns."""
    class DummyModel(Base, UUIDMixin, TimestampMixin):
        __tablename__ = "dummy_model"
        name = Column(String)

    columns = DummyModel.__table__.columns
    assert "id" in columns
    assert "created_at" in columns
    assert "updated_at" in columns
