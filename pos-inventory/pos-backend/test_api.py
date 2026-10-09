import httpx

def test_api():
    base_url = "http://127.0.0.1:3001/api/v1/production"
    
    # Let's get an admin token first
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": "admin", "role": "admin"})
    headers = {"Authorization": f"Bearer {token}"}
    
    df = "2024-01-01"
    dt = "2024-12-31"
    params = {"date_from": df, "date_to": dt}
    
    with httpx.Client(base_url=base_url, headers=headers) as client:
        print("--- Status ---")
        res = client.get("/status-distribution", params=params)
        print(res.json())
        
        print("--- Orders ---")
        res = client.get("/orders", params=params)
        print(res.json().get('total') if res.status_code == 200 else res.json())
        
if __name__ == "__main__":
    test_api()
