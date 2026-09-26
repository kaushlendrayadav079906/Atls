import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services import approval_service

client = TestClient(app)

@pytest.fixture
def mock_invoice():
    with patch("app.api.v1.returns.SAPInvoicesService") as mock:
        instance = mock.return_value
        instance.get_invoice.return_value = {"DocNum": 12345, "DocEntry": 1, "DocTotal": 100.0}
        yield instance

@pytest.fixture
def mock_returns_service():
    with patch("app.api.v1.admin.SAPReturnsService") as mock:
        instance = mock.return_value
        instance.create_credit_note_from_invoice.return_value = {"DocNum": 999, "DocEntry": 9}
        yield instance

@pytest.fixture
def mock_admin_invoice():
    with patch("app.api.v1.admin.SAPInvoicesService") as mock:
        instance = mock.return_value
        instance.get_invoice.return_value = {"DocNum": 12345, "DocEntry": 1, "DocTotal": 100.0}
        instance.create_invoice.return_value = {"DocNum": 555, "DocEntry": 5}
        yield instance

@pytest.fixture
def override_get_current_user():
    def _get_current_user():
        return {"id": "user123", "username": "operator", "role": "user", "branch_id": "BR1"}
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = _get_current_user
    yield _get_current_user
    app.dependency_overrides.clear()

@pytest.fixture
def override_admin_user():
    def _require_admin():
        return {"id": "admin123", "username": "admin", "role": "admin", "branch_id": "BR1"}
    from app.core.security import require_admin
    app.dependency_overrides[require_admin] = _require_admin
    yield _require_admin
    app.dependency_overrides.clear()


def test_create_return_requires_approval(mock_invoice, override_get_current_user):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [
            {
                "itemCode": "ITM1",
                "itemName": "Item 1",
                "quantity": 1,
                "unitPrice": 100.0,
                "lineTotal": 100.0,
                "baseLine": 0
            }
        ],
        "reason": "Test Return",
        "returnType": "refund",
        "warehouse": "BR1"
    }

    response = client.post("/api/v1/returns", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "pending_approval"
    assert data["requestId"] is not None

def test_admin_can_approve_request(mock_invoice, override_get_current_user, override_admin_user, mock_returns_service, mock_admin_invoice):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100.0, "lineTotal": 100.0, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
        "warehouse": "BR1"
    }
    response = client.post("/api/v1/returns", json=payload)
    req_id = response.json()["requestId"]

    app_response = client.post(f"/api/v1/admin/approvals/{req_id}/approve")
    assert app_response.status_code == 200
    
    req = approval_service.get_approval_request(req_id)
    assert req["status"] == "completed"
    assert req["payload"].get("creditNoteDocEntry") == 9

def test_self_approval_prevented(mock_invoice):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100.0, "lineTotal": 100.0, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
        "warehouse": "BR1"
    }

    def _get_admin_user():
        return {"id": "admin123", "username": "admin", "role": "admin", "branch_id": "BR1"}

    from app.core.security import get_current_user, require_admin
    app.dependency_overrides[get_current_user] = _get_admin_user
    app.dependency_overrides[require_admin] = _get_admin_user

    response = client.post("/api/v1/returns", json=payload)
    req_id = response.json()["requestId"]

    app_response = client.post(f"/api/v1/admin/approvals/{req_id}/approve")
    assert app_response.status_code == 403
    app.dependency_overrides.clear()

def test_duplicate_approval_prevented(mock_invoice, override_get_current_user, override_admin_user, mock_returns_service, mock_admin_invoice):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100.0, "lineTotal": 100.0, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
        "warehouse": "BR1"
    }
    response = client.post("/api/v1/returns", json=payload)
    req_id = response.json()["requestId"]

    # First approve
    app_response = client.post(f"/api/v1/admin/approvals/{req_id}/approve")
    assert app_response.status_code == 200

    # Second approve should fail
    app_response2 = client.post(f"/api/v1/admin/approvals/{req_id}/approve")
    assert app_response2.status_code == 400

def test_revalidation_failure(mock_invoice, override_get_current_user, override_admin_user, mock_returns_service, mock_admin_invoice):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100.0, "lineTotal": 100.0, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
        "warehouse": "BR1"
    }
    response = client.post("/api/v1/returns", json=payload)
    req_id = response.json()["requestId"]

    # Make revalidation fail
    mock_admin_invoice.get_invoice.return_value = None

    app_response = client.post(f"/api/v1/admin/approvals/{req_id}/approve")
    assert app_response.status_code == 404

def test_exchange_success(mock_invoice, override_get_current_user, override_admin_user, mock_returns_service, mock_admin_invoice):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "returnItems": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100.0, "lineTotal": 100.0, "baseLine": 0, "product": {"id": "ITM1", "price": 100}}],
        "replacementItems": [{"product": {"id": "ITM2", "name": "Item 2", "price": 120.0, "category": "C", "brand": "B"}, "quantity": 1}],
        "reason": "Exchange",
        "cardCode": "C0001",
        "warehouse": "BR1"
    }
    response = client.post("/api/v1/returns/exchange", json=payload)
    assert response.status_code == 202
    req_id = response.json()["requestId"]

    app_response = client.post(f"/api/v1/admin/approvals/{req_id}/approve")
    assert app_response.status_code == 200

    req = approval_service.get_approval_request(req_id)
    assert req["status"] == "completed"
    assert req["payload"].get("creditNoteDocEntry") == 9
    assert req["payload"].get("newInvoiceDocEntry") == 5

def test_exchange_credit_note_failure(mock_invoice, override_get_current_user, override_admin_user, mock_returns_service, mock_admin_invoice):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "returnItems": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100.0, "lineTotal": 100.0, "baseLine": 0, "product": {"id": "ITM1", "price": 100}}],
        "replacementItems": [{"product": {"id": "ITM2", "name": "Item 2", "price": 120.0, "category": "C", "brand": "B"}, "quantity": 1}],
        "reason": "Exchange",
        "cardCode": "C0001",
        "warehouse": "BR1"
    }
    response = client.post("/api/v1/returns/exchange", json=payload)
    req_id = response.json()["requestId"]

    mock_returns_service.create_credit_note_from_invoice.side_effect = Exception("SAP Error")

    app_response = client.post(f"/api/v1/admin/approvals/{req_id}/approve")
    assert app_response.status_code == 502
    
    req = approval_service.get_approval_request(req_id)
    assert req["status"] == "failed"
    assert mock_admin_invoice.create_invoice.called is False

def test_exchange_invoice_failure_partial_state(mock_invoice, override_get_current_user, override_admin_user, mock_returns_service, mock_admin_invoice):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "returnItems": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100.0, "lineTotal": 100.0, "baseLine": 0, "product": {"id": "ITM1", "price": 100}}],
        "replacementItems": [{"product": {"id": "ITM2", "name": "Item 2", "price": 120.0, "category": "C", "brand": "B"}, "quantity": 1}],
        "reason": "Exchange",
        "cardCode": "C0001",
        "warehouse": "BR1"
    }
    response = client.post("/api/v1/returns/exchange", json=payload)
    req_id = response.json()["requestId"]

    mock_admin_invoice.create_invoice.side_effect = Exception("SAP Timeout")

    app_response = client.post(f"/api/v1/admin/approvals/{req_id}/approve")
    assert app_response.status_code == 502
    
    req = approval_service.get_approval_request(req_id)
    assert req["status"] == "outcome-unknown"
    assert req["payload"].get("creditNoteDocEntry") == 9
