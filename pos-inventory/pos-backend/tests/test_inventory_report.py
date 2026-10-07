import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Use dummy auth headers for tests (if auth allows it, or mock get_current_user)
# In standard pos-backend test setup, we usually mock SAP or use a test fixture.

def test_inventory_overview(monkeypatch):
    # We will mock fetch_inventory_data to return dummy SAP items
    from app.api.v1 import inventory_report
    
    mock_items = [
        {"ItemCode": "A001", "ItemName": "Item 1", "QuantityOnStock": 10, "AvgStdPrice": 100, "U_SUBG": "Cat1"},
        {"ItemCode": "A002", "ItemName": "Item 2", "QuantityOnStock": 0, "AvgStdPrice": 50, "U_SUBG": "Cat2"},
    ]
    
    monkeypatch.setattr(inventory_report, "fetch_inventory_data", lambda w: mock_items)
    
    # Bypass auth for test if possible, or mock get_current_user
    app.dependency_overrides[inventory_report.get_current_user] = lambda: {"user_id": "test"}
    
    response = client.get("/api/v1/reports/inventory/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["total_products"] == 2
    assert data["total_stock_value"] == 1000
    assert data["out_of_stock"] == 1
    
    app.dependency_overrides = {}

def test_inventory_products(monkeypatch):
    from app.api.v1 import inventory_report
    mock_items = [
        {"ItemCode": "A001", "ItemName": "Item 1", "QuantityOnStock": 10, "AvgStdPrice": 100, "U_SUBG": "Cat1"},
    ]
    monkeypatch.setattr(inventory_report, "fetch_inventory_data", lambda w: mock_items)
    app.dependency_overrides[inventory_report.get_current_user] = lambda: {"user_id": "test"}
    
    response = client.get("/api/v1/reports/inventory/products?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["item_code"] == "A001"
    
    app.dependency_overrides = {}
