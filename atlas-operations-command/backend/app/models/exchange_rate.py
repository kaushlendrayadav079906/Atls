from sqlalchemy import Column, String, ForeignKey, Numeric, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class ExchangeRate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exchange_rates"

    company_id = Column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    from_currency = Column(String(3), nullable=False, index=True)
    to_currency = Column(String(3), nullable=False, index=True)
    rate = Column(Numeric(12, 6), nullable=False)
    effective_date = Column(Date, nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint('company_id', 'from_currency', 'to_currency', 'effective_date', name='uq_exchange_rates_company_pair_date'),
    )

    company = relationship("Company")
