import pytest
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from app.models.company import Company
from app.models.exchange_rate import ExchangeRate
from app.services.currency import CurrencyService
from app.core.exceptions import CurrencyRateNotFoundError, DuplicateExchangeRateError


def test_same_currency_identity(db_session):
    service = CurrencyService(db_session)
    company_id = uuid4()
    
    # Same currency (USD -> USD) returns 1.000000 without DB lookup
    rate = service.get_exchange_rate(
        company_id=company_id,
        from_currency="USD",
        to_currency="USD",
        target_date=date(2026, 9, 7)
    )
    assert rate == Decimal("1.000000")

    # Case insensitive
    rate_lower = service.get_exchange_rate(
        company_id=company_id,
        from_currency="eur",
        to_currency="EUR",
        target_date=date(2026, 9, 7)
    )
    assert rate_lower == Decimal("1.000000")

    converted_amount, applied_rate = service.convert_currency(
        company_id=company_id,
        amount=Decimal("1500.00"),
        from_currency="USD",
        to_currency="USD"
    )
    assert applied_rate == Decimal("1.000000")
    assert converted_amount == Decimal("1500.00")


def test_direct_pair_and_no_automatic_inversion(db_session):
    company = Company(
        name="FX Direct Pair Co",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    service = CurrencyService(db_session)

    # Create explicit EUR -> USD rate
    service.create_rate(
        company_id=company.id,
        from_currency="EUR",
        to_currency="USD",
        rate=Decimal("1.085000"),
        effective_date=date(2026, 9, 1)
    )

    # Direct pair EUR -> USD resolves successfully
    rate_direct = service.get_exchange_rate(
        company_id=company.id,
        from_currency="EUR",
        to_currency="USD",
        target_date=date(2026, 9, 7)
    )
    assert rate_direct == Decimal("1.085000")

    # USD -> EUR MUST NOT automatically inverse (1 / 1.085); must raise CurrencyRateNotFoundError
    with pytest.raises(CurrencyRateNotFoundError) as exc_info:
        service.get_exchange_rate(
            company_id=company.id,
            from_currency="USD",
            to_currency="EUR",
            target_date=date(2026, 9, 7)
        )
    assert "No exchange rate found for USD->EUR" in str(exc_info.value.detail)


def test_scope_precedence_company_older_vs_global_newer(db_session):
    company = Company(
        name="Precedence Co 1",
        currency_code="USD",
        region="EU",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    service = CurrencyService(db_session)

    # Company rate on 2026-08-01 = 1.100000
    service.create_rate(
        company_id=company.id,
        from_currency="EUR",
        to_currency="USD",
        rate=Decimal("1.100000"),
        effective_date=date(2026, 8, 1)
    )

    # Global rate on 2026-09-01 = 1.050000 (Newer than company rate)
    global_rate = ExchangeRate(
        company_id=None,
        from_currency="EUR",
        to_currency="USD",
        rate=Decimal("1.050000"),
        effective_date=date(2026, 9, 1)
    )
    db_session.add(global_rate)
    db_session.commit()

    # Scope-First Precedence: Company rate (1.100000) MUST be used even though global rate is newer
    rate = service.get_exchange_rate(
        company_id=company.id,
        from_currency="EUR",
        to_currency="USD",
        target_date=date(2026, 9, 5)
    )
    assert rate == Decimal("1.100000")

    # Cleanup global test rate
    db_session.delete(global_rate)
    db_session.commit()


def test_scope_precedence_company_newer_vs_global_older(db_session):
    company = Company(
        name="Precedence Co 2",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    service = CurrencyService(db_session)

    # Global rate on 2026-08-01 = 1.050000
    global_rate = ExchangeRate(
        company_id=None,
        from_currency="GBP",
        to_currency="USD",
        rate=Decimal("1.250000"),
        effective_date=date(2026, 8, 1)
    )
    db_session.add(global_rate)
    db_session.commit()

    # Company rate on 2026-09-01 = 1.300000
    service.create_rate(
        company_id=company.id,
        from_currency="GBP",
        to_currency="USD",
        rate=Decimal("1.300000"),
        effective_date=date(2026, 9, 1)
    )

    # Company rate (1.300000) selected
    rate = service.get_exchange_rate(
        company_id=company.id,
        from_currency="GBP",
        to_currency="USD",
        target_date=date(2026, 9, 5)
    )
    assert rate == Decimal("1.300000")

    # Cleanup global test rate
    db_session.delete(global_rate)
    db_session.commit()


def test_global_fallback_when_no_company_rate(db_session):
    company = Company(
        name="Precedence Co 3",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    service = CurrencyService(db_session)

    # Global rate exists for JPY -> USD
    global_rate = ExchangeRate(
        company_id=None,
        from_currency="JPY",
        to_currency="USD",
        rate=Decimal("0.006800"),
        effective_date=date(2026, 9, 1)
    )
    db_session.add(global_rate)
    db_session.commit()

    # Fallback to global rate succeeds
    rate = service.get_exchange_rate(
        company_id=company.id,
        from_currency="JPY",
        to_currency="USD",
        target_date=date(2026, 9, 5)
    )
    assert rate == Decimal("0.006800")

    # Cleanup global test rate
    db_session.delete(global_rate)
    db_session.commit()


def test_no_future_rate_allowed(db_session):
    company = Company(
        name="Future Rate Co",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    service = CurrencyService(db_session)

    # Rate effective in the future: 2026-09-10
    service.create_rate(
        company_id=company.id,
        from_currency="CAD",
        to_currency="USD",
        rate=Decimal("0.750000"),
        effective_date=date(2026, 9, 10)
    )

    # Target date is 2026-09-07 (before effective date) -> Must fail
    with pytest.raises(CurrencyRateNotFoundError) as exc_info:
        service.get_exchange_rate(
            company_id=company.id,
            from_currency="CAD",
            to_currency="USD",
            target_date=date(2026, 9, 7)
        )
    assert "No exchange rate found for CAD->USD" in str(exc_info.value.detail)


def test_duplicate_rate_creation_rejection(db_session):
    company = Company(
        name="Duplicate Rate Co",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    service = CurrencyService(db_session)

    service.create_rate(
        company_id=company.id,
        from_currency="CHF",
        to_currency="USD",
        rate=Decimal("1.120000"),
        effective_date=date(2026, 9, 1)
    )

    # Duplicate exact (company_id, from_currency, to_currency, effective_date) must raise DuplicateExchangeRateError
    with pytest.raises(DuplicateExchangeRateError) as exc_info:
        service.create_rate(
            company_id=company.id,
            from_currency="CHF",
            to_currency="USD",
            rate=Decimal("1.150000"),
            effective_date=date(2026, 9, 1)
        )
    assert "already exists for this company" in str(exc_info.value.detail)


def test_decimal_precision_and_rounding(db_session):
    company = Company(
        name="Precision Co",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    service = CurrencyService(db_session)

    # 1500.00 EUR * 1.085000 = 1627.50
    service.create_rate(
        company_id=company.id,
        from_currency="EUR",
        to_currency="USD",
        rate=Decimal("1.085000"),
        effective_date=date(2026, 9, 1)
    )

    amount_base, rate = service.convert_to_company_base(
        company_id=company.id,
        amount=Decimal("1500.00"),
        transaction_currency="EUR",
        transaction_date=date(2026, 9, 2)
    )
    assert rate == Decimal("1.085000")
    assert amount_base == Decimal("1627.50")

    # Rounding HALF_UP verification: 10.555 * 1.000000 -> 10.56
    converted_amount, _ = service.convert_currency(
        company_id=company.id,
        amount=Decimal("10.555"),
        from_currency="USD",
        to_currency="USD"
    )
    assert converted_amount == Decimal("10.56")
