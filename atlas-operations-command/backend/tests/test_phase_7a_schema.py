import pytest
from datetime import date
from decimal import Decimal
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.company import Company
from app.models.financial_transaction import FinancialTransaction
from app.models.exchange_rate import ExchangeRate
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyRead
from app.schemas.business import FinancialTransactionBase, FinancialTransactionResponse


def test_phase_7a_company_schema_and_defaults(db_session: Session):
    """Verify Company Phase 7A model fields, safe neutral defaults, and validation."""
    company = Company(
        id=uuid4(),
        name="Phase 7A Test Enterprise",
        currency_code="EUR",
        region="Europe",
        fiscal_year_start_month=4
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    # Verify defaults
    assert company.country_code is None
    assert company.timezone == "UTC"
    assert company.locale == "en-US"
    assert company.state_code is None
    assert company.gstin is None
    assert company.tax_id is None
    assert company.default_tax_rate == Decimal("0.00")

    # Update with specific regional/tax configurations
    company.country_code = "IN"
    company.state_code = "27"
    company.gstin = "27ABCDE1234F1Z5"
    company.tax_id = "VAT987654"
    company.default_tax_rate = Decimal("18.00")
    db_session.commit()
    db_session.refresh(company)

    assert company.country_code == "IN"
    assert company.state_code == "27"
    assert company.gstin == "27ABCDE1234F1Z5"
    assert company.default_tax_rate == Decimal("18.00")


def test_phase_7a_financial_transaction_fields(db_session: Session):
    """Verify FinancialTransaction Phase 7A multi-currency, base amount, and tax fields."""
    company = Company(
        id=uuid4(),
        name="Financial Test Co",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()

    tx = FinancialTransaction(
        id=uuid4(),
        company_id=company.id,
        transaction_date=date(2026, 9, 7),
        transaction_type="revenue",
        amount=Decimal("1500.00"),
        currency_code="USD",
        amount_base=Decimal("1500.00"),
        exchange_rate=Decimal("1.000000"),
        tax_rate=Decimal("10.00"),
        tax_amount=Decimal("150.00"),
        is_tax_inclusive=False,
        hsn_sac_code="998311"
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)

    assert tx.amount == Decimal("1500.00")
    assert tx.amount_base == Decimal("1500.00")
    assert tx.exchange_rate == Decimal("1.000000")
    assert tx.tax_rate == Decimal("10.00")
    assert tx.tax_amount == Decimal("150.00")
    assert tx.is_tax_inclusive is False
    assert tx.hsn_sac_code == "998311"


def test_phase_7a_exchange_rate_model_and_uniqueness(db_session: Session):
    """Verify ExchangeRate model persistence, Decimal precision, and uniqueness constraint."""
    company = Company(
        id=uuid4(),
        name="Exchange Rate Co",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()

    rate1 = ExchangeRate(
        id=uuid4(),
        company_id=company.id,
        from_currency="EUR",
        to_currency="USD",
        rate=Decimal("1.085000"),
        effective_date=date(2026, 9, 1)
    )
    db_session.add(rate1)
    db_session.commit()
    db_session.refresh(rate1)

    assert rate1.rate == Decimal("1.085000")
    assert rate1.from_currency == "EUR"
    assert rate1.to_currency == "USD"

    # Attempt duplicate insert for same (company_id, from_currency, to_currency, effective_date)
    rate_dup = ExchangeRate(
        id=uuid4(),
        company_id=company.id,
        from_currency="EUR",
        to_currency="USD",
        rate=Decimal("1.090000"),
        effective_date=date(2026, 9, 1)
    )
    db_session.add(rate_dup)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_phase_7a_no_fake_seed_rates_in_db(db_session: Session):
    """Verify that no arbitrary market exchange rates were seeded during migration."""
    # Global rates (company_id IS NULL) must be exactly 0
    global_rates_count = db_session.query(ExchangeRate).filter(ExchangeRate.company_id.is_(None)).count()
    assert global_rates_count == 0


def test_phase_7a_company_schema_validation():
    """Verify Pydantic schemas enforce Phase 7A validation constraints."""
    valid_data = {
        "name": "Validation Test Co",
        "currency_code": "INR",
        "region": "India",
        "fiscal_year_start_month": 4,
        "status": "active",
        "country_code": "IN",
        "timezone": "Asia/Kolkata",
        "locale": "en-IN",
        "state_code": "29",
        "gstin": "29ABCDE1234F1Z5",
        "tax_id": "TAX12345",
        "default_tax_rate": Decimal("18.00")
    }
    schema = CompanyCreate(**valid_data)
    assert schema.country_code == "IN"
    assert schema.default_tax_rate == Decimal("18.00")

    # Invalid country_code (not 2 chars)
    with pytest.raises(Exception):
        CompanyCreate(**{**valid_data, "country_code": "IND"})

    # Invalid tax_rate (> 100)
    with pytest.raises(Exception):
        CompanyCreate(**{**valid_data, "default_tax_rate": Decimal("150.00")})
