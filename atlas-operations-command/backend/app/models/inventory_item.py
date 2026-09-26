from sqlalchemy import Column, String, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class InventoryItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "inventory_items"

    company_id = Column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    factory_id = Column(ForeignKey("factories.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Numeric(10, 2), nullable=False)
    value = Column(Numeric(15, 2), nullable=False)
    status = Column(String(50), nullable=False, default="active")

    company = relationship("Company")
    factory = relationship("Factory", back_populates="inventory_items")
    product = relationship("Product")
