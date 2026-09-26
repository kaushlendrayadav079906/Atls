import pytest
from uuid import uuid4

from app.models.company import Company
from app.models.user import User
from app.models.user_credential import UserCredential
from app.models.role import Role
from app.models.user_role import UserRole
from app.core.security import hash_password

def setup_rbac_test_data(db_session):
    company = Company(id=uuid4(), name=f"RBAC Test Company {uuid4()}", currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    db_session.add(company)
    db_session.commit()
    
    # 1. Admin User
    admin_user = User(id=uuid4(), company_id=company.id, email="admin@rbac.com", full_name="Admin")
    db_session.add(admin_user)
    db_session.add(UserCredential(user_id=admin_user.id, password_hash=hash_password("adminpass")))
    
    # 2. Standard User
    std_user = User(id=uuid4(), company_id=company.id, email="std@rbac.com", full_name="Standard")
    db_session.add(std_user)
    db_session.add(UserCredential(user_id=std_user.id, password_hash=hash_password("stdpass")))
    
    # 3. Dual Role User
    dual_user = User(id=uuid4(), company_id=company.id, email="dual@rbac.com", full_name="Dual")
    db_session.add(dual_user)
    db_session.add(UserCredential(user_id=dual_user.id, password_hash=hash_password("dualpass")))
    
    db_session.commit()
    
    # Roles
    admin_role = Role(id=uuid4(), name="admin", company_id=company.id)
    std_role = Role(id=uuid4(), name="standard_user", company_id=company.id)
    db_session.add(admin_role)
    db_session.add(std_role)
    db_session.commit()
    
    # Assignments
    db_session.add(UserRole(user_id=admin_user.id, role_id=admin_role.id))
    db_session.add(UserRole(user_id=std_user.id, role_id=std_role.id))
    db_session.add(UserRole(user_id=dual_user.id, role_id=admin_role.id))
    db_session.add(UserRole(user_id=dual_user.id, role_id=std_role.id))
    
    db_session.commit()
    
    return {
        "company": company,
        "admin_user": admin_user,
        "std_user": std_user,
        "dual_user": dual_user,
        "admin_role": admin_role,
        "std_role": std_role
    }

def login_and_get_token(client, company_name, email, password):
    resp = client.post("/api/v1/auth/login", json={
        "company_name": company_name,
        "email": email,
        "password": password
    })
    return resp.json()["access_token"]

def test_admin_authorization(client, db_session):
    data = setup_rbac_test_data(db_session)
    
    # Admin accesses admin route -> 200
    token = login_and_get_token(client, data["company"].name, "admin@rbac.com", "adminpass")
    resp = client.get("/api/v1/auth/admin-test", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    
    # Standard user accesses admin route -> 403
    token_std = login_and_get_token(client, data["company"].name, "std@rbac.com", "stdpass")
    resp_forbidden = client.get("/api/v1/auth/admin-test", headers={"Authorization": f"Bearer {token_std}"})
    assert resp_forbidden.status_code == 403
    assert "Insufficient permissions" in resp_forbidden.json()["detail"]

def test_standard_user_authorization(client, db_session):
    data = setup_rbac_test_data(db_session)
    
    # Standard accesses standard route -> 200
    token = login_and_get_token(client, data["company"].name, "std@rbac.com", "stdpass")
    resp = client.get("/api/v1/auth/standard-test", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    
    # Admin accessing standard route fails because admin doesn't have standard_user role
    # unless we implicitly grant it, but requirements say we MUST explicitly check it.
    token_admin = login_and_get_token(client, data["company"].name, "admin@rbac.com", "adminpass")
    resp_forbidden = client.get("/api/v1/auth/standard-test", headers={"Authorization": f"Bearer {token_admin}"})
    assert resp_forbidden.status_code == 403

def test_multiple_roles(client, db_session):
    data = setup_rbac_test_data(db_session)
    
    # Dual user has both 'admin' and 'standard_user'
    token = login_and_get_token(client, data["company"].name, "dual@rbac.com", "dualpass")
    
    resp1 = client.get("/api/v1/auth/admin-test", headers={"Authorization": f"Bearer {token}"})
    assert resp1.status_code == 200
    
    resp2 = client.get("/api/v1/auth/standard-test", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 200

def test_authentication_vs_authorization(client, db_session):
    data = setup_rbac_test_data(db_session)
    
    # No token -> 401 Not authenticated
    resp1 = client.get("/api/v1/auth/admin-test")
    assert resp1.status_code == 401
    assert resp1.json()["detail"] == "Not authenticated"
    
    # Valid token, invalid role -> 403
    token = login_and_get_token(client, data["company"].name, "std@rbac.com", "stdpass")
    resp2 = client.get("/api/v1/auth/admin-test", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 403

def test_tenant_isolation(client, db_session):
    data = setup_rbac_test_data(db_session)
    
    # Create Company B
    company_b = Company(id=uuid4(), name="Comp B", currency_code="USD", region="NA", fiscal_year_start_month=1)
    db_session.add(company_b)
    db_session.commit()
    
    # Create User B in Company B
    user_b = User(id=uuid4(), company_id=company_b.id, email="user@b.com", full_name="User B")
    db_session.add(user_b)
    db_session.add(UserCredential(user_id=user_b.id, password_hash=hash_password("bpass")))
    db_session.commit()
    
    # Give User B an 'admin' role but the role belongs to Company A
    db_session.add(UserRole(user_id=user_b.id, role_id=data["admin_role"].id))
    db_session.commit()
    
    # Login User B
    token = login_and_get_token(client, company_b.name, "user@b.com", "bpass")
    
    # Try to access admin-test
    resp = client.get("/api/v1/auth/admin-test", headers={"Authorization": f"Bearer {token}"})
    # Since the admin role's company_id does not match User B's company_id, it is ignored
    assert resp.status_code == 403

def test_dynamic_role_change(client, db_session):
    data = setup_rbac_test_data(db_session)
    
    # Login standard user
    token = login_and_get_token(client, data["company"].name, "std@rbac.com", "stdpass")
    
    # Fails admin route
    assert client.get("/api/v1/auth/admin-test", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    
    # Assign admin role dynamically
    db_session.add(UserRole(user_id=data["std_user"].id, role_id=data["admin_role"].id))
    db_session.commit()
    
    # Succeeds without new token
    assert client.get("/api/v1/auth/admin-test", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    
    # Revoke admin role dynamically
    ur = db_session.query(UserRole).filter_by(user_id=data["std_user"].id, role_id=data["admin_role"].id).first()
    db_session.delete(ur)
    db_session.commit()
    
    # Fails again without new token
    assert client.get("/api/v1/auth/admin-test", headers={"Authorization": f"Bearer {token}"}).status_code == 403
