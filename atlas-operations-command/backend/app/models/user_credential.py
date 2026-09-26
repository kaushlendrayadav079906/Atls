from sqlalchemy import Column, String, ForeignKey, Uuid
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class UserCredential(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "user_credentials"

    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)

    user = relationship("User", back_populates="credential")
