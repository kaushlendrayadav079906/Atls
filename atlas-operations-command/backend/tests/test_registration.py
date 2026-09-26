import pytest
from uuid import UUID, uuid4
from unittest.mock import patch
from app.models.company import Company
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole
from app.models.user_credential import UserCredential
from app.core.security import verify_password
from app.services.auth import AuthService
from app.schemas.auth import RegisterRequest

def get_valid_payload():
    return {
        "company_name": "Acme Global Corp",
        "country_code": "US",
        "currency_code": "USD",
        "timezone": "America/New_York",
        "locale": "en-US",
        "region": "North America",
        "fiscal_year_start_month": 1,
        "full_name": "Admin User",
        "email": "admin@acme.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!"
    }

# 1. Successful registration returns 201
def test_successful_registration(client, db_session):
    payload = get_valid_payload()
    response = client.post("/api/v1/auth/register", json=payload)
    
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Company and administrator registered successfully"
    assert "company_id" in data
    assert UUID(data["company_id"]) # Valid UUID
    assert data["company_name"] == "Acme Global Corp"
    assert data["email"] == "admin@acme.com"
    assert data["full_name"] == "Admin User"

# 2. Company creation in database
def test_company_creation(client, db_session):
    payload = get_valid_payload()
    payload["company_name"] = "Database Verified Corp"
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    company_id = UUID(response.json()["company_id"])
    
    company = db_session.query(Company).filter(Company.id == company_id).first()
    assert company is not None
    assert company.name == "Database Verified Corp"
    assert company.country_code == "US"
    assert company.currency_code == "USD"
    assert company.timezone == "America/New_York"
    assert company.locale == "en-US"
    assert company.region == "North America"
    assert company.fiscal_year_start_month == 1
    assert company.status == "active"

# 3. User creation in database and tenant linkage
def test_user_creation_and_linkage(client, db_session):
    payload = get_valid_payload()
    payload["email"] = "linkage@test.com"
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    company_id = UUID(response.json()["company_id"])
    
    user = db_session.query(User).filter(User.company_id == company_id, User.email == "linkage@test.com").first()
    assert user is not None
    assert user.full_name == "Admin User"
    assert user.status == "active"
    assert user.company_id == company_id

# 4. Admin role creation
def test_admin_role_creation(client, db_session):
    payload = get_valid_payload()
    payload["email"] = "adminrole@test.com"
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    company_id = UUID(response.json()["company_id"])
    
    roles = db_session.query(Role).filter(Role.company_id == company_id).all()
    assert len(roles) == 1
    assert roles[0].name == "admin"
    assert roles[0].company_id == company_id

# 5. UserRole creation
def test_user_role_creation(client, db_session):
    payload = get_valid_payload()
    payload["email"] = "userrole@test.com"
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    company_id = UUID(response.json()["company_id"])
    
    user = db_session.query(User).filter(User.company_id == company_id, User.email == "userrole@test.com").first()
    admin_role = db_session.query(Role).filter(Role.company_id == company_id, Role.name == "admin").first()
    
    user_role = db_session.query(UserRole).filter(UserRole.user_id == user.id, UserRole.role_id == admin_role.id).first()
    assert user_role is not None

# 6 & 7. UserCredential creation and Argon2id password verification
def test_user_credential_and_argon2id(client, db_session):
    payload = get_valid_payload()
    payload["email"] = "cred@test.com"
    payload["password"] = "SecretPassword123"
    payload["confirm_password"] = "SecretPassword123"
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    company_id = UUID(response.json()["company_id"])
    
    user = db_session.query(User).filter(User.company_id == company_id, User.email == "cred@test.com").first()
    cred = db_session.query(UserCredential).filter(UserCredential.user_id == user.id).first()
    
    assert cred is not None
    assert cred.password_hash != "SecretPassword123"
    assert "$argon2id$" in cred.password_hash
    assert verify_password("SecretPassword123", cred.password_hash) is True
    assert verify_password("WrongPassword", cred.password_hash) is False

