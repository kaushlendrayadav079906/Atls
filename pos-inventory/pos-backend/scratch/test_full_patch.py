import os
import sys
import json

backend_dir = r"c:\Users\A\Documents\IB\Dashboard\atl2\Atls\pos-inventory\pos-backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.chdir(backend_dir)

from app.services.sap.client import get_sap_client

def test_full_sap_patch():
    client = get_sap_client()
    client.login()

    payload = {
        "InventoryWeight": 80.0,
        "PurchaseUnitWeight": 80.0,
        "SalesUnitWeight": 80.0,
        "U_PerPices": 80,
        "U_Drawing": "Y",
        "User_Text": "Quality Checked & Remarks Verified",
    }
    print(f"Executing PATCH on Items('CS1124') with:\n{json.dumps(payload, indent=2)}")
    client.patch("Items('CS1124')", data=payload)
    print("PATCH succeeded!")

    read_back = client.get("Items('CS1124')", params={"$select": "ItemCode,ItemName,InventoryWeight,PurchaseUnitWeight,SalesUnitWeight,U_PerPices,U_Drawing,User_Text"})
    print(f"\nRead-back verification from SAP:\n{json.dumps(read_back, indent=2)}")

if __name__ == "__main__":
    test_full_sap_patch()
