from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user_context
from app.schemas.auth import AuthContext
from app.schemas.realtime import (
    RealtimeDashboardSummaryResponse,
    RealtimeOperationalHealthResponse,
    RealtimeAlertItem,
)
from app.services.realtime import realtime_service

router = APIRouter(prefix="", tags=["Real-Time Dashboard"])


@router.get("/realtime/summary", response_model=RealtimeDashboardSummaryResponse)
def get_realtime_summary(
    factory_id: Optional[UUID] = Query(None, description="Optional factory ID filter"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """
    Retrieve live composite operational, financial, and risk telemetry for the authenticated company.
    Guaranteed fast read-only query (zero AI / Gemini invocations).
    """
    return realtime_service.get_dashboard_summary(
        db=db,
        company_id=auth.company_id,
        factory_id=factory_id
    )


@router.get("/realtime/operational-health", response_model=RealtimeOperationalHealthResponse)
def get_realtime_operational_health(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """
    Ultra-lightweight operational status badge endpoint for high-frequency dashboard polling.
    """
    return realtime_service.get_operational_health(
        db=db,
        company_id=auth.company_id
    )


@router.get("/realtime/alerts", response_model=List[RealtimeAlertItem])
def get_realtime_alerts(
    severity: Optional[str] = Query(None, description="Filter alerts by severity (CRITICAL, HIGH, MEDIUM, LOW)"),
    limit: int = Query(10, ge=1, le=50, description="Max number of alerts to return"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """
    Retrieve active critical notification alerts for top navigation and alert drawers.
    """
    return realtime_service.get_alerts(
        db=db,
        company_id=auth.company_id,
        severity=severity,
        limit=limit
    )
