import httpx
import json

session = httpx.Client(verify=False)
login_res = session.post("https://ebony-renovator-elevation.ngrok-free.dev/b1s/v1/Login", json={
    "CompanyDB": "Amit_Kumar",
    "UserName": "manager",
    "Password": "1234"
}, timeout=30.0)
print("Login:", login_res.status_code)
res = session.get("https://ebony-renovator-elevation.ngrok-free.dev/b1s/v1/IncomingPayments?$top=1", timeout=30.0)
print("Payments:", res.status_code)
with open("payments_output.json", "w", encoding="utf-8") as f:
    json.dump(res.json(), f, indent=2)
