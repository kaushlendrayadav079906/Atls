from uuid import uuid4
from datetime import date
from app.models.company import Company
from app.models.factory import Factory
from app.models.financial_transaction import FinancialTransaction
from app.models.inventory_item import InventoryItem
from app.models.product import Product
from tests.conftest import setup_auth


def test_get_risk_analysis_unauthenticated(client):
    resp = client.get("/api/v1/ai/risk-analysis")
    assert resp.status_code == 401


def test_get_risk_analysis_authorized(client, db_session):
    company_id, user_id, headers = setup_auth(db_session, client, role="standard_user", email_prefix="ai_std")

    resp = client.get("/api/v1/ai/risk-analysis", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "overall_score" in data
    assert "overall_severity" in data
    assert "financial" in data
    assert "operational" in data
    assert "supply" in data


def test_get_risk_analysis_factory_filter_and_tenant_isolation(client, db_session):
    # Company A
    comp_a, user_a, headers_a = setup_auth(db_session, client, role="admin", email_prefix="comp_a_admin")
    fac_a = Factory(id=uuid4(), company_id=comp_a, name="Factory A", status="active")
    db_session.add(fac_a)
    db_session.commit()

    # Company B
    comp_b, user_b, headers_b = setup_auth(db_session, client, role="admin", email_prefix="comp_b_admin")
    fac_b = Factory(id=uuid4(), company_id=comp_b, name="Factory B", status="active")
    db_session.add(fac_b)
    db_session.commit()

    # Query with own factory -> 200 OK
    resp_ok = client.get(f"/api/v1/ai/risk-analysis?factory_id={fac_a.id}", headers=headers_a)
    assert resp_ok.status_code == 200

    # Cross-tenant IDOR attack: Company A tries to query Company B's factory_id -> 404
    resp_idor = client.get(f"/api/v1/ai/risk-analysis?factory_id={fac_b.id}", headers=headers_a)
    assert resp_idor.status_code == 404
    assert "Factory not found" in resp_idor.json()["detail"]


def test_get_recommendations(client, db_session):
    company_id, user_id, headers = setup_auth(db_session, client, role="standard_user", email_prefix="rec_user")

    resp = client.get("/api/v1/ai/recommendations?limit=3", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 3


def test_get_executive_briefing(client, db_session):
    company_id, user_id, headers = setup_auth(db_session, client, role="standard_user", email_prefix="brief_user")

    resp = client.get("/api/v1/ai/briefing", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["company_id"] == str(company_id)
    assert "overall_risk_score" in data
    assert "financial_highlights" in data
    assert "operational_highlights" in data
    assert "supply_highlights" in data
    assert "top_recommendations" in data


def test_evaluate_endpoint_rbac(client, db_session):
    # Standard user -> 403 Forbidden
    comp_std, u_std, headers_std = setup_auth(db_session, client, role="standard_user", email_prefix="eval_std")
    resp_forbidden = client.post("/api/v1/ai/risk-analysis/evaluate", json={}, headers=headers_std)
    assert resp_forbidden.status_code == 403

    # Admin user -> 200 OK
    comp_adm, u_adm, headers_adm = setup_auth(db_session, client, role="admin", email_prefix="eval_adm")
    resp_ok = client.post("/api/v1/ai/risk-analysis/evaluate", json={}, headers=headers_adm)
    assert resp_ok.status_code == 200
    assert "overall_score" in resp_ok.json()


def test_roadmap_risks_and_actions_api(client, db_session):
    from app.models.risk import Risk, AiRecommendedAction
    comp_id, user_id, headers = setup_auth(db_session, client, role="standard_user", email_prefix="roadmap_user")

    # Seed Risk and Action
    risk = Risk(
        id=uuid4(),
        company_id=comp_id,
        title="Active Supply Delay",
        severity="HIGH",
        category="Supply",
        likelihood_pct=75.0,
        financial_impact=100000.0,
        department="Logistics",
        status="active"
    )
    action = AiRecommendedAction(
        id=uuid4(),
        company_id=comp_id,
        title="Reroute Shipment",
        severity="HIGH",
        category="Logistics",
        description="Reroute through secondary corridor.",
        cta_label="Reroute Now",
        status="pending"
    )
    db_session.add_all([risk, action])
    db_session.commit()

    # GET /api/v1/risks
    resp_r = client.get("/api/v1/risks", headers=headers)
    assert resp_r.status_code == 200
    assert len(resp_r.json()) >= 1
    assert resp_r.json()[0]["title"] == "Active Supply Delay"

    # GET /api/v1/ai/actions and alias /api/ai-actions
    resp_a = client.get("/api/v1/ai/actions", headers=headers)
    assert resp_a.status_code == 200
    assert len(resp_a.json()) >= 1
    assert resp_a.json()[0]["title"] == "Reroute Shipment"

    resp_alias = client.get("/api/ai-actions", headers=headers)
    assert resp_alias.status_code == 200

    # POST /api/v1/ai/actions/{id}/resolve
    resp_res = client.post(f"/api/v1/ai/actions/{action.id}/resolve", headers=headers)
    assert resp_res.status_code == 200
    assert resp_res.json()["status"] == "completed"
    assert resp_res.json()["resolved_at"] is not None

    # Cross-tenant resolution IDOR defense
    comp_other, u_other, headers_other = setup_auth(db_session, client, role="standard_user", email_prefix="other_actor")
    resp_idor = client.post(f"/api/v1/ai/actions/{action.id}/resolve", headers=headers_other)
    assert resp_idor.status_code == 404


def test_roadmap_briefings_and_async_run_api(client, db_session):
    from app.models.risk import ExecutiveBriefing
    comp_id, user_id, headers = setup_auth(db_session, client, role="standard_user", email_prefix="brief_async_user")

    # Seed Briefing
    briefing = ExecutiveBriefing(
        id=uuid4(),
        company_id=comp_id,
        summary_text="Q3 Operational Briefing Summary",
        critical_issues=[],
        business_impact=[],
        priority_actions=[]
    )
    db_session.add(briefing)
    db_session.commit()

    # GET /api/v1/briefings/latest
    resp_latest = client.get("/api/v1/briefings/latest", headers=headers)
    assert resp_latest.status_code == 200
    assert resp_latest.json()["summary_text"] == "Q3 Operational Briefing Summary"

    # GET /api/v1/briefings
    resp_hist = client.get("/api/v1/briefings", headers=headers)
    assert resp_hist.status_code == 200
    assert len(resp_hist.json()) >= 1

    # POST /api/v1/ai/run-analysis
    resp_run = client.post("/api/v1/ai/run-analysis", headers=headers)
    assert resp_run.status_code == 200
    job_id = resp_run.json()["job_id"]
    assert job_id is not None
    assert resp_run.json()["status"] in ("pending", "running", "completed")

    # GET /api/v1/ai/jobs/{job_id}
    resp_job = client.get(f"/api/v1/ai/jobs/{job_id}", headers=headers)
    assert resp_job.status_code == 200
    assert resp_job.json()["job_id"] == job_id
