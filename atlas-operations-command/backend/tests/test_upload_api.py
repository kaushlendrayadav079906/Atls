from fastapi.testclient import TestClient
from app.main import app
from tests.conftest import setup_auth
import json

client = TestClient(app)

def test_upload_unauthorized():
    response = client.post("/api/v1/uploads")
    assert response.status_code == 401

def test_upload_non_admin(db_session):
    company_id, user_id, headers = setup_auth(db_session, client, role="user", email_prefix="user_upload")
    files = {"file": ("test.csv", b"name,code\nF1,C1", "text/csv")}
    response = client.post("/api/v1/uploads", headers=headers, files=files)
    assert response.status_code == 403

def test_upload_csv(db_session):
    company_id, user_id, headers = setup_auth(db_session, client, email_prefix="admin_upload1")
    files = {"file": ("test.csv", b"name,code\nF1,C1", "text/csv")}
    response = client.post("/api/v1/uploads", headers=headers, files=files)
    assert response.status_code == 201
    assert response.json()["file_type"] == "csv"
    assert response.json()["original_filename"] == "test.csv"
    assert response.json()["status"] == "uploaded"
    
    # Test duplicate upload idempotency
    files2 = {"file": ("test2.csv", b"name,code\nF1,C1", "text/csv")}
    resp2 = client.post("/api/v1/uploads", headers=headers, files=files2)
    assert resp2.status_code == 409
    
def test_upload_unsupported_type(db_session):
    company_id, user_id, headers = setup_auth(db_session, client, email_prefix="admin_upload2")
    files = {"file": ("test.pdf", b"pdf content", "application/pdf")}
    response = client.post("/api/v1/uploads", headers=headers, files=files)
    assert response.status_code == 415

def test_tenant_isolation(db_session):
    company1_id, user1_id, headers1 = setup_auth(db_session, client, email_prefix="admin_tenant1")
    company2_id, user2_id, headers2 = setup_auth(db_session, client, email_prefix="admin_tenant2")
    
    files = {"file": ("test.csv", b"data1", "text/csv")}
    resp1 = client.post("/api/v1/uploads", headers=headers1, files=files)
    upload_id = resp1.json()["id"]
    
    # Company 2 tries to get Company 1's upload
    resp2 = client.get(f"/api/v1/uploads/{upload_id}", headers=headers2)
    assert resp2.status_code == 404
    
    # Company 2 tries to upload the exact same file (same hash)
    # This should succeed because uniqueness is (company_id, file_hash)
    files2 = {"file": ("test.csv", b"data1", "text/csv")}
    resp3 = client.post("/api/v1/uploads", headers=headers2, files=files2)
    assert resp3.status_code == 201
