"""Comprehensive safety tests proving SAP write-back operations are strictly blocked while read-only queries remain fully operational."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.core.config import settings
from app.services.sap.finance_service import SAPFinanceService
from app.services.ai_service import AIAssistantService

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_dependencies():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def admin_auth_headers():
    token = create_access_token({"sub": "admin_user", "role": "admin", "branch_id": None})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def manager_auth_headers():
    token = create_access_token({"sub": "manager_user", "role": "manager", "branch_id": "01"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def mock_openai():
    with patch("app.services.ai_service.openai.OpenAI") as mock:
        yield mock


# ==============================================================================
# 1. Direct Endpoint Rejection Tests (Bypassing Frontend)
# ==============================================================================

def test_submit_endpoint_strictly_blocked_by_safety_policy(admin_auth_headers):
    """Ensure POST /api/v1/finance/submit-update is rejected with 403 Forbidden even with Admin credentials and confirm=True."""
    assert settings.FINANCE_WRITEBACK_ENABLED is False, "Safety violation: FINANCE_WRITEBACK_ENABLED must be False by default"
    
    payload = {
        "entity_type": "invoice",
        "record_id": "1001",
        "updates": {"Comments": "Direct API modification attempt"},
        "confirm": True
    }
    
    response = client.post(
        "/api/v1/finance/submit-update",
        json=payload,
        headers=admin_auth_headers
    )
    
    assert response.status_code == 403
    data = response.json()
    assert "SAP write-back is temporarily disabled by administrative safety policy" in data["detail"]
    assert "All write operations are rejected" in data["detail"]


def test_submit_endpoint_blocked_for_all_roles(manager_auth_headers):
    """Ensure safety policy blocks submit requests regardless of role."""
    payload = {
        "entity_type": "customer",
        "record_id": "CUS001",
        "updates": {"CardName": "Attempted Name Change"},
        "confirm": True
    }
    response = client.post(
        "/api/v1/finance/submit-update",
        json=payload,
        headers=manager_auth_headers
    )
    assert response.status_code == 403
    assert "safety policy" in response.json()["detail"].lower()


# ==============================================================================
# 2. Service Layer Direct Invocation Protection
# ==============================================================================

def test_service_layer_submit_record_update_raises_permission_error():
    """Ensure direct Python call to SAPFinanceService.submit_record_update raises PermissionError without touching SAP."""
    svc = SAPFinanceService()
    svc.client = MagicMock()  # Mock client to verify it is NEVER called
    
    with pytest.raises(PermissionError) as exc_info:
        svc.submit_record_update(
            entity_type="invoice",
            record_id="500",
            updates={"Comments": "Malicious direct call"},
            user={"id": "1", "username": "admin", "role": "admin"}
        )
    
    assert "SAP write-back is temporarily disabled by administrative safety policy" in str(exc_info.value)
    # Verify zero calls were made to client.patch or client.post
    assert svc.client.patch.call_count == 0
    assert svc.client.post.call_count == 0


# ==============================================================================
# 3. AI Service Schema and Execution Safety Lock
# ==============================================================================

def test_ai_tools_schema_excludes_write_tool(mock_openai):
    """Ensure submit_approved_record_update tool is omitted from AI tools schema when writeback is disabled."""
    settings.OPENAI_API_KEY = "test_key"
    with patch("app.services.ai_service.SAPFinanceService"):
        service = AIAssistantService()
        schema = service._get_tools_schema()
        tool_names = [t["function"]["name"] for t in schema]
        
        assert "submit_approved_record_update" not in tool_names, (
            "Safety violation: submit_approved_record_update must NOT be visible to AI when writeback is disabled"
        )
        # Read-only tools must still be registered
        assert "get_finance_summary" in tool_names
        assert "inspect_finance_record" in tool_names
        assert "propose_record_update" in tool_names
        assert "get_finance_admin_settings" in tool_names
        assert "refresh_finance_data" in tool_names


def test_ai_execute_tool_hard_blocks_write_tool(mock_openai):
    """Ensure calling submit_approved_record_update via _execute_tool returns hard safety error without calling finance_service."""
    settings.OPENAI_API_KEY = "test_key"
    with patch("app.services.ai_service.SAPFinanceService") as mock_fin_class:
        service = AIAssistantService()
        mock_fin_instance = mock_fin_class.return_value
        service.finance_service = mock_fin_instance
        
        context, card, nav = service._execute_tool(
            "submit_approved_record_update",
            {"entity_type": "invoice", "record_id": "1001", "updates": {"Comments": "Test"}, "confirm": True},
            permitted_warehouse=None,
            current_user={"name": "Admin", "role": "admin"}
        )
        
        assert context.get("is_disabled") is True
        assert "safety policy" in context.get("error", "").lower()
        assert card["status"] == "error"
        # Finance service submit must NEVER be called
        assert mock_fin_instance.submit_record_update.call_count == 0


# ==============================================================================
# 4. Admin Settings Reports Disabled Status Accurately
# ==============================================================================

def test_admin_settings_reports_writeback_disabled(admin_auth_headers):
    """Ensure /admin-settings endpoint reports writeback_enabled=False and submit_sap_writeback=False across all roles."""
    with patch("app.api.v1.finance._finance_service.client.check_health", return_value={"status": "connected", "circuit_breaker": "CLOSED", "authenticated": True}):
        response = client.get("/api/v1/finance/admin-settings", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["writeback_enabled"] is False
        assert data["writeback_status"] == "DISABLED_SAFETY_POLICY"
        assert "admin_controlled_sap_writeback" not in data["enabled_capabilities"]
        
        matrix = data["role_permission_matrix"]
        assert matrix["admin"]["submit_sap_writeback"] is False
        assert matrix["manager"]["submit_sap_writeback"] is False
        assert matrix["accountant"]["submit_sap_writeback"] is False
        assert matrix["user"]["submit_sap_writeback"] is False


# ==============================================================================
# 5. Read-Only Functionality Remains 100% Operational
# ==============================================================================

def test_read_only_overview_remains_available(admin_auth_headers):
    """Ensure GET /finance/overview continues to operate normally under safety lock."""
    mock_overview = {
        "period": {"range": "monthly", "label": "This Month"},
        "kpis": {"total_sales": {"value": 500000.0, "invoice_count": 25}},
        "charts": {"sales_vs_purchases": []},
        "tables": {"top_customers": [], "top_suppliers": []}
    }
    with patch("app.api.v1.finance._finance_service.get_finance_overview", return_value=mock_overview):
        response = client.get("/api/v1/finance/overview", headers=admin_auth_headers)
        assert response.status_code == 200
        assert response.json()["kpis"]["total_sales"]["value"] == 500000.0


def test_read_only_record_details_remains_available(admin_auth_headers):
    """Ensure GET /finance/record-details continues to operate normally under safety lock."""
    mock_details = {
        "record_id": "1001",
        "entity_type": "invoice",
        "editable_fields": ["Comments", "JournalMemo"],
        "locked_fields": [{"field": "DocTotal", "reason": "GAAP requirement"}],
        "is_editable": True
    }
    with patch("app.api.v1.finance._finance_service.get_record_details", return_value=mock_details):
        response = client.get("/api/v1/finance/record-details?entity_type=invoice&record_id=1001", headers=admin_auth_headers)
        assert response.status_code == 200
        assert response.json()["record_id"] == "1001"


def test_read_only_validate_update_remains_available(admin_auth_headers):
    """Ensure POST /finance/validate-update (which only diffs in memory) continues to operate normally."""
    mock_val = {
        "is_valid": True,
        "diff": [{"field": "Comments", "old_value": "Old", "new_value": "New"}],
        "errors": []
    }
    with patch("app.api.v1.finance._finance_service.validate_record_update", return_value=mock_val):
        response = client.post(
            "/api/v1/finance/validate-update",
            json={"entity_type": "invoice", "record_id": "1001", "updates": {"Comments": "New"}},
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["is_valid"] is True


def test_read_only_audit_log_remains_available(admin_auth_headers):
    """Ensure GET /finance/audit-log continues to operate normally."""
    with patch("app.services.audit_service.get_audit_entries", return_value=[]):
        response = client.get("/api/v1/finance/audit-log", headers=admin_auth_headers)
        assert response.status_code == 200
        assert response.json()["total_entries"] == 0
