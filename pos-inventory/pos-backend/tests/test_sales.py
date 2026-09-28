import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user

client = TestClient(app)

def mock_get_current_user_operator():
    return {"sub": "op1", "role": "operator", "branch_id": "BRANCH_A"}

def mock_get_current_user_admin():
    return {"sub": "admin1", "role": "admin"}

@pytest.fixture
def mock_invoice_service():
    with patch("app.api.v1.sales._invoice_service") as mock_service:
        yield mock_service

def test_get_sales_filters_by_branch(mock_invoice_service):
    app.dependency_overrides[get_current_user] = mock_get_current_user_operator
    
    # Return invoices from two different branches
    mock_invoice_service.get_recent_invoices_with_lines.return_value = [
        {"DocEntry": 1, "DocNum": 101, "U_Branch": "BRANCH_A"},
        {"DocEntry": 2, "DocNum": 102, "U_Branch": "BRANCH_B"}
    ]

    response = client.get("/api/v1/sales")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == 1
    assert "BRANCH_A" in data[0]["saleId"]

def test_get_sales_admin_sees_all(mock_invoice_service):
    app.dependency_overrides[get_current_user] = mock_get_current_user_admin
    
    mock_invoice_service.get_recent_invoices_with_lines.return_value = [
        {"DocEntry": 1, "DocNum": 101, "U_Branch": "BRANCH_A"},
        {"DocEntry": 2, "DocNum": 102, "U_Branch": "BRANCH_B"}
    ]

    response = client.get("/api/v1/sales")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

def test_get_sale_unauthorized_branch(mock_invoice_service):
    app.dependency_overrides[get_current_user] = mock_get_current_user_operator
    
    mock_invoice_service.get_invoice.return_value = {
        "DocEntry": 2, "DocNum": 102, "U_Branch": "BRANCH_B"
    }

    response = client.get("/api/v1/sales/2")
    assert response.status_code == 403
    assert "Forbidden: You can only view sales from your assigned branch" in response.json()["detail"]

def test_get_sale_authorized_branch(mock_invoice_service):
    app.dependency_overrides[get_current_user] = mock_get_current_user_operator
    
    mock_invoice_service.get_invoice.return_value = {
        "DocEntry": 1, "DocNum": 101, "U_Branch": "BRANCH_A"
    }

    response = client.get("/api/v1/sales/1")
    assert response.status_code == 200
    assert response.json()["id"] == 1
