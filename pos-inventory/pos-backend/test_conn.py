import sys
import httpx

def test_conn():
    urls = [
        "https://116.72.105.127:50000/b1s/v1/Login",
        "http://116.72.105.127:50001/b1s/v1/Login",
    ]
    for url in urls:
        print(f"Testing {url}...")
        try:
            res = httpx.post(url, json={
                "CompanyDB": "Amit_Kumar",
                "UserName": "manager",
                "Password": "123"
            }, verify=False, timeout=3.0)
            print(f"Status: {res.status_code}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_conn()
