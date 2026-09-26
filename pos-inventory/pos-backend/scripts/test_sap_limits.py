#!/usr/bin/env python3

import time
import sys
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Optional

import httpx

# ── credentials ──────────────────────────────────────────────────────────────
BASE_URL   = "http://116.72.105.127:50001/b1s/v1"
COMPANY_DB = "KLPL_LIVE_DB"
USERNAME   = "manager"
PASSWORD   = "KLPL@1987"
TIMEOUT    = 30.0
# ─────────────────────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):   print(f"  {GREEN}✓{RESET} {msg}")
def warn(msg): print(f"  {YELLOW}⚠{RESET} {msg}")
def err(msg):  print(f"  {RED}✗{RESET} {msg}")
def info(msg): print(f"  {CYAN}→{RESET} {msg}")
def hdr(msg):  print(f"\n{BOLD}{CYAN}{'─'*60}{RESET}\n{BOLD}{msg}{RESET}")

# ── auth ──────────────────────────────────────────────────────────────────────

def login():
    client = httpx.Client(timeout=TIMEOUT, verify=False)
    resp = client.post(f"{BASE_URL}/Login", json={
        "CompanyDB": COMPANY_DB,
        "UserName": USERNAME,
        "Password": PASSWORD,
    })
    resp.raise_for_status()

    session = resp.cookies.get("B1SESSION")
    if not session:
        raise RuntimeError("No B1SESSION cookie")

    ok(f"Login OK (session={session[:8]}…)")
    return client, session

def get_headers(prefer_pagesize: Optional[int] = None):
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if prefer_pagesize:
        h["Prefer"] = f"odata.maxpagesize={prefer_pagesize}"
    return h

def sap_get(client, session, endpoint, params=None, prefer=None):
    resp = client.get(
        f"{BASE_URL}/{endpoint}",
        headers=get_headers(prefer),
        cookies={"B1SESSION": session},
        params=params or {},
    )
    return resp

# ── metadata ──────────────────────────────────────────────────────────────────

def fetch_metadata(client, session):
    hdr("[Metadata] Fetching")
    resp = sap_get(client, session, "$metadata")

    if resp.status_code != 200:
        err(f"Metadata failed: {resp.status_code}")
        return None
    print(resp.text)
    ok("Metadata loaded")
    return resp.text

def has_navigation_property(metadata: str, entity: str, prop: str) -> bool:
    pattern = rf'<EntityType Name="{entity}".*?</EntityType>'
    match = re.search(pattern, metadata, re.DOTALL)

    if not match:
        warn(f"Entity '{entity}' not found")
        return False

    return f'Name="{prop}"' in match.group(0)

# ── DocumentLines handling ────────────────────────────────────────────────────

def fetch_invoice_with_lines(client, session, metadata):
    hdr("[Invoices] DocumentLines strategy")

    can_expand = False

    if metadata:
        can_expand = has_navigation_property(metadata, "Document", "DocumentLines")

    if can_expand:
        ok("Using $expand=DocumentLines")

        resp = sap_get(client, session, "Invoices", {
            "$top": 1,
            "$expand": "DocumentLines"
        })

        if resp.status_code == 200:
            data = resp.json().get("value", [])
            if data:
                lines = len(data[0].get("DocumentLines", []))
                ok(f"Expand success → {lines} lines")
        else:
            err(f"Expand failed → fallback triggered")
            fallback_invoice_fetch(client, session)

    else:
        warn("Expand not supported → using fallback")
        fallback_invoice_fetch(client, session)

def fallback_invoice_fetch(client, session):
    resp = sap_get(client, session, "Invoices", {"$top": 1})
    data = resp.json().get("value", [])

    if not data:
        warn("No invoices found")
        return

    de = data[0]["DocEntry"]

    resp = sap_get(client, session, f"Invoices({de})")
    lines = len(resp.json().get("DocumentLines", []))

    ok(f"Invoice({de}) → {lines} lines")

# ── concurrency test ──────────────────────────────────────────────────────────

def check_concurrency(client, session):
    hdr("[Concurrency Test]")

    resp = sap_get(client, session, "Invoices", {
        "$select": "DocEntry",
        "$top": 20
    })

    entries = [str(r["DocEntry"]) for r in resp.json().get("value", [])]

    def fetch(de):
        r = sap_get(client, session, f"Invoices({de})")
        return r.status_code

    for workers in (1, 3, 5, 8):
        ok_count = 0

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(fetch, de) for de in entries[:workers*2]]

            for f in as_completed(futures):
                if f.result() == 200:
                    ok_count += 1

        print(f"  workers={workers} → {ok_count} success")

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"\n{BOLD}SAP Service Layer Smart Probe{RESET}")

    try:
        client, session = login()
    except Exception as e:
        err(f"Login failed: {e}")
        sys.exit(1)

    try:
        metadata = fetch_metadata(client, session)
        fetch_invoice_with_lines(client, session, metadata)
        check_concurrency(client, session)

    finally:
        try:
            client.post(f"{BASE_URL}/Logout", cookies={"B1SESSION": session})
            ok("Logged out")
        except:
            pass

        client.close()

    print(f"\n{BOLD}Done{RESET}\n")

if __name__ == "__main__":
    main()