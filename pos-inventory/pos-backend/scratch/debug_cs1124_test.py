import sys
import os
from dotenv import load_dotenv
load_dotenv(os.path.abspath("pos-inventory/pos-backend/.env"))
sys.path.insert(0, os.path.abspath("pos-inventory/pos-backend"))

from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)
token = create_access_token({"sub": "admin", "role": "admin", "branch_id": "01", "permissions": ["products.view"]})
headers = {"Authorization": f"Bearer {token}"}

res = client.get("/api/v1/stock-configuration?date_from=2026-11-14&date_to=2026-11-16", headers=headers)
data = res.json()
cs1124 = next(it for it in data["items"] if it["item_code"] == "CS1124")
print("CS1124:")
print("  so_no:", repr(cs1124.get("so_no")))
print("  so_qty:", repr(cs1124.get("so_qty")))
print("  qty:", repr(cs1124.get("qty")))
print("  grpo_no:", repr(cs1124.get("grpo_no")))
print("  po_no:", repr(cs1124.get("po_no")))
