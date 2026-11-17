import sys, os
from dotenv import load_dotenv
load_dotenv(os.path.abspath('pos-inventory/pos-backend/.env'))
sys.path.insert(0, os.path.abspath('pos-inventory/pos-backend'))
from app.services.sap.client import get_sap_client

client = get_sap_client()
client.login()

# Test PATCH with UserText
try:
    print("Testing PATCH with UserText...")
    res = client.patch("Items('CS1124')", data={"UserText": "Test UserText"})
    print("UserText PATCH succeeded:", res)
except Exception as e:
    print("UserText PATCH failed:", e)

# Test PATCH with User_Text
try:
    print("Testing PATCH with User_Text...")
    res = client.patch("Items('CS1124')", data={"User_Text": "Test User_Text"})
    print("User_Text PATCH succeeded:", res)
except Exception as e:
    print("User_Text PATCH failed:", e)
