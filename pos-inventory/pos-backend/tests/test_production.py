import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.sap.production_service import calculate_metrics

from app.core.security import get_current_user
from app.api.v1.production import get_production_service

client = TestClient(app)

def test_calculate_metrics():
    # Normal case
    pending, p_pct, r_pct = calculate_metrics(100.0, 80.0, 5.0)
    assert pending == 20.0
    assert p_pct == 80.0
    assert r_pct == 6.25
    
    # Zero planned
    pending, p_pct, r_pct = calculate_metrics(0.0, 10.0, 0.0)
    assert pending == 0.0
    assert p_pct == 0.0
    assert r_pct == 0.0
    
    # Zero produced
    pending, p_pct, r_pct = calculate_metrics(100.0, 0.0, 0.0)
    assert pending == 100.0
    assert p_pct == 0.0
    assert r_pct == 0.0

def test_get_production_summary():
    app.dependency_overrides[get_current_user] = lambda: {"role": "admin", "branch_id": "WH-001"}
    
    mock_service = MagicMock()
    mock_service.get_production_summary.return_value = {
        "total_production": 1000.0,
        "open_orders": 5,
        "released_orders": 3,
        "completed_orders": 2,
        "cancelled_orders": 0,
        "total_rejection": 50.0,
        "rejection_percentage": 5.0,
        "pending_production": 200.0,
        "production_efficiency": None
    }
    app.dependency_overrides[get_production_service] = lambda: mock_service
    
    response = client.get("/api/v1/production/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_production"] == 1000.0
    assert data["open_orders"] == 5

def test_get_production_orders():
    app.dependency_overrides[get_current_user] = lambda: {"role": "admin", "branch_id": "WH-001"}
    
    mock_service = MagicMock()
    mock_service.get_production_orders.return_value = (
        [{"production_order_no": 123, "item_code": "ITEM01", "planned_qty": 100.0, "produced_qty": 50.0, "rejected_qty": 0.0, "pending_qty": 50.0, "production_percentage": 50.0, "rejection_percentage": 0.0}],
        1
    )
    app.dependency_overrides[get_production_service] = lambda: mock_service
    
    response = client.get("/api/v1/production/orders")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["total"] == 1

def test_invalid_date_range():
    app.dependency_overrides[get_current_user] = lambda: {"role": "admin"}
    app.dependency_overrides[get_production_service] = lambda: MagicMock()
    response = client.get("/api/v1/production/orders?date_from=2026-05-01&date_to=2026-04-01")
    assert response.status_code == 400
    assert "cannot be after" in response.json()["detail"]
