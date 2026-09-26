from typing import Dict, Any, List, Tuple
from app.schemas.risk import RiskFactor, DomainRiskScore


def get_severity_from_score(score: float) -> str:
    """Maps a 0-100 risk score to standard categorical severity."""
    if score <= 25.0:
        return "LOW"
    elif score <= 50.0:
        return "MEDIUM"
    elif score <= 75.0:
        return "HIGH"
    else:
        return "CRITICAL"


class RiskEngine:
    """Deterministic Multi-Domain Risk Engine implementing Phase 5B specifications."""

    def evaluate_financial_risk(self, fin_data: Dict[str, Any]) -> DomainRiskScore:
        revenue = float(fin_data.get("total_revenue", 0.0))
        expenditure = float(fin_data.get("total_expenditure", 0.0))
        top_customer_revenue = float(fin_data.get("top_customer_revenue", 0.0))
        top_customer_name = fin_data.get("top_customer_name", "N/A")
        curr_rev = float(fin_data.get("current_month_rev", revenue))
        prior_rev = fin_data.get("prior_month_rev")

        risk_factors: List[RiskFactor] = []
        metrics: Dict[str, float] = {
            "total_revenue": revenue,
            "total_expenditure": expenditure,
        }

        # 1. Operating Margin
        if revenue > 0:
            margin = (revenue - expenditure) / revenue
        elif expenditure > 0:
            margin = -1.0
        else:
            margin = 0.0
        metrics["operating_margin"] = round(margin, 4)
        metrics["operating_margin_pct"] = round(margin * 100.0, 2)

        if revenue == 0 and expenditure == 0:
            margin_score = 10.0
            margin_sev = "LOW"
        elif margin < 0.0:
            margin_score = 90.0
            margin_sev = "CRITICAL"
            risk_factors.append(RiskFactor(
                metric_name="operating_margin",
                domain="financial",
                value=round(margin * 100.0, 2),
                threshold=0.0,
                severity="CRITICAL",
                explanation=f"Negative operating margin ({margin*100:.1f}%); expenditures (${expenditure:,.2f}) exceed revenue (${revenue:,.2f})."
            ))
        elif margin < 0.10:
            margin_score = 65.0
            margin_sev = "HIGH"
            risk_factors.append(RiskFactor(
                metric_name="operating_margin",
                domain="financial",
                value=round(margin * 100.0, 2),
                threshold=10.0,
                severity="HIGH",
                explanation=f"Thin operating margin ({margin*100:.1f}%), below healthy 10% benchmark."
            ))
        elif margin < 0.20:
            margin_score = 35.0
            margin_sev = "MEDIUM"
        else:
            margin_score = 10.0
            margin_sev = "LOW"

        # 2. Burn Ratio (Expenditure-to-Revenue)
        if revenue > 0:
            burn_ratio = expenditure / revenue
        elif expenditure > 0:
            burn_ratio = 2.0
        else:
            burn_ratio = 0.0
        metrics["burn_ratio"] = round(burn_ratio, 4)

        if burn_ratio > 1.20:
            burn_score = 85.0
            risk_factors.append(RiskFactor(
                metric_name="burn_ratio",
                domain="financial",
                value=round(burn_ratio, 2),
                threshold=1.20,
                severity="CRITICAL",
                explanation=f"Critical expenditure burn ratio ({burn_ratio:.2f}x revenue)."
            ))
        elif burn_ratio > 1.00:
            burn_score = 60.0
            risk_factors.append(RiskFactor(
                metric_name="burn_ratio",
                domain="financial",
                value=round(burn_ratio, 2),
                threshold=1.00,
                severity="HIGH",
                explanation=f"Elevated burn ratio ({burn_ratio:.2f}x revenue) exceeding total revenue."
            ))
        elif burn_ratio > 0.85:
            burn_score = 35.0
        else:
            burn_score = 10.0

        # 3. Revenue Momentum
        if prior_rev is not None and float(prior_rev) > 0:
            mom = (curr_rev - float(prior_rev)) / float(prior_rev)
            metrics["revenue_mom_change"] = round(mom, 4)
            if mom < -0.30:
                mom_score = 70.0
                risk_factors.append(RiskFactor(
                    metric_name="revenue_mom_change",
                    domain="financial",
                    value=round(mom * 100.0, 2),
                    threshold=-30.0,
                    severity="HIGH",
                    explanation=f"Significant month-over-month revenue contraction ({mom*100:.1f}%)."
                ))
            elif mom < -0.10:
                mom_score = 40.0
                risk_factors.append(RiskFactor(
                    metric_name="revenue_mom_change",
                    domain="financial",
                    value=round(mom * 100.0, 2),
                    threshold=-10.0,
                    severity="MEDIUM",
                    explanation=f"Moderate month-over-month revenue decline ({mom*100:.1f}%)."
                ))
            else:
                mom_score = 10.0
        else:
            metrics["revenue_mom_change"] = 0.0
            mom_score = 10.0

        # 4. Customer Concentration
        if revenue > 0:
            cust_conc = top_customer_revenue / revenue
        else:
            cust_conc = 0.0
        metrics["customer_concentration"] = round(cust_conc, 4)
        metrics["customer_concentration_pct"] = round(cust_conc * 100.0, 2)

        if cust_conc > 0.50:
            cust_score = 70.0
            risk_factors.append(RiskFactor(
                metric_name="customer_concentration",
                domain="financial",
                value=round(cust_conc * 100.0, 2),
                threshold=50.0,
                severity="HIGH",
                explanation=f"High customer concentration: top customer '{top_customer_name}' accounts for {cust_conc*100:.1f}% of revenue."
            ))
        elif cust_conc > 0.30:
            cust_score = 40.0
            risk_factors.append(RiskFactor(
                metric_name="customer_concentration",
                domain="financial",
                value=round(cust_conc * 100.0, 2),
                threshold=30.0,
                severity="MEDIUM",
                explanation=f"Moderate customer concentration: top customer accounts for {cust_conc*100:.1f}% of revenue."
            ))
        else:
            cust_score = 10.0

        # Domain composite score
        domain_score = round((margin_score * 0.35) + (burn_score * 0.30) + (mom_score * 0.15) + (cust_score * 0.20), 2)
        domain_severity = get_severity_from_score(domain_score)

        return DomainRiskScore(
            domain="financial",
            score=domain_score,
            severity=domain_severity,
            metrics=metrics,
            risk_factors=risk_factors
        )

    def evaluate_operational_risk(self, ops_data: Dict[str, Any]) -> DomainRiskScore:
        total_factories = int(ops_data.get("total_factories", 0))
        active_factories = int(ops_data.get("active_factories", 0))
        inactive_factories = int(ops_data.get("inactive_factories", 0))
        metric_latest = ops_data.get("metric_latest", {})
        metric_prior = ops_data.get("metric_prior", {})
        downtime_val = float(ops_data.get("downtime_val", 0.0))

        risk_factors: List[RiskFactor] = []
        metrics: Dict[str, float] = {
            "total_factories": float(total_factories),
            "active_factories": float(active_factories),
            "inactive_factories": float(inactive_factories),
        }

        # 1. Factory Inactivity Ratio
        if total_factories > 0:
            inactivity_ratio = inactive_factories / total_factories
        else:
            inactivity_ratio = 0.0
        metrics["inactivity_ratio"] = round(inactivity_ratio, 4)

        if inactivity_ratio > 0.30:
            fac_score = 90.0
            risk_factors.append(RiskFactor(
                metric_name="factory_inactivity_ratio",
                domain="operational",
                value=round(inactivity_ratio * 100.0, 2),
                threshold=30.0,
                severity="CRITICAL",
                explanation=f"{inactive_factories}/{total_factories} ({inactivity_ratio*100:.1f}%) factories are inactive or shutdown."
            ))
        elif inactivity_ratio > 0.15:
            fac_score = 65.0
            risk_factors.append(RiskFactor(
                metric_name="factory_inactivity_ratio",
                domain="operational",
                value=round(inactivity_ratio * 100.0, 2),
                threshold=15.0,
                severity="HIGH",
                explanation=f"{inactive_factories}/{total_factories} factories are currently inactive."
            ))
        elif inactivity_ratio > 0.0:
            fac_score = 35.0
            risk_factors.append(RiskFactor(
                metric_name="factory_inactivity_ratio",
                domain="operational",
                value=round(inactivity_ratio * 100.0, 2),
                threshold=0.0,
                severity="MEDIUM",
                explanation=f"{inactive_factories} factory currently reporting inactive status."
            ))
        else:
            fac_score = 0.0

        # 2. KPI Degradation (Efficiency / Output)
        kpi_delta = 0.0
        eff_latest = metric_latest.get("efficiency") or metric_latest.get("oee") or metric_latest.get("output")
        eff_prior = metric_prior.get("efficiency") or metric_prior.get("oee") or metric_prior.get("output")

        if eff_latest is not None and eff_prior is not None and float(eff_prior) > 0:
            kpi_delta = (float(eff_latest) - float(eff_prior)) / float(eff_prior)
            metrics["kpi_efficiency_delta"] = round(kpi_delta, 4)

            if kpi_delta < -0.20:
                kpi_score = 70.0
                risk_factors.append(RiskFactor(
                    metric_name="kpi_efficiency_delta",
                    domain="operational",
                    value=round(kpi_delta * 100.0, 2),
                    threshold=-20.0,
                    severity="HIGH",
                    explanation=f"Severe operational KPI degradation ({kpi_delta*100:.1f}% drop)."
                ))
            elif kpi_delta < -0.05:
                kpi_score = 40.0
                risk_factors.append(RiskFactor(
                    metric_name="kpi_efficiency_delta",
                    domain="operational",
                    value=round(kpi_delta * 100.0, 2),
                    threshold=-5.0,
                    severity="MEDIUM",
                    explanation=f"Moderate operational KPI decline ({kpi_delta*100:.1f}% drop)."
                ))
            else:
                kpi_score = 10.0
        else:
            metrics["kpi_efficiency_delta"] = 0.0
            kpi_score = 10.0

        # 3. High Downtime
        metrics["downtime_val"] = round(downtime_val, 2)
        # Normalize: if downtime given as percentage > 1 (e.g. 18.5) or ratio (0.185)
        dt_pct = downtime_val if downtime_val > 1.0 else downtime_val * 100.0

        if dt_pct > 15.0:
            dt_score = 75.0
            risk_factors.append(RiskFactor(
                metric_name="downtime_pct",
                domain="operational",
                value=round(dt_pct, 2),
                threshold=15.0,
                severity="HIGH",
                explanation=f"High facility downtime recorded ({dt_pct:.1f}%)."
            ))
        elif dt_pct > 5.0:
            dt_score = 40.0
            risk_factors.append(RiskFactor(
                metric_name="downtime_pct",
                domain="operational",
                value=round(dt_pct, 2),
                threshold=5.0,
                severity="MEDIUM",
                explanation=f"Moderate downtime recorded ({dt_pct:.1f}%)."
            ))
        else:
            dt_score = 10.0

        # Domain composite score
        domain_score = round((fac_score * 0.45) + (kpi_score * 0.30) + (dt_score * 0.25), 2)
        domain_severity = get_severity_from_score(domain_score)

        return DomainRiskScore(
            domain="operational",
            score=domain_score,
            severity=domain_severity,
            metrics=metrics,
            risk_factors=risk_factors
        )

    def evaluate_supply_risk(self, sup_data: Dict[str, Any], total_expenditure: float) -> DomainRiskScore:
        total_items = int(sup_data.get("total_items", 0))
        stockout_items = int(sup_data.get("stockout_items", 0))
        inactive_items = int(sup_data.get("inactive_items", 0))
        total_inv_val = float(sup_data.get("total_inventory_value", 0.0))
        top_vendor_spend = float(sup_data.get("top_vendor_spend", 0.0))
        top_vendor_name = sup_data.get("top_vendor_name", "N/A")

        risk_factors: List[RiskFactor] = []
        metrics: Dict[str, float] = {
            "total_items": float(total_items),
            "stockout_items": float(stockout_items),
            "inactive_items": float(inactive_items),
            "total_inventory_value": total_inv_val,
        }

        # 1. Stockout Ratio
        if total_items > 0:
            stockout_ratio = stockout_items / total_items
        else:
            stockout_ratio = 0.0
        metrics["stockout_ratio"] = round(stockout_ratio, 4)
        metrics["stockout_pct"] = round(stockout_ratio * 100.0, 2)

        if stockout_ratio > 0.25:
            stockout_score = 85.0
            risk_factors.append(RiskFactor(
                metric_name="stockout_ratio",
                domain="supply",
                value=round(stockout_ratio * 100.0, 2),
                threshold=25.0,
                severity="CRITICAL",
                explanation=f"Severe stock-out level: {stockout_items}/{total_items} ({stockout_ratio*100:.1f}%) inventory items have zero quantity."
            ))
        elif stockout_ratio > 0.10:
            stockout_score = 60.0
            risk_factors.append(RiskFactor(
                metric_name="stockout_ratio",
                domain="supply",
                value=round(stockout_ratio * 100.0, 2),
                threshold=10.0,
                severity="HIGH",
                explanation=f"High stock-out level: {stockout_items}/{total_items} items depleted."
            ))
        elif stockout_ratio > 0.0:
            stockout_score = 30.0
            risk_factors.append(RiskFactor(
                metric_name="stockout_ratio",
                domain="supply",
                value=round(stockout_ratio * 100.0, 2),
                threshold=0.0,
                severity="MEDIUM",
                explanation=f"{stockout_items} item(s) currently out of stock."
            ))
        else:
            stockout_score = 0.0

        # 2. Vendor Spend Concentration
        if total_expenditure > 0:
            vendor_conc = top_vendor_spend / total_expenditure
        else:
            vendor_conc = 0.0
        metrics["vendor_concentration"] = round(vendor_conc, 4)
        metrics["vendor_concentration_pct"] = round(vendor_conc * 100.0, 2)

        if vendor_conc > 0.50:
            vendor_score = 65.0
            risk_factors.append(RiskFactor(
                metric_name="vendor_concentration",
                domain="supply",
                value=round(vendor_conc * 100.0, 2),
                threshold=50.0,
                severity="HIGH",
                explanation=f"High single-vendor dependency: '{top_vendor_name}' represents {vendor_conc*100:.1f}% of total procurement spend."
            ))
        elif vendor_conc > 0.30:
            vendor_score = 35.0
            risk_factors.append(RiskFactor(
                metric_name="vendor_concentration",
                domain="supply",
                value=round(vendor_conc * 100.0, 2),
                threshold=30.0,
                severity="MEDIUM",
                explanation=f"Moderate single-vendor spend concentration ({vendor_conc*100:.1f}%)."
            ))
        else:
            vendor_score = 10.0

        # 3. Inactive Inventory Ratio
        if total_items > 0:
            inactive_ratio = inactive_items / total_items
        else:
            inactive_ratio = 0.0
        metrics["inactive_inventory_ratio"] = round(inactive_ratio, 4)

        if inactive_ratio > 0.20:
            inactive_score = 40.0
            risk_factors.append(RiskFactor(
                metric_name="inactive_inventory_ratio",
                domain="supply",
                value=round(inactive_ratio * 100.0, 2),
                threshold=20.0,
                severity="MEDIUM",
                explanation=f"{inactive_items}/{total_items} ({inactive_ratio*100:.1f}%) inventory items are marked inactive."
            ))
        else:
            inactive_score = 10.0

        # Domain composite score
        domain_score = round((stockout_score * 0.45) + (vendor_score * 0.35) + (inactive_score * 0.20), 2)
        domain_severity = get_severity_from_score(domain_score)

        return DomainRiskScore(
            domain="supply",
            score=domain_score,
            severity=domain_severity,
            metrics=metrics,
            risk_factors=risk_factors
        )

    def calculate_overall_score(
        self, financial: DomainRiskScore, operational: DomainRiskScore, supply: DomainRiskScore
    ) -> Tuple[float, str]:
        """Calculates authoritative composite 0-100 risk score based on 40/35/25 weighting."""
        composite = (financial.score * 0.40) + (operational.score * 0.35) + (supply.score * 0.25)
        final_score = round(min(100.0, max(0.0, composite)), 2)
        severity = get_severity_from_score(final_score)
        return final_score, severity


risk_engine = RiskEngine()
