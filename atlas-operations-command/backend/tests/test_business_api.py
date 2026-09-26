from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import setup_auth

client = TestClient(app)

def test_business_data_sap(db_session):
    company_id, user_id, headers = setup_auth(db_session, client)
    response = client.get("/api/v1/business-data/sap", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"
    assert "SAP integration is not configured" in response.json()["message"]

def test_business_data_organic(db_session):
    company_id, user_id, headers = setup_auth(db_session, client)
    response = client.get("/api/v1/business-data/organic", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_revenue" in data
    assert "total_expenditure" in data
    assert "net_profit" in data
    assert "active_factories" in data
