from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user_context
from app.api.rbac import RequireRole
from app.schemas.auth import AuthContext
from app.schemas.risk import (
    RiskAnalysisResponse,
    RecommendationResponse,
    ExecutiveBriefingResponse,
    RiskEvaluateRequest,
    RiskItemResponse,
    AiActionItemResponse,
    ExecutiveBriefingEntityResponse,
    AIAnalysisJobResponse,
)
from app.repositories.risk import risk_persistence_repository
from app.services.ai_risk_service import ai_risk_service
from app.services.recommendation_engine import recommendation_engine
from app.services.executive_briefing import executive_briefing_service
from app.services.ai_analysis_workflow import ai_analysis_workflow_service

router = APIRouter(prefix="", tags=["AI & Risk Intelligence"])


# ============================================================================
# 1. On-demand Risk Intelligence (Discovery Specs)
# ============================================================================

@router.get("/ai/risk-analysis", response_model=RiskAnalysisResponse)
async def get_risk_analysis(
    factory_id: Optional[UUID] = Query(None, description="Optional factory ID filter"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """Retrieve multi-domain risk evaluation and composite score for the authenticated company."""
    return await ai_risk_service.evaluate_risk(
        db=db, company_id=auth.company_id, factory_id=factory_id
    )


@router.get("/ai/recommendations", response_model=List[RecommendationResponse])
async def get_recommendations(
    limit: int = Query(5, ge=1, le=50, description="Max number of recommendations"),
    domain: Optional[str] = Query(None, description="Filter by domain (e.g. FINANCIAL, OPERATIONAL, SUPPLY)"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """Retrieve prioritized, actionable risk mitigation recommendations."""
    risk_res = await ai_risk_service.evaluate_risk(db=db, company_id=auth.company_id)
    return recommendation_engine.generate_deterministic_recommendations(
        financial=risk_res.financial,
        operational=risk_res.operational,
        supply=risk_res.supply,
        limit=limit,
        domain_filter=domain,
    )


@router.get("/ai/briefing", response_model=ExecutiveBriefingResponse)
async def get_executive_briefing(
    year: Optional[int] = Query(None, description="Optional fiscal year filter"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Optional month filter"),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """Generate comprehensive executive risk and operational intelligence briefing."""
    return await executive_briefing_service.generate_briefing(
        db=db, company_id=auth.company_id, year=year, month=month
    )


@router.post("/ai/risk-analysis/evaluate", response_model=RiskAnalysisResponse)
async def evaluate_risk_analysis(
    payload: RiskEvaluateRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(RequireRole("admin")),
):
    """Admin-only endpoint to trigger an explicit fresh risk analysis evaluation."""
    return await ai_risk_service.evaluate_risk(
        db=db, company_id=auth.company_id, factory_id=payload.factory_id
    )


# ============================================================================
# 2. Roadmap Reconciled APIs: Active Risk Register
# ============================================================================

@router.get("/risks", response_model=List[RiskItemResponse])
def get_persisted_risks(
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    status: Optional[str] = Query(None, description="Filter by status (active, mitigated, resolved)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """Retrieve persistent Active Risk Register records for the authenticated company."""
    return risk_persistence_repository.get_risks(
        db=db, company_id=auth.company_id, severity=severity, status=status, limit=limit, offset=offset
    )


# ============================================================================
# 3. Roadmap Reconciled APIs: AI Recommended Actions & Resolution
# ============================================================================

@router.get("/ai/actions", response_model=List[AiActionItemResponse])
@router.get("/ai-actions", response_model=List[AiActionItemResponse])
def get_persisted_ai_actions(
    status: Optional[str] = Query(None, description="Filter by status (pending, completed, dismissed)"),
    severity: Optional[str] = Query(None, description="Filter by severity (CRITICAL, HIGH, MEDIUM, LOW)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """Retrieve persistent AI Recommended Actions feed for the authenticated company."""
    return risk_persistence_repository.get_actions(
        db=db, company_id=auth.company_id, status=status, severity=severity, limit=limit, offset=offset
    )


@router.post("/ai/actions/{action_id}/resolve", response_model=AiActionItemResponse)
@router.post("/ai-actions/{action_id}/resolve", response_model=AiActionItemResponse)
def resolve_ai_action(
    action_id: UUID,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """Resolve an AI Recommended Action, marking it completed for the authenticated company."""
    action = risk_persistence_repository.get_action_by_id(db=db, action_id=action_id, company_id=auth.company_id)
    if not action:
        raise HTTPException(status_code=404, detail="AI Action not found or does not belong to company")

    action.status = "completed"
    action.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(action)
    return action


# ============================================================================
# 4. Roadmap Reconciled APIs: Executive Briefings
# ============================================================================

@router.get("/briefings/latest", response_model=ExecutiveBriefingEntityResponse)
def get_latest_briefing(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """Retrieve the latest persisted executive briefing for the authenticated company without calling Gemini."""
    briefing = risk_persistence_repository.get_latest_briefing(db=db, company_id=auth.company_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="No persisted executive briefing found for company")
    return briefing


@router.get("/briefings", response_model=List[ExecutiveBriefingEntityResponse])
def get_historical_briefings(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_user_context),
):
    """Retrieve historical persisted executive briefings for the authenticated company."""
    return risk_persistence_repository.get_briefings(
        db=db, company_id=auth.company_id, limit=limit, offset=offset
    )


# ============================================================================
# 5. Roadmap Reconciled APIs: Async AI Run Analysis Workflow
# ============================================================================

@router.post("/ai/run-analysis", response_model=AIAnalysisJobResponse)
async def run_ai_analysis_job(
    factory_id: Optional[UUID] = Query(None, description="Optional factory ID filter"),
    auth: AuthContext = Depends(get_current_user_context),
):
    """Trigger the multi-pipeline AI Predictive Risk Engine as an async job returning a job_id."""
    return ai_analysis_workflow_service.start_analysis_job(
        company_id=auth.company_id, factory_id=factory_id
    )


@router.get("/ai/jobs/{job_id}", response_model=AIAnalysisJobResponse)
async def get_ai_analysis_job_status(
    job_id: str,
    auth: AuthContext = Depends(get_current_user_context),
):
    """Poll status of an asynchronous AI analysis job."""
    job_status = ai_analysis_workflow_service.get_job_status(job_id=job_id, company_id=auth.company_id)
    if not job_status:
        raise HTTPException(status_code=404, detail="Job not found or does not belong to company")
    return job_status
