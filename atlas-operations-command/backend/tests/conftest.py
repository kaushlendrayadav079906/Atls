import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db

import os
import subprocess

def get_test_db_url():
    db_host = os.environ.get("DB_HOST")
    if not db_host:
        try:
            wsl_out = subprocess.check_output(["wsl", "-d", "Ubuntu", "hostname", "-I"], timeout=3).decode().split()
            if wsl_out:
                db_host = wsl_out[0]
        except Exception:
            db_host = "localhost"
    if not db_host:
        db_host = "localhost"
    return f"mysql+pymysql://user:password@{db_host}:3307/atlasops_test"

# Use MySQL for testing
SQLALCHEMY_DATABASE_URL = get_test_db_url()

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app import models as _models
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="function")
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def setup_auth(db_session, client, role="admin", email_prefix="admin", currency_code="USD"):
    from uuid import uuid4
    from app.models.company import Company
    from app.models.user import User
    from app.models.role import Role
    from app.models.user_role import UserRole
    from app.models.user_credential import UserCredential
    from app.core.security import hash_password
    
    company = Company(id=uuid4(), name=f"Test Company {uuid4()}", currency_code=currency_code, region="NA", fiscal_year_start_month=1)
    db_session.add(company)
    db_session.commit()
    
    email = f"{email_prefix}@test.com"
    user = User(id=uuid4(), company_id=company.id, email=email, full_name="Test User")
    db_session.add(user)
    db_session.add(UserCredential(user_id=user.id, password_hash=hash_password("password")))
    db_session.commit()
    
    r = Role(id=uuid4(), name=role, company_id=company.id)
    db_session.add(r)
    db_session.commit()
    
    db_session.add(UserRole(user_id=user.id, role_id=r.id))
    db_session.commit()
    
    resp = client.post("/api/v1/auth/login", json={
        "company_name": company.name,
        "email": email,
        "password": "password"
    })
    token = resp.json()["access_token"]
    
    return company.id, user.id, {"Authorization": f"Bearer {token}"}
