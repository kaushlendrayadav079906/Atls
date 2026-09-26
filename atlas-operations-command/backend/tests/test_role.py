import pytest
from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import setup_auth

client = TestClient(app)

def test_role_crud(db_session):
    company_id, user_id, headers = setup_auth(db_session, client, role="admin")

    # 1. Create admin role (actually 'editor' role, since admin already created)
    response = client.post(
        "/api/v1/roles",
        json={"company_id": str(company_id), "name": "standard_user", "description": "Std"},
        headers=headers
    )
    assert response.status_code == 201
    role_id = response.json()["id"]

    # 2. Get Role
    get_resp = client.get(f"/api/v1/roles/{role_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "standard_user"

    # 3. Update Role
    update_resp = client.put(
        f"/api/v1/roles/{role_id}",
        json={"name": "standard_user", "description": "Updated"},
        headers=headers
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["description"] == "Updated"

    # 4. List Roles
    list_resp = client.get(f"/api/v1/companies/{company_id}/roles", headers=headers)
    assert list_resp.status_code == 200
    roles = list_resp.json()
    assert len(roles) >= 2 # admin and standard_user

def test_user_role_assignment(db_session):
    company_id, admin_user_id, headers = setup_auth(db_session, client, role="admin")
    
    # Create another user via admin
    user_resp = client.post("/api/v1/users", json={
        "company_id": str(company_id),
        "email": "user1@example.com",
        "full_name": "Test User",
        "status": "active"
    }, headers=headers)
    assert user_resp.status_code == 201
    user_id = user_resp.json()["id"]

    # Create role
    role_resp = client.post("/api/v1/roles", json={
        "company_id": str(company_id),
        "name": "standard_user",
        "description": "Std"
    }, headers=headers)
    assert role_resp.status_code == 201
    role_id = role_resp.json()["id"]

    # 1. Assign role
    assign_resp = client.post(f"/api/v1/users/{user_id}/roles/{role_id}", headers=headers)
    assert assign_resp.status_code == 201

    # 2. List user roles
    list_resp = client.get(f"/api/v1/users/{user_id}/roles", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # 3. Remove role
    remove_resp = client.delete(f"/api/v1/users/{user_id}/roles/{role_id}", headers=headers)
    assert remove_resp.status_code == 204

    # 4. List again (empty)
    list_resp2 = client.get(f"/api/v1/users/{user_id}/roles", headers=headers)
    assert len(list_resp2.json()) == 0

def test_tenant_isolation(db_session):
    # Admin A in Company A
    companyA_id, userA_id, headersA = setup_auth(db_session, client, role="admin", email_prefix="adminA")
    # Admin B in Company B
    companyB_id, userB_id, headersB = setup_auth(db_session, client, role="admin", email_prefix="adminB")

    # A tries to list B's roles -> 403
    assert client.get(f"/api/v1/companies/{companyB_id}/roles", headers=headersA).status_code == 403
    
    # A tries to update B's role -> 404
    # First get a role from B
    b_roles = client.get(f"/api/v1/companies/{companyB_id}/roles", headers=headersB).json()
    b_role_id = b_roles[0]["id"]
    
    update_resp = client.put(f"/api/v1/roles/{b_role_id}", json={"name": "standard_user", "description": "hacked"}, headers=headersA)
    assert update_resp.status_code == 404
