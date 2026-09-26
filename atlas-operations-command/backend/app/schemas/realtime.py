from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from decimal import Decimal


class OperationalPulse(BaseModel):
    total_factories: int = 0
    active_factories: int = 0
    inactive_factories: int = 0
    operational_health_pct: float = 0.0


class FinancialPulse(BaseModel):
    total_revenue: float = 0.0
    total_expenditure: float = 0.0
    net_profit: float = 0.0
    operating_margin_pct: float = 0.0


class RiskSummaryPulse(BaseModel):
    active_risk_count: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    overall_composite_score: float = 0.0
    overall_severity: str = "LOW"


class RealtimeDashboardSummaryResponse(BaseModel):
    company_id: UUID
    timestamp: datetime
    system_status: str = "OPERATIONAL"
    operational_pulse: OperationalPulse
    financial_pulse: FinancialPulse
    risk_summary: RiskSummaryPulse
    pending_actions_count: int = 0
    latest_briefing_timestamp: Optional[datetime] = None
    data_version: str


class RealtimeOperationalHealthResponse(BaseModel):
    status: str  # HEALTHY, DEGRADED, CRITICAL
    active_plants: int = 0
    total_plants: int = 0
    active_critical_alerts: int = 0
    last_data_sync: Optional[datetime] = None


class RealtimeAlertItem(BaseModel):
    id: UUID
    title: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    category: str
    financial_impact: float = 0.0
    department: Optional[str] = None
    created_at: datetime