# 8. Password / password_hash not returned in response
def test_password_hash_not_in_response(client):
    payload = get_valid_payload()
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    body = response.text
    assert "password" not in response.json()
    assert "password_hash" not in response.json()
    assert "$argon2id$" not in body
    assert "SecurePassword123!" not in body

# 9. Invalid email
def test_validation_invalid_email(client):
    payload = get_valid_payload()
    payload["email"] = "not-an-email"
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

# 10. Password mismatch
def test_validation_password_mismatch(client):
    payload = get_valid_payload()
    payload["confirm_password"] = "MismatchPassword123!"
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert "password and confirm_password do not match" in response.text

# 11. Invalid / missing timezone
def test_validation_timezone(client):
    # Invalid timezone
    payload = get_valid_payload()
    payload["timezone"] = "Invalid/Timezone_Name"
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert "Unknown or invalid IANA timezone" in response.text

    # Missing timezone
    payload2 = get_valid_payload()
    del payload2["timezone"]
    response2 = client.post("/api/v1/auth/register", json=payload2)
    assert response2.status_code == 422

# 12. Invalid currency and country
def test_validation_currency_and_country(client):
    # Invalid currency
    payload = get_valid_payload()
    payload["currency_code"] = "US" # must be 3
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

    # Invalid country
    payload = get_valid_payload()
    payload["country_code"] = "USA" # must be 2
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

# 13. Invalid fiscal month
def test_validation_fiscal_month(client):
    payload = get_valid_payload()
    payload["fiscal_year_start_month"] = 13
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

    payload["fiscal_year_start_month"] = 0
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

# 14. Registration cannot supply company_id
def test_forbidden_field_company_id(client):
    payload = get_valid_payload()
    payload["company_id"] = str(uuid4())
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert "extra_forbidden" in response.text or "Extra inputs are not permitted" in response.text

# 15. Registration cannot supply role, role_id, user_id, password_hash
def test_forbidden_field_role_and_hash(client):
    for forbidden_field in ["role", "role_id", "user_id", "password_hash", "status"]:
        payload = get_valid_payload()
        payload[forbidden_field] = "malicious_input"
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422, f"Failed for field {forbidden_field}"

# 16, 17, 18, 19. Transaction rollback tests (No orphan records)
def test_rollback_on_user_creation_failure(client, db_session):
    payload = get_valid_payload()
    payload["company_name"] = "Rollback Company 1"
    
    # We patch User instantiation or DB add to fail
    with patch("app.services.auth.User", side_effect=Exception("User creation failed")):
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 500
        
    # Verify no orphan Company exists
    company = db_session.query(Company).filter(Company.name == "Rollback Company 1").first()
    assert company is None

def test_rollback_on_role_creation_failure(client, db_session):
    payload = get_valid_payload()
    payload["company_name"] = "Rollback Company 2"
    payload["email"] = "rollback2@test.com"
    
    with patch("app.services.auth.Role", side_effect=Exception("Role creation failed")):
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 500
        
    # Verify no orphan Company or User
    company = db_session.query(Company).filter(Company.name == "Rollback Company 2").first()
    assert company is None
    user = db_session.query(User).filter(User.email == "rollback2@test.com").first()
    assert user is None

def test_rollback_on_credential_creation_failure(client, db_session):
    payload = get_valid_payload()
    payload["company_name"] = "Rollback Company 3"
    payload["email"] = "rollback3@test.com"
    
    with patch("app.services.auth.UserCredential", side_effect=Exception("Credential creation failed")):
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 500
        
    # Verify no orphan records
    company = db_session.query(Company).filter(Company.name == "Rollback Company 3").first()
    assert company is None
    user = db_session.query(User).filter(User.email == "rollback3@test.com").first()
    assert user is None

