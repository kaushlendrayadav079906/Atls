import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from app.main import app
from tests.conftest import setup_auth

client = TestClient(app)

def test_user_crud_and_tenant_isolation(db_session):
    # 1. Admin A in Company A
    companyA_id, adminA_id, headersA = setup_auth(db_session, client, role="admin", email_prefix="adminA")
    # 2. Admin B in Company B
    companyB_id, adminB_id, headersB = setup_auth(db_session, client, role="admin", email_prefix="adminB")

    # 3. Create User in Company A (Admin A) -> 201
    user_data = {
        "company_id": str(companyA_id),
        "email": "alice@example.com",
        "full_name": "Alice",
        "status": "active"
    }
    create_resp = client.post("/api/v1/users", json=user_data, headers=headersA)
    assert create_resp.status_code == 201
    user = create_resp.json()
    assert user["email"] == "alice@example.com"
    user_id = user["id"]
    
    # 4. Check user doesn't leak password hash
    assert "password" not in user
    assert "password_hash" not in user
    
    # 5. Retrieve User by ID (Admin A) -> 200
    get_resp = client.get(f"/api/v1/users/{user_id}", headers=headersA)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == user_id
    
    # 6. Retrieve User by ID (Admin B) -> 404 (IDOR protection)
    get_resp_b = client.get(f"/api/v1/users/{user_id}", headers=headersB)
    assert get_resp_b.status_code == 404
    
    # 7. List users by company (Admin A) -> 200
    list_resp = client.get(f"/api/v1/companies/{companyA_id}/users", headers=headersA)
    assert list_resp.status_code == 200
    users = list_resp.json()
    assert len(users) == 2 # Admin A and Alice
    
    # 8. List Company A users (Admin B) -> 403 (Cross-tenant block)
    list_resp_b = client.get(f"/api/v1/companies/{companyA_id}/users", headers=headersB)
    assert list_resp_b.status_code == 403

    # 9. Update User (Admin A) -> 200
    update_resp = client.put(f"/api/v1/users/{user_id}", json={
        "full_name": "Updated Alice"
    }, headers=headersA)
    assert update_resp.status_code == 200
    assert update_resp.json()["full_name"] == "Updated Alice"
    
    # 10. Update User (Admin B) -> 404 (Cross-tenant block)
    update_resp_b = client.put(f"/api/v1/users/{user_id}", json={
        "full_name": "Hacked Alice"
    }, headers=headersB)
    assert update_resp_b.status_code == 404

def test_standard_user_restrictions(db_session):
    company_id, user_id, headers = setup_auth(db_session, client, role="standard_user", email_prefix="std")
    
    # Standard user tries to create a user -> 403
    user_data = {
        "company_id": str(company_id),
        "email": "bob@example.com",
        "full_name": "Bob",
        "status": "active"
    }
    create_resp = client.post("/api/v1/users", json=user_data, headers=headers)
    assert create_resp.status_code == 403
    
    # Standard user lists users in their company -> 200
    list_resp = client.get(f"/api/v1/companies/{company_id}/users", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1
