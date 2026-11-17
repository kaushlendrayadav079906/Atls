import sys
import os

# Set testing environment variables
os.environ["TESTING"] = "True"
os.environ["SAP_STOCK_SYNC_ENABLED"] = "False"
sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("pos-inventory/pos-backend"))

print("Importing app...")
from app.main import app
from fastapi.testclient import TestClient
from app.core.security import create_access_token

print("Creating TestClient...")
with TestClient(app) as client:
    print("Generating token...")
    token = create_access_token({"sub": "admin", "role": "admin", "branch_id": "01", "permissions": ["products.view"]})
    headers = {"Authorization": f"Bearer {token}"}
    print("Calling endpoint GET /api/v1/stock-configuration...")
    res = client.get("/api/v1/stock-configuration?page=1&page_size=10", headers=headers)
    print(f"Status: {res.status_code}")
    print(f"Keys: {res.json().keys() if res.status_code == 200 else res.text}")
