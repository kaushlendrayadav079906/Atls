from app.services.sap.client import get_sap_client
from app.core.config import settings
import os

print(f"Original URL: {settings.SAP_SERVICE_LAYER_URL}")

# Override for testing
settings.SAP_SERVICE_LAYER_URL = "http://127.0.0.1:50001/b1s/v1"
print(f"Testing IPv4 URL: {settings.SAP_SERVICE_LAYER_URL}")

client = get_sap_client()
client.base_url = settings.SAP_SERVICE_LAYER_URL

try:
    if client.login():
        print("Logged in successfully with IPv4!")
        client.logout()
except Exception as e:
    print(f"IPv4 Error: {e}")

# Also test https
settings.SAP_SERVICE_LAYER_URL = "https://127.0.0.1:50000/b1s/v1"
print(f"\nTesting HTTPS URL: {settings.SAP_SERVICE_LAYER_URL}")
client.base_url = settings.SAP_SERVICE_LAYER_URL

try:
    if client.login():
        print("Logged in successfully with HTTPS!")
        client.logout()
except Exception as e:
    print(f"HTTPS Error: {e}")
