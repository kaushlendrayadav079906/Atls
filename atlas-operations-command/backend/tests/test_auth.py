import pytest
from uuid import uuid4
import jwt

from app.core.config import settings
from app.models.company import Company
from app.models.user import User
from app.models.user_credential import UserCredential
from app.core.security import hash_password

def setup_test_user(db_session, company_name=None, email="jwt@test.com", password="strongpassword123", status="active", company_status="active"):
    c_name = company_name if company_name is not None else f"JWT Test Company {uuid4()}"
    company = Company(
        id=uuid4(),
        name=c_name,
        currency_code="USD",
        region="NA",
        fiscal_year_start_month=1,
        status=company_status
    )
    db_session.add(company)
    db_session.commit()
    
    user = User(
        id=uuid4(),
        company_id=company.id,
        email=email,
        full_name="JWT User",
        status=status
    )
    db_session.add(user)
    db_session.commit()
    
    pwd_hash = hash_password(password)
    cred = UserCredential(user_id=user.id, password_hash=pwd_hash)
    db_session.add(cred)
    db_session.commit()
    
    return company, user

# 1. Successful login: correct company_name + correct email + correct password -> 200
def test_login_success(client, db_session):
    company, user = setup_test_user(db_session)
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    # Ensure no credentials/passwords returned
    assert "password" not in data
    assert "password_hash" not in data

# 2. Wrong company name -> 401
def test_login_failure_wrong_company_name(client, db_session):
    company, user = setup_test_user(db_session)
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": "Nonexistent Company Name",
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email, password, or company"

# 3. Wrong email -> 401
def test_login_failure_wrong_email(client, db_session):
    company, user = setup_test_user(db_session)
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "wrong@test.com",
        "password": "strongpassword123"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email, password, or company"

# 4. Wrong password -> 401
def test_login_failure_wrong_password(client, db_session):
    company, user = setup_test_user(db_session)
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": "wrongpassword123"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email, password, or company"

# 5. Inactive user -> 401
def test_login_failure_inactive_user(client, db_session):
    company, user = setup_test_user(db_session, status="inactive")
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email, password, or company"

# 6. Inactive company -> 401
def test_login_failure_inactive_company(client, db_session):
    company, user = setup_test_user(db_session, company_status="inactive")
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email, password, or company"

