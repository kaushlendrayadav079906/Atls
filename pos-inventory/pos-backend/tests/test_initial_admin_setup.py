"""Automated test suite for ATLAS Initial Admin Setup and Security Bootstrap.

Tests all required scenarios:
1. Missing environment variables skips safely
2. Existing administrator protection (no changes, no overwriting)
3. Initial Admin creation when no admin exists (PBKDF2-SHA256, transactional, audit event)
4. Existing employee email conflict (no role change, no password overwrite, conflict logged)
5. Concurrent bootstrap safety (PostgreSQL advisory transaction lock)
6. Successful Admin login via configured email and password
7. Invalid credentials rejection
8. Employee permission restrictions remain enforced
9. Finance writeback remains strictly disabled (FINANCE_WRITEBACK_ENABLED=False)
"""

import threading
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import verify_password, get_password_hash
from app.services.user_service import (
    ensure_bootstrap_admin,
    create_user,
    get_user_by_username,
    get_user_by_id,
    _get_connection,
    log_security_event,
)


@pytest.fixture
def client():
    app.dependency_overrides.clear()
    with (
        patch("app.services.sap.client.SAPServiceLayerClient.login", return_value=True),
        patch("app.services.sap.items_service.SAPItemsService.get_items", return_value=[]),
    ):
        with TestClient(app) as test_client:
            yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def setup_test_users():
    """Ensure standard test admin and employee exist for login & restriction tests."""
    admin = get_user_by_username("test_admin_auth")
    if not admin:
        admin = create_user(
            username="test_admin_auth",
            email="test_admin_auth@atlas.local",
            password="SecureAdminPass123!",
            name="Test Admin Auth",
            role="admin",
            branch_id="HQ",
        )

    emp = get_user_by_username("test_emp_auth")
    if not emp:
        emp = create_user(
            username="test_emp_auth",
            email="test_emp_auth@atlas.local",
            password="SecureEmpPass123!",
            name="Test Emp Auth",
            role="operator",
            branch_id="01",
        )

    return {"admin": admin, "employee": emp}


# ------------------------------------------------------------------------------
# 1. Missing Environment Variables
# ------------------------------------------------------------------------------

def test_missing_env_variables_skips_safely():
    """When ADMIN_EMAIL or ADMIN_PASSWORD are blank/missing, bootstrap skips safely."""
    with (
        patch.object(settings, "ADMIN_EMAIL", ""),
        patch.object(settings, "ADMIN_PASSWORD", ""),
        patch("app.services.user_service._count_active_admins", return_value=0),
    ):
        res = ensure_bootstrap_admin()
        assert res is None, "Should safely return None when environment variables are missing"


def test_short_admin_password_skips_safely():
    """When ADMIN_PASSWORD is less than 8 characters, bootstrap skips safely."""
    with (
        patch.object(settings, "ADMIN_EMAIL", "newadmin@atlas.local"),
        patch.object(settings, "ADMIN_PASSWORD", "short"),
        patch("app.services.user_service._count_active_admins", return_value=0),
    ):
        res = ensure_bootstrap_admin()
        assert res is None, "Should reject passwords shorter than 8 characters"


# ------------------------------------------------------------------------------
# 2. Existing Admin Protection
# ------------------------------------------------------------------------------

def test_existing_admin_protection():
    """When an active administrator already exists, no accounts or passwords are changed."""
    with (
        patch.object(settings, "ADMIN_EMAIL", "overwrite_attempt@atlas.local"),
        patch.object(settings, "ADMIN_PASSWORD", "MaliciousPassword123!"),
        patch("app.services.user_service._count_active_admins", return_value=1),
    ):
        res = ensure_bootstrap_admin()
        assert res is None, "Must not perform any action when active admin already exists"

        # Verify no user with the overwrite attempt email was created
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE email = 'overwrite_attempt@atlas.local'")
                assert cur.fetchone() is None


# ------------------------------------------------------------------------------
# 3. Initial Admin Creation (When No Admin Exists)
# ------------------------------------------------------------------------------

def test_initial_admin_creation():
    """When no admin exists and email is unused, dedicated admin is created with PBKDF2 hash."""
    test_email = "bootstrap_brand_new_admin@atlas.local"
    test_password = "SuperSecureBootstrapPassword#2026"
    test_username = "brand_new_admin"

    # Clean up prior test run if any
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE email = %s OR username = %s", (test_email, test_username))

    try:
        with (
            patch.object(settings, "ADMIN_EMAIL", test_email),
            patch.object(settings, "ADMIN_PASSWORD", test_password),
            patch.object(settings, "ADMIN_USERNAME", test_username),
            patch.object(settings, "ADMIN_NAME", "Initial Bootstrap Administrator"),
            patch("app.services.user_service._count_active_admins", return_value=0),
        ):
            created = ensure_bootstrap_admin()
            assert created is not None
            assert created["email"] == test_email
            assert created["username"] == test_username
            assert created["role"] == "admin"

            # Verify in database
            with _get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, username, email, password_hash, role, is_active, token_version FROM users WHERE email = %s",
                        (test_email,),
                    )
                    row = cur.fetchone()
                    assert row is not None
                    assert row[1] == test_username
                    assert row[2] == test_email
                    pwd_hash = row[3]
                    assert verify_password(test_password, pwd_hash) is True
                    assert row[4] == "admin"
                    assert row[5] is True  # is_active
                    assert row[6] == 1     # token_version

                    # Verify security audit log was written
                    cur.execute(
                        "SELECT action, username FROM security_audit_logs WHERE action = 'INITIAL_ADMIN_CREATED' AND username = %s",
                        (test_username,),
                    )
                    audit_row = cur.fetchone()
                    assert audit_row is not None
                    assert audit_row[0] == "INITIAL_ADMIN_CREATED"
    finally:
        # Clean up created test user
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM users WHERE email = %s OR username = %s", (test_email, test_username))


