import urllib.request
import json
from app.core.security import create_access_token

token = create_access_token({"sub": "admin", "role": "admin", "company_id": "RMPL_DEMO"})

# 1. /auth/me
try:
    req = urllib.request.Request("http://127.0.0.1:3001/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        print("/auth/me status:", resp.status)
        print(resp.read().decode())
except Exception as e:
    print("/auth/me failed:", e)

# 2. /google-sheets/status
try:
    req2 = urllib.request.Request("http://127.0.0.1:3001/api/v1/integrations/google-sheets/status", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req2, timeout=5) as resp:
        print("/google-sheets/status status:", resp.status)
        print(resp.read().decode()[:200])
except Exception as e:
    print("/google-sheets/status failed:", e)
