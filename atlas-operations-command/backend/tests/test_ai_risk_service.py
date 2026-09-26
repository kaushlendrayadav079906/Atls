import pytest
from uuid import uuid4
import json
from app.models.company import Company
from app.models.factory import Factory
from app.models.financial_transaction import FinancialTransaction
from app.models.inventory_item import InventoryItem
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.product import Product
from app.services.ai_risk_service import ai_risk_service
from app.services.executive_briefing import executive_briefing_service
from app.services.recommendation_engine import recommendation_engine
from app.integrations.ai.mock import MockAIProvider


@pytest.mark.anyio
async def test_ai_risk_service_with_mock_provider(db_session):
    company = Company(id=uuid4(), name="AI Risk Test Corp", currency_code="USD", region="NA", fiscal_year_start_month=1)
    db_session.add(company)
    db_session.commit()

    factory = Factory(id=uuid4(), company_id=company.id, name="Plant Alpha", status="active")
    db_session.add(factory)
    db_session.commit()

    # Add transactions
    from datetime import date
    db_session.add(FinancialTransaction(
        id=uuid4(), company_id=company.id, factory_id=factory.id,
        transaction_date=date(2026, 8, 1), transaction_type="revenue", amount=200000.0, currency_code="USD"
    ))
    db_session.add(FinancialTransaction(
        id=uuid4(), company_id=company.id, factory_id=factory.id,
        transaction_date=date(2026, 8, 2), transaction_type="expenditure", amount=150000.0, currency_code="USD"
    ))
    db_session.commit()

    canned_ai_json = json.dumps({
        "executive_summary": "Company exhibits healthy operational margin with low volatility.",
        "primary_vulnerability": "Single plant concentration.",
        "key_observations": ["Margin is positive at 25%", "No stockout risks detected"],
        "strategic_outlook": "Positive growth trajectory."
    })
    mock_provider = MockAIProvider(default_response=canned_ai_json)

    res = await ai_risk_service.evaluate_risk(db_session, company.id, provider=mock_provider)

    assert res.overall_score >= 0.0
    assert res.ai_enriched is True
    assert res.ai_qualitative_analysis is not None
    assert res.ai_qualitative_analysis.executive_summary == "Company exhibits healthy operational margin with low volatility."


@pytest.mark.anyio
async def test_ai_risk_service_timeout_fallback(db_session):
    company = Company(id=uuid4(), name="Timeout Corp", currency_code="EUR", region="EU", fiscal_year_start_month=1)
    db_session.add(company)
    db_session.commit()

    mock_provider = MockAIProvider(simulate_timeout=True)

    res = await ai_risk_service.evaluate_risk(db_session, company.id, provider=mock_provider)

    assert res.overall_score >= 0.0
    assert res.ai_enriched is False
    assert res.ai_qualitative_analysis is None


@pytest.mark.anyio
async def test_ai_risk_service_malformed_json_fallback(db_session):
    company = Company(id=uuid4(), name="Malformed Corp", currency_code="USD", region="APAC", fiscal_year_start_month=1)
    db_session.add(company)
    db_session.commit()

    mock_provider = MockAIProvider(default_response="Not valid JSON at all")

    res = await ai_risk_service.evaluate_risk(db_session, company.id, provider=mock_provider)

    assert res.overall_score >= 0.0
    assert res.ai_enriched is False


@pytest.mark.anyio
async def test_ai_risk_service_unavailable_fallback(db_session):
    company = Company(id=uuid4(), name="Unavailable Corp", currency_code="USD", region="APAC", fiscal_year_start_month=1)
    db_session.add(company)
    db_session.commit()

    mock_provider = MockAIProvider(simulate_unavailable=True)

    res = await ai_risk_service.evaluate_risk(db_session, company.id, provider=mock_provider)

    assert res.overall_score >= 0.0
    assert res.ai_enriched is False


@pytest.mark.anyio
async def test_executive_briefing_generation(db_session):
    company = Company(id=uuid4(), name="Executive Briefing Corp", currency_code="USD", region="LATAM", fiscal_year_start_month=1)
    db_session.add(company)
    db_session.commit()

    mock_provider = MockAIProvider(default_response=json.dumps({
        "executive_summary": "Synthesized executive briefing: Stable posture.",
        "primary_vulnerability": "None",
        "key_observations": ["Operations nominal"],
        "strategic_outlook": "Stable"
    }))

    briefing = await executive_briefing_service.generate_briefing(db_session, company.id, provider=mock_provider)

    assert briefing.company_id == company.id
    assert briefing.overall_risk_score >= 0.0
    assert briefing.financial_highlights is not None
    assert briefing.operational_highlights is not None
    assert briefing.supply_highlights is not None
    assert len(briefing.top_recommendations) > 0
