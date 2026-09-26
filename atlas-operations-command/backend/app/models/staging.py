from sqlalchemy import Column, String, Text, ForeignKey, JSON, Uuid
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class StagedRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "staged_records"

    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    upload_id = Column(Uuid(as_uuid=True), ForeignKey("file_uploads.id", ondelete="CASCADE"), nullable=False, index=True)
    
    target_entity = Column(String(50), nullable=True) # E.g., 'FinancialTransaction'
    raw_data = Column(JSON, nullable=False)
    status = Column(String(50), nullable=False, default="pending") # pending, imported, error
    error_message = Column(Text, nullable=True)
