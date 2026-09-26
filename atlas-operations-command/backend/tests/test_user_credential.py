import pytest
from uuid import uuid4
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.security import hash_password, verify_password
from app.models.user_credential import UserCredential
from app.models.company import Company
from app.models.user import User
from app.schemas.user_credential import CredentialCreate, CredentialResponse
from app.services.user_credential import UserCredentialService

# A. PASSWORD HASHING
def test_password_hashing():
    plain = "securepassword123"
    hashed1 = hash_password(plain)
    hashed2 = hash_password(plain)
    
    assert hashed1 != plain
    assert "$argon2id$" in hashed1
    assert hashed1 != hashed2 # Salting produces different hashes

# B. PASSWORD VERIFICATION
def test_password_verification():
    plain = "securepassword123"
    hashed = hash_password(plain)
    
    assert verify_password(plain, hashed) is True
    assert verify_password("wrongpassword", hashed) is False
    assert verify_password(plain, "$argon2id$invalidhashformat") is False

# C. PASSWORD POLICY
def test_password_policy():
    with pytest.raises(ValidationError):
        CredentialCreate(password="")
        
    with pytest.raises(ValidationError):
        CredentialCreate(password="short")

    valid = CredentialCreate(password="validpassword")
    assert valid.password == "validpassword"

# D, E, F, G. PERSISTENCE, CONSTRAINT, ISOLATION, INACTIVE
def test_credential_service():
    from app.core.database import get_db
    from app.main import app
    
    # Get the db from the test client's dependency overrides
    db_gen = app.dependency_overrides.get(get_db, get_db)()
    db_session = next(db_gen)
    try:
        company_a = Company(id=uuid4(), name="Company A", currency_code="USD", region="NA", fiscal_year_start_month=1)
        company_b = Company(id=uuid4(), name="Company B", currency_code="USD", region="NA", fiscal_year_start_month=1)
        user_a = User(id=uuid4(), company_id=company_a.id, email="a@a.com", full_name="User A")
        user_inactive = User(id=uuid4(), company_id=company_a.id, email="inactive@a.com", full_name="Inactive", status="inactive")
        user_b = User(id=uuid4(), company_id=company_b.id, email="b@b.com", full_name="User B")
        
        db_session.add_all([company_a, company_b, user_a, user_inactive, user_b])
        db_session.commit()

        service = UserCredentialService(db_session)
        plain_pass = "securepassword123"

        # Creation
        cred = service.set_credential(company_a.id, user_a.id, plain_pass)
        assert cred.password_hash != plain_pass
        assert "$argon2id$" in cred.password_hash
        
        # E. 1-to-1 Duplicate Creation Rejected
        with pytest.raises(HTTPException) as exc_info:
            service.set_credential(company_a.id, user_a.id, plain_pass)
        assert exc_info.value.status_code == 409

        # F. Tenant Isolation during creation
        with pytest.raises(HTTPException) as exc_info:
            service.set_credential(company_a.id, user_b.id, plain_pass)
        assert exc_info.value.status_code == 403

        # G. Inactive User Verification Fails
        service.set_credential(company_a.id, user_inactive.id, plain_pass)
        assert service.verify_credential(company_a.id, user_inactive.id, plain_pass) is False

        # B. Normal verification works
        assert service.verify_credential(company_a.id, user_a.id, plain_pass) is True
        assert service.verify_credential(company_a.id, user_a.id, "wrong") is False
        
        # F. Cross-company verification fails
        assert service.verify_credential(company_b.id, user_a.id, plain_pass) is False
    finally:
        db_session.close()

# H. RESPONSE SECURITY
def test_credential_response_security():
    from datetime import datetime
    cred = UserCredential(
        id=uuid4(), 
        user_id=uuid4(), 
        password_hash="secret",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    response = CredentialResponse.model_validate(cred)
    assert not hasattr(response, "password_hash")
    assert not hasattr(response, "password")
