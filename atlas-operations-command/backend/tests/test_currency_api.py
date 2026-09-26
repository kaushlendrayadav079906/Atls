import pytest
from datetime import date
from decimal import Decimal
from uuid import uuid4

from tests.conftest import setup_auth
from app.models.exchange_rate import ExchangeRate
from app.models.company import Company
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole
from app.core.jwt import create_access_token


def test_currency_api_workflow_and_rbac(db_session, client):
    # Setup Admin user and Company: setup_auth returns (company_id, user_id, headers)
    company_id, admin_id, headers_admin = setup_auth(db_session, client, role="admin", email_prefix="curr_adm")

    # 1. Admin creates direct exchange rate: EUR -> USD
    res_create = client.post(
        "/api/v1/currency/rates",
        json={
            "from_currency": "EUR",
            "to_currency": "USD",
            "rate": "1.085000",
            "effective_date": "2026-09-01"
        },
        headers=headers_admin
    )
    assert res_create.status_code == 201
    created_data = res_create.json()
    assert created_data["from_currency"] == "EUR"
    assert created_data["to_currency"] == "USD"
    assert created_data["rate"] == "1.085000"
    assert created_data["company_id"] == str(company_id)

    # 2. Duplicate exact rate creation returns 409 Conflict
    res_dup = client.post(
        "/api/v1/currency/rates",
        json={
            "from_currency": "EUR",
            "to_currency": "USD",
            "rate": "1.090000",
            "effective_date": "2026-09-01"
        },
        headers=headers_admin
    )
    assert res_dup.status_code == 409
    assert "already exists for this company" in res_dup.json()["detail"]

    # 3. Client cannot inject arbitrary company_id (must be forced to auth company)
    fake_company_id = str(uuid4())
    res_inject = client.post(
        "/api/v1/currency/rates",
        json={
            "from_currency": "GBP",
            "to_currency": "USD",
            "rate": "1.300000",
            "effective_date": "2026-09-01",
            "company_id": fake_company_id
        },
        headers=headers_admin
    )
    assert res_inject.status_code == 201
    assert res_inject.json()["company_id"] == str(company_id)

    # 4. Standard User in same company
    std_user = User(id=uuid4(), company_id=company_id, email="std_curr_user@test.com", full_name="Std User")
    db_session.add(std_user)
    r_std = Role(id=uuid4(), name="standard_user", company_id=company_id)
    db_session.add(r_std)
    db_session.commit()
    db_session.add(UserRole(user_id=std_user.id, role_id=r_std.id))
    db_session.commit()

    token_std = create_access_token(std_user.id, company_id)
    headers_std = {"Authorization": f"Bearer {token_std}"}

    # Standard user CANNOT create rates (403 Forbidden)
    res_std_create = client.post(
        "/api/v1/currency/rates",
        json={
            "from_currency": "JPY",
            "to_currency": "USD",
            "rate": "0.006800",
            "effective_date": "2026-09-01"
        },
        headers=headers_std
    )
    assert res_std_create.status_code == 403

    # Standard user CAN list rates (200 OK)
    res_list = client.get("/api/v1/currency/rates", headers=headers_std)
    assert res_list.status_code == 200
    rate_list = res_list.json()
    assert len(rate_list) >= 2

    # Standard user CAN perform currency conversion (200 OK)
    res_convert = client.post(
        "/api/v1/currency/convert",
        json={
            "amount": "1500.00",
            "from_currency": "EUR",
            "to_currency": "USD",
            "target_date": "2026-09-07"
        },
        headers=headers_std
    )
    assert res_convert.status_code == 200
    conv_data = res_convert.json()
    assert conv_data["original_amount"] == "1500.00"
    assert conv_data["exchange_rate"] == "1.085000"
    assert conv_data["converted_amount"] == "1627.50"

    # Missing foreign rate conversion returns 422 Unprocessable Entity
    res_missing = client.post(
        "/api/v1/currency/convert",
        json={
            "amount": "100.00",
            "from_currency": "AUD",
            "to_currency": "USD",
            "target_date": "2026-09-07"
        },
        headers=headers_std
    )
    assert res_missing.status_code == 422
    assert "No exchange rate found for AUD->USD" in res_missing.json()["detail"]

    # Same currency conversion works without explicit rate
    res_same = client.post(
        "/api/v1/currency/convert",
        json={
            "amount": "250.00",
            "from_currency": "USD",
            "to_currency": "USD",
            "target_date": "2026-09-07"
        },
        headers=headers_std
    )
    assert res_same.status_code == 200
    assert res_same.json()["converted_amount"] == "250.00"
    assert res_same.json()["exchange_rate"] == "1.000000"


def test_currency_tenant_isolation(db_session, client):
    # Setup Company A and Company B
    company_id_a, user_id_a, headers_a = setup_auth(db_session, client, role="admin", email_prefix="tenant_a")
    company_id_b, user_id_b, headers_b = setup_auth(db_session, client, role="admin", email_prefix="tenant_b")

    # Company A adds private rate for CAD -> USD
    res_a = client.post(
        "/api/v1/currency/rates",
        json={
            "from_currency": "CAD",
            "to_currency": "USD",
            "rate": "0.740000",
            "effective_date": "2026-09-01"
        },
        headers=headers_a
    )
    assert res_a.status_code == 201

    # Company B listing rates should NOT see Company A's CAD -> USD rate
    res_b_list = client.get("/api/v1/currency/rates?from_currency=CAD", headers=headers_b)
    assert res_b_list.status_code == 200
    assert len(res_b_list.json()) == 0

    # Company B convert CAD -> USD must fail with 422 (cannot use Company A's rate)
    res_b_conv = client.post(
        "/api/v1/currency/convert",
        json={
            "amount": "1000.00",
            "from_currency": "CAD",
            "to_currency": "USD",
            "target_date": "2026-09-07"
        },
        headers=headers_b
    )
    assert res_b_conv.status_code == 422
