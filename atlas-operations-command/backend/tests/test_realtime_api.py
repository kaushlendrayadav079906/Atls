import pytest
from datetime import datetime, date, timezone
from decimal import Decimal
from uuid import uuid4
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.models.factory import Factory
from app.models.financial_transaction import FinancialTransaction
from app.models.risk import Risk, AiRecommendedAction, ExecutiveBriefing
from tests.conftest import setup_auth


@pytest.fixture
def test_setup_data(db_session, client):
    # Setup Auth for Company A
    comp_a_id, user_a_id, headers_a = setup_auth(db_session, client, role="standard_user", email_prefix="realtime_a")

    # Factories for Company A (2 active, 1 inactive)
    f1 = Factory(id=uuid4(), company_id=comp_a_id, name="Factory Alpha", code="FA", location="Austin", status="active")
    f2 = Factory(id=uuid4(), company_id=comp_a_id, name="Factory Beta", code="FB", location="Dallas", status="active")
    f3 = Factory(id=uuid4(), company_id=comp_a_id, name="Factory Gamma", code="FG", location="Houston", status="inactive")
    db_session.add_all([f1, f2, f3])

    # Financial Transactions for Company A
    t1 = FinancialTransaction(
        id=uuid4(), company_id=comp_a_id, factory_id=f1.id,
        transaction_date=date(2026, 9, 1), transaction_type="revenue", amount=Decimal("100000.00"),
        currency_code="USD"
    )
    t2 = FinancialTransaction(
        id=uuid4(), company_id=comp_a_id, factory_id=f2.id,
        transaction_date=date(2026, 9, 2), transaction_type="expenditure", amount=Decimal("60000.00"),
        currency_code="USD"
    )
    db_session.add_all([t1, t2])

    # Risks for Company A (1 CRITICAL active, 1 HIGH active, 1 LOW resolved)
    r1 = Risk(
        id=uuid4(), company_id=comp_a_id, title="Critical Boiler Failure",
        severity="CRITICAL", category="Operational", likelihood_pct=Decimal("90.0"),
        financial_impact=Decimal("250000.00"), department="Operations", status="active"
    )
    r2 = Risk(
        id=uuid4(), company_id=comp_a_id, title="High Supplier Concentration",
        severity="HIGH", category="Supply", likelihood_pct=Decimal("70.0"),
        financial_impact=Decimal("100000.00"), department="Procurement", status="active"
    )
    r3 = Risk(
        id=uuid4(), company_id=comp_a_id, title="Old Minor Leak",
        severity="LOW", category="Operational", likelihood_pct=Decimal("10.0"),
        financial_impact=Decimal("5000.00"), department="Operations", status="resolved"
    )
    db_session.add_all([r1, r2, r3])

    # AI Action for Company A
    act1 = AiRecommendedAction(
        id=uuid4(), company_id=comp_a_id, title="Initiate Supplier Switch",
        severity="HIGH", category="Supply", description="Switch vendor",
        cta_label="Switch Now", status="pending"
    )
    db_session.add(act1)

    # Executive Briefing for Company A
    br1 = ExecutiveBriefing(
        id=uuid4(), company_id=comp_a_id, generated_at=datetime.now(timezone.utc),
        summary_text="Overview for Comp A", critical_issues=[], business_impact=[], priority_actions=[]
    )
    db_session.add(br1)

    # Company B (Isolated Tenant)
    comp_b_id, user_b_id, headers_b = setup_auth(db_session, client, role="standard_user", email_prefix="realtime_b")

    f_b = Factory(id=uuid4(), company_id=comp_b_id, name="Factory Delta", code="FD", location="Berlin", status="active")
    db_session.add(f_b)

    db_session.commit()

    return {
        "comp_a_id": comp_a_id,
        "headers_a": headers_a,
        "comp_b_id": comp_b_id,
        "headers_b": headers_b,
        "f1": f1,
    }


