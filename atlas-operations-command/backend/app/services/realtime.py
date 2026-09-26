from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.schemas.realtime import (
    RealtimeDashboardSummaryResponse,
    OperationalPulse,
    FinancialPulse,
    RiskSummaryPulse,
    RealtimeOperationalHealthResponse,
    RealtimeAlertItem,
)
from app.repositories.realtime import realtime_repository


class RealtimeService:
    def get_dashboard_summary(
        self,
        db: Session,
        company_id: UUID,
        factory_id: Optional[UUID] = None
    ) -> RealtimeDashboardSummaryResponse:
        """
        Synthesize comprehensive real-time dashboard metrics using fast SQL aggregations.
        STRICT RULE: This method MUST NOT invoke Gemini or trigger AI analysis.
        """
        now = datetime.now(timezone.utc)

        op_data = realtime_repository.get_operational_pulse(db, company_id, factory_id)
        fin_data = realtime_repository.get_financial_pulse(db, company_id, factory_id)
        risk_data = realtime_repository.get_risk_summary(db, company_id)
        pending_actions = realtime_repository.get_pending_actions_count(db, company_id)
        briefing_time = realtime_repository.get_latest_briefing_timestamp(db, company_id)

        # Operational health status
        health_pct = op_data["operational_health_pct"]
        if health_pct < 60.0 or risk_data["critical_count"] > 0:
            system_status = "DEGRADED"
        elif health_pct < 80.0 or risk_data["high_count"] > 1:
            system_status = "WARNING"
        else:
            system_status = "OPERATIONAL"

        data_version = now.strftime("%Y%m%d-%H%M%S")

        return RealtimeDashboardSummaryResponse(
            company_id=company_id,
            timestamp=now,
            system_status=system_status,
            operational_pulse=OperationalPulse(**op_data),
            financial_pulse=FinancialPulse(**fin_data),
            risk_summary=RiskSummaryPulse(**risk_data),
            pending_actions_count=pending_actions,
            latest_briefing_timestamp=briefing_time,
            data_version=data_version,
        )

    def get_operational_health(
        self,
        db: Session,
        company_id: UUID
    ) -> RealtimeOperationalHealthResponse:
        """
        Ultra-lightweight operational pulse endpoint for live dashboard status badges.
        STRICT RULE: This method MUST NOT invoke Gemini.
        """
        op_data = realtime_repository.get_operational_pulse(db, company_id)
        risk_data = realtime_repository.get_risk_summary(db, company_id)
        last_sync = realtime_repository.get_last_data_sync_timestamp(db, company_id)

        health_pct = op_data["operational_health_pct"]
        critical_alerts = risk_data["critical_count"]

        if critical_alerts > 0 or health_pct < 50.0:
            status = "CRITICAL"
        elif health_pct < 85.0 or risk_data["high_count"] > 0:
            status = "DEGRADED"
        else:
            status = "HEALTHY"

        return RealtimeOperationalHealthResponse(
            status=status,
            active_plants=op_data["active_factories"],
            total_plants=op_data["total_factories"],
            active_critical_alerts=critical_alerts,
            last_data_sync=last_sync,
        )

    def get_alerts(
        self,
        db: Session,
        company_id: UUID,
        severity: Optional[str] = None,
        limit: int = 10
    ) -> List[RealtimeAlertItem]:
        """
        Fetch active alerts for top-bar bell notifications.
        STRICT RULE: Read-only query over persisted risk records. Zero AI invocation.
        """
        risks = realtime_repository.get_active_alerts(
            db=db,
            company_id=company_id,
            severity=severity,
            limit=limit
        )

        return [
            RealtimeAlertItem(
                id=r.id,
                title=r.title,
                severity=r.severity,
                category=r.category,
                financial_impact=float(r.financial_impact or 0.0),
                department=r.department,
                created_at=r.created_at,
            )
            for r in risks
        ]


realtime_service = RealtimeService()
