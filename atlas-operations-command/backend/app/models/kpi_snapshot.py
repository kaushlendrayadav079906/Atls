from sqlalchemy import Column, String, ForeignKey, Numeric, Date
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class KpiSnapshot(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "kpi_snapshots"

    company_id = Column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    factory_id = Column(ForeignKey("factories.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False, index=True)
    metric_name = Column(String(100), nullable=False, index=True)
    metric_value = Column(Numeric(15, 2), nullable=False)

    company = relationship("Company")
    factory = relationship("Factory", back_populates="kpi_snapshots")
