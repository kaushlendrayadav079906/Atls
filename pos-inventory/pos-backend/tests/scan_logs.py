import re
import os

log_files = ['backend.log', 'backend_utf8.log', 'logs/app.log']
patterns = [
    r'submit[-_]update',
    r'submit_approved_record_update',
    r'\[AUDIT\]',
    r'SAP_UPDATE',
    r'PATCH\s+',
    r'Service Layer.*PATCH',
    r'/b1s/v[12]/Invoices\(',
    r'/b1s/v[12]/PurchaseInvoices\(',
    r'/b1s/v[12]/BusinessPartners\('
]

match_count = 0
for log_path in log_files:
    print(f"=== Scanning {log_path} ===")
    if not os.path.exists(log_path):
        print(f"File {log_path} not found.")
        continue
    try:
        with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line_no, line in enumerate(f, 1):
                for p in patterns:
                    if re.search(p, line, re.IGNORECASE):
                        match_count += 1
                        # Mask any potential sensitive words
                        clean = re.sub(r'Bearer\s+[A-Za-z0-9\-\._~+/]+=*', 'Bearer [REDACTED]', line.strip())
                        clean = re.sub(r'(?i)password\s*[:=]\s*[^\s,]+', 'password=[REDACTED]', clean)
                        print(f"Line {line_no} [{p}]: {clean[:140]}")
    except Exception as e:
        print(f"Error reading {log_path}: {e}")

print(f"=== Scan Complete: Total matches found = {match_count} ===")