# ------------------------------------------------------------------------------
# 4. Existing Employee Email Conflict Protection
# ------------------------------------------------------------------------------

def test_existing_employee_email_conflict():
    """If configured ADMIN_EMAIL matches an existing employee, do NOT promote or overwrite."""
    conflict_email = "employee_conflict_test@atlas.local"
    original_emp_password = "EmpOriginalPassword123!"

    # Ensure a non-admin employee exists with this email
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE email = %s", (conflict_email,))

    emp = create_user(
        username="emp_conflict_target",
        email=conflict_email,
        password=original_emp_password,
        name="Conflict Target Employee",
        role="operator",
        branch_id="02",
    )
    assert emp is not None
    assert emp["role"] == "operator"

    try:
        # Attempt bootstrap using the employee's email
        with (
            patch.object(settings, "ADMIN_EMAIL", conflict_email),
            patch.object(settings, "ADMIN_PASSWORD", "AttemptedAdminPassword#999"),
            patch("app.services.user_service._count_active_admins", return_value=0),
        ):
            res = ensure_bootstrap_admin()
            assert res is None, "Must abort creation on email conflict"

            # Verify the employee account was NOT modified
            with _get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT role, password_hash FROM users WHERE email = %s",
                        (conflict_email,),
                    )
                    row = cur.fetchone()
                    assert row is not None
                    assert row[0] == "operator", "Role must remain operator; no auto-promotion allowed"
                    assert verify_password(original_emp_password, row[1]) is True, "Original password must not be overwritten"
                    assert verify_password("AttemptedAdminPassword#999", row[1]) is False

                    # Verify security audit event was logged
                    cur.execute(
                        "SELECT action FROM security_audit_logs WHERE action = 'BOOTSTRAP_ADMIN_CONFLICT_EMAIL_EXISTS' ORDER BY created_at DESC LIMIT 1"
                    )
                    audit_row = cur.fetchone()
                    assert audit_row is not None
                    assert audit_row[0] == "BOOTSTRAP_ADMIN_CONFLICT_EMAIL_EXISTS"
    finally:
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM users WHERE email = %s", (conflict_email,))


# ------------------------------------------------------------------------------
# 5. Concurrent Bootstrap Safety
# ------------------------------------------------------------------------------

def test_concurrent_bootstrap_safety():
    """Simulate concurrent worker startups calling ensure_bootstrap_admin simultaneously."""
    test_email = "concurrent_bootstrap_admin@atlas.local"
    test_password = "ConcurrentPass123#!"
    test_username = "concurrent_admin"

    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE email = %s OR username = %s", (test_email, test_username))

    results = []
    errors = []

    def run_worker():
        try:
            with (
                patch.object(settings, "ADMIN_EMAIL", test_email),
                patch.object(settings, "ADMIN_PASSWORD", test_password),
                patch.object(settings, "ADMIN_USERNAME", test_username),
                patch("app.services.user_service._count_active_admins", side_effect=lambda cur: (
                    1 if cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin' AND email = %s", (test_email,)) or cur.fetchone()[0] > 0 else 0
                )),
            ):
                res = ensure_bootstrap_admin()
                results.append(res)
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=run_worker) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0, f"Concurrent execution generated errors: {errors}"

    # Verify at most ONE thread created the account
    created_results = [r for r in results if r is not None]
    assert len(created_results) <= 1, f"Expected at most 1 creation, got {len(created_results)}"

    # Clean up
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE email = %s OR username = %s", (test_email, test_username))


# ------------------------------------------------------------------------------
# 6. Admin Login via Email and Username
# ------------------------------------------------------------------------------

def test_successful_admin_login_via_email_and_username(client, setup_test_users):
    """Admin can log in using either email or username with the PBKDF2 hashed password."""
    # 1. Login via configured Email
    resp_email = client.post(
        "/api/v1/auth/login",
        json={"email": "test_admin_auth@atlas.local", "password": "SecureAdminPass123!"},
    )
    assert resp_email.status_code == 200
    data_email = resp_email.json()
    assert "access_token" in data_email
    assert data_email["user"]["role"] == "admin"
    assert "users.manage" in data_email["user"]["permissions"]
    assert "settings.view" in data_email["user"]["permissions"]

    # 2. Login via Username
    resp_user = client.post(
        "/api/v1/auth/login",
        json={"username": "test_admin_auth", "password": "SecureAdminPass123!"},
    )
    assert resp_user.status_code == 200
    data_user = resp_user.json()
    assert "access_token" in data_user
    assert data_user["user"]["role"] == "admin"


