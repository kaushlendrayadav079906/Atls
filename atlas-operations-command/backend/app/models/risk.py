from sqlalchemy import Column, String, ForeignKey, Numeric, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin
from datetime import datetime, timezone


class Risk(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "risks"

    company_id = Column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    severity = Column(String(50), nullable=False, index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    category = Column(String(100), nullable=False, index=True)  # Financial, Operational, Supply, Procurement, Logistics
    likelihood_pct = Column(Numeric(5, 2), nullable=False, default=0.0)
    financial_impact = Column(Numeric(15, 2), nullable=False, default=0.0)
    department = Column(String(100), nullable=False, default="Operations")
    status = Column(String(50), nullable=False, default="active", index=True)  # active, mitigated, resolved
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    company = relationship("Company")


class AiRecommendedAction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_recommended_actions"

    company_id = Column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    severity = Column(String(50), nullable=False, index=True)  # CRITICAL, HIGH, MEDIUM, LOW
    category = Column(String(100), nullable=False, index=True)  # Procurement, Logistics, Inventory, Vendor Mgmt, Finance
    description = Column(Text, nullable=False)
    cta_label = Column(String(100), nullable=False)  # Initiate Supplier Switch, Reroute Now, Raise Stock Order, Schedule Review
    status = Column(String(50), nullable=False, default="pending", index=True)  # pending, completed, dismissed
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    company = relationship("Company")


class ExecutiveBriefing(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "executive_briefings"

    company_id = Column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    generated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    summary_text = Column(Text, nullable=False)
    critical_issues = Column(JSON, nullable=False, default=list)
    business_impact = Column(JSON, nullable=False, default=list)
    priority_actions = Column(JSON, nullable=False, default=list)

    company = relationship("Company")
