import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_alerts_unauthorized():
    response = client.get("/api/v1/dashboard/alerts")
    assert response.status_code in (401, 403)

@patch("app.api.v1.dashboard.approval_service.get_pending_approvals")
def test_get_alerts_success_manager(mock_get_pending):
    mock_get_pending.return_value = [
        {
            "id": "123",
            "request_type": "refund",
            "status": "pending",
            "amount": 50.0,
            "reason": "Damaged",
            "branch_id": "BRANCH_A",
            "created_at": "2026-09-26T12:00:00Z"
        }
    ]
    
    # Manager token setup (mocked via test header or security bypass)
    # We will mock get_current_user
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"role": "manager", "branch_id": "BRANCH_A"}
    
    response = client.get("/api/v1/dashboard/alerts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "123"
    assert data[0]["branch_id"] == "BRANCH_A"
    
    mock_get_pending.assert_called_once_with(branch_id="BRANCH_A")
    app.dependency_overrides.clear()

@patch("app.api.v1.dashboard.approval_service.get_pending_approvals")
def test_get_alerts_operator_forbidden(mock_get_pending):
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"role": "operator", "branch_id": "BRANCH_A"}
    
    response = client.get("/api/v1/dashboard/alerts")
    # require_manager_or_admin should throw 403
    assert response.status_code == 403
    
    mock_get_pending.assert_not_called()
    app.dependency_overrides.clear()
