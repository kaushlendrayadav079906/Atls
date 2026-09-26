
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class Role(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "roles"

    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)

    company = relationship("Company", back_populates="roles")
    user_roles = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('company_id', 'name', name='uq_roles_company_name'),
    )
