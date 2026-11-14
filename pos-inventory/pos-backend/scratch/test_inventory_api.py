import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user

def main():
    app.dependency_overrides[get_current_user] = lambda: {
        "sub": "admin",
        "id": 1,
        "user_id": 1,
        "username": "admin",
        "role": "admin",
        "branch_id": None,
        "permissions": ["*"],
        "is_active": True,
    }
    client = TestClient(app)

    print("--- Testing /api/v1/reports/inventory/products for CS1124 & CS0227 ---")
    for code in ["CS1124", "CS0227"]:
        r = client.get(f"/api/v1/reports/inventory/products?search={code}")
        print(f"Code {code}: status {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            items = data.get("items", [])
            print(f"Found {len(items)} items:")
            for it in items:
                print(f"  ItemCode={it.get('item_code')}, Name={it.get('name')}, Stock={it.get('current_stock')}, MinStock={it.get('min_stock')}, Status={it.get('status')}")

if __name__ == "__main__":
    main()
