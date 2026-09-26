from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, CheckConstraint, Uuid
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="active")

    company = relationship("Company", back_populates="users")
    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    credential = relationship("UserCredential", back_populates="user", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (

        UniqueConstraint('company_id', 'email', name='uq_users_company_email'),
        CheckConstraint("status IN ('active', 'inactive')", name='ck_users_status'),
    )
