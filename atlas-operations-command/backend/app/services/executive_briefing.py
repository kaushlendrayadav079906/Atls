from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.company import Company
from app.services.ai_risk_service import ai_risk_service
from app.services.recommendation_engine import recommendation_engine
from app.integrations.ai.base import BaseAIProvider
from app.schemas.risk import (
    ExecutiveBriefingResponse,
    FinancialHighlights,
    OperationalHighlights,
    SupplyHighlights,
    RecommendationResponse,
    RiskAnalysisResponse,
)


class ExecutiveBriefingService:
    """Synthesizes deterministic domain metrics and AI qualitative insights into executive briefings."""

    async def generate_briefing(
        self,
        db: Session,
        company_id: UUID,
        year: Optional[int] = None,
        month: Optional[int] = None,
        provider: Optional[BaseAIProvider] = None,
    ) -> ExecutiveBriefingResponse:
        # 1. Run core risk analysis
        risk_result: RiskAnalysisResponse = await ai_risk_service.evaluate_risk(
            db=db, company_id=company_id, provider=provider
        )

        fin = risk_result.financial
        ops = risk_result.operational
        sup = risk_result.supply

        # 2. Extract key domain risk highlights
        fin_factors = [f.explanation for f in fin.risk_factors]
        ops_factors = [f.explanation for f in ops.risk_factors]
        sup_factors = [f.explanation for f in sup.risk_factors]

        fin_highlights = FinancialHighlights(
            score=fin.score,
            total_revenue=fin.metrics.get("total_revenue", 0.0),
            total_expenditure=fin.metrics.get("total_expenditure", 0.0),
            operating_margin_pct=fin.metrics.get("operating_margin_pct", 0.0),
            burn_ratio=fin.metrics.get("burn_ratio", 0.0),
            key_risk=fin_factors[0] if fin_factors else "Operating margins and expenditure levels are within stable ranges."
        )

        ops_highlights = OperationalHighlights(
            score=ops.score,
            active_factories=int(ops.metrics.get("active_factories", 0)),
            total_factories=int(ops.metrics.get("total_factories", 0)),
            key_risk=ops_factors[0] if ops_factors else "All manufacturing facilities are operating normally."
        )

        sup_highlights = SupplyHighlights(
            score=sup.score,
            stockout_count=int(sup.metrics.get("stockout_items", 0)),
            total_items=int(sup.metrics.get("total_items", 0)),
            top_vendor_share_pct=sup.metrics.get("vendor_concentration_pct", 0.0),
            key_risk=sup_factors[0] if sup_factors else "Inventory availability and vendor concentration meet target thresholds."
        )

        # 3. Generate recommendations
        recommendations: List[RecommendationResponse] = recommendation_engine.generate_deterministic_recommendations(
            financial=fin,
            operational=ops,
            supply=sup,
            limit=5
        )

        # 4. Formulate executive summary
        if risk_result.ai_enriched and risk_result.ai_qualitative_analysis:
            exec_summary = risk_result.ai_qualitative_analysis.executive_summary
        else:
            exec_summary = (
                f"Executive Status: Overall enterprise risk posture is evaluated at {risk_result.overall_score:.1f}/100 ({risk_result.overall_severity}). "
                f"Financial health score is {fin.score:.1f}, operational stability score is {ops.score:.1f}, and supply chain risk score is {sup.score:.1f}."
            )

        data_quality_notes: List[str] = []
        if fin_highlights.total_revenue == 0 and fin_highlights.total_expenditure == 0:
            data_quality_notes.append("No financial transactions recorded for this tenant context.")
        if ops_highlights.total_factories == 0:
            data_quality_notes.append("No manufacturing plants registered for this tenant context.")
        if sup_highlights.total_items == 0:
            data_quality_notes.append("No inventory items found for this tenant context.")

        return ExecutiveBriefingResponse(
            company_id=company_id,
            generated_at=datetime.now(timezone.utc),
            overall_risk_score=risk_result.overall_score,
            overall_risk_level=risk_result.overall_severity,
            ai_enriched=risk_result.ai_enriched,
            executive_summary=exec_summary,
            financial_highlights=fin_highlights,
            operational_highlights=ops_highlights,
            supply_highlights=sup_highlights,
            top_recommendations=recommendations,
            data_quality_notes=data_quality_notes,
        )


executive_briefing_service = ExecutiveBriefingService()
