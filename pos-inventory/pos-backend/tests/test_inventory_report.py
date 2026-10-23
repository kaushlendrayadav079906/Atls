import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api.v1 import inventory_report

client = TestClient(app)

MOCK_ITEMS = [
    {
        "ItemCode": "A001",
        "ItemName": "Finished Good 1",
        "QuantityOnStock": 20.0,
        "AvgStdPrice": 100.0,
        "ItemsGroupCode": 101,
        "ItemWarehouseInfoCollection": [
            {"WarehouseCode": "SH", "InStock": 20.0, "MinimalStock": 5.0}
        ]
    },
    {
        "ItemCode": "A002",
        "ItemName": "Low Stock Raw Material",
        "QuantityOnStock": 4.0,
        "AvgStdPrice": 50.0,
        "ItemsGroupCode": 102,
        "ItemWarehouseInfoCollection": [
            {"WarehouseCode": "SH", "InStock": 4.0, "MinimalStock": 10.0}
        ]
    },
    {
        "ItemCode": "A003",
        "ItemName": "Out of Stock Cable",
        "QuantityOnStock": 0.0,
        "AvgStdPrice": 25.0,
        "ItemsGroupCode": 103,
        "ItemWarehouseInfoCollection": [
            {"WarehouseCode": "SH", "InStock": 0.0, "MinimalStock": 10.0}
        ]
    }
]

@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[inventory_report.get_current_user] = lambda: {
        "sub": "test", "user_id": "test", "role": "admin", "permissions": ["reports.view", "*"]
    }
    yield
    app.dependency_overrides = {}


def test_inventory_overview(monkeypatch):
    monkeypatch.setattr(inventory_report, "fetch_inventory_data", lambda w: MOCK_ITEMS)
    
    response = client.get("/api/v1/reports/inventory/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["total_products"] == 3
    # A001: 20 * 100 = 2000, A002: 4 * 50 = 200, A003: 0 * 25 = 0 => 2200
    assert data["total_stock_value"] == 2200.0
    assert data["low_stock_items"] == 1  # A002
    assert data["out_of_stock"] == 1     # A003


def test_inventory_distribution(monkeypatch):
    monkeypatch.setattr(inventory_report, "fetch_inventory_data", lambda w: MOCK_ITEMS)
    
    response = client.get("/api/v1/reports/inventory/distribution")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    status_map = {s["status"]: s for s in data["statuses"]}
    assert status_map["in_stock"]["count"] == 1
    assert status_map["low_stock"]["count"] == 1
    assert status_map["out_of_stock"]["count"] == 1


def test_inventory_value_by_category(monkeypatch):
    monkeypatch.setattr(inventory_report, "fetch_inventory_data", lambda w: MOCK_ITEMS)
    monkeypatch.setattr(inventory_report, "get_item_groups_map", lambda: {
        101: "FINISHED GOODS",
        102: "RAW MATERIAL",
        103: "CABLE"
    })
    
    response = client.get("/api/v1/reports/inventory/value-by-category?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data["categories"]) == 3
    cat_names = [c["category"] for c in data["categories"]]
    assert "FINISHED GOODS" in cat_names
    assert "RAW MATERIAL" in cat_names


def test_inventory_products(monkeypatch):
    monkeypatch.setattr(inventory_report, "fetch_inventory_data", lambda w: MOCK_ITEMS)
    
    response = client.get("/api/v1/reports/inventory/products?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3
    assert data["items"][0]["item_code"] == "A001"
    assert data["items"][1]["status"] == "low_stock"
    assert data["items"][2]["status"] == "out_of_stock"


def test_inventory_valuation(monkeypatch):
    monkeypatch.setattr(inventory_report, "fetch_inventory_data", lambda w: MOCK_ITEMS)
    
    response = client.get("/api/v1/reports/inventory/valuation?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert data["total_stock_value"] == 2200.0
    assert data["items"][0]["item_code"] == "A001"
    assert data["items"][0]["stock_value"] == 2000.0


def test_inventory_low_stock(monkeypatch):
    monkeypatch.setattr(inventory_report, "fetch_inventory_data", lambda w: MOCK_ITEMS)
    
    response = client.get("/api/v1/reports/inventory/low-stock?page=1&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["item_code"] == "A002"
    assert data["items"][0]["deficit"] == 6.0  # 10 - 4


def test_inventory_export_csv(monkeypatch):
    monkeypatch.setattr(inventory_report, "fetch_inventory_data", lambda w: MOCK_ITEMS)
    
    response = client.get("/api/v1/reports/inventory/export?tab=stock_summary")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    content = response.text
    assert "Finished Good 1" in content
    assert "A001" in content
