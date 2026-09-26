import pytest
from app.services.risk_engine import risk_engine, get_severity_from_score
from app.schemas.risk import DomainRiskScore


def test_severity_mapping_boundaries():
    assert get_severity_from_score(0.0) == "LOW"
    assert get_severity_from_score(25.0) == "LOW"
    assert get_severity_from_score(25.01) == "MEDIUM"
    assert get_severity_from_score(50.0) == "MEDIUM"
    assert get_severity_from_score(50.01) == "HIGH"
    assert get_severity_from_score(75.0) == "HIGH"
    assert get_severity_from_score(75.01) == "CRITICAL"
    assert get_severity_from_score(100.0) == "CRITICAL"


def test_financial_risk_healthy():
    fin_data = {
        "total_revenue": 1000000.0,
        "total_expenditure": 600000.0,
        "top_customer_revenue": 200000.0,
        "top_customer_name": "Acme Corp",
        "current_month_rev": 100000.0,
        "prior_month_rev": 95000.0,
    }
    score = risk_engine.evaluate_financial_risk(fin_data)
    assert score.domain == "financial"
    assert score.metrics["operating_margin"] == 0.4
    assert score.metrics["burn_ratio"] == 0.6
    assert score.metrics["customer_concentration"] == 0.2
    assert score.score <= 25.0
    assert score.severity == "LOW"
    assert len(score.risk_factors) == 0


def test_financial_risk_critical_negative_margin():
    fin_data = {
        "total_revenue": 500000.0,
        "total_expenditure": 800000.0,  # Negative margin
        "top_customer_revenue": 350000.0,  # 70% concentration
        "top_customer_name": "MegaClient",
        "current_month_rev": 30000.0,
        "prior_month_rev": 60000.0,  # -50% MoM drop
    }
    score = risk_engine.evaluate_financial_risk(fin_data)
    assert score.metrics["operating_margin"] < 0
    assert score.metrics["burn_ratio"] == 1.6
    assert score.score > 75.0
    assert score.severity == "CRITICAL"
    assert len(score.risk_factors) >= 3


def test_financial_risk_empty_data():
    fin_data = {}
    score = risk_engine.evaluate_financial_risk(fin_data)
    assert score.metrics["total_revenue"] == 0.0
    assert score.metrics["total_expenditure"] == 0.0
    assert score.score <= 25.0
    assert score.severity == "LOW"


def test_operational_risk_all_active():
    ops_data = {
        "total_factories": 4,
        "active_factories": 4,
        "inactive_factories": 0,
        "metric_latest": {"efficiency": 95.0},
        "metric_prior": {"efficiency": 94.0},
        "downtime_val": 2.5,
    }
    score = risk_engine.evaluate_operational_risk(ops_data)
    assert score.domain == "operational"
    assert score.metrics["inactivity_ratio"] == 0.0
    assert score.score <= 25.0
    assert score.severity == "LOW"
    assert len(score.risk_factors) == 0


def test_operational_risk_high_inactivity_and_downtime():
    ops_data = {
        "total_factories": 4,
        "active_factories": 2,
        "inactive_factories": 2,  # 50% inactive -> CRITICAL
        "metric_latest": {"efficiency": 60.0},
        "metric_prior": {"efficiency": 90.0},  # -33% drop -> HIGH
        "downtime_val": 22.0,  # >15% -> HIGH
    }
    score = risk_engine.evaluate_operational_risk(ops_data)
    assert score.metrics["inactivity_ratio"] == 0.5
    assert score.score >= 75.0
    assert score.severity == "CRITICAL"
    assert len(score.risk_factors) >= 3


def test_supply_risk_healthy():
    sup_data = {
        "total_items": 50,
        "stockout_items": 0,
        "inactive_items": 2,
        "total_inventory_value": 500000.0,
        "top_vendor_spend": 50000.0,
        "top_vendor_name": "Supplier A",
    }
    score = risk_engine.evaluate_supply_risk(sup_data, total_expenditure=300000.0)
    assert score.domain == "supply"
    assert score.metrics["stockout_ratio"] == 0.0
    assert score.score <= 25.0
    assert score.severity == "LOW"


def test_supply_risk_critical_stockout_and_concentration():
    sup_data = {
        "total_items": 20,
        "stockout_items": 8,  # 40% stockout -> CRITICAL
        "inactive_items": 6,  # 30% inactive -> MEDIUM
        "total_inventory_value": 50000.0,
        "top_vendor_spend": 180000.0,  # 90% spend
        "top_vendor_name": "Monopoly Supplier",
    }
    score = risk_engine.evaluate_supply_risk(sup_data, total_expenditure=200000.0)
    assert score.metrics["stockout_ratio"] == 0.4
    assert score.metrics["vendor_concentration"] == 0.9
    assert score.score >= 50.0
    assert len(score.risk_factors) >= 2


def test_overall_composite_calculation():
    fin = DomainRiskScore(domain="financial", score=80.0, severity="CRITICAL", metrics={})
    ops = DomainRiskScore(domain="operational", score=40.0, severity="MEDIUM", metrics={})
    sup = DomainRiskScore(domain="supply", score=60.0, severity="HIGH", metrics={})

    # Overall = (80 * 0.40) + (40 * 0.35) + (60 * 0.25) = 32 + 14 + 15 = 61.0 (HIGH)
    score, sev = risk_engine.calculate_overall_score(fin, ops, sup)
    assert score == 61.0
    assert sev == "HIGH"
