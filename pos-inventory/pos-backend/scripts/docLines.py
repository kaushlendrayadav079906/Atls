import httpx
import json

BASE_URL = "http://116.72.105.127:50001/b1s/v1"
LOGIN_URL = f"{BASE_URL}/Login"

# 🔐 Fill this properly
credentials = {
    "CompanyDB": "KLPL_LIVE_DB",
            "UserName": "manager",
            "Password": "KLPL@1987"
}


def login():
    with httpx.Client() as client:
        res = client.post(LOGIN_URL, json=credentials)
        res.raise_for_status()
        cookies = res.cookies
        print("✅ Logged in")
        return cookies


def test_expand(cookies):
    print("\n🔎 Testing $expand=DocumentLines...")

    url = f"{BASE_URL}/Invoices"
    params = {
        "$top": 1,
        "$select": "DocEntry,DocNum",
        "$expand": "DocumentLines($select=ItemCode,Quantity,LineNum)"
    }

    with httpx.Client(cookies=cookies) as client:
        res = client.get(url, params=params)
        print("Status:", res.status_code)

        try:
            data = res.json()
            lines = data["value"][0].get("DocumentLines", [])

            if lines:
                print("✅ Expand works. Sample line:")
                print(json.dumps(lines[0], indent=2))
            else:
                print("⚠️ Expand returned empty lines")

        except Exception as e:
            print("❌ Expand failed:", str(e))


def test_nested_select(cookies):
    print("\n🔎 Testing nested $select inside $expand...")

    url = f"{BASE_URL}/Invoices"
    params = {
        "$top": 1,
        "$select": "DocEntry",
        "$expand": "DocumentLines($select=ItemCode)"
    }

    with httpx.Client(cookies=cookies) as client:
        res = client.get(url, params=params)
        print("Status:", res.status_code)

        try:
            data = res.json()
            lines = data["value"][0].get("DocumentLines", [])

            if lines:
                sample = lines[0]
                print("📦 Returned fields:", list(sample.keys()))

                if list(sample.keys()) == ["ItemCode"]:
                    print("✅ Nested select works correctly")
                else:
                    print("⚠️ SAP ignored nested select (common issue)")

        except Exception as e:
            print("❌ Nested select test failed:", str(e))


def test_crossjoin(cookies):
    print("\n🔎 Testing QueryService ($crossjoin)...")

    url = f"{BASE_URL}/QueryService_PostQuery"

    payload = {
        "QueryPath": "$crossjoin(Invoices,Invoices/DocumentLines)",
        "QueryOption": "$expand=Invoices($select=DocEntry,DocNum),Invoices/DocumentLines($select=ItemCode,LineNum,Quantity)"
                       "&$filter=Invoices/DocEntry eq Invoices/DocumentLines/DocEntry and Invoices/DocEntry ge 1 and Invoices/DocumentLines/LineNum eq 0"
    }

    headers = {
        "Content-Type": "application/json"
    }

    with httpx.Client(cookies=cookies) as client:
        res = client.post(url, json=payload, headers=headers)

        print("Status:", res.status_code)

        try:
            data = res.json()
            if "value" in data and len(data["value"]) > 0:
                print("✅ Crossjoin works. Sample:")
                print(json.dumps(data["value"][0], indent=2))
            else:
                print("⚠️ Crossjoin returned empty")

        except Exception as e:
            print("❌ Crossjoin failed:", str(e))


def main():
    cookies = login()

    test_expand(cookies)
    test_nested_select(cookies)
    test_crossjoin(cookies)


if __name__ == "__main__":
    main()