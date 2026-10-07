from app.services.sap.client import get_sap_client
from app.core.config import settings

print(f"URL: {settings.SAP_SERVICE_LAYER_URL}")
print(f"DB: {settings.SAP_COMPANY_DB}")
print(f"USER: {settings.SAP_USERNAME}")
print("PWD: [HIDDEN]")

client = get_sap_client()
try:
    if client.login():
        print("Logged in successfully!")
        client.logout()
except Exception as e:
    print(f"Error: {e}")
