import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services import approval_service
from app.services.sap.client import SAPConnectionError, SAPDocumentClosedError
from app.services.sap.returns_service import SAPReturnsService

client = TestClient(app)

@pytest.fixture
def mock_invoice():
    with patch("app.api.v1.returns.SAPInvoicesService") as mock:
        instance = mock.return_value
        instance.get_invoice.return_value = {
            "DocNum": 12345,
            "DocEntry": 1,
            "DocTotal": 100.0,
            "CardCode": "C0001",
            "U_Branch": "BR1",
            "DocumentLines": [{"LineNum": 0, "ItemCode": "ITM1", "Quantity": 1, "WarehouseCode": "BR1"}],
        }
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
        return {"user_id": "user123", "username": "operator", "role": "user", "branch_id": "BR1"}
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = _get_current_user
    yield _get_current_user
    app.dependency_overrides.clear()

@pytest.fixture
def override_admin_user():
    def _require_admin():
        return {"user_id": "admin123", "username": "admin", "role": "admin", "branch_id": "BR1"}
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
        return {"user_id": "admin123", "username": "admin", "role": "admin", "branch_id": "BR1"}

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
    assert approval_service.get_approval_request(req_id)["status"] == "failed"

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


def test_return_rejects_original_invoice_from_another_branch(mock_invoice, override_get_current_user):
    mock_invoice.get_invoice.return_value["U_Branch"] = "BR2"
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100, "lineTotal": 100, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
    }

    with patch("app.api.v1.returns.approval_service.create_approval_request") as create_request:
        response = client.post("/api/v1/returns", json=payload)

    assert response.status_code == 403
    create_request.assert_not_called()


def test_lookup_rejects_invoice_from_another_branch(mock_invoice, override_get_current_user):
    mock_invoice.get_invoice.return_value["U_Branch"] = "BR2"

    response = client.get("/api/v1/returns/lookup?q=1")

    assert response.status_code == 403


def test_return_request_uses_authenticated_branch_for_warehouse(mock_invoice, override_get_current_user):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100, "lineTotal": 100, "baseLine": 0, "warehouse": "OTHER"}],
        "reason": "Test Return",
        "returnType": "refund",
        "warehouse": "OTHER",
        "cardCode": "CLIENT-CODE",
    }

    with patch("app.api.v1.returns.approval_service.create_approval_request", return_value={"id": "request-1"}) as create_request:
        response = client.post("/api/v1/returns", json=payload)

    assert response.status_code == 202
    stored_payload = create_request.call_args.kwargs["payload"]
    assert stored_payload["warehouse"] == "BR1"
    assert stored_payload["items"][0]["warehouse"] == "BR1"
    assert stored_payload["cardCode"] == "C0001"


def test_return_rejects_quantity_above_original_invoice(mock_invoice, override_get_current_user):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 2, "unitPrice": 100, "lineTotal": 200, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
    }

    response = client.post("/api/v1/returns", json=payload)

    assert response.status_code == 422


def test_return_sap_timeout_is_recorded_as_unknown(mock_invoice, override_get_current_user, override_admin_user, mock_returns_service, mock_admin_invoice):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100, "lineTotal": 100, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
    }
    response = client.post("/api/v1/returns", json=payload)
    req_id = response.json()["requestId"]
    mock_returns_service.create_credit_note_from_invoice.side_effect = SAPConnectionError("timeout")

    approval_response = client.post(f"/api/v1/admin/approvals/{req_id}/approve")

    assert approval_response.status_code == 502
    assert approval_service.get_approval_request(req_id)["status"] == "outcome-unknown"


def test_approval_rejects_admin_from_another_branch(mock_invoice, override_get_current_user, mock_admin_invoice):
    payload = {
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100, "lineTotal": 100, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
    }
    response = client.post("/api/v1/returns", json=payload)
    req_id = response.json()["requestId"]

    def _other_branch_admin():
        return {"user_id": "admin-other", "username": "admin", "role": "admin", "branch_id": "BR2"}

    from app.core.security import require_admin
    app.dependency_overrides[require_admin] = _other_branch_admin
    try:
        approval_response = client.post(f"/api/v1/admin/approvals/{req_id}/reject")
    finally:
        app.dependency_overrides.clear()

    assert approval_response.status_code == 403
    assert approval_service.get_approval_request(req_id)["status"] == "pending"


