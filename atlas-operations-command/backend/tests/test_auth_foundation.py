import pytest
from uuid import uuid4
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.schemas.auth import AuthContext
from app.core.exceptions import UnauthenticatedException, InvalidAuthException, add_exception_handlers
from app.api.deps import get_current_user_context

def test_auth_context_creation():
    user_id = uuid4()
    company_id = uuid4()

    # 1. Valid context
    context = AuthContext(user_id=user_id, company_id=company_id)
    assert context.user_id == user_id
    assert context.company_id == company_id

    # 2. Missing fields should fail
    with pytest.raises(ValidationError):
        AuthContext(user_id=user_id)
        
    with pytest.raises(ValidationError):
        AuthContext(company_id=company_id)

    # 3. Extra fields (like passwords/tokens) should be forbidden
    with pytest.raises(ValidationError):
        AuthContext(user_id=user_id, company_id=company_id, password="secret")

def test_auth_exceptions():
    # Setup minimal app to test exception handlers
    app = FastAPI()
    add_exception_handlers(app)

    @app.get("/unauth")
    def trigger_unauth():
        raise UnauthenticatedException(detail="Not logged in")

    @app.get("/invalid")
    def trigger_invalid():
        raise InvalidAuthException(detail="Bad token")

    client = TestClient(app)

    # 1. Unauthenticated -> 401
    resp1 = client.get("/unauth")
    assert resp1.status_code == 401
    assert resp1.json()["detail"] == "Not logged in"
    assert resp1.headers.get("WWW-Authenticate") == "Bearer"

    # 2. Invalid -> 403
    resp2 = client.get("/invalid")
    assert resp2.status_code == 403
    assert resp2.json()["detail"] == "Bad token"

def test_get_current_user_context_dependency():
    app = FastAPI()
    add_exception_handlers(app)

    @app.get("/me")
    def get_me(current_user: AuthContext = Depends(get_current_user_context)):
        return {"user_id": str(current_user.user_id)}

    client = TestClient(app)
    
    # With real authentication implemented, missing token yields a standard 401
    resp = client.get("/me")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Not authenticated"
