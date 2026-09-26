import json
import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.company import Company
from app.models.factory import Factory
from app.repositories.risk import risk_data_repository
from app.services.risk_engine import risk_engine
from app.services.ai_context import ai_context_builder
from app.integrations.ai.base import (
    BaseAIProvider,
    AIProviderError,
    AIConfigurationError,
    AIUnavailableError,
    AITimeoutError,
    AIMalformedResponseError,
)
from app.integrations.ai.factory import get_ai_provider
from app.schemas.risk import (
    RiskAnalysisResponse,
    AIQualitativeAnalysis,
    DomainRiskScore,
)

logger = logging.getLogger(__name__)


class AIRiskService:
    """Orchestrates deterministic multi-domain risk scoring and AI qualitative analysis."""

    async def evaluate_risk(
        self,
        db: Session,
        company_id: UUID,
        factory_id: Optional[UUID] = None,
        provider: Optional[BaseAIProvider] = None,
    ) -> RiskAnalysisResponse:
        # 1. Tenant & object validation
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        if factory_id:
            fac = db.query(Factory).filter(Factory.id == factory_id, Factory.company_id == company_id).first()
            if not fac:
                raise HTTPException(status_code=404, detail="Factory not found or does not belong to company")

        # 2. Extract Phase 3 domain summaries
        fin_data = risk_data_repository.get_financial_summary(db, company_id, factory_id)
        ops_data = risk_data_repository.get_operational_summary(db, company_id, factory_id)
        sup_data = risk_data_repository.get_supply_summary(db, company_id, factory_id)

        # 3. Deterministic risk calculation
        financial_score = risk_engine.evaluate_financial_risk(fin_data)
        operational_score = risk_engine.evaluate_operational_risk(ops_data)
        supply_score = risk_engine.evaluate_supply_risk(sup_data, fin_data.get("total_expenditure", 0.0))

        overall_score, overall_severity = risk_engine.calculate_overall_score(
            financial_score, operational_score, supply_score
        )

        all_risk_factors = (
            financial_score.risk_factors + operational_score.risk_factors + supply_score.risk_factors
        )

        # 4. Qualitative AI analysis (via BaseAIProvider)
        ai_enriched = False
        ai_analysis: Optional[AIQualitativeAnalysis] = None

        ai_provider = provider or get_ai_provider()

        try:
            if await ai_provider.is_available():
                ai_request = ai_context_builder.build_risk_analysis_request(
                    company_name=company.name,
                    company_region=company.region or "Unknown",
                    overall_score=overall_score,
                    overall_severity=overall_severity,
                    financial=financial_score,
                    operational=operational_score,
                    supply=supply_score,
                    risk_factors=all_risk_factors,
                )

                response = await ai_provider.generate_text(ai_request)
                ai_analysis = self._parse_ai_response(response.content)
                if ai_analysis:
                    ai_enriched = True
        except (
            AIConfigurationError,
            AITimeoutError,
            AIUnavailableError,
            AIMalformedResponseError,
            AIProviderError,
        ) as e:
            logger.warning(f"AI provider evaluation unavailable/failed: {type(e).__name__} - proceeding with deterministic results.")
        except Exception as e:
            logger.warning(f"Unexpected error during AI enrichment: {type(e).__name__} - proceeding with deterministic results.")

        return RiskAnalysisResponse(
            overall_score=overall_score,
            overall_severity=overall_severity,
            financial=financial_score,
            operational=operational_score,
            supply=supply_score,
            risk_factors=all_risk_factors,
            ai_enriched=ai_enriched,
            ai_qualitative_analysis=ai_analysis,
            generated_at=datetime.now(timezone.utc)
        )

    def _parse_ai_response(self, content: str) -> Optional[AIQualitativeAnalysis]:
        """Safely parses JSON string into AIQualitativeAnalysis Pydantic model."""
        if not content or not content.strip():
            return None

        # Clean potential markdown fences ```json ... ```
        cleaned = content.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            data = json.loads(cleaned)
            if not isinstance(data, dict):
                return None
            return AIQualitativeAnalysis(
                executive_summary=str(data.get("executive_summary", ""))[:1500],
                primary_vulnerability=str(data.get("primary_vulnerability", ""))[:500],
                key_observations=[str(o)[:200] for o in data.get("key_observations", [])[:5]],
                strategic_outlook=str(data.get("strategic_outlook", ""))[:1000]
            )
        except Exception:
            return None


ai_risk_service = AIRiskService()
