import pytest
import asyncio
from uuid import uuid4
from datetime import datetime, timezone
from app.models.company import Company
from app.models.risk import Risk, AiRecommendedAction, ExecutiveBriefing
from app.repositories.risk import risk_persistence_repository
from app.services.ai_analysis_workflow import ai_analysis_workflow_service
from app.integrations.ai.mock import MockAIProvider
from tests.conftest import setup_auth


def test_risk_persistence_crud_and_tenant_isolation(db_session):
    comp_a = Company(id=uuid4(), name="Company A", currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    comp_b = Company(id=uuid4(), name="Company B", currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    db_session.add_all([comp_a, comp_b])
    db_session.commit()

    # Create risks
    risk_a1 = Risk(
        id=uuid4(),
        company_id=comp_a.id,
        title="Supply Chain Interruption",
        severity="CRITICAL",
        category="Supply",
        likelihood_pct=80.0,
        financial_impact=4200000.0,
        department="Logistics",
        status="active"
    )
    risk_a2 = Risk(
        id=uuid4(),
        company_id=comp_a.id,
        title="Thin Operating Margins",
        severity="HIGH",
        category="Financial",
        likelihood_pct=60.0,
        financial_impact=500000.0,
        department="Finance",
        status="resolved"
    )
    risk_b = Risk(
        id=uuid4(),
        company_id=comp_b.id,
        title="Competitor Price Drop",
        severity="MEDIUM",
        category="Market",
        likelihood_pct=40.0,
        financial_impact=200000.0,
        department="Sales",
        status="active"
    )
    risk_persistence_repository.create_risk(db_session, risk_a1)
    risk_persistence_repository.create_risk(db_session, risk_a2)
    risk_persistence_repository.create_risk(db_session, risk_b)
    db_session.commit()

    # Query Company A risks
    risks_a = risk_persistence_repository.get_risks(db_session, comp_a.id)
    assert len(risks_a) == 2
    assert all(r.company_id == comp_a.id for r in risks_a)

    # Filter by severity
    crit_risks = risk_persistence_repository.get_risks(db_session, comp_a.id, severity="CRITICAL")
    assert len(crit_risks) == 1
    assert crit_risks[0].title == "Supply Chain Interruption"

    # Filter by status
    active_risks = risk_persistence_repository.get_risks(db_session, comp_a.id, status="active")
    assert len(active_risks) == 1

    # Cross-tenant isolation
    risks_b = risk_persistence_repository.get_risks(db_session, comp_b.id)
    assert len(risks_b) == 1
    assert risks_b[0].title == "Competitor Price Drop"


def test_ai_recommended_action_persistence_and_resolve(db_session):
    comp = Company(id=uuid4(), name="Acme Actions", currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    db_session.add(comp)
    db_session.commit()

    action = AiRecommendedAction(
        id=uuid4(),
        company_id=comp.id,
        title="Initiate Supplier Switch",
        severity="CRITICAL",
        category="Procurement",
        description="Switch to secondary supplier due to delivery delays.",
        cta_label="Initiate Supplier Switch",
        status="pending"
    )
    risk_persistence_repository.create_action(db_session, action)
    db_session.commit()

    fetched = risk_persistence_repository.get_action_by_id(db_session, action.id, comp.id)
    assert fetched is not None
    assert fetched.status == "pending"
    assert fetched.resolved_at is None

    # Resolve action
    fetched.status = "completed"
    fetched.resolved_at = datetime.now(timezone.utc)
    db_session.commit()

    updated = risk_persistence_repository.get_action_by_id(db_session, action.id, comp.id)
    assert updated.status == "completed"
    assert updated.resolved_at is not None


def test_executive_briefing_persistence(db_session):
    comp = Company(id=uuid4(), name="Briefing Corp", currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    db_session.add(comp)
    db_session.commit()

    briefing = ExecutiveBriefing(
        id=uuid4(),
        company_id=comp.id,
        summary_text="Enterprise risk remains stable at LOW severity.",
        critical_issues=[{"title": "Factory Maintenance", "severity": "MEDIUM"}],
        business_impact=["Potential delivery delay of 2 days."],
        priority_actions=[{"title": "Inspect Line 2", "priority": "MEDIUM"}]
    )
    risk_persistence_repository.create_briefing(db_session, briefing)
    db_session.commit()

    latest = risk_persistence_repository.get_latest_briefing(db_session, comp.id)
    assert latest is not None
    assert latest.summary_text == "Enterprise risk remains stable at LOW severity."
    assert len(latest.critical_issues) == 1
    assert len(latest.business_impact) == 1

    all_briefings = risk_persistence_repository.get_briefings(db_session, comp.id)
    assert len(all_briefings) == 1


@pytest.mark.anyio
async def test_ai_analysis_workflow_execution(db_session):
    comp = Company(id=uuid4(), name="Workflow Enterprise", currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    db_session.add(comp)
    db_session.commit()

    mock_provider = MockAIProvider(default_response='{"executive_summary": "All systems optimal.", "primary_vulnerability": "None", "key_observations": [], "strategic_outlook": "Positive"}')

    job_resp = ai_analysis_workflow_service.start_analysis_job(
        company_id=comp.id, provider=mock_provider, db=db_session
    )
    assert job_resp.job_id is not None
    assert job_resp.status in ("pending", "running")

    # Wait for completion
    for _ in range(30):
        await asyncio.sleep(0.1)
        status = ai_analysis_workflow_service.get_job_status(job_resp.job_id, comp.id)
        if status and status.status in ("completed", "failed"):
            break

    final_status = ai_analysis_workflow_service.get_job_status(job_resp.job_id, comp.id)
    assert final_status is not None
    assert final_status.status == "completed"
    assert final_status.result_summary is not None
    assert "overall_score" in final_status.result_summary

    # Verify that records were persisted
    latest_briefing = risk_persistence_repository.get_latest_briefing(db_session, comp.id)
    assert latest_briefing is not None
