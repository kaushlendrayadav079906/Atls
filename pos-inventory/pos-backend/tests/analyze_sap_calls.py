import re
import os

log_files = ['backend.log', 'backend_utf8.log', 'logs/app.log']
unique_non_get = set()
patch_calls = []

for log_path in log_files:
    if not os.path.exists(log_path):
        continue
    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if 'b1s/v1' in line:
                m = re.search(r'HTTP Request:\s+([A-Z]+)\s+([^\s\"]+)', line)
                if m:
                    method, full_url = m.group(1), m.group(2)
                    if method != 'GET':
                        endpoint = re.sub(r'https?://[^/]+', '', full_url)
                        unique_non_get.add((method, endpoint))
                    if method in ('PATCH', 'PUT', 'DELETE'):
                        patch_calls.append(line.strip())

print("=== Unique Non-GET Outbound Calls to SAP Service Layer ===")
for method, ep in sorted(unique_non_get):
    print(f"  {method} {ep}")

print(f"\n=== Total Outbound PATCH/PUT/DELETE Calls to SAP: {len(patch_calls)} ===")
for c in patch_calls:
    print(f"  {c}")
