import pytest
from decimal import Decimal
from uuid import uuid4

from app.models.company import Company
from app.services.tax import TaxService
from app.core.exceptions import (
    MissingTaxJurisdictionError,
    InapplicableTaxJurisdictionError,
    InvalidTaxRateError,
    InvalidTaxJurisdictionError,
)


def test_indian_gst_intra_state_calculation(db_session):
    # Setup company with country_code = 'IN' and state_code = '27' (Maharashtra)
    company = Company(
        id=uuid4(),
        name="Indian Enterprise",
        country_code="IN",
        state_code="27",
        currency_code="INR",
        region="Asia",
        fiscal_year_start_month=4,
        default_tax_rate=Decimal("18.00")
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # 1. Intra-State (MH to 27 - Both normalize to 27) Tax-Exclusive
    # 1000.00 @ 18% -> CGST (9%) = 90.00, SGST (9%) = 90.00, IGST = 0.00, Total = 1180.00
    res = service.calculate_tax(
        company_id=company.id,
        amount=Decimal("1000.00"),
        tax_rate=Decimal("18.00"),
        is_tax_inclusive=False,
        supplier_state="MH",
        customer_state="27",
        is_gst=True,
        hsn_sac_code="998311"
    )
    assert res.jurisdiction_type == "INTRA_STATE"
    assert res.supplier_state == "27"
    assert res.customer_state == "27"
    assert res.taxable_amount == Decimal("1000.00")
    assert res.total_tax == Decimal("180.00")
    assert res.cgst_rate == Decimal("9.00")
    assert res.cgst_amount == Decimal("90.00")
    assert res.sgst_rate == Decimal("9.00")
    assert res.sgst_amount == Decimal("90.00")
    assert res.igst_rate == Decimal("0.00")
    assert res.igst_amount == Decimal("0.00")
    assert res.total_amount == Decimal("1180.00")
    assert res.cgst_amount + res.sgst_amount == res.total_tax


def test_indian_gst_inter_state_calculation(db_session):
    company = Company(
        id=uuid4(),
        name="Indian Exporter",
        country_code="IN",
        state_code="27",
        currency_code="INR",
        region="Asia",
        fiscal_year_start_month=4
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # 2. Inter-State (MH / 27 to KA / 29) Tax-Exclusive
    # 1000.00 @ 18% -> IGST (18%) = 180.00, CGST = 0, SGST = 0
    res = service.calculate_tax(
        company_id=company.id,
        amount=Decimal("1000.00"),
        tax_rate=Decimal("18.00"),
        is_tax_inclusive=False,
        supplier_state="MH",
        customer_state="KA",
        is_gst=True
    )
    assert res.jurisdiction_type == "INTER_STATE"
    assert res.supplier_state == "27"
    assert res.customer_state == "29"
    assert res.cgst_amount == Decimal("0.00")
    assert res.sgst_amount == Decimal("0.00")
    assert res.igst_rate == Decimal("18.00")
    assert res.igst_amount == Decimal("180.00")
    assert res.total_amount == Decimal("1180.00")


def test_indian_gst_tax_inclusive_calculation(db_session):
    company = Company(
        id=uuid4(),
        name="Indian Retailer",
        country_code="IN",
        state_code="27",
        currency_code="INR",
        region="Asia",
        fiscal_year_start_month=4
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # Gross = 1180.00 @ 18% inclusive -> Taxable = 1000.00, Total Tax = 180.00, CGST = 90.00, SGST = 90.00
    res = service.calculate_tax(
        company_id=company.id,
        amount=Decimal("1180.00"),
        tax_rate=Decimal("18.00"),
        is_tax_inclusive=True,
        supplier_state="27",
        customer_state="27",
        is_gst=True
    )
    assert res.is_tax_inclusive is True
    assert res.taxable_amount == Decimal("1000.00")
    assert res.total_tax == Decimal("180.00")
    assert res.cgst_amount == Decimal("90.00")
    assert res.sgst_amount == Decimal("90.00")
    assert res.total_amount == Decimal("1180.00")


def test_indian_gst_penny_reconciliation_odd_cents(db_session):
    company = Company(
        id=uuid4(),
        name="Indian Odd Cent Co",
        country_code="IN",
        state_code="27",
        currency_code="INR",
        region="Asia",
        fiscal_year_start_month=4
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # Base = 84.17 @ 18% -> Total Tax = 15.1506 -> 15.15.
    # CGST = 15.15 / 2 = 7.575 -> 7.58, SGST = 15.15 - 7.58 = 7.57.
    res = service.calculate_tax(
        company_id=company.id,
        amount=Decimal("84.17"),
        tax_rate=Decimal("18.00"),
        is_tax_inclusive=False,
        supplier_state="27",
        customer_state="27",
        is_gst=True
    )
    assert res.total_tax == Decimal("15.15")
    assert res.cgst_amount == Decimal("7.58")
    assert res.sgst_amount == Decimal("7.57")
    assert res.cgst_amount + res.sgst_amount == res.total_tax


def test_country_gating_null_country_code(db_session):
    company = Company(
        id=uuid4(),
        name="Neutral Unclassified Co",
        country_code=None,
        currency_code="USD",
        region="Global",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # Requesting GST for NULL country company MUST fail with InapplicableTaxJurisdictionError
    with pytest.raises(InapplicableTaxJurisdictionError) as exc:
        service.calculate_tax(
            company_id=company.id,
            amount=Decimal("1000.00"),
            tax_rate=Decimal("18.00"),
            supplier_state="MH",
            customer_state="MH",
            is_gst=True
        )
    assert "requires Company country_code to be configured as 'IN'" in str(exc.value.detail)


def test_country_gating_non_indian_company(db_session):
    company = Company(
        id=uuid4(),
        name="US Enterprise",
        country_code="US",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # Requesting GST for US company MUST fail with InapplicableTaxJurisdictionError
    with pytest.raises(InapplicableTaxJurisdictionError) as exc:
        service.calculate_tax(
            company_id=company.id,
            amount=Decimal("1000.00"),
            tax_rate=Decimal("18.00"),
            supplier_state="MH",
            customer_state="MH",
            is_gst=True
        )
    assert "not applicable for company with country_code 'US'" in str(exc.value.detail)


def test_missing_state_jurisdiction_errors(db_session):
    company = Company(
        id=uuid4(),
        name="Indian Incomplete Co",
        country_code="IN",
        state_code=None,
        currency_code="INR",
        region="Asia",
        fiscal_year_start_month=4
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # Missing customer state
    with pytest.raises(MissingTaxJurisdictionError) as exc1:
        service.calculate_tax(
            company_id=company.id,
            amount=Decimal("1000.00"),
            tax_rate=Decimal("18.00"),
            supplier_state="27",
            customer_state=None,
            is_gst=True
        )
    assert "customer_state must be provided" in str(exc1.value.detail)

    # Missing supplier state (and company.state_code is None)
    with pytest.raises(MissingTaxJurisdictionError) as exc2:
        service.calculate_tax(
            company_id=company.id,
            amount=Decimal("1000.00"),
            tax_rate=Decimal("18.00"),
            supplier_state=None,
            customer_state="27",
            is_gst=True
        )
    assert "supplier_state must be provided" in str(exc2.value.detail)


def test_invalid_state_code_normalization(db_session):
    company = Company(
        id=uuid4(),
        name="Indian Invalid State Co",
        country_code="IN",
        state_code="27",
        currency_code="INR",
        region="Asia",
        fiscal_year_start_month=4
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # Invalid state code "XX"
    with pytest.raises(InvalidTaxJurisdictionError) as exc1:
        service.calculate_tax(
            company_id=company.id,
            amount=Decimal("1000.00"),
            tax_rate=Decimal("18.00"),
            supplier_state="XX",
            customer_state="27",
            is_gst=True
        )
    assert "Invalid Indian GST state code: 'XX'" in str(exc1.value.detail)

    # Invalid numeric code "99"
    with pytest.raises(InvalidTaxJurisdictionError) as exc2:
        service.calculate_tax(
            company_id=company.id,
            amount=Decimal("1000.00"),
            tax_rate=Decimal("18.00"),
            supplier_state="27",
            customer_state="99",
            is_gst=True
        )
    assert "Invalid Indian GST state code: '99'" in str(exc2.value.detail)


def test_tax_rate_precedence_and_zero_tax(db_session):
    company = Company(
        id=uuid4(),
        name="Default Tax Rate Co",
        country_code="IN",
        state_code="27",
        currency_code="INR",
        region="Asia",
        fiscal_year_start_month=4,
        default_tax_rate=Decimal("12.00")
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # 1. Explicit tax_rate (18.00) overrides company default (12.00)
    res_override = service.calculate_tax(
        company_id=company.id,
        amount=Decimal("1000.00"),
        tax_rate=Decimal("18.00"),
        supplier_state="27",
        customer_state="27",
        is_gst=True
    )
    assert res_override.tax_rate == Decimal("18.00")
    assert res_override.total_tax == Decimal("180.00")

    # 2. Omitted tax_rate falls back to company default (12.00)
    res_fallback = service.calculate_tax(
        company_id=company.id,
        amount=Decimal("1000.00"),
        tax_rate=None,
        supplier_state="27",
        customer_state="27",
        is_gst=True
    )
    assert res_fallback.tax_rate == Decimal("12.00")
    assert res_fallback.total_tax == Decimal("120.00")

    # 3. Explicit zero tax rate (0.00%) is valid and produces 0.00 tax
    res_zero = service.calculate_tax(
        company_id=company.id,
        amount=Decimal("1000.00"),
        tax_rate=Decimal("0.00"),
        supplier_state="27",
        customer_state="27",
        is_gst=True
    )
    assert res_zero.tax_rate == Decimal("0.00")
    assert res_zero.total_tax == Decimal("0.00")
    assert res_zero.cgst_amount == Decimal("0.00")
    assert res_zero.sgst_amount == Decimal("0.00")


def test_generic_non_gst_calculation(db_session):
    company = Company(
        id=uuid4(),
        name="Generic Global Co",
        country_code="US",
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1
    )
    db_session.add(company)
    db_session.commit()

    service = TaxService(db_session)

    # is_gst=False computes flat tax without CGST/SGST/IGST breakdown
    res = service.calculate_tax(
        company_id=company.id,
        amount=Decimal("500.00"),
        tax_rate=Decimal("7.50"),
        is_tax_inclusive=False,
        is_gst=False
    )
    assert res.jurisdiction_type == "GENERIC_NON_GST"
    assert res.taxable_amount == Decimal("500.00")
    assert res.total_tax == Decimal("37.50") # 500 * 0.075
    assert res.cgst_amount == Decimal("0.00")
    assert res.sgst_amount == Decimal("0.00")
    assert res.igst_amount == Decimal("0.00")
    assert res.total_amount == Decimal("537.50")
