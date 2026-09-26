import asyncio
import logging
import uuid
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.risk import Risk, AiRecommendedAction, ExecutiveBriefing
from app.repositories.risk import risk_persistence_repository
from app.services.ai_risk_service import ai_risk_service
from app.services.recommendation_engine import recommendation_engine
from app.services.executive_briefing import executive_briefing_service
from app.schemas.risk import AIAnalysisJobResponse
from app.integrations.ai.base import BaseAIProvider

logger = logging.getLogger(__name__)


class AIAnalysisWorkflowService:
    """Manages asynchronous AI analysis jobs, persistence pipelines, and status tracking."""

    def __init__(self):
        # In-memory job state store for lightweight async tracking (company-scoped)
        self._jobs: Dict[str, Dict[str, Any]] = {}

    def start_analysis_job(
        self,
        company_id: UUID,
        factory_id: Optional[UUID] = None,
        provider: Optional[BaseAIProvider] = None,
        db: Optional[Session] = None,
    ) -> AIAnalysisJobResponse:
        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "company_id": str(company_id),
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "completed_at": None,
            "error": None,
            "result_summary": None,
        }
        self._jobs[job_id] = job_data

        # Launch background task execution
        asyncio.create_task(self._execute_analysis(job_id, company_id, factory_id, provider, db))

        return AIAnalysisJobResponse(
            job_id=job_id,
            status="pending",
            created_at=job_data["created_at"],
        )

    def get_job_status(self, job_id: str, company_id: UUID) -> Optional[AIAnalysisJobResponse]:
        job_data = self._jobs.get(job_id)
        if not job_data or job_data["company_id"] != str(company_id):
            return None

        return AIAnalysisJobResponse(
            job_id=job_data["job_id"],
            status=job_data["status"],
            created_at=job_data["created_at"],
            completed_at=job_data.get("completed_at"),
            error=job_data.get("error"),
            result_summary=job_data.get("result_summary"),
        )

    async def _execute_analysis(
        self,
        job_id: str,
        company_id: UUID,
        factory_id: Optional[UUID] = None,
        provider: Optional[BaseAIProvider] = None,
        db_override: Optional[Session] = None,
    ) -> None:
        self._jobs[job_id]["status"] = "running"
        owns_db = db_override is None
        db: Session = db_override if db_override is not None else SessionLocal()
        try:
            # 1. Pipeline 1: Risk Prediction Engine (Multi-domain evaluation)
            risk_result = await ai_risk_service.evaluate_risk(
                db=db, company_id=company_id, factory_id=factory_id, provider=provider
            )

            # Persist active Risk records
            persisted_risk_count = 0
            for factor in risk_result.risk_factors:
                category_map = {
                    "financial": "Financial",
                    "operational": "Operational",
                    "supply": "Supply",
                }
                dept_map = {
                    "financial": "Finance",
                    "operational": "Plant Operations",
                    "supply": "Supply Chain",
                }
                risk_entry = Risk(
                    company_id=company_id,
                    title=f"{factor.metric_name.replace('_', ' ').title()} Alert",
                    severity=factor.severity,
                    category=category_map.get(factor.domain.lower(), "Operations"),
                    likelihood_pct=85.0 if factor.severity in ("CRITICAL", "HIGH") else 50.0,
                    financial_impact=abs(factor.value * 1000.0) if factor.domain == "financial" else 150000.0,
                    department=dept_map.get(factor.domain.lower(), "Operations"),
                    status="active",
                )
                risk_persistence_repository.create_risk(db, risk_entry)
                persisted_risk_count += 1

            # 2. Pipeline 2: Recommended Actions Generator
            recs = recommendation_engine.generate_deterministic_recommendations(
                financial=risk_result.financial,
                operational=risk_result.operational,
                supply=risk_result.supply,
                limit=10,
            )

            persisted_action_count = 0
            for r in recs:
                cta_map = {
                    "FINANCIAL": "Rebalance Budget",
                    "OPERATIONAL": "Schedule Maintenance",
                    "SUPPLY": "Initiate Supplier Switch" if "Vendor" in r.title else "Raise Stock Order",
                    "STRATEGIC": "Schedule Review",
                }
                cat_map = {
                    "FINANCIAL": "Finance",
                    "OPERATIONAL": "Plant Operations",
                    "SUPPLY": "Logistics" if "Delivery" in r.title else "Procurement",
                    "STRATEGIC": "Vendor Mgmt",
                }
                action_entry = AiRecommendedAction(
                    company_id=company_id,
                    title=r.title,
                    severity=r.priority,
                    category=cat_map.get(r.domain.upper(), "Operations"),
                    description=r.description,
                    cta_label=cta_map.get(r.domain.upper(), "Review Now"),
                    status="pending",
                )
                risk_persistence_repository.create_action(db, action_entry)
                persisted_action_count += 1

            # 3. Pipeline 3: Executive Briefing Generator
            briefing_resp = await executive_briefing_service.generate_briefing(
                db=db, company_id=company_id, provider=provider
            )

            # Build JSON structures for critical issues, business impact, priority actions
            critical_issues = [
                {
                    "title": f.metric_name.replace("_", " ").title(),
                    "severity": f.severity,
                    "explanation": f.explanation,
                }
                for f in risk_result.risk_factors if f.severity in ("CRITICAL", "HIGH")
            ]

            business_impact = [
                f"{factor.domain.capitalize()} risk exposure at {factor.severity} severity due to {factor.metric_name}."
                for factor in risk_result.risk_factors
            ]
            if not business_impact:
                business_impact.append("Operations operating within stable parameters across all core domains.")

            priority_actions = [
                {
                    "title": r.title,
                    "priority": r.priority,
                    "description": r.description,
                }
                for r in recs[:3]
            ]

            briefing_entry = ExecutiveBriefing(
                company_id=company_id,
                generated_at=datetime.now(timezone.utc),
                summary_text=briefing_resp.executive_summary,
                critical_issues=critical_issues,
                business_impact=business_impact,
                priority_actions=priority_actions,
            )
            risk_persistence_repository.create_briefing(db, briefing_entry)

            db.commit()

            # Update job state
            self._jobs[job_id]["status"] = "completed"
            self._jobs[job_id]["completed_at"] = datetime.now(timezone.utc)
            self._jobs[job_id]["result_summary"] = {
                "overall_score": risk_result.overall_score,
                "overall_severity": risk_result.overall_severity,
                "persisted_risks": persisted_risk_count,
                "persisted_actions": persisted_action_count,
                "briefing_id": str(briefing_entry.id),
                "ai_enriched": risk_result.ai_enriched,
            }
        except Exception as e:
            db.rollback()
            logger.exception(f"AI analysis job {job_id} failed: {e}")
            self._jobs[job_id]["status"] = "failed"
            self._jobs[job_id]["completed_at"] = datetime.now(timezone.utc)
            self._jobs[job_id]["error"] = "AI analysis workflow encountered an error."
        finally:
            if owns_db:
                db.close()


ai_analysis_workflow_service = AIAnalysisWorkflowService()
