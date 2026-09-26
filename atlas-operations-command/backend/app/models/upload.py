from sqlalchemy import Column, String, Integer, Text, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class FileUpload(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "file_uploads"

    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by_user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    file_type = Column(String(50), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_hash = Column(String(64), nullable=False)
    
    status = Column(String(50), nullable=False, default="uploaded")
    error_message = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint('company_id', 'file_hash', name='uq_company_file_hash'),
    )
