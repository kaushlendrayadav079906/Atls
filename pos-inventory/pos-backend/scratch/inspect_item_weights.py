import sys
import os
sys.path.insert(0, os.path.abspath("."))
from app.services.sap.client import get_sap_client
import json

client = get_sap_client()
client.login()

item = client.get("Items('CS1124')")

# Check all properties containing weight, text, drawing, remark, etc.
keywords = ["weight", "text", "draw", "remark", "perpice", "user", "pack", "pic"]
matches = {}
for k, v in item.items():
    lower_k = k.lower()
    if any(w in lower_k for w in keywords):
        matches[k] = v

print("Matching properties on Items('CS1124'):")
print(json.dumps(matches, indent=2))
