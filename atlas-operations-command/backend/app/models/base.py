import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, text
from sqlalchemy import Uuid
from sqlalchemy.orm import declarative_mixin

@declarative_mixin
class UUIDMixin:
    """
    Mixin to add a UUID primary key to a model.
    Uses python uuid4 for client-side generation.
    """
    id = Column(
        Uuid(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )

@declarative_mixin
class TimestampMixin:
    """
    Mixin to add timezone-aware created_at and updated_at timestamps.
    Defaults to UTC time.
    """
    created_at = Column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        server_default=text("CURRENT_TIMESTAMP"), 
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc), 
        server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"), 
        nullable=False
    )
