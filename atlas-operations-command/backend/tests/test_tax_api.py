import pytest
from decimal import Decimal
from uuid import uuid4

from tests.conftest import setup_auth
from app.models.company import Company
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole
from app.core.jwt import create_access_token


def test_tax_api_indian_gst_flow(db_session, client):
    # Setup Indian company and Admin user
    company_id, admin_id, headers_admin = setup_auth(db_session, client, role="admin", email_prefix="tax_adm")
    company = db_session.query(Company).filter(Company.id == company_id).first()
    company.country_code = "IN"
    company.state_code = "27"
    company.currency_code = "INR"
    db_session.commit()

    # 1. Admin calls tax calculation API for Intra-State (MH / 27)
    res_intra = client.post(
        "/api/v1/tax/calculate",
        json={
            "amount": "1000.00",
            "tax_rate": "18.00",
            "is_tax_inclusive": False,
            "supplier_state": "MH",
            "customer_state": "27",
            "is_gst": True,
            "hsn_sac_code": "998311"
        },
        headers=headers_admin
    )
    assert res_intra.status_code == 200
    data_intra = res_intra.json()
    assert data_intra["jurisdiction_type"] == "INTRA_STATE"
    assert data_intra["supplier_state"] == "27"
    assert data_intra["customer_state"] == "27"
    assert data_intra["taxable_amount"] == "1000.00"
    assert data_intra["cgst_amount"] == "90.00"
    assert data_intra["sgst_amount"] == "90.00"
    assert data_intra["igst_amount"] == "0.00"
    assert data_intra["total_amount"] == "1180.00"
    assert data_intra["hsn_sac_code"] == "998311"

    # 2. Standard user in the same company can also calculate tax
    std_user = User(id=uuid4(), company_id=company_id, email="std_tax_user@test.com", full_name="Std Tax User")
    db_session.add(std_user)
    r_std = Role(id=uuid4(), name="standard_user", company_id=company_id)
    db_session.add(r_std)
    db_session.commit()
    db_session.add(UserRole(user_id=std_user.id, role_id=r_std.id))
    db_session.commit()

    token_std = create_access_token(std_user.id, company_id)
    headers_std = {"Authorization": f"Bearer {token_std}"}

    res_std = client.post(
        "/api/v1/tax/calculate",
        json={
            "amount": "2000.00",
            "tax_rate": "18.00",
            "is_tax_inclusive": False,
            "supplier_state": "MH",
            "customer_state": "KA",
            "is_gst": True
        },
        headers=headers_std
    )
    assert res_std.status_code == 200
    data_std = res_std.json()
    assert data_std["jurisdiction_type"] == "INTER_STATE"
    assert data_std["igst_amount"] == "360.00"
    assert data_std["cgst_amount"] == "0.00"
    assert data_std["sgst_amount"] == "0.00"
    assert data_std["total_amount"] == "2360.00"


def test_tax_api_country_gating_and_validation_errors(db_session, client):
    # Setup non-Indian (US) company
    company_id, admin_id, headers_us = setup_auth(db_session, client, role="admin", email_prefix="tax_us")
    company = db_session.query(Company).filter(Company.id == company_id).first()
    company.country_code = "US"
    db_session.commit()

    # 1. Non-Indian company requesting Indian GST returns 422
    res_gst_us = client.post(
        "/api/v1/tax/calculate",
        json={
            "amount": "1000.00",
            "tax_rate": "18.00",
            "supplier_state": "MH",
            "customer_state": "MH",
            "is_gst": True
        },
        headers=headers_us
    )
    assert res_gst_us.status_code == 422
    assert "not applicable for company with country_code 'US'" in res_gst_us.json()["detail"]

    # 2. Generic tax calculation for US company succeeds
    res_generic = client.post(
        "/api/v1/tax/calculate",
        json={
            "amount": "1000.00",
            "tax_rate": "8.25",
            "is_gst": False
        },
        headers=headers_us
    )
    assert res_generic.status_code == 200
    assert res_generic.json()["jurisdiction_type"] == "GENERIC_NON_GST"
    assert res_generic.json()["total_tax"] == "82.50"
    assert res_generic.json()["total_amount"] == "1082.50"

    # 3. Negative amount validation (422 Unprocessable Entity)
    res_neg = client.post(
        "/api/v1/tax/calculate",
        json={
            "amount": "-500.00",
            "tax_rate": "10.00",
            "is_gst": False
        },
        headers=headers_us
    )
    assert res_neg.status_code == 422

    # 4. Tax rate > 100 validation (422 Unprocessable Entity)
    res_high_rate = client.post(
        "/api/v1/tax/calculate",
        json={
            "amount": "500.00",
            "tax_rate": "150.00",
            "is_gst": False
        },
        headers=headers_us
    )
    assert res_high_rate.status_code == 422

    # 5. Unauthenticated request returns 401
    res_unauth = client.post(
        "/api/v1/tax/calculate",
        json={"amount": "100.00", "is_gst": False}
    )
    assert res_unauth.status_code == 401
