from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import setup_auth

client = TestClient(app)

def test_reports_top_customers(db_session):
    company_id, user_id, headers = setup_auth(db_session, client)
    response = client.get("/api/v1/reports/top-customers?limit=5", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_reports_sales_by_product(db_session):
    company_id, user_id, headers = setup_auth(db_session, client)
    response = client.get("/api/v1/reports/sales-by-product?limit=5", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_reports_monthly_revenue_expenditure(db_session):
    company_id, user_id, headers = setup_auth(db_session, client)
    response = client.get("/api/v1/reports/monthly-revenue-expenditure?year=2026&month=9", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["year"] == 2026
    assert data["month"] == 9
