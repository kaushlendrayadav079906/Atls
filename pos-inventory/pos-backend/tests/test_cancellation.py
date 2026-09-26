import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user
from app.services.sap.client import SAPValidationError

client = TestClient(app)

def mock_get_current_user_operator():
    return {"sub": "op1", "role": "operator", "branch_id": "BRANCH_A"}

def mock_get_current_user_manager():
    return {"sub": "mgr1", "role": "manager", "branch_id": "BRANCH_A"}

def mock_get_current_user_admin():
    return {"sub": "admin1", "role": "admin"}

@pytest.fixture
def mock_invoice_service():
    with patch("app.api.v1.sales._invoice_service") as mock_service:
        yield mock_service


def test_cancel_sale_success(mock_invoice_service):
    app.dependency_overrides[get_current_user] = mock_get_current_user_manager
    
    mock_invoice_service.get_invoice.return_value = {
        "DocEntry": 123,
        "DocNum": 1000123,
        "U_Branch": "BRANCH_A",
        "Cancelled": "tNO",
        "DocumentStatus": "bost_Open"
    }
    mock_invoice_service.cancel_invoice.return_value = True

    response = client.post("/api/v1/sales/123/cancel")
    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Sale cancelled successfully."}


def test_cancel_sale_unauthorized_branch_operator(mock_invoice_service):
    app.dependency_overrides[get_current_user] = mock_get_current_user_operator
    
    # Operator from BRANCH_A trying to cancel invoice from BRANCH_B
    mock_invoice_service.get_invoice.return_value = {
        "DocEntry": 124,
        "U_Branch": "BRANCH_B",
        "Cancelled": "tNO",
        "DocumentStatus": "bost_Open"
    }

    response = client.post("/api/v1/sales/124/cancel")
    assert response.status_code == 403
    assert "Operators can only void sales from their own branch" in response.json()["detail"]


def test_cancel_sale_already_cancelled(mock_invoice_service):
    app.dependency_overrides[get_current_user] = mock_get_current_user_admin
    
    mock_invoice_service.get_invoice.return_value = {
        "DocEntry": 125,
        "U_Branch": "BRANCH_A",
        "Cancelled": "tYES",
        "DocumentStatus": "bost_Close"
    }

    response = client.post("/api/v1/sales/125/cancel")
    assert response.status_code == 400
    assert "Sale is already cancelled" in response.json()["detail"]


def test_cancel_sale_linked_payment(mock_invoice_service):
    app.dependency_overrides[get_current_user] = mock_get_current_user_admin
    
    mock_invoice_service.get_invoice.return_value = {
        "DocEntry": 126,
        "U_Branch": "BRANCH_A",
        "Cancelled": "tNO",
        "DocumentStatus": "bost_Open"
    }
    mock_invoice_service.cancel_invoice.side_effect = SAPValidationError(
        400, "Cannot cancel document; payment exists or reconciled"
    )

    response = client.post("/api/v1/sales/126/cancel")
    assert response.status_code == 400
    assert "linked to a payment" in response.json()["detail"]


def test_cancel_sale_not_found(mock_invoice_service):
    app.dependency_overrides[get_current_user] = mock_get_current_user_admin
    mock_invoice_service.get_invoice.return_value = None

    response = client.post("/api/v1/sales/999/cancel")
    assert response.status_code == 404
    assert "Sale 999 not found" in response.json()["detail"]
