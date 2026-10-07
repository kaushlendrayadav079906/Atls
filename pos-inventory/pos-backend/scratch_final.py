import sys
import os
import httpx

def main():
    base_url = "http://localhost:3001/api/v1"
    
    with httpx.Client(base_url=base_url) as client:
        print("--- Testing /health ---")
        health = client.get("http://localhost:3001/health")
        print(health.status_code, health.text)
        
        # Login to get token
        print("--- Testing /auth/login ---")
        login_res = client.post("/auth/login", json={
            "username": "admin",
            "password": "password123"
        })
        if login_res.status_code != 200:
            # try testuser from earlier
            login_res = client.post("/auth/login", json={
                "username": "testuser",
                "password": "password123"
            })
        print("Login:", login_res.status_code)
        
        token = login_res.json().get("access_token")
        if not token:
            print("Failed to get token!")
            return
            
        headers = {"Authorization": f"Bearer {token}"}
        
        endpoints = [
            "/auth/me",
            "/dashboard/summary",
            "/atlas/inventory-summary?branch=SH",
            "/dashboard/alerts",
            "/atlas/sales-trends",
            "/dashboard/recent-sales",
            "/atlas/product-velocity"
        ]
        
        for ep in endpoints:
            print(f"--- Testing {ep} ---")
            res = client.get(ep, headers=headers)
            print(f"Status: {res.status_code}")
            print(f"Response: {res.text[:200]}...")

if __name__ == "__main__":
    main()
