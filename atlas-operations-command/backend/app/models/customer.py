from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class Customer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "customers"

    company_id = Column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="active")

    company = relationship("Company")
