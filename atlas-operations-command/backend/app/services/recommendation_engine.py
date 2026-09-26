from typing import List, Optional
from uuid import uuid4
from app.schemas.risk import RecommendationResponse, RiskFactor, DomainRiskScore


class RecommendationEngine:
    """Two-layer recommendation engine generating deterministic rules and AI-enriched action items."""

    def generate_deterministic_recommendations(
        self,
        financial: DomainRiskScore,
        operational: DomainRiskScore,
        supply: DomainRiskScore,
        limit: int = 5,
        domain_filter: Optional[str] = None
    ) -> List[RecommendationResponse]:
        recommendations: List[RecommendationResponse] = []

        all_factors = financial.risk_factors + operational.risk_factors + supply.risk_factors

        # Sort factors by severity: CRITICAL > HIGH > MEDIUM > LOW
        sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        sorted_factors = sorted(all_factors, key=lambda f: sev_order.get(f.severity, 4))

        for factor in sorted_factors:
            rec = self._map_factor_to_recommendation(factor)
            if rec:
                if domain_filter and rec.domain.upper() != domain_filter.upper():
                    continue
                recommendations.append(rec)

        # If no severe risk factors triggered, provide healthy operational recommendations
        if not recommendations:
            recommendations.append(RecommendationResponse(
                id=str(uuid4()),
                domain="STRATEGIC",
                priority="LOW",
                title="Maintain Baseline Monitoring",
                description="All operational, financial, and supply metrics are within standard operating thresholds.",
                action_items=[
                    "Continue scheduled factory KPI logging and monthly revenue tracking.",
                    "Review inventory safety stock thresholds quarterly."
                ],
                is_ai_generated=False
            ))

        return recommendations[:limit]

    def _map_factor_to_recommendation(self, factor: RiskFactor) -> Optional[RecommendationResponse]:
        m_name = factor.metric_name

        if m_name == "operating_margin":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="FINANCIAL",
                priority=factor.severity,
                title="Operating Margin Recovery Plan",
                description=f"Margin is compressed ({factor.value}%). Operating expenses must be trimmed and unit economics reviewed.",
                action_items=[
                    "Implement a temporary freeze on discretionary operating expenditures.",
                    "Audit product pricing tiers and direct component margins.",
                    "Review manufacturing facility overhead allocations."
                ],
                is_ai_generated=False
            )

        elif m_name == "burn_ratio":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="FINANCIAL",
                priority=factor.severity,
                title="Expenditure Burn Containment",
                description=f"Burn ratio is elevated at {factor.value}x revenue. Outflows outpace top-line revenues.",
                action_items=[
                    "Review procurement commitments and delay non-urgent vendor orders.",
                    "Implement weekly cash flow forecasting."
                ],
                is_ai_generated=False
            )

        elif m_name == "customer_concentration":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="FINANCIAL",
                priority=factor.severity,
                title="Customer Revenue Diversification",
                description=f"Single client concentration ({factor.value}%) creates acute revenue dependency.",
                action_items=[
                    "Expand direct sales pipeline to acquire new tier-1 corporate accounts.",
                    "Structure long-term multi-year contracts with top existing accounts."
                ],
                is_ai_generated=False
            )

        elif m_name == "revenue_mom_change":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="FINANCIAL",
                priority=factor.severity,
                title="Revenue Contraction Mitigation",
                description=f"Month-over-month revenue contracted by {factor.value}%.",
                action_items=[
                    "Analyze product line sales velocity to identify underperforming SKUs.",
                    "Re-engage dormant customer accounts."
                ],
                is_ai_generated=False
            )

        elif m_name == "factory_inactivity_ratio":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="OPERATIONAL",
                priority=factor.severity,
                title="Inactive Factory Remediation",
                description=f"Factory inactivity is at {factor.value}%. Idle plant capacity degrades operational throughput.",
                action_items=[
                    "Conduct technical root-cause assessment on inactive facilities.",
                    "Reallocate production schedules to active manufacturing hubs."
                ],
                is_ai_generated=False
            )

        elif m_name == "kpi_efficiency_delta":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="OPERATIONAL",
                priority=factor.severity,
                title="Manufacturing Efficiency Optimization",
                description=f"Operational efficiency has declined by {factor.value}%.",
                action_items=[
                    "Audit plant line balancing and bottleneck work centers.",
                    "Review operator staffing and equipment calibration standards."
                ],
                is_ai_generated=False
            )

        elif m_name == "downtime_pct":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="OPERATIONAL",
                priority=factor.severity,
                title="Equipment Downtime Reduction",
                description=f"Plant downtime reached {factor.value}%.",
                action_items=[
                    "Institute preventive maintenance schedules during off-shift hours.",
                    "Stock high-wear spare parts locally at factory maintenance depots."
                ],
                is_ai_generated=False
            )

        elif m_name == "stockout_ratio":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="SUPPLY",
                priority=factor.severity,
                title="Critical Inventory Stockout Replenishment",
                description=f"Stockout ratio is at {factor.value}%. Zero-quantity inventory items risk order fulfillment failures.",
                action_items=[
                    "Issue expedited purchase orders for out-of-stock product SKUs.",
                    "Recalibrate safety stock minimums based on historical demand lead times."
                ],
                is_ai_generated=False
            )

        elif m_name == "vendor_concentration":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="SUPPLY",
                priority=factor.severity,
                title="Vendor Procurement Diversification",
                description=f"Single vendor accounts for {factor.value}% of procurement expenditure.",
                action_items=[
                    "Identify and qualify secondary supplier sources for core materials.",
                    "Negotiate volume SLAs and backup fulfillment agreements."
                ],
                is_ai_generated=False
            )

        elif m_name == "inactive_inventory_ratio":
            return RecommendationResponse(
                id=str(uuid4()),
                domain="SUPPLY",
                priority=factor.severity,
                title="Inactive Inventory Liquidation",
                description=f"{factor.value}% of inventory is marked inactive, locking operational capital.",
                action_items=[
                    "Conduct inventory audit to identify obsolete or scrap materials.",
                    "Discount or repurpose inactive stock items."
                ],
                is_ai_generated=False
            )

        return None


recommendation_engine = RecommendationEngine()
