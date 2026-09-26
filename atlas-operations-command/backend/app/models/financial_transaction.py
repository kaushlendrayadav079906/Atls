from sqlalchemy import Column, String, ForeignKey, Numeric, Date, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class FinancialTransaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "financial_transactions"

    company_id = Column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    factory_id = Column(ForeignKey("factories.id", ondelete="CASCADE"), nullable=True, index=True)
    transaction_date = Column(Date, nullable=False, index=True)
    transaction_type = Column(String(50), nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    currency_code = Column(String(3), nullable=False)
    description = Column(String(255), nullable=True)
    
    # Phase 7A Multi-Currency and Tax metadata fields
    amount_base = Column(Numeric(15, 2), nullable=False, default=0.00)
    exchange_rate = Column(Numeric(12, 6), nullable=False, default=1.000000)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    is_tax_inclusive = Column(Boolean, nullable=False, default=False)
    hsn_sac_code = Column(String(20), nullable=True)

    customer_id = Column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    vendor_id = Column(ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True, index=True)
    product_id = Column(ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    company = relationship("Company")
    factory = relationship("Factory", back_populates="financial_transactions")
    customer = relationship("Customer")
    vendor = relationship("Vendor")
    product = relationship("Product")

