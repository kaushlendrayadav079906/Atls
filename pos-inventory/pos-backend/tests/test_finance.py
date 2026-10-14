"""Tests for Finance Overview API endpoints."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_dependencies():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def auth_headers():
    token = create_access_token({"sub": "admin", "role": "admin", "branch_id": None})
    return {"Authorization": f"Bearer {token}"}

def test_finance_overview_requires_auth():
    response = client.get("/api/v1/finance/overview")
    assert response.status_code == 401

def test_finance_overview_success(auth_headers):
    mock_overview_data = {
        "period": {
            "range": "monthly",
            "from_date": "2026-10-01",
            "to_date": "2026-10-14",
            "label": "This Month"
        },
        "kpis": {
            "total_sales": {"value": 405180.0, "invoice_count": 25, "growth": 12.5, "is_positive": True},
            "total_purchases": {"value": 218460.0, "invoice_count": 18, "growth": 8.2, "is_positive": True},
            "incoming_payments": {"value": 362400.0, "payment_count": 24, "growth": 15.1, "is_positive": True},
            "outgoing_payments": {"value": 194700.0, "payment_count": 16, "growth": -3.6, "is_positive": False},
            "accounts_receivable": {"value": 123560.0, "subtext": "Outstanding from customers"},
            "accounts_payable": {"value": 86340.0, "subtext": "Outstanding to suppliers"},
            "gross_profit": {"value": 186720.0, "growth": 18.4, "is_positive": True},
            "gross_margin": {"value": 46.1, "growth": 4.8, "is_positive": True}
        },
        "charts": {
            "sales_vs_purchases": [
                {"period": "Nov", "sales": 220000, "purchases": 120000},
                {"period": "Dec", "sales": 290000, "purchases": 170000}
            ],
            "payments_trend": [
                {"period": "Nov", "incoming": 280000, "outgoing": 160000},
                {"period": "Dec", "incoming": 340000, "outgoing": 190000}
            ]
        },
        "tables": {
            "top_customers": [
                {"rank": 1, "customerName": "Rekha limited", "invoices": 8, "netSales": 112450.0, "percentage": 27.8}
            ],
            "top_suppliers": [
                {"rank": 1, "supplierName": "ABC Traders", "invoices": 5, "netPurchases": 86300.0, "percentage": 39.5}
            ],
            "recent_payments": {
                "incoming": [{"refNo": "RCT-101", "date": "2025-04-10", "customer": "Rekha limited", "amount": 50000}],
                "outgoing": [{"refNo": "PAY-001", "date": "2025-04-10", "supplier": "ABC Traders", "amount": 30000}]
            }
        },
        "meta": {"timestamp": "2026-10-14T00:00:00", "branch_id": "all", "is_cached": False}
    }

    with patch("app.api.v1.finance._finance_service.get_finance_overview", return_value=mock_overview_data):
        response = client.get("/api/v1/finance/overview?range=monthly", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "kpis" in data
        assert "charts" in data
        assert "tables" in data
        assert data["kpis"]["total_sales"]["value"] == 405180.0
        assert data["kpis"]["gross_margin"]["value"] == 46.1

def test_record_details_endpoint(auth_headers):
    mock_details = {
        "entity_type": "invoice",
        "record_id": "101",
        "doc_num": "101",
        "status": "Open",
        "can_edit": True,
        "editable_fields": {"Comments": {"label": "Invoice Remarks", "current_value": "Note"}},
        "locked_fields": {"DocTotal": {"reason": "Locked by SAP"}}
    }
    with patch("app.api.v1.finance._finance_service.get_record_details", return_value=mock_details):
        response = client.get("/api/v1/finance/record-details?entity_type=invoice&record_id=101", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["record_id"] == "101"
        assert data["can_edit"] is True
        assert "Comments" in data["editable_fields"]

def test_validate_update_endpoint(auth_headers):
    mock_val = {
        "is_valid": True,
        "errors": [],
        "diff": [{"field": "Comments", "old_value": "Old", "new_value": "New", "permitted": True}],
        "record_id": "101",
        "entity_type": "invoice"
    }
    with patch("app.api.v1.finance._finance_service.validate_record_update", return_value=mock_val):
        response = client.post(
            "/api/v1/finance/validate-update",
            json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["is_valid"] is True

def test_submit_update_blocked_by_safety_policy(auth_headers):
    """Verify that submit-update is strictly blocked by administrative safety policy by default."""
    response = client.post(
        "/api/v1/finance/submit-update",
        json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": True},
        headers=auth_headers
    )
    assert response.status_code == 403
    assert "safety policy" in response.json()["detail"].lower()

def test_submit_update_requires_confirmation(auth_headers):
    with patch("app.api.v1.finance.settings.FINANCE_WRITEBACK_ENABLED", True):
        response = client.post(
            "/api/v1/finance/submit-update",
            json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": False},
            headers=auth_headers
        )
        assert response.status_code == 400
        assert "Explicit user confirmation required" in response.json()["detail"]

def test_submit_update_forbidden_for_read_only_user():
    read_only_token = create_access_token({"sub": "user1", "role": "user", "branch_id": None})
    with patch("app.api.v1.finance.settings.FINANCE_WRITEBACK_ENABLED", True):
        response = client.post(
            "/api/v1/finance/submit-update",
            json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": True},
            headers={"Authorization": f"Bearer {read_only_token}"}
        )
        assert response.status_code == 403

def test_submit_update_success(auth_headers):
    mock_result = {
        "success": True,
        "message": "Successfully updated invoice 101 in SAP Business One.",
        "diff": [{"field": "Comments", "old_value": "Old", "new_value": "New"}],
        "updated_record": {"Comments": "New"},
        "audit_id": "AUD-ABC12345",
        "timestamp": "2026-10-14T10:00:00Z"
    }
    with patch("app.api.v1.finance.settings.FINANCE_WRITEBACK_ENABLED", True):
        with patch("app.api.v1.finance._finance_service.submit_record_update", return_value=mock_result):
            response = client.post(
                "/api/v1/finance/submit-update",
                json={"entity_type": "invoice", "record_id": "101", "updates": {"Comments": "New"}, "confirm": True},
                headers=auth_headers
            )
            assert response.status_code == 200
            assert response.json()["success"] is True
            assert response.json()["audit_id"] == "AUD-ABC12345"

def test_admin_settings_endpoint(auth_headers):
    mock_settings = {
        "assistant_mode": "FINANCE_INTELLIGENT_WORKSPACE",
        "sap_status": "connected",
        "enabled_capabilities": ["sales_revenue_analysis", "admin_controlled_sap_writeback"]
    }
    with patch("app.api.v1.finance._finance_service.get_admin_settings", return_value=mock_settings):
        response = client.get("/api/v1/finance/admin-settings", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["assistant_mode"] == "FINANCE_INTELLIGENT_WORKSPACE"

def test_admin_settings_forbidden_for_non_admin():
    manager_token = create_access_token({"sub": "mgr", "role": "manager", "branch_id": "SH"})
    response = client.get("/api/v1/finance/admin-settings", headers={"Authorization": f"Bearer {manager_token}"})
    assert response.status_code == 403

