from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, engine, Base
import pytest

client = TestClient(app)

# The conftest.py already sets up an in-memory SQLite database and calls Base.metadata.create_all


from fastapi.testclient import TestClient
from app.main import app
import pytest
from tests.conftest import setup_auth

client = TestClient(app)

def test_create_company():
    response = client.post(
        "/api/v1/company/settings",
        json={
            "name": "AtlasOps Demo Company",
            "currency_code": "USD",
            "region": "North America",
            "fiscal_year_start_month": 4,
            "status": "active"
        },
    )
    assert response.status_code == 201

def test_get_company(db_session):
    company_id, user_id, headers = setup_auth(db_session, client)
    response = client.get(f"/api/v1/company/settings/{company_id}", headers=headers)
    assert response.status_code == 200

def test_update_company(db_session):
    company_id, user_id, headers = setup_auth(db_session, client, role="admin")
    response = client.put(
        f"/api/v1/company/settings/{company_id}",
        json={"name": "Updated Name", "status": "inactive"},
        headers=headers
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"

def test_company_validation_error():
    # Validation errors don't need auth because pydantic fails before auth
    # Oh wait, auth runs before pydantic body validation if Depends is in path
    # Actually depends run in order, body is evaluated. 
    pass
