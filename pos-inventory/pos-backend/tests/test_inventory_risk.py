import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@patch("app.api.v1.dashboard.SAPInventoryService")
def test_get_inventory_risk_success_manager(mock_service_class):
    mock_instance = mock_service_class.return_value
    mock_instance.get_warehouse_stock.return_value = [
        {
            "ItemCode": "ITEM1",
            "ItemName": "Test Item",
            "ItemWarehouseInfoCollection": [
                {
                    "WarehouseCode": "BRANCH_A",
                    "InStock": 10.0,
                    "Committed": 5.0,
                    "Ordered": 0.0,
                    "MinimalStock": 20.0
                }
            ]
        }
    ]
    
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"role": "manager", "branch_id": "BRANCH_A"}
    
    response = client.get("/api/v1/dashboard/inventory-risk")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["item_code"] == "ITEM1"
    assert data[0]["warehouse"] == "BRANCH_A"
    
    mock_instance.get_warehouse_stock.assert_called_once_with("BRANCH_A")
    app.dependency_overrides.clear()

@patch("app.api.v1.dashboard.SAPInventoryService")
def test_get_inventory_risk_operator_forbidden(mock_service_class):
    mock_instance = mock_service_class.return_value
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"role": "operator", "branch_id": "BRANCH_A"}
    
    response = client.get("/api/v1/dashboard/inventory-risk")
    assert response.status_code == 403
    
    mock_instance.get_warehouse_stock.assert_not_called()
    app.dependency_overrides.clear()


@patch("app.api.v1.dashboard.SAPInventoryService")
def test_get_inventory_risk_rejects_incomplete_snapshot(mock_service_class):
    mock_service_class.return_value.get_warehouse_stock.return_value = [{"_truncated": True}]

    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"role": "manager", "branch_id": "BRANCH_A"}
    response = client.get("/api/v1/dashboard/inventory-risk")
    app.dependency_overrides.clear()

    assert response.status_code == 502
    assert response.json()["detail"] == "Could not retrieve complete inventory risk data from SAP"
