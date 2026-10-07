import httpx

def main():
    with httpx.Client(base_url="http://localhost:3001/api/v1") as client:
        # Try to login with admin
        login_res = client.post("/auth/login", json={
            "username": "admin",
            "password": "password123"
        })
        print("Login:", login_res.status_code, login_res.text)
        print("Login:", login_res.status_code)
        token = login_res.json().get("access_token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test summary
        res = client.get("/dashboard/summary", headers=headers)
        print("Summary:", res.status_code, res.text)
        
        # Test trends
        res = client.get("/atlas/sales-trends", headers=headers)
        print("Trends:", res.status_code, res.text)

if __name__ == "__main__":
    main()