def test_non_admin_cannot_reject_approval(mock_invoice, override_get_current_user):
    response = client.post("/api/v1/returns", json={
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100, "lineTotal": 100, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
    })
    req_id = response.json()["requestId"]

    approval_response = client.post(f"/api/v1/admin/approvals/{req_id}/reject")

    assert approval_response.status_code == 403
    assert approval_service.get_approval_request(req_id)["status"] == "pending"


def test_get_return_rejects_foreign_branch(override_get_current_user):
    with patch("app.api.v1.returns.SAPReturnsService") as service:
        service.return_value.get_return.return_value = {
            "DocEntry": 9,
            "CreditNoteLines": [{"ItemCode": "ITM1", "WarehouseCode": "BR2"}],
        }
        response = client.get("/api/v1/returns/9")

    assert response.status_code == 403


def test_sap_credit_note_payload_uses_comments_not_unverified_fields():
    client_mock = MagicMock()
    client_mock.post.return_value = {"DocEntry": 9, "DocNum": 999}
    with patch("app.services.sap.returns_service.get_sap_client", return_value=client_mock):
        service = SAPReturnsService()
        service.create_credit_note_from_invoice({
            "originalDocEntry": 1,
            "originalDocNum": 12345,
            "cardCode": "C0001",
            "items": [{"itemCode": "ITM1", "quantity": 1, "unitPrice": 100, "baseLine": 0, "warehouse": "BR1"}],
            "reason": "Test Return",
            "returnType": "refund",
        })

    payload = client_mock.post.call_args.args[1]
    assert payload["DocumentLines"][0]["BaseEntry"] == 1
    assert payload["DocumentLines"][0]["BaseLine"] == 0
    assert "Return reason: Test Return" in payload["Comments"]
    assert "U_Return_Reason" not in payload


def test_sap_closed_invoice_does_not_create_unlinked_credit_note():
    client_mock = MagicMock()
    client_mock.post.side_effect = SAPDocumentClosedError("closed")
    with patch("app.services.sap.returns_service.get_sap_client", return_value=client_mock):
        service = SAPReturnsService()
        with pytest.raises(SAPDocumentClosedError):
            service.create_credit_note_from_invoice({
                "originalDocEntry": 1,
                "cardCode": "C0001",
                "items": [{"itemCode": "ITM1", "quantity": 1, "unitPrice": 100, "baseLine": 0, "warehouse": "BR1"}],
            })

    client_mock.post.assert_called_once()
    client_mock.get.assert_not_called()


def test_sap_malformed_credit_note_response_is_not_accepted():
    client_mock = MagicMock()
    client_mock.post.return_value = {"DocNum": 999}
    with patch("app.services.sap.returns_service.get_sap_client", return_value=client_mock):
        service = SAPReturnsService()
        with pytest.raises(SAPConnectionError):
            service.create_credit_note_from_invoice({
                "originalDocEntry": 1,
                "cardCode": "C0001",
                "items": [{"itemCode": "ITM1", "quantity": 1, "unitPrice": 100, "baseLine": 0, "warehouse": "BR1"}],
            })


def test_approval_not_reported_success_when_completion_persistence_fails(
    mock_invoice, override_get_current_user, override_admin_user, mock_returns_service, mock_admin_invoice
):
    response = client.post("/api/v1/returns", json={
        "originalDocEntry": 1,
        "originalDocNum": 12345,
        "items": [{"itemCode": "ITM1", "itemName": "Item 1", "quantity": 1, "unitPrice": 100, "lineTotal": 100, "baseLine": 0}],
        "reason": "Test Return",
        "returnType": "refund",
    })
    req_id = response.json()["requestId"]
    update_status = approval_service.update_approval_status

    def fail_completed_update(request_id, status, *args, **kwargs):
        if status == "completed":
            return False
        return update_status(request_id, status, *args, **kwargs)

    with patch("app.api.v1.admin.approval_service.update_approval_status", side_effect=fail_completed_update):
        approval_response = client.post(f"/api/v1/admin/approvals/{req_id}/approve")

    assert approval_response.status_code == 502
    assert approval_service.get_approval_request(req_id)["status"] == "outcome-unknown"
