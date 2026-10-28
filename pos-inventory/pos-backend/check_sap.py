"""
SAP Business One Service Layer Connection Diagnostic Script
Tests connectivity, credentials, and endpoints configured in .env and alternates.
"""
import sys
import os
import httpx

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.core.config import settings

def test_endpoint(url, company_db, username, password, verify_ssl=False):
    print(f"\n--- Testing Endpoint ---")
    print(f"URL:        {url}")
    print(f"CompanyDB:  {company_db}")
    print(f"Username:   {username}")
    
    login_url = f"{url.rstrip('/')}/Login"
    payload = {
        "CompanyDB": company_db,
        "UserName": username,
        "Password": password
    }
    
    try:
        with httpx.Client(timeout=8.0, verify=verify_ssl, follow_redirects=True) as client:
            resp = client.post(login_url, json=payload)
            print(f"HTTP Status: {resp.status_code}")
            if resp.status_code == 200:
                print(">>> SUCCESS: Connected and Authenticated with SAP!")
                cookies = resp.cookies
                print(f"B1SESSION: {cookies.get('B1SESSION', '')[:15]}...")
                return True
            else:
                print(f">>> FAILED: SAP returned: {resp.text}")
                return False
    except httpx.ConnectTimeout:
        print(">>> FAILED: Connection timed out. The server IP/Port is unreachable (check VPN/Tailscale/Firewall).")
        return False
    except httpx.ConnectError as ce:
        print(f">>> FAILED: Connection refused or network unreachable ({ce}).")
        return False
    except Exception as exc:
        print(f">>> FAILED: {type(exc).__name__}: {exc}")
        return False

def main():
    print("=" * 65)
    print("SAP Service Layer Connectivity Diagnostic")
    print("=" * 65)
    
    # 1. Test current .env settings
    print("\n[1] Testing current .env settings:")
    ok = test_endpoint(
        url=settings.SAP_SERVICE_LAYER_URL,
        company_db=settings.SAP_COMPANY_DB,
        username=settings.SAP_USERNAME,
        password=settings.SAP_PASSWORD,
        verify_ssl=settings.SAP_SSL_VERIFY
    )
    
    if ok:
        print("\nConclusion: Current .env settings are WORKING!")
        return

    # 2. Test alternate credentials/IPs if the current one failed
    print("\n[2] Testing alternate configurations found in project...")
    
    alternatives = [
        # (URL, DB, User, Pwd)
        ("http://100.108.17.64:50001/b1s/v1", "LIVE_Astro_051225", "manager", "Asap@12345"),
        ("https://100.108.17.64:50000/b1s/v1", "Amit_Kumar", "manager", "1234"),
        ("https://116.72.105.127:50000/b1s/v1", "Amit_Kumar", "manager", "1234"),
        ("http://116.72.105.127:50001/b1s/v1", "Amit_Kumar", "manager", "1234"),
        ("http://116.72.105.127:50001/b1s/v1", "LIVE_Astro_051225", "manager", "Asap@12345"),
        ("https://116.72.105.127:50000/b1s/v1", "LIVE_Astro_051225", "manager", "Asap@12345"),
    ]
    
    found_working = False
    for url, db, user, pwd in alternatives:
        if url == settings.SAP_SERVICE_LAYER_URL and db == settings.SAP_COMPANY_DB:
            continue
        if test_endpoint(url, db, user, pwd, verify_ssl=False):
            print(f"\n>>> FOUND WORKING CONFIGURATION! <<<")
            print(f"Update your .env with:")
            print(f"SAP_SERVICE_LAYER_URL={url}")
            print(f"SAP_COMPANY_DB={db}")
            print(f"SAP_USERNAME={user}")
            print(f"SAP_PASSWORD={pwd}")
            found_working = True
            break
            
    if not found_working:
        print("\n" + "=" * 65)
        print("RECOMMENDATION:")
        print("1. If using 100.108.17.64, ensure Tailscale / VPN is active and connected.")
        print("2. If using 116.72.105.127, verify the IP/port 50001/50000 is open in firewall.")
        print("3. Check with your SAP administrator for the latest Service Layer URL & credentials.")
        print("=" * 65)

if __name__ == "__main__":
    main()
