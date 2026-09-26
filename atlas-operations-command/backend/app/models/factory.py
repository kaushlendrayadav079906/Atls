from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class Factory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "factories"

    company_id = Column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="active")

    company = relationship("Company")
    inventory_items = relationship("InventoryItem", back_populates="factory", cascade="all, delete-orphan")
    financial_transactions = relationship("FinancialTransaction", back_populates="factory", cascade="all, delete-orphan")
    kpi_snapshots = relationship("KpiSnapshot", back_populates="factory", cascade="all, delete-orphan")
