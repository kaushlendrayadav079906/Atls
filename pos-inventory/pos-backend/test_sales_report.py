import httpx
import json

token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc5MTEwNDIzNn0.z-PUaQrRVzn2CPY6Ain8EKUl3gzI6uctOXcCbfP9MTo'
headers = {'Authorization': f'Bearer {token}'}

print("=== TEST 1: Atlas Overview (monthly) ===")
r = httpx.get('http://127.0.0.1:3001/api/v1/atlas/overview?range=monthly', headers=headers, timeout=30)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"  totalSales: {data.get('totalSales')}")
    print(f"  invoiceCount: {data.get('invoiceCount')}")
    print(f"  averageOrderValue: {data.get('averageOrderValue')}")
    print(f"  paymentBreakdown: {json.dumps(data.get('paymentBreakdown', []))}")
else:
    print(f"  Error: {r.text[:500]}")

print()
print("=== TEST 2: Atlas Sales Trends (monthly) ===")
r2 = httpx.get('http://127.0.0.1:3001/api/v1/atlas/sales-trends?range=monthly', headers=headers, timeout=30)
print(f"Status: {r2.status_code}")
if r2.status_code == 200:
    trend = r2.json()
    points = trend.get('trend', [])
    print(f"  Trend points: {len(points)}")
    for p in points[:5]:
        print(f"    {p}")
else:
    print(f"  Error: {r2.text[:500]}")

print()
print("=== TEST 3: Dashboard Recent Sales Feed (monthly) ===")
r3 = httpx.get('http://127.0.0.1:3001/api/v1/dashboard/recent-sales-feed?range=monthly&limit=5', headers=headers, timeout=30)
print(f"Status: {r3.status_code}")
if r3.status_code == 200:
    feed = r3.json()
    print(f"  total: {feed.get('total')}")
    print(f"  grossSales: {feed.get('grossSales')}")
    items = feed.get('items', [])
    print(f"  items count: {len(items)}")
    for item in items[:3]:
        print(f"    docNum={item.get('docNum')}, customer={item.get('customerName')}, total={item.get('total')}, paymentMethod={item.get('paymentMethod')}")
else:
    print(f"  Error: {r3.text[:500]}")

print()
print("=== TEST 4: Admin user (non-admin role) ===")
# Test with a 'user' role - should now work (not 403)
r_reg = httpx.post('http://127.0.0.1:3001/api/v1/auth/login', json={'username': 'Admin', 'password': 'rj123456'}, timeout=10)
print(f"Login status: {r_reg.status_code}")