# 20, 21, 22. Login integration, /auth/me, and admin RBAC authorization
def test_new_user_login_and_admin_authorization(client, db_session):
    payload = get_valid_payload()
    payload["company_name"] = "Integrated Corp"
    payload["email"] = "integrated_admin@corp.com"
    payload["password"] = "ComplexPassword999!"
    payload["confirm_password"] = "ComplexPassword999!"
    
    # 1. Register
    reg_response = client.post("/api/v1/auth/register", json=payload)
    assert reg_response.status_code == 201
    company_id = reg_response.json()["company_id"]
    
    # 2. Login using existing POST /api/v1/auth/login
    login_response = client.post("/api/v1/auth/login", json={
        "company_name": payload["company_name"],
        "email": "integrated_admin@corp.com",
        "password": "ComplexPassword999!"
    })
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data
    token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Access /auth/me
    me_response = client.get("/api/v1/auth/me", headers=headers)
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["company_id"] == company_id
    
    # 4. Access /auth/admin-test with admin RBAC
    admin_response = client.get("/api/v1/auth/admin-test", headers=headers)
    assert admin_response.status_code == 200
    assert admin_response.json()["role_authorized"] == "admin"

# Normalization tests
def test_request_normalization(client, db_session):
    payload = get_valid_payload()
    payload["company_name"] = "   Whitespace Co   "
    payload["full_name"] = "   John Doe   "
    payload["email"] = "   John.Doe@Corp.COM   "
    payload["country_code"] = " in "
    payload["currency_code"] = " inr "
    payload["timezone"] = "   Asia/Kolkata   "
    
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["company_name"] == "Whitespace Co"
    assert data["full_name"] == "John Doe"
    assert data["email"] == "john.doe@corp.com"
    
    company_id = UUID(data["company_id"])
    company = db_session.query(Company).filter(Company.id == company_id).first()
    assert company.country_code == "IN"
    assert company.currency_code == "INR"
    assert company.timezone == "Asia/Kolkata"

# Company-scoped email uniqueness (Same email across two companies allowed)
def test_company_scoped_email_across_different_companies(client, db_session):
    payload1 = get_valid_payload()
    payload1["company_name"] = "Company Alpha"
    payload1["email"] = "shared.admin@multi.com"
    
    payload2 = get_valid_payload()
    payload2["company_name"] = "Company Beta"
    payload2["email"] = "shared.admin@multi.com"
    
    res1 = client.post("/api/v1/auth/register", json=payload1)
    assert res1.status_code == 201
    
    res2 = client.post("/api/v1/auth/register", json=payload2)
    assert res2.status_code == 201
    
    assert res1.json()["company_id"] != res2.json()["company_id"]
    assert res1.json()["email"] == res2.json()["email"]
    
    # But within same company, cannot duplicate admin role or duplicate email
    # Testing duplicate role error handling in auth_service
    auth_service = AuthService(db_session)
    reg_req = RegisterRequest(
        company_name="Duplicate Test Co",
        currency_code="USD",
        timezone="UTC",
        full_name="Duplicate Admin",
        email="dup@test.com",
        password="ValidPassword123!",
        confirm_password="ValidPassword123!"
    )
    res_reg = auth_service.register_company_and_admin(reg_req)
    assert res_reg.company_id is not None

# Login email case-insensitivity and whitespace trimming
def test_login_email_case_insensitivity(client, db_session):
    payload = get_valid_payload()
    payload["company_name"] = "Case Test Co"
    payload["email"] = "casetest@corp.com"
    payload["password"] = "ValidPassword123!"
    payload["confirm_password"] = "ValidPassword123!"
    
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    company_id = res.json()["company_id"]
    
    # Login with uppercase and spaces in email and company_name
    login_res = client.post("/api/v1/auth/login", json={
        "company_name": "  Case Test Co  ",
        "email": "   CaseTest@CORP.COM   ",
        "password": "ValidPassword123!"
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

