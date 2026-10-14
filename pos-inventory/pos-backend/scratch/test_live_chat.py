"""Test live chat tool calling against pos-backend."""
import requests
import json
import sys

def main():
    base_url = "http://127.0.0.1:3001"
    
    import sys, os
    sys.path.insert(0, os.path.abspath("."))
    from app.core.security import create_access_token
    token = create_access_token({"sub": "admin", "role": "admin", "name": "Admin User", "branch_id": None})
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("Token created successfully!")

    queries = [
        "Show monthly revenue for the last 6 months",
        "Show incoming payments this month",
        "Which customer purchased the most?",
        "How much money do customers still owe us?",
        "What is our gross profit this month?",
        "Can I edit invoice 56?",
        "Open incoming payments"
    ]

    for q in queries:
        print(f"\n=======================================================")
        print(f"QUERY: {q}")
        print(f"=======================================================")
        try:
            res = requests.post(
                f"{base_url}/api/v1/ai-assistant/chat",
                headers=headers,
                json={
                    "message": q,
                    "branch_id": "",
                    "history": []
                },
                timeout=45
            )
            print(f"Status: {res.status_code}")
            if res.status_code == 200:
                data = res.json()
                print(f"Answer:\n{data.get('answer')[:300]}...")
                sd = data.get("structured_data")
                if sd:
                    print(f"Structured Type: {sd.get('type')}")
                    if sd.get("type") == "table":
                        print(f"Table title: {sd.get('title')}, rows count: {len(sd.get('rows', []))}")
                        if sd.get("chart"):
                            print(f"Chart: {sd['chart'].get('type')}, series: {sd['chart'].get('series')}, defaultView: {sd['chart'].get('defaultView')}")
                    elif sd.get("type") == "finance_summary":
                        print(f"Cards count: {len(sd.get('cards', []))}")
                    elif sd.get("type") == "navigation":
                        print(f"Navigation target: {sd.get('target')}")
                nav = data.get("navigation")
                if nav:
                    print(f"Navigation Action: {nav}")
            else:
                print(f"Error: {res.text}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    main()
