import sys
import os
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user

def run_audit():
    # Set up admin user override
    app.dependency_overrides[get_current_user] = lambda: {
        "sub": "admin",
        "id": 1,
        "user_id": 1,
        "username": "admin",
        "role": "admin",
        "branch_id": None,
        "permissions": ["*"],
        "is_active": True,
    }

    client = TestClient(app)

    print("==================================================")
    print("1. AUDIT SALES ORDERS ENDPOINT (/api/v1/sales-orders)")
    print("==================================================")
    
    # Test 1A: Search for 26271140
    try:
        r = client.get("/api/v1/sales-orders?search=26271140")
        print(f"Status Code: {r.status_code}")
        data = r.json()
        print(f"Total: {data.get('total')}, Items returned: {len(data.get('items', []))}")
        for item in data.get("items", []):
            print(f"  DocNum: {item.get('doc_num')}, DocEntry: {item.get('doc_entry')}, Customer: {item.get('card_name')}, Total: {item.get('doc_total')}, Status: {item.get('document_status')}, Date: {item.get('doc_date')}")
    except Exception as e:
        print("Error in 1A:", e)

    # Test 1B: First page of sales orders
    try:
        r = client.get("/api/v1/sales-orders?page=1&limit=5")
        data = r.json()
        print(f"\nTop 5 Sales Orders in ATLAS:")
        for item in data.get("items", []):
            print(f"  SO #{item.get('doc_num')} (Entry: {item.get('doc_entry')}) | Customer: {item.get('card_name')} | Status: {item.get('document_status')} | Total: {item.get('doc_total')} | Date: {item.get('doc_date')}")
    except Exception as e:
        print("Error in 1B:", e)

    # Test 1C: Specific Sales Order Detail DocEntry 551
    try:
        r = client.get("/api/v1/sales-orders/551")
        print(f"\nSales Order 551 Detail: Status Code {r.status_code}")
        detail = r.json()
        print(f"  DocNum: {detail.get('doc_num')}, Customer: {detail.get('card_name')} ({detail.get('card_code')}), Total: {detail.get('doc_total')}, Status: {detail.get('document_status')}")
        for line in detail.get("document_lines", []):
            print(f"    Line: Item={line.get('item_code')}, Desc={line.get('item_description')}, Qty={line.get('quantity')}, BalanceQty={line.get('balance_qty')}, DispatchQty={line.get('dispatch_qty')}, Price={line.get('price')}, LineTotal={line.get('line_total')}")
    except Exception as e:
        print("Error in 1C:", e)

    print("\n==================================================")
    print("2. AUDIT PURCHASE ORDERS ENDPOINT (/api/v1/purchase-orders)")
    print("==================================================")

    # Test 2A: Search for 1378
    try:
        r = client.get("/api/v1/purchase-orders?search=1378")
        print(f"Status Code: {r.status_code}")
        data = r.json()
        print(f"Search '1378' -> Total: {data.get('total')}, Items returned: {len(data.get('items', []))}")
        for item in data.get("items", []):
            print(f"  DocNum: {item.get('doc_num')}, DocEntry: {item.get('doc_entry')}, Vendor: {item.get('card_name')}, Total: {item.get('doc_total')}, Status: {item.get('document_status')}")
    except Exception as e:
        print("Error in 2A:", e)

    # Test 2B: Search for PO2627 / P02627
    for q in ["PO2627", "P02627"]:
        try:
            r = client.get(f"/api/v1/purchase-orders?search={q}")
            data = r.json()
            print(f"Search '{q}' -> Total: {data.get('total')}, Items: {len(data.get('items', []))}")
        except Exception as e:
            print(f"Error in search {q}:", e)

    # Test 2C: First page of purchase orders
    try:
        r = client.get("/api/v1/purchase-orders?page=1&limit=5")
        data = r.json()
        print(f"\nTop 5 Purchase Orders in ATLAS:")
        for item in data.get("items", []):
            print(f"  PO #{item.get('doc_num')} (Entry: {item.get('doc_entry')}) | Vendor: {item.get('card_name')} | Status: {item.get('document_status')} | Total: {item.get('doc_total')} | Date: {item.get('doc_date')}")
    except Exception as e:
        print("Error in 2C:", e)

    # Test 2D: Detail for PO 871
    try:
        r = client.get("/api/v1/purchase-orders/871")
        print(f"\nPurchase Order 871 Detail: Status Code {r.status_code}")
        detail = r.json()
        print(f"  DocNum: {detail.get('doc_num')}, Vendor: {detail.get('card_name')} ({detail.get('card_code')}), Total: {detail.get('doc_total')}, Status: {detail.get('document_status')}")
        for line in detail.get("document_lines", []):
            print(f"    Line: Item={line.get('item_code')}, Desc={line.get('item_description')}, Qty={line.get('quantity')}, BalanceQty={line.get('balance_qty')}, ReceivedQty={line.get('received_qty')}, Price={line.get('price')}")
    except Exception as e:
        print("Error in 2D:", e)

    print("\n==================================================")
    print("3. AUDIT STOCK / PRODUCTS FOR CS1124 & CS0227")
    print("==================================================")
    for code in ["CS1124", "CS0227"]:
        try:
            r = client.get(f"/api/v1/products?search={code}")
            data = r.json()
            items = data.get("items", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            print(f"\nProducts API for {code} (returned {len(items)} items):")
            for item in items:
                print(f"  ID: {item.get('id')}, Name: {item.get('name')}, Stock: {item.get('stock')}, Warehouse: {item.get('warehouse')}, Price: {item.get('price')}")
        except Exception as e:
            print(f"Error checking product {code}:", e)

    print("\n==================================================")
    print("4. AUDIT EXECUTIVE DASHBOARD (/api/v1/dashboard/executive-command)")
    print("==================================================")
    try:
        r = client.get("/api/v1/dashboard/executive-command?range=monthly&force_refresh=true")
        print(f"Dashboard Executive Command Status: {r.status_code}")
        data = r.json()
        print(f"Data source status: {data.get('data_source_status')}")
        print(f"AI Brief Title: {data.get('brief', {}).get('title')}")
        print(f"AI Brief Text: {data.get('brief', {}).get('summary_text')}")
        
        kpis = data.get("kpis", {})
        print("\nKPIs in Executive Dashboard:")
        for kpi_key, kpi_val in kpis.items():
            print(f"  {kpi_key}: formatted={kpi_val.get('formatted')}, value={kpi_val.get('value')}, subtext={kpi_val.get('subtext')}")
            
        print("\nGap Cards:")
        for gap in data.get("gap_cards", []):
            print(f"  Rank {gap.get('rank')}: {gap.get('title')} | Impact: {gap.get('impact_value')} | Label: {gap.get('impact_label')} | Detail: {gap.get('supporting_detail')}")

        print("\nAction Queue:")
        for act in data.get("action_queue", []):
            print(f"  {act.get('priority')}: {act.get('title')} ({act.get('category')}) -> {act.get('action_label')}")
    except Exception as e:
        print("Error checking executive command:", e)

    print("\n==================================================")
    print("5. AUDIT RECENT TRANSACTIONS ON DASHBOARD (/api/v1/dashboard/recent-sales-feed)")
    print("==================================================")
    try:
        r = client.get("/api/v1/dashboard/recent-sales-feed?limit=5")
        data = r.json()
        print(f"Recent sales feed: {data.get('total')} items")
        for s in data.get("items", []):
            print(f"  Invoice: {s.get('invoice_number')}, Customer: {s.get('customer_name')}, Total: {s.get('total')}, Date: {s.get('created_at')}")
    except Exception as e:
        print("Error checking recent sales feed:", e)

if __name__ == "__main__":
    run_audit()