# ------------------------------------------------------------------------------
# 7. Invalid Credentials Rejection
# ------------------------------------------------------------------------------

def test_invalid_credentials_rejected(client, setup_test_users):
    """Invalid passwords and nonexistent users are strictly rejected with 401."""
    # Wrong password for existing user
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test_admin_auth@atlas.local", "password": "WrongPassword123!"},
    )
    assert resp.status_code == 401
    assert "Invalid username or password" in resp.json()["detail"]

    # Nonexistent user
    resp_none = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent_user@atlas.local", "password": "AnyPassword123!"},
    )
    assert resp_none.status_code == 401
    assert "Invalid username or password" in resp_none.json()["detail"]


# ------------------------------------------------------------------------------
# 8. Employee Permission Restrictions
# ------------------------------------------------------------------------------

def test_employee_permission_restrictions(client, setup_test_users):
    """Employee accounts cannot access administrator endpoints (403 Forbidden)."""
    # Login as employee
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "test_emp_auth", "password": "SecureEmpPass123!"},
    )
    assert resp.status_code == 200
    emp_token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {emp_token}"}

    # Attempt to access user management endpoint
    admin_resp = client.get("/api/v1/admin/users", headers=headers)
    assert admin_resp.status_code == 403
    assert (
        "Administrator access required" in admin_resp.json()["detail"]
        or "Forbidden" in admin_resp.json()["detail"]
        or "users.manage" in admin_resp.json()["detail"]
    )

    # Attempt to access security audit logs
    logs_resp = client.get("/api/v1/admin/audit-logs", headers=headers)
    assert logs_resp.status_code == 403


# ------------------------------------------------------------------------------
# 9. Finance Writeback Remains Strictly Disabled
# ------------------------------------------------------------------------------

def test_finance_writeback_remains_strictly_disabled(client, setup_test_users):
    """Ensure FINANCE_WRITEBACK_ENABLED is False and write endpoints reject with 403."""
    assert settings.FINANCE_WRITEBACK_ENABLED is False, "FINANCE_WRITEBACK_ENABLED must remain False"

    # Login as Admin
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test_admin_auth@atlas.local", "password": "SecureAdminPass123!"},
    )
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Attempt SAP writeback operation
    submit_resp = client.post(
        "/api/v1/finance/submit-update",
        json={
            "entity_type": "invoice",
            "record_id": "1001",
            "updates": {"Comments": "Direct write test"},
            "confirm": True,
        },
        headers=admin_headers,
    )
    assert submit_resp.status_code == 403
    assert "SAP write-back is temporarily disabled by administrative safety policy" in submit_resp.json()["detail"]


# ------------------------------------------------------------------------------
# 10. Multi-Candidate Username / Email Collision Authentication
# ------------------------------------------------------------------------------

def test_case_variant_handle_collision_exact_match_priority(client):
    """
    When multiple accounts share case-insensitive names in PostgreSQL (e.g. 'Admin' vs 'admin'),
    authenticate_user must prioritize exact-match casing and verify credentials across candidates.
    """
    user_a = "test_case_user"
    user_b = "Test_Case_User"
    email_a = "case_a@atlas.local"
    email_b = "case_b@atlas.local"
    pass_a = "PasswordA_123!"
    pass_b = "PasswordB_123!"

    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE username IN (%s, %s) OR email IN (%s, %s)", (user_a, user_b, email_a, email_b))

    create_user(username=user_a, email=email_a, password=pass_a, name="Case User Lower", role="user")
    create_user(username=user_b, email=email_b, password=pass_b, name="Case User Title", role="admin")

    try:
        # Login with lower username and pass_a -> succeeds as user_a
        resp_a = client.post("/api/v1/auth/login", json={"username": user_a, "password": pass_a})
        assert resp_a.status_code == 200
        assert resp_a.json()["user"]["username"] == user_a

        # Login with title username and pass_b -> succeeds as user_b
        resp_b = client.post("/api/v1/auth/login", json={"username": user_b, "password": pass_b})
        assert resp_b.status_code == 200
        assert resp_b.json()["user"]["username"] == user_b

        # Login via email_a
        resp_email_a = client.post("/api/v1/auth/login", json={"email": email_a, "password": pass_a})
        assert resp_email_a.status_code == 200
        assert resp_email_a.json()["user"]["username"] == user_a

        # Login via email_b
        resp_email_b = client.post("/api/v1/auth/login", json={"email": email_b, "password": pass_b})
        assert resp_email_b.status_code == 200
        assert resp_email_b.json()["user"]["username"] == user_b
    finally:
        with _get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM users WHERE username IN (%s, %s) OR email IN (%s, %s)", (user_a, user_b, email_a, email_b))