# 7. Missing credential -> 401
def test_user_without_credential_fails(client, db_session):
    c_name = f"No Cred Co {uuid4()}"
    company = Company(id=uuid4(), name=c_name, currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    db_session.add(company)
    db_session.commit()

    user = User(id=uuid4(), company_id=company.id, email="nocred@test.com", full_name="No Cred", status="active")
    db_session.add(user)
    db_session.commit()

    res = client.post("/api/v1/auth/login", json={
        "company_name": c_name,
        "email": "nocred@test.com",
        "password": "anypassword"
    })
    assert res.status_code == 401
    assert res.json()["detail"] == "Incorrect email, password, or company"

# 8. Company name whitespace normalization
def test_login_company_name_whitespace_normalization(client, db_session):
    raw_name = f"Whitespace Corp {uuid4()}"
    company, user = setup_test_user(db_session, company_name=raw_name)
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": f"   {raw_name}   ",
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

# 9. Company name case normalization (via MySQL collation)
def test_login_company_name_case_normalization(client, db_session):
    raw_name = f"CaseSensitiveCorp{uuid4().hex[:8]}"
    company, user = setup_test_user(db_session, company_name=raw_name.upper())
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": raw_name.lower(),
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

# 10. Email case & whitespace normalization
def test_login_email_case_and_whitespace_normalization(client, db_session):
    company, user = setup_test_user(db_session, email="normalized@test.com")
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "   Normalized@TEST.COM   ",
        "password": "strongpassword123"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

# 11. Duplicate active company names -> 401 without arbitrary selection
def test_login_duplicate_active_companies_fails(client, db_session):
    dup_name = f"Duplicate Name Co {uuid4()}"
    comp1 = Company(id=uuid4(), name=dup_name, currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    comp2 = Company(id=uuid4(), name=dup_name, currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    db_session.add_all([comp1, comp2])
    db_session.commit()

    user1 = User(id=uuid4(), company_id=comp1.id, email="dup@test.com", full_name="User 1", status="active")
    cred1 = UserCredential(user_id=user1.id, password_hash=hash_password("password123"))
    db_session.add_all([user1, cred1])
    db_session.commit()

    response = client.post("/api/v1/auth/login", json={
        "company_name": dup_name,
        "email": "dup@test.com",
        "password": "password123"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email, password, or company"

# 12. Nonexistent company -> 401
def test_login_nonexistent_company(client, db_session):
    response = client.post("/api/v1/auth/login", json={
        "company_name": "Completely Nonexistent Ltd",
        "email": "anyone@test.com",
        "password": "password123"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email, password, or company"

# 13. Client attempts old company_id field -> 422
def test_client_attempts_old_company_id_field(client, db_session):
    company, user = setup_test_user(db_session)
    
    # 1. Payload with company_id instead of company_name
    res1 = client.post("/api/v1/auth/login", json={
        "company_id": str(company.id),
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert res1.status_code == 422

    # 2. Payload with both company_id and company_name (extra forbidden)
    res2 = client.post("/api/v1/auth/login", json={
        "company_id": str(company.id),
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert res2.status_code == 422

# 14 & 15. Cross-tenant login matrix
def test_cross_tenant_login_matrix(client, db_session):
    # Company A & User A
    name_a = f"Company Alpha {uuid4()}"
    comp_a = Company(id=uuid4(), name=name_a, currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    user_a = User(id=uuid4(), company_id=comp_a.id, email="user.a@alpha.com", full_name="User A", status="active")
    cred_a = UserCredential(user_id=user_a.id, password_hash=hash_password("AlphaPass123!"))

    # Company B & User B
    name_b = f"Company Beta {uuid4()}"
    comp_b = Company(id=uuid4(), name=name_b, currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    user_b = User(id=uuid4(), company_id=comp_b.id, email="user.b@beta.com", full_name="User B", status="active")
    cred_b = UserCredential(user_id=user_b.id, password_hash=hash_password("BetaPass123!"))

    db_session.add_all([comp_a, comp_b, user_a, user_b, cred_a, cred_b])
    db_session.commit()

    # Case 1: Company A + User A + Password A -> SUCCESS (200)
    r1 = client.post("/api/v1/auth/login", json={
        "company_name": name_a,
        "email": "user.a@alpha.com",
        "password": "AlphaPass123!"
    })
    assert r1.status_code == 200
    assert "access_token" in r1.json()

    # Case 2: Company B + User B + Password B -> SUCCESS (200)
    r2 = client.post("/api/v1/auth/login", json={
        "company_name": name_b,
        "email": "user.b@beta.com",
        "password": "BetaPass123!"
    })
    assert r2.status_code == 200
    assert "access_token" in r2.json()

    # Case 3: Company A + User B + Password B -> FAIL (401)
    r3 = client.post("/api/v1/auth/login", json={
        "company_name": name_a,
        "email": "user.b@beta.com",
        "password": "BetaPass123!"
    })
    assert r3.status_code == 401

    # Case 4: Company B + User A + Password A -> FAIL (401)
    r4 = client.post("/api/v1/auth/login", json={
        "company_name": name_b,
        "email": "user.a@alpha.com",
        "password": "AlphaPass123!"
    })
    assert r4.status_code == 401

    # Case 5: Company A + User A + Password B -> FAIL (401)
    r5 = client.post("/api/v1/auth/login", json={
        "company_name": name_a,
        "email": "user.a@alpha.com",
        "password": "BetaPass123!"
    })
    assert r5.status_code == 401

    # Case 6: Company B + User B + Password A -> FAIL (401)
    r6 = client.post("/api/v1/auth/login", json={
        "company_name": name_b,
        "email": "user.b@beta.com",
        "password": "AlphaPass123!"
    })
    assert r6.status_code == 401

# 16 & 17. Successful JWT contains actual internal company_id matching user's company_id
def test_jwt_creation_and_claims(client, db_session):
    company, user = setup_test_user(db_session)
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Decode and verify claims
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert payload["sub"] == str(user.id)
    assert payload["company_id"] == str(company.id)
    assert payload["company_id"] == str(user.company_id)
    assert "exp" in payload
    assert "iat" in payload

# 18. /api/v1/auth/me works using the issued JWT
def test_bearer_authentication_and_me_endpoint(client, db_session):
    company, user = setup_test_user(db_session)
    
    # 1. Successful login
    response = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # 2. Access /me with token
    response_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response_me.status_code == 200
    data = response_me.json()
    assert data["user_id"] == str(user.id)
    assert data["company_id"] == str(company.id)
    assert "password" not in data
    assert "password_hash" not in data
    
    # 3. Access without token
    response_no_token = client.get("/api/v1/auth/me")
    assert response_no_token.status_code == 401
    
    # 4. Access with wrong scheme
    response_wrong_scheme = client.get("/api/v1/auth/me", headers={"Authorization": f"Basic {token}"})
    assert response_wrong_scheme.status_code == 401
    
    # 5. Access with bad token
    response_bad_token = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer badtoken"})
    assert response_bad_token.status_code == 401

# 19. Tampered JWT fails authentication
def test_jwt_tampering_and_algorithm_security():
    payload = {"sub": "123", "company_id": "456"}
    token = jwt.encode(payload, key="", algorithm="none")
    
    with pytest.raises(jwt.InvalidAlgorithmError):
        jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])

def test_tenant_safety_token_manipulation(client, db_session):
    company, user = setup_test_user(db_session)
    company2 = Company(id=uuid4(), name=f"Other Company {uuid4()}", currency_code="USD", region="NA", fiscal_year_start_month=1, status="active")
    db_session.add(company2)
    db_session.commit()
    
    response = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Change the user's company in the database to simulate tenant mismatch
    user.company_id = company2.id
    db_session.commit()
    
    response_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response_me.status_code == 401
    assert response_me.json()["detail"] == "Tenant mismatch"

# Login request validation matrix (Empty values & extra fields rejected)
def test_login_validation_matrix(client, db_session):
    company, user = setup_test_user(db_session)
    
    # 1. Empty company_name -> 422
    res_empty_company = client.post("/api/v1/auth/login", json={
        "company_name": "   ",
        "email": "jwt@test.com",
        "password": "strongpassword123"
    })
    assert res_empty_company.status_code == 422

    # 2. Empty password -> 422
    res_empty_pass = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": ""
    })
    assert res_empty_pass.status_code == 422

    # 3. Empty email -> 422
    res_empty_email = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "   ",
        "password": "strongpassword123"
    })
    assert res_empty_email.status_code == 422

    # 4. Extra/forbidden fields rejected -> 422
    res_extra = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": "jwt@test.com",
        "password": "strongpassword123",
        "bypass": True
    })
    assert res_extra.status_code == 422

