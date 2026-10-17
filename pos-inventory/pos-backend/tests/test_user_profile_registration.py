"""
Comprehensive tests for User Profile Details in Registration and Permission Management.
Covers:
1. Registration accepts and persists phone number and job role.
2. Missing or invalid required registration fields are rejected (missing phone, short phone, letters in phone, missing job role, empty job role).
3. Duplicate username/email handling remains correct.
4. Newly registered user profile retrieval via admin endpoint.
5. Legacy users with missing phone/job_role return None (frontend displays 'Not provided').
6. Saving permissions does not modify profile information (phone, job_role, name, email remain intact).
7. Non-admin users cannot access protected user-management APIs.
8. Registration cannot grant administrator privileges via role or job designation.
9. Existing permission assignments, role templates, and session revocation continue working.
"""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import user_service
from app.core.security import create_access_token


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def setup_storage():
    user_service.init_user_storage()


@pytest.fixture
def admin_headers():
    admin_user = user_service.create_user(
        username=f"admin_{uuid.uuid4().hex[:6]}",
        email=f"admin_{uuid.uuid4().hex[:6]}@example.com",
        password="AdminPassword123!",
        name="Admin Test User",
        role="admin",
        phone="+919876543210",
        job_role="Administrator",
    )
    token = create_access_token(
        data={
            "sub": admin_user["username"],
            "email": admin_user["email"],
            "role": "admin",
            "user_id": admin_user["id"],
            "token_version": admin_user.get("token_version", 1),
        }
    )
    return {"Authorization": f"Bearer {token}"}, admin_user


@pytest.fixture
def employee_headers():
    emp_user = user_service.create_user(
        username=f"emp_{uuid.uuid4().hex[:6]}",
        email=f"emp_{uuid.uuid4().hex[:6]}@example.com",
        password="EmpPassword123!",
        name="Standard Employee",
        role="user",
        phone="+919123456789",
        job_role="Cashier",
    )
    token = create_access_token(
        data={
            "sub": emp_user["username"],
            "email": emp_user["email"],
            "role": "user",
            "user_id": emp_user["id"],
            "token_version": emp_user.get("token_version", 1),
        }
    )
    return {"Authorization": f"Bearer {token}"}, emp_user


# ─── 1. Registration Accepts & Persists Phone and Job Role ────────────────────

def test_registration_accepts_and_persists_phone_and_job_role(client):
    uid = uuid.uuid4().hex[:6]
    username = f"cashier_{uid}"
    email = f"cashier_{uid}@example.com"

    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": "Password123!",
            "name": "Jane Cashier",
            "phone": "+91 98765 43210",
            "job_role": "Cashier",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    user = data["user"]
    assert user["username"] == username
    assert user["email"] == email
    assert user["phone"] == "+919876543210"  # Normalized
    assert user["job_role"] == "Cashier"
    assert user["role"] == "user"

    # Verify directly from database
    stored = user_service.get_user_by_id(user["id"])
    assert stored is not None
    assert stored["phone"] == "+919876543210"
    assert stored["job_role"] == "Cashier"
    assert "password_hash" not in user


# ─── 2. Missing or Invalid Required Registration Fields ───────────────────────

def test_registration_missing_phone_rejected(client):
    uid = uuid.uuid4().hex[:6]
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"user_{uid}",
            "email": f"user_{uid}@example.com",
            "password": "Password123!",
            "name": "Missing Phone",
            "job_role": "Cashier",
        },
    )
    assert resp.status_code == 422


def test_registration_invalid_phone_format_rejected(client):
    uid = uuid.uuid4().hex[:6]
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"user_{uid}",
            "email": f"user_{uid}@example.com",
            "password": "Password123!",
            "name": "Bad Phone",
            "phone": "invalid-phone-abc",
            "job_role": "Cashier",
        },
    )
    assert resp.status_code == 422


def test_registration_phone_too_short_rejected(client):
    uid = uuid.uuid4().hex[:6]
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"user_{uid}",
            "email": f"user_{uid}@example.com",
            "password": "Password123!",
            "name": "Short Phone",
            "phone": "12345",  # Less than 7 digits
            "job_role": "Cashier",
        },
    )
    assert resp.status_code == 422


def test_registration_missing_job_role_rejected(client):
    uid = uuid.uuid4().hex[:6]
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"user_{uid}",
            "email": f"user_{uid}@example.com",
            "password": "Password123!",
            "name": "Missing Job Role",
            "phone": "+91 98765 43210",
        },
    )
    assert resp.status_code == 422


