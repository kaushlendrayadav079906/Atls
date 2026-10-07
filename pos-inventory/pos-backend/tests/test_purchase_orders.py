import pytest
from unittest.mock import patch

@pytest.fixture
def mock_sap_service():
    with patch("app.api.v1.purchase_orders._service") as mock:
        yield mock

def test_list_purchase_orders(client, auth_headers, mock_sap_service):
    mock_sap_service.list_purchase_orders.return_value = {
        "value": [
            {"DocEntry": 1, "DocNum": 100, "DocTotal": 1000.0, "CardCode": "VEN001"}
        ],
        "odata.count": 1
    }
    response = client.get("/api/v1/purchase-orders", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["doc_entry"] == 1

def test_list_purchase_orders_pagination(client, auth_headers, mock_sap_service):
    mock_sap_service.list_purchase_orders.return_value = {"value": [], "odata.count": 0}
    response = client.get("/api/v1/purchase-orders?page=2&limit=25", headers=auth_headers)
    assert response.status_code == 200
    mock_sap_service.list_purchase_orders.assert_called_once()
    args, kwargs = mock_sap_service.list_purchase_orders.call_args
    assert kwargs["skip"] == 25
    assert kwargs["top"] == 25

def test_list_purchase_orders_search(client, auth_headers, mock_sap_service):
    mock_sap_service.list_purchase_orders.return_value = {"value": [], "odata.count": 0}
    response = client.get("/api/v1/purchase-orders?search=Test", headers=auth_headers)
    assert response.status_code == 200
    args, kwargs = mock_sap_service.list_purchase_orders.call_args
    filters = kwargs.get("filters", [])
    assert any("substringof('Test', CardName)" in f for f in filters)

def test_get_purchase_order_summary(client, auth_headers, mock_sap_service):
    mock_sap_service.get_purchase_order_summary.return_value = {
        "total_orders": 42,
        "pending_orders": 18,
        "received_orders": 20,
        "cancelled_orders": 4
    }
    response = client.get("/api/v1/purchase-orders/summary", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_orders"] == 42
    assert data["received_orders"] == 20

def test_get_purchase_order_detail(client, auth_headers, mock_sap_service):
    mock_sap_service.get_purchase_order.return_value = {
        "DocEntry": 1,
        "DocNum": 100,
        "BPL_IDAssignedToInvoice": 1,
        "DocumentLines": [
            {
                "LineNum": 1,
                "ItemCode": "ITM1", 
                "Quantity": 10.0,
                "RemainingOpenQuantity": 2.0,
                "Price": 50.0,
                "PriceAfterVAT": 50.0,
                "LineTotal": 500.0
            }
        ]
    }
    response = client.get("/api/v1/purchase-orders/1", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["doc_entry"] == 1
    assert len(data["document_lines"]) == 1
    
    line = data["document_lines"][0]
    assert line["quantity"] == 10.0
    assert line["open_quantity"] == 2.0
    assert line["received_quantity"] == 8.0  # 10.0 - 2.0
    assert line["price"] == 50.0
