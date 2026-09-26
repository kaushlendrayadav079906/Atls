import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user

client = TestClient(app)

@pytest.fixture
def mock_invoices():
    return [
        {
            "DocEntry": 1,
            "DocNum": 1001,
            "DocTotal": 110.0,
            "U_P_Method": "card",
            "U_Branch": "B1",
            "DocDate": "2026-09-26T00:00:00Z"
        }
    ]

@pytest.fixture
def manager_token():
    app.dependency_overrides[get_current_user] = lambda: {"id": "m1", "role": "manager", "branch_id": "B1"}
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def admin_token():
    app.dependency_overrides[get_current_user] = lambda: {"id": "a1", "role": "admin", "branch_id": "B1"}
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def operator_token():
    app.dependency_overrides[get_current_user] = lambda: {"id": "u1", "role": "user", "branch_id": "B1"}
    yield
    app.dependency_overrides.clear()

def test_atlas_overview_manager_access(manager_token, monkeypatch, mock_invoices):
    monkeypatch.setattr("app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date", lambda self, s, e: mock_invoices)
    response = client.get("/api/v1/atlas/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["totalSales"] == 110.0
    assert data["invoiceCount"] == 1

def test_atlas_overview_operator_denied(operator_token):
    response = client.get("/api/v1/atlas/overview")
    assert response.status_code == 403

def test_atlas_branch_comparison_manager_denied(manager_token):
    response = client.get("/api/v1/atlas/branch-comparison")
    assert response.status_code == 403

def test_atlas_branch_comparison_admin_allowed(admin_token, monkeypatch, mock_invoices):
    monkeypatch.setattr("app.api.v1.atlas.SAPInvoicesService.get_invoices_by_date", lambda self, s, e: mock_invoices)
    monkeypatch.setattr("app.api.v1.atlas.SAPWarehousesService.get_warehouses", lambda self: [{"WarehouseCode": "B1", "WarehouseName": "Branch 1"}])
    response = client.get("/api/v1/atlas/branch-comparison")
    assert response.status_code == 200
    data = response.json()
    assert len(data["branches"]) > 0
    assert data["branches"][0]["branchId"] == "B1"

def test_atlas_inventory_summary_no_branch(admin_token):
    response = client.get("/api/v1/atlas/inventory-summary")
    assert response.status_code == 400
    assert "Branch must be provided" in response.json()["detail"]