def test_registration_empty_job_role_rejected(client):
    uid = uuid.uuid4().hex[:6]
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"user_{uid}",
            "email": f"user_{uid}@example.com",
            "password": "Password123!",
            "name": "Empty Job Role",
            "phone": "+91 98765 43210",
            "job_role": "   ",
        },
    )
    assert resp.status_code == 422


# ─── 3. Duplicate Username/Email Handling ─────────────────────────────────────

def test_registration_duplicate_username_rejected(client):
    uid = uuid.uuid4().hex[:6]
    user_data = {
        "username": f"dup_{uid}",
        "email": f"dup_{uid}@example.com",
        "password": "Password123!",
        "name": "First User",
        "phone": "+91 98765 43210",
        "job_role": "Cashier",
    }
    resp1 = client.post("/api/v1/auth/register", json=user_data)
    assert resp1.status_code == 200

    # Attempt to register with same username
    user_data2 = dict(user_data)
    user_data2["email"] = f"other_{uid}@example.com"
    resp2 = client.post("/api/v1/auth/register", json=user_data2)
    assert resp2.status_code == 400
    assert "already exists" in resp2.json()["detail"].lower()


def test_registration_duplicate_email_rejected(client):
    uid = uuid.uuid4().hex[:6]
    user_data = {
        "username": f"first_{uid}",
        "email": f"shared_{uid}@example.com",
        "password": "Password123!",
        "name": "First User",
        "phone": "+91 98765 43210",
        "job_role": "Cashier",
    }
    resp1 = client.post("/api/v1/auth/register", json=user_data)
    assert resp1.status_code == 200

    # Attempt to register with same email
    user_data2 = dict(user_data)
    user_data2["username"] = f"second_{uid}"
    resp2 = client.post("/api/v1/auth/register", json=user_data2)
    assert resp2.status_code == 400
    assert "already exists" in resp2.json()["detail"].lower()


# ─── 4. Admin API Returns Profile Fields for Permission Modal ──────────────────