def test_realtime_summary_success(client: TestClient, test_setup_data):
    """Verify live composite summary returns correctly calculated pulses."""
    headers = test_setup_data["headers_a"]

    response = client.get("/api/v1/realtime/summary", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["company_id"] == str(test_setup_data["comp_a_id"])
    assert data["system_status"] in ("OPERATIONAL", "DEGRADED", "WARNING")

    # Operational pulse check (2 active, 1 inactive -> 3 total, 66.67% health)
    op = data["operational_pulse"]
    assert op["total_factories"] == 3
    assert op["active_factories"] == 2
    assert op["inactive_factories"] == 1
    assert op["operational_health_pct"] == 66.67

    # Financial pulse check (100k rev, 60k exp -> 40k profit, 40% margin)
    fin = data["financial_pulse"]
    assert fin["total_revenue"] == 100000.00
    assert fin["total_expenditure"] == 60000.00
    assert fin["net_profit"] == 40000.00
    assert fin["operating_margin_pct"] == 40.0

    # Risk summary check (1 critical, 1 high active, resolved excluded)
    risk = data["risk_summary"]
    assert risk["active_risk_count"] == 2
    assert risk["critical_count"] == 1
    assert risk["high_count"] == 1
    assert risk["low_count"] == 0
    assert risk["overall_severity"] == "CRITICAL"

    assert data["pending_actions_count"] == 1
    assert data["latest_briefing_timestamp"] is not None


def test_realtime_summary_factory_filter(client: TestClient, test_setup_data):
    """Verify factory filtering scopes operational and financial pulses."""
    headers = test_setup_data["headers_a"]
    f1_id = test_setup_data["f1"].id

    response = client.get(f"/api/v1/realtime/summary?factory_id={f1_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()

    op = data["operational_pulse"]
    assert op["total_factories"] == 1
    assert op["active_factories"] == 1
    assert op["inactive_factories"] == 0


def test_realtime_operational_health(client: TestClient, test_setup_data):
    """Verify lightweight operational health endpoint."""
    headers = test_setup_data["headers_a"]

    response = client.get("/api/v1/realtime/operational-health", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["status"] in ("HEALTHY", "DEGRADED", "CRITICAL")
    assert data["active_plants"] == 2
    assert data["total_plants"] == 3
    assert data["active_critical_alerts"] == 1


def test_realtime_alerts_feed(client: TestClient, test_setup_data):
    """Verify alerts feed returns active critical/high risks and excludes resolved ones."""
    headers = test_setup_data["headers_a"]

    response = client.get("/api/v1/realtime/alerts", headers=headers)
    assert response.status_code == 200
    alerts = response.json()

    assert len(alerts) == 2
    assert alerts[0]["severity"] == "CRITICAL"
    assert alerts[0]["title"] == "Critical Boiler Failure"
    assert alerts[1]["severity"] == "HIGH"


def test_realtime_alerts_severity_filter(client: TestClient, test_setup_data):
    """Verify filtering alerts by severity."""
    headers = test_setup_data["headers_a"]

    response = client.get("/api/v1/realtime/alerts?severity=CRITICAL", headers=headers)
    assert response.status_code == 200
    alerts = response.json()

    assert len(alerts) == 1
    assert alerts[0]["severity"] == "CRITICAL"


def test_realtime_tenant_isolation(client: TestClient, test_setup_data):
    """Verify strict tenant isolation between Company A and Company B."""
    headers_b = test_setup_data["headers_b"]

    # Company B has 1 factory, 0 transactions, 0 risks
    response = client.get("/api/v1/realtime/summary", headers=headers_b)
    assert response.status_code == 200
    data = response.json()

    assert data["company_id"] == str(test_setup_data["comp_b_id"])
    assert data["operational_pulse"]["total_factories"] == 1
    assert data["financial_pulse"]["total_revenue"] == 0.0
    assert data["risk_summary"]["active_risk_count"] == 0

    # Company B alerts must be empty
    alert_res = client.get("/api/v1/realtime/alerts", headers=headers_b)
    assert alert_res.status_code == 200
    assert len(alert_res.json()) == 0


def test_realtime_unauthorized(client: TestClient):
    """Verify that unauthenticated requests are rejected with 401."""
    assert client.get("/api/v1/realtime/summary").status_code == 401
    assert client.get("/api/v1/realtime/operational-health").status_code == 401
    assert client.get("/api/v1/realtime/alerts").status_code == 401


def test_realtime_zero_ai_invocation(client: TestClient, test_setup_data):
    """
    CRITICAL REGRESSION REQUIREMENT:
    Verify that polling real-time endpoints NEVER invokes Gemini or AI risk services.
    """
    headers = test_setup_data["headers_a"]

    with patch("app.integrations.ai.factory.get_ai_provider") as mock_provider, \
         patch("app.services.ai_risk_service.ai_risk_service.evaluate_risk") as mock_eval, \
         patch("app.services.ai_analysis_workflow.ai_analysis_workflow_service.start_analysis_job") as mock_workflow:

        res1 = client.get("/api/v1/realtime/summary", headers=headers)
        assert res1.status_code == 200

        res2 = client.get("/api/v1/realtime/operational-health", headers=headers)
        assert res2.status_code == 200

        res3 = client.get("/api/v1/realtime/alerts", headers=headers)
        assert res3.status_code == 200

        # Assert zero AI invocations
        mock_provider.assert_not_called()
        mock_eval.assert_not_called()
        mock_workflow.assert_not_called()
