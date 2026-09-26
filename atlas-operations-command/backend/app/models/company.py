from sqlalchemy import Column, String, Integer, CheckConstraint, Numeric
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class Company(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "companies"

    name = Column(String(255), nullable=False)
    currency_code = Column(String(3), nullable=False)
    region = Column(String(100), nullable=False)
    fiscal_year_start_month = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, default="active")

    # Phase 7A Localization & Tax Configuration fields
    country_code = Column(String(2), nullable=True)
    timezone = Column(String(50), nullable=False, default="UTC")
    locale = Column(String(20), nullable=False, default="en-US")
    state_code = Column(String(10), nullable=True)
    gstin = Column(String(15), nullable=True)
    tax_id = Column(String(50), nullable=True)
    default_tax_rate = Column(Numeric(5, 2), nullable=False, default=0.00)

    __table_args__ = (
        CheckConstraint('fiscal_year_start_month BETWEEN 1 AND 12', name='ck_companies_fiscal_year_start_month'),
        CheckConstraint("status IN ('active', 'inactive')", name='ck_companies_status'),
    )
    users = relationship("User", back_populates="company", cascade="all, delete-orphan")
    roles = relationship("Role", back_populates="company", cascade="all, delete-orphan")