def test_admin_get_user_details_returns_profile_fields(client, admin_headers):
    headers, _ = admin_headers
    uid = uuid.uuid4().hex[:6]
    new_user = user_service.create_user(
        username=f"target_{uid}",
        email=f"target_{uid}@example.com",
        password="TargetPassword123!",
        name="Target Employee",
        role="operator",
        phone="+1 555-0199",
        job_role="Inventory Manager",
    )

    resp = client.get(f"/api/v1/admin/users/{new_user['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == new_user["id"]
    assert data["name"] == "Target Employee"
    assert data["email"] == f"target_{uid}@example.com"
    assert data["username"] == f"target_{uid}"
    assert data["phone"] == "+1 555-0199"
    assert data["job_role"] == "Inventory Manager"
    assert data["role"] == "operator"
    # Never expose password hash
    assert "password_hash" not in data


def test_admin_list_users_includes_profile_fields(client, admin_headers):
    headers, _ = admin_headers
    resp = client.get("/api/v1/admin/users", headers=headers)
    assert resp.status_code == 200
    users = resp.json()
    assert len(users) > 0
    for u in users:
        assert "phone" in u
        assert "job_role" in u
        assert "password_hash" not in u


# ─── 5. Legacy Users with Missing Profile Fields ───────────────────────────────

def test_legacy_users_with_missing_fields_return_none(client, admin_headers):
    headers, _ = admin_headers
    uid = uuid.uuid4().hex[:6]
    # Create user directly with phone=None, job_role=None (simulating legacy database record)
    legacy_user = user_service.create_user(
        username=f"legacy_{uid}",
        email=f"legacy_{uid}@example.com",
        password="LegacyPassword123!",
        name="Legacy Employee",
        role="user",
        phone=None,
        job_role=None,
    )

    resp = client.get(f"/api/v1/admin/users/{legacy_user['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["phone"] is None  # Frontend presents 'Not provided'
    assert data["job_role"] is None  # Frontend presents 'Not provided'


# ─── 6. Saving Permissions Does Not Modify Profile Information ────────────────

def test_saving_permissions_does_not_modify_profile_info(client, admin_headers):
    headers, _ = admin_headers
    uid = uuid.uuid4().hex[:6]
    target_user = user_service.create_user(
        username=f"perm_target_{uid}",
        email=f"perm_target_{uid}@example.com",
        password="PermPassword123!",
        name="Permissions Target",
        role="user",
        phone="+919876543210",
        job_role="Sales Executive",
    )

    # Save new permission set for this user
    put_resp = client.put(
        f"/api/v1/admin/users/{target_user['id']}/permissions",
        headers=headers,
        json={"permissions": ["products.view", "pos.access", "sales_orders.view"]},
    )
    assert put_resp.status_code == 200

    # Fetch user details again and assert profile was NOT modified
    after = user_service.get_user_by_id(target_user["id"])
    assert after["name"] == "Permissions Target"
    assert after["email"] == f"perm_target_{uid}@example.com"
    assert after["username"] == f"perm_target_{uid}"
    assert after["phone"] == "+919876543210"
    assert after["job_role"] == "Sales Executive"
    assert after["role"] == "user"


# ─── 7. Non-Admin Users Cannot Access User-Management APIs ─────────────────────

def test_employee_cannot_access_user_management(client, employee_headers):
    headers, emp = employee_headers

    # Cannot list all users
    resp_list = client.get("/api/v1/admin/users", headers=headers)
    assert resp_list.status_code == 403

    # Cannot view user details
    resp_detail = client.get(f"/api/v1/admin/users/{emp['id']}", headers=headers)
    assert resp_detail.status_code == 403

    # Cannot update permissions
    resp_perms = client.put(
        f"/api/v1/admin/users/{emp['id']}/permissions",
        headers=headers,
        json={"permissions": ["dashboard.view"]},
    )
    assert resp_perms.status_code == 403


# ─── 8. Registration Cannot Grant Administrator Privileges ─────────────────────

def test_registration_cannot_grant_admin_via_role_or_job_title(client):
    uid = uuid.uuid4().hex[:6]

    # Case A: User attempts role="admin"
    resp_a = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"hostile_a_{uid}",
            "email": f"hostile_a_{uid}@example.com",
            "password": "Password123!",
            "name": "Hostile A",
            "phone": "+91 98765 43210",
            "job_role": "Cashier",
            "role": "admin",
        },
    )
    assert resp_a.status_code == 200
    assert resp_a.json()["user"]["role"] == "user"
    assert resp_a.json()["user"]["role"] != "admin"

    # Case B: User enters job_role="Store Manager" - application role MUST remain "user"
    resp_b = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"hostile_b_{uid}",
            "email": f"hostile_b_{uid}@example.com",
            "password": "Password123!",
            "name": "Store Manager User",
            "phone": "+91 98765 43210",
            "job_role": "Store Manager",
            "role": "user",
        },
    )
    assert resp_b.status_code == 200
    user_b = resp_b.json()["user"]
    assert user_b["job_role"] == "Store Manager"
    assert user_b["role"] == "user"  # Strictly unprivileged user role

    # Case C: User enters "Administrator" as job role -> rejected
    resp_c = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"hostile_c_{uid}",
            "email": f"hostile_c_{uid}@example.com",
            "password": "Password123!",
            "name": "Hostile C",
            "phone": "+91 98765 43210",
            "job_role": "Administrator",
            "role": "user",
        },
    )
    assert resp_c.status_code == 422


# ─── 9. Session Revocation Continues Working ───────────────────────────────────

def test_session_revocation_invalidates_jwt(client, admin_headers):
    headers, _ = admin_headers
    uid = uuid.uuid4().hex[:6]
    target_user = user_service.create_user(
        username=f"session_test_{uid}",
        email=f"session_test_{uid}@example.com",
        password="TargetPassword123!",
        name="Session Test Target",
        role="user",
        phone="+919876543210",
        job_role="Cashier",
    )

    # Generate token for target
    emp_token = create_access_token(
        data={
            "sub": target_user["username"],
            "email": target_user["email"],
            "role": "user",
            "user_id": target_user["id"],
            "token_version": target_user.get("token_version", 1),
        }
    )
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    # Verify user token works on /auth/me
    me_resp = client.get("/api/v1/auth/me", headers=emp_headers)
    assert me_resp.status_code == 200

    # Admin revokes target's sessions
    revoke_resp = client.post(
        f"/api/v1/admin/users/{target_user['id']}/revoke-sessions",
        headers=headers,
    )
    assert revoke_resp.status_code == 200

    # Target token must now be rejected
    me_after = client.get("/api/v1/auth/me", headers=emp_headers)
    assert me_after.status_code == 401
