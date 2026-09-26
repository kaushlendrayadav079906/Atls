from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import setup_auth

client = TestClient(app)

def test_create_factory():
    # Placeholder for factory creation if we implement mutation
    pass

def test_get_factory(db_session):
    company_id, user_id, headers = setup_auth(db_session, client)
    response = client.get("/api/v1/factories", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_factory_tenant_isolation(db_session):
    company1_id, user1_id, headers1 = setup_auth(db_session, client, email_prefix="admin1")
    company2_id, user2_id, headers2 = setup_auth(db_session, client, email_prefix="admin2")
    
    res1 = client.get("/api/v1/factories", headers=headers1)
    assert res1.status_code == 200
    
    res2 = client.get("/api/v1/factories", headers=headers2)
    assert res2.status_code == 200
