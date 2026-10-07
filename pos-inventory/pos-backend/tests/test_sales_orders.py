import pytest
from unittest.mock import patch, MagicMock

@pytest.fixture
def mock_sap_service():
    with patch("app.api.v1.sales_orders._service") as mock:
        yield mock

def test_list_sales_orders(client, auth_headers, mock_sap_service):
    mock_sap_service.list_sales_orders.return_value = {
        "value": [
            {"DocEntry": 1, "DocNum": 100, "DocTotal": 1000.0, "CardCode": "C001"}
        ],
        "odata.count": 1
    }
    response = client.get("/api/v1/sales-orders", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["doc_entry"] == 1

def test_list_sales_orders_pagination(client, auth_headers, mock_sap_service):
    mock_sap_service.list_sales_orders.return_value = {"value": [], "odata.count": 0}
    response = client.get("/api/v1/sales-orders?page=2&limit=25", headers=auth_headers)
    assert response.status_code == 200
    mock_sap_service.list_sales_orders.assert_called_once()
    args, kwargs = mock_sap_service.list_sales_orders.call_args
    assert kwargs["skip"] == 25
    assert kwargs["top"] == 25

def test_list_sales_orders_branch_isolation(client, auth_headers, mock_sap_service):
    # current_user fixture or auth_headers usually has branch_id. 
    # The API reads branch_id from get_current_user.
    mock_sap_service.list_sales_orders.return_value = {"value": [], "odata.count": 0}
    response = client.get("/api/v1/sales-orders", headers=auth_headers)
    assert response.status_code == 200
    args, kwargs = mock_sap_service.list_sales_orders.call_args
    filters = kwargs.get("filters", [])
    # Assuming auth_headers provides a user with branch_id = 1
    assert any("BPL_IDAssignedToInvoice eq 1" in f for f in filters)

def test_list_sales_orders_unauthorized_branch(client, auth_headers):
    response = client.get("/api/v1/sales-orders?branch_id=999", headers=auth_headers)
    assert response.status_code == 403

def test_list_sales_orders_search(client, auth_headers, mock_sap_service):
    mock_sap_service.list_sales_orders.return_value = {"value": [], "odata.count": 0}
    response = client.get("/api/v1/sales-orders?search=Test", headers=auth_headers)
    assert response.status_code == 200
    args, kwargs = mock_sap_service.list_sales_orders.call_args
    filters = kwargs.get("filters", [])
    assert any("substringof('Test', CardName)" in f for f in filters)

def test_get_sales_order_summary(client, auth_headers, mock_sap_service):
    mock_sap_service.get_sales_order_summary.return_value = {
        "total_orders": 42,
        "pending_orders": 18,
        "completed_orders": 20,
        "cancelled_orders": 4
    }
    response = client.get("/api/v1/sales-orders/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_orders"] == 42

def test_get_sales_order_detail(client, auth_headers, mock_sap_service):
    mock_sap_service.get_sales_order.return_value = {
        "DocEntry": 1,
        "DocNum": 100,
        "BPL_IDAssignedToInvoice": 1,
        "DocumentLines": [
            {"ItemCode": "ITM1", "Quantity": 2}
        ]
    }
    response = client.get("/api/v1/sales-orders/1", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["doc_entry"] == 1
    assert len(data["document_lines"]) == 1

def test_sap_failure(client, auth_headers, mock_sap_service):
    from app.services.sap.client import SAPConnectionError
    mock_sap_service.list_sales_orders.side_effect = SAPConnectionError("Unavailable")
    response = client.get("/api/v1/sales-orders", headers=auth_headers)
    assert response.status_code == 502

def test_empty_result(client, auth_headers, mock_sap_service):
    mock_sap_service.list_sales_orders.return_value = {"value": [], "odata.count": 0}
    response = client.get("/api/v1/sales-orders", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["total"] == 0
