import pytest
from datetime import date
from uuid import uuid4
from decimal import Decimal

from tests.conftest import setup_auth
from app.models.company import Company
from app.models.user import User
from app.models.role import Role
from app.core.jwt import create_access_token


def test_localization_config_success_admin_and_standard_user(db_session, client):
    """Verify GET /api/v1/localization/config returns correct configuration and formatting."""
    company_id, admin_id, headers_admin = setup_auth(db_session, client, role="admin", email_prefix="loc_adm")
    company = db_session.query(Company).filter(Company.id == company_id).first()
    company.country_code = "IN"
    company.timezone = "Asia/Kolkata"
    company.locale = "en-IN"
    company.currency_code = "INR"
    company.state_code = "27"
    company.gstin = "27ABCDE1234F1Z5"
    company.default_tax_rate = Decimal("18.00")
    company.fiscal_year_start_month = 4
    db_session.commit()

    # Admin access
    res_admin = client.get("/api/v1/localization/config", headers=headers_admin)
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["company_id"] == str(company.id)
    assert data_admin["country_code"] == "IN"
    assert data_admin["timezone"] == "Asia/Kolkata"
    assert data_admin["locale"] == "en-IN"
    assert data_admin["currency_code"] == "INR"
    assert data_admin["state_code"] == "27"
    assert data_admin["gstin"] == "27ABCDE1234F1Z5"
    assert data_admin["default_tax_rate"] == "18.00"
    assert data_admin["fiscal_year_start_month"] == 4
    assert data_admin["formatting"]["currency_symbol"] == "₹"
    assert data_admin["formatting"]["currency_decimals"] == 2
    assert data_admin["formatting"]["date_format"] == "YYYY-MM-DD"

    # Setup Standard User in the same company
    user_role = Role(id=uuid4(), company_id=company.id, name="standard_user")
    user = User(
        id=uuid4(),
        company_id=company.id,
        email=f"std_loc_{uuid4().hex[:6]}@example.com",
        full_name="Standard Test User",
        status="active"
    )
    db_session.add_all([user_role, user])
    db_session.commit()

    from app.models.user_role import UserRole
    db_session.add(UserRole(user_id=user.id, role_id=user_role.id))
    db_session.commit()

    user_token = create_access_token(user_id=user.id, company_id=company.id)
    headers_user = {"Authorization": f"Bearer {user_token}"}

    res_user = client.get("/api/v1/localization/config", headers=headers_user)
    assert res_user.status_code == 200
    assert res_user.json()["company_id"] == str(company.id)


def test_localization_config_country_neutrality(db_session, client):
    """Verify company with NULL country_code remains neutral and does not guess country."""
    company_id, user_id, headers = setup_auth(db_session, client, role="standard_user", email_prefix="loc_neutral")
    company = db_session.query(Company).filter(Company.id == company_id).first()
    company.country_code = None  # Neutral
    company.currency_code = "USD"
    company.tax_id = "US-987654321"
    company.fiscal_year_start_month = 1
    db_session.commit()

    res = client.get("/api/v1/localization/config", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["country_code"] is None
    assert data["currency_code"] == "USD"
    assert data["formatting"]["currency_symbol"] == "$"
    assert data["tax_id"] == "US-987654321"


def test_localization_config_unauthenticated(client):
    """Verify unauthenticated request returns 401."""
    res = client.get("/api/v1/localization/config")
    assert res.status_code == 401


def test_current_fiscal_year_endpoint(db_session, client):
    """Verify GET /api/v1/fiscal-year/current endpoint."""
    company_id, user_id, headers = setup_auth(db_session, client, role="standard_user", email_prefix="fy_curr")
    company = db_session.query(Company).filter(Company.id == company_id).first()
    company.fiscal_year_start_month = 4
    db_session.commit()

    res = client.get("/api/v1/fiscal-year/current", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["company_id"] == str(company.id)
    assert data["fiscal_year_start_month"] == 4
    assert data["as_of_date"] == str(date.today())
    assert "fiscal_year" in data
    assert "fiscal_quarter" in data
    assert "fiscal_period" in data
    assert "fiscal_year_start_date" in data
    assert "fiscal_year_end_date" in data


def test_fiscal_year_date_info_endpoint(db_session, client):
    """Verify GET /api/v1/fiscal-year/date-info endpoint with valid and invalid dates."""
    company_id, user_id, headers = setup_auth(db_session, client, role="standard_user", email_prefix="fy_date")
    company = db_session.query(Company).filter(Company.id == company_id).first()
    company.fiscal_year_start_month = 4
    db_session.commit()

    # Target date: 2026-08-15 (Start month = 4 -> FY2026 Q2 Period 5)
    res = client.get(
        "/api/v1/fiscal-year/date-info?target_date=2026-08-15",
        headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["company_id"] == str(company.id)
    assert data["as_of_date"] == "2026-08-15"
    assert data["fiscal_year"] == 2026
    assert data["fiscal_year_label"] == "FY2026-2027"
    assert data["fiscal_quarter"] == 2
    assert data["fiscal_quarter_label"] == "Q2"
    assert data["fiscal_period"] == 5
    assert data["fiscal_year_start_date"] == "2026-04-01"
    assert data["fiscal_year_end_date"] == "2027-03-31"
    assert data["quarter_start_date"] == "2026-07-01"
    assert data["quarter_end_date"] == "2026-09-30"

    # Invalid date format -> 422
    res_bad = client.get(
        "/api/v1/fiscal-year/date-info?target_date=invalid-date",
        headers=headers
    )
    assert res_bad.status_code == 422


def test_tenant_isolation_between_companies(db_session, client):
    """Verify tenant isolation on localization and fiscal year endpoints."""
    company_a_id, user_a_id, headers_a = setup_auth(db_session, client, role="admin", email_prefix="loc_iso_a")
    company_b_id, user_b_id, headers_b = setup_auth(db_session, client, role="standard_user", email_prefix="loc_iso_b")

    company_a = db_session.query(Company).filter(Company.id == company_a_id).first()
    company_a.currency_code = "INR"
    company_a.fiscal_year_start_month = 4

    company_b = db_session.query(Company).filter(Company.id == company_b_id).first()
    company_b.currency_code = "EUR"
    company_b.country_code = "DE"
    company_b.timezone = "Europe/Berlin"
    company_b.fiscal_year_start_month = 1
    db_session.commit()

    # Caller A gets Company A config
    res_a = client.get("/api/v1/localization/config", headers=headers_a)
    assert res_a.status_code == 200
    assert res_a.json()["company_id"] == str(company_a.id)
    assert res_a.json()["currency_code"] == "INR"

    # Caller B gets Company B config
    res_b = client.get("/api/v1/localization/config", headers=headers_b)
    assert res_b.status_code == 200
    assert res_b.json()["company_id"] == str(company_b.id)
    assert res_b.json()["currency_code"] == "EUR"
    assert res_b.json()["formatting"]["currency_symbol"] == "€"
