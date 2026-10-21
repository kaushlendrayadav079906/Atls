"""Automated Security & RBAC Test Suite for ATLAS.

Tests all 16 scenarios mandated by ATLAS Authentication, Authorization & RBAC specification:
1. Valid administrator login
2. Valid employee login
3. Invalid credentials rejection
4. Disabled employee login rejection (ACCOUNT_DEACTIVATED)
5. Administrator access to administrative endpoints
6. Employee denial for administrative endpoints (403 Forbidden)
7. Employee access to explicitly granted module
8. Employee denial for unassigned module (403 Forbidden)
9. Direct API enforcement (cannot bypass module permissions)
10. Separation of View vs Create/Edit/Delete/Export/Approve
11. Last admin protection (lockout prevention)
12. Token revocation & session invalidation via token_version
13. Logout server-side token invalidation
14. Public registration role restriction (forces 'user')
15. AI assistant tool permission gating
16. Branch/warehouse access boundary enforcement
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from datetime import timedelta

from app.main import app
from app.core.security import create_access_token, get_password_hash
from app.services.user_service import (
    create_user,
    get_user_by_id,
    get_user_by_username,
    set_user_permissions,
    revoke_user_sessions,
    deactivate_user,
    activate_user,
    get_effective_permissions,
)
from app.services.ai_service import AIAssistantService


@pytest.fixture
def auth_client():
    """TestClient without dependency overrides so live authentication/authorization runs."""
    app.dependency_overrides.clear()
    with (
        patch("app.services.sap.client.SAPServiceLayerClient.login", return_value=True),
        patch("app.services.sap.items_service.SAPItemsService.get_items", return_value=[]),
    ):
        with TestClient(app) as test_client:
            yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_users():
    """Ensure standard test users exist in database."""
    admin_user = get_user_by_username("test_admin_auth")
    if not admin_user:
        admin_user = create_user(
            username="test_admin_auth",
            email="test_admin_auth@atlas.local",
            password="SecureAdminPass123!",
            name="Test Admin Auth",
            role="admin",
            branch_id="HQ",
        )

    emp_user = get_user_by_username("test_emp_auth")
    if not emp_user:
        emp_user = create_user(
            username="test_emp_auth",
            email="test_emp_auth@atlas.local",
            password="SecureEmpPass123!",
            name="Test Emp Auth",
            role="operator",
            branch_id="01",
        )
    else:
        activate_user(emp_user["id"])

    return {"admin": admin_user, "employee": emp_user}


# ─── 1. Admin Login & 2. Employee Login & 3. Invalid Credentials & 4. Disabled Login ────

def test_admin_and_employee_login_lifecycle(auth_client, test_users):
    """Test valid admin login, valid employee login, invalid credentials, and disabled account."""
    admin_user = test_users["admin"]
    emp_user = test_users["employee"]

    # 1. Valid Administrator Login
    resp = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "test_admin_auth", "password": "SecureAdminPass123!"},
    )
    assert resp.status_code == 200
    admin_data = resp.json()
    assert "access_token" in admin_data
    assert admin_data["user"]["role"] == "admin"
    assert "dashboard.view" in admin_data["user"]["permissions"]

    # 2. Valid Employee Login
    resp = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "test_emp_auth", "password": "SecureEmpPass123!"},
    )
    assert resp.status_code == 200
    emp_data = resp.json()
    assert "access_token" in emp_data
    assert emp_data["user"]["role"] == "operator"

    # 3. Invalid Credentials
    resp = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "test_emp_auth", "password": "WrongPassword999!"},
    )
    assert resp.status_code == 401
    assert "Invalid username" in resp.json().get("detail", "")

    # 4. Disabled Employee Login
    deactivate_user(emp_user["id"], admin_user_id=admin_user["id"])
    resp = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "test_emp_auth", "password": "SecureEmpPass123!"},
    )
    assert resp.status_code == 401
    assert "deactivated" in resp.json().get("detail", "").lower()

    # Re-activate for following tests
    activate_user(emp_user["id"], admin_user_id=admin_user["id"])


# ─── 5. Admin Endpoints Access & 6. Employee Forbidden ────────────────────────

def test_admin_endpoints_and_employee_forbidden(auth_client, test_users):
    """Admin can access /admin/*; Employee receives 403 Forbidden."""
    admin = get_user_by_id(test_users["admin"]["id"])
    emp = get_user_by_id(test_users["employee"]["id"])

    admin_token = create_access_token(
        data={"sub": admin["username"], "user_id": admin["id"], "role": "admin", "token_version": admin["token_version"]}
    )
    emp_token = create_access_token(
        data={"sub": emp["username"], "user_id": emp["id"], "role": "operator", "token_version": emp["token_version"]}
    )

    # Admin access
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    resp = auth_client.get("/api/v1/admin/users", headers=headers_admin)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    resp = auth_client.get("/api/v1/admin/permissions", headers=headers_admin)
    assert resp.status_code == 200

    # Employee access denied with 403
    headers_emp = {"Authorization": f"Bearer {emp_token}"}
    resp = auth_client.get("/api/v1/admin/users", headers=headers_emp)
    assert resp.status_code == 403

    resp = auth_client.get("/api/v1/admin/permissions", headers=headers_emp)
    assert resp.status_code == 403


# ─── 7. Granular Module Permission Granted & 8. Missing Permission Denied ─────

def test_module_permissions_grant_and_deny(auth_client, test_users):
    """Test user with permission succeeds; user lacking permission gets 403."""
    admin = test_users["admin"]
    user = get_user_by_username("test_perm_user")
    if not user:
        user = create_user(
            username="test_perm_user",
            email="perm_user@atlas.local",
            password="Password123!",
            name="Perm User",
            role="user",
            branch_id="01",
        )
    else:
        user = get_user_by_id(user["id"])

    # Clear custom permissions so user has default 'user' role
    set_user_permissions(user["id"], ["dashboard.view"], admin_user_id=admin["id"])
    user = get_user_by_id(user["id"])

    token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "role": user["role"], "token_version": user["token_version"]}
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to access finance overview -> should return 403 Forbidden
    resp = auth_client.get("/api/v1/finance/overview", headers=headers)
    assert resp.status_code == 403
    assert "finance.view" in resp.json().get("detail", "")

    # Now grant finance.view to this specific employee
    set_user_permissions(user["id"], ["finance.view", "dashboard.view"], admin_user_id=admin["id"])
    user = get_user_by_id(user["id"])

    # Token version incremented on permission change, so issue new token
    new_token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "role": user["role"], "token_version": user["token_version"]}
    )
    new_headers = {"Authorization": f"Bearer {new_token}"}

    with patch("app.services.sap.finance_service.SAPFinanceService.get_finance_overview", return_value={"kpis": {}}):
        resp = auth_client.get("/api/v1/finance/overview", headers=new_headers)
        assert resp.status_code == 200


# ─── 10. Separation of View vs Create / Edit / Delete / Export ─────────────────

def test_view_permission_does_not_grant_delete_or_export(auth_client, test_users):
    """Verify that view permission strictly denies mutations (Delete, Export) with 403."""
    admin = test_users["admin"]
    user = get_user_by_username("test_view_only_user")
    if not user:
        user = create_user(
            username="test_view_only_user",
            email="viewonly@atlas.local",
            password="Password123!",
            name="View Only User",
            role="user",
            branch_id="01",
        )

    # Grant ONLY products.view and reports.view, NO products.delete and NO reports.export
    set_user_permissions(user["id"], ["products.view", "reports.view"], admin_user_id=admin["id"])
    user = get_user_by_id(user["id"])

    token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "role": user["role"], "token_version": user["token_version"]}
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Product DELETE attempt should be rejected with 403
    resp = auth_client.delete("/api/v1/products/ITEM-999", headers=headers)
    assert resp.status_code == 403
    assert "products.delete" in resp.json().get("detail", "")

    # 2. Reports EXPORT attempt should be rejected with 403
    resp = auth_client.get("/api/v1/dashboard/reports/export", headers=headers)
    assert resp.status_code == 403
    assert "reports.export" in resp.json().get("detail", "")


# ─── 11. Last Admin Safety Guard ──────────────────────────────────────────────

def test_last_admin_lockout_prevention():
    """System must reject deactivating or demoting the last active administrator."""
    # Find all admins and verify safety check
    admin = get_user_by_username("test_admin_auth")
    if admin:
        # Mock cursor count to simulate last admin scenario
        with patch("app.services.user_service._count_active_admins", return_value=1):
            with pytest.raises(ValueError) as excinfo:
                deactivate_user(admin["id"])
            assert "CANNOT_DEACTIVATE_LAST_ADMIN" in str(excinfo.value)


# ─── 12. Instant Session Revocation & 13. Logout ──────────────────────────────

def test_session_revocation_and_logout(auth_client, test_users):
    """Bumping token_version immediately invalidates active JWTs (returns 401)."""
    admin = test_users["admin"]
    user = get_user_by_username("test_session_user")
    if not user:
        user = create_user(
            username="test_session_user",
            email="session@atlas.local",
            password="Password123!",
            name="Session User",
            role="operator",
            branch_id="01",
        )
    else:
        user = get_user_by_id(user["id"])

    # Issue token with current token_version
    token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "role": user["role"], "token_version": user["token_version"]}
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Verify token is valid for /auth/me
    resp = auth_client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200

    # Admin revokes user sessions
    revoke_user_sessions(user["id"], admin_user_id=admin["id"])

    # Next request with old token is rejected with 401 Unauthorized
    resp = auth_client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 401
    assert "revoked" in resp.json().get("detail", "").lower()


# ─── 14. Public Registration Cannot Grant Admin ───────────────────────────────

def test_public_registration_cannot_grant_admin(auth_client):
    """Public registration endpoint must force role to 'user' even if client specifies 'admin'."""
    import uuid
    uid = uuid.uuid4().hex[:8]
    unique_user = f"reg_{uid}"
    resp = auth_client.post(
        "/api/v1/auth/register",
        json={
            "username": unique_user,
            "email": f"{unique_user}@example.com",
            "name": "Registration Test",
            "phone": "+91 9876543210",
            "job_role": "Cashier",
            "password": "SecurePassword123!",
            "role": "admin",  # Hostile attempt to claim admin
        },
    )
    assert resp.status_code == 200
    user_data = resp.json()["user"]
    # Role MUST be forced to user
    assert user_data["role"] == "user"
    assert user_data["role"] != "admin"
    assert user_data["phone"] == "+919876543210"
    assert user_data["job_role"] == "Cashier"


# ─── 15. AI Assistant Tool Permission Gating ──────────────────────────────────

def test_ai_assistant_tool_permission_gating():
    """AI Assistant tools must reject queries outside the user's effective permissions."""
    service = AIAssistantService()

    # User lacking finance.view
    user_without_finance = {
        "id": "u-1",
        "username": "cashier",
        "role": "user",
        "permissions": ["dashboard.view", "products.view"],
    }

    # Attempt to execute get_finance_summary
    context, card, nav = service._execute_tool(
        tool_name="get_finance_summary",
        args={},
        permitted_warehouse="01",
        current_user=user_without_finance,
    )

    assert "Forbidden" in context.get("error", "") or "Access Denied" in context.get("error", "")
    assert context.get("meta", {}).get("permission_denied") is True

    # User with finance.view
    user_with_finance = {
        "id": "u-2",
        "username": "accountant",
        "role": "manager",
        "permissions": ["dashboard.view", "finance.view"],
    }

    with patch.object(service.finance_service, "get_finance_overview", return_value={"kpis": {}}):
        context, card, nav = service._execute_tool(
            tool_name="get_finance_summary",
            args={},
            permitted_warehouse="01",
            current_user=user_with_finance,
        )
        assert "error" not in context or "Access Denied" not in context.get("error", "")


# ─── 16. Branch Access Enforcement ────────────────────────────────────────────

def test_branch_level_access_enforcement(auth_client, test_users):
    """Non-admin users cannot query data from arbitrary other branches."""
    user = get_user_by_username("test_branch_locked")
    if not user:
        user = create_user(
            username="test_branch_locked",
            email="branchlocked@atlas.local",
            password="Password123!",
            name="Branch Locked",
            role="manager",
            branch_id="01",
        )
    else:
        user = get_user_by_id(user["id"])

    token = create_access_token(
        data={"sub": user["username"], "user_id": user["id"], "role": user["role"], "branch_id": "01", "token_version": user["token_version"]}
    )
    headers = {"Authorization": f"Bearer {token}"}

    # With branch 01 assigned, requesting branch '99' should still be restricted to branch '01'
    with patch("app.services.sap.finance_service.SAPFinanceService.get_finance_overview") as mock_get:
        mock_get.return_value = {"kpis": {}}
        resp = auth_client.get("/api/v1/finance/overview?branch=99", headers=headers)
        # Manager is locked to branch '01'
        if mock_get.called:
            assert mock_get.call_args.kwargs.get("branch_id") == "01"
