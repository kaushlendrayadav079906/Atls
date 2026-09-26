#!/usr/bin/env python3
"""Compare SAP $batch vs sequential dashboard-style requests."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import time
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx


@dataclass
class RequestSpec:
    name: str
    method: str
    url: str
    json_body: Optional[Dict[str, Any]] = None
    content_type: str = "application/json"


def _env_or_arg(value: Optional[str], env_key: str) -> Optional[str]:
    return value if value else os.getenv(env_key)


def _env_bool(env_key: str, default: bool) -> bool:
    raw = os.getenv(env_key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _normalize_base_url(raw_url: str) -> str:
    base = raw_url.rstrip("/")
    if base.endswith("/b1s/v1"):
        return base
    return f"{base}/b1s/v1"


def _build_query_service_payload(
    start_date: str,
    end_date: str,
    top: int,
    skip: int,
) -> Dict[str, Any]:
    filter_str = (
        "Invoices/DocEntry eq Invoices/DocumentLines/DocEntry"
        f" and Invoices/DocDate ge '{start_date}'"
        f" and Invoices/DocDate le '{end_date}'"
    )

    expand = (
        "$expand=Invoices($select=DocEntry,DocNum,DocDate,DocTotal,VatSum,TotalDiscount,U_P_Method,U_S_Employee)"
        ",Invoices/DocumentLines($select=ItemCode,ItemDescription,Quantity,LineTotal,WarehouseCode,LineNum,UnitPrice)"
    )

    query_option = f"{expand}&$filter={filter_str}&$top={top}&$skip={skip}"

    return {
        "QueryPath": "$crossjoin(Invoices,Invoices/DocumentLines)",
        "QueryOption": query_option,
    }


def _build_requests(
    start_date: str,
    end_date: str,
    line_pages: int,
    line_page_size: int,
    items_pages: int,
) -> List[RequestSpec]:
    filter_range = f"DocDate ge '{start_date}' and DocDate le '{end_date}'"
    header_select = (
        "DocEntry,DocNum,DocDate,DocTotal,VatSum,TotalDiscount,CardCode,CardName,"
        "U_C_Name,U_W_Number,U_P_Method,U_S_Employee"
    )
    item_filter = "Valid eq 'tYES' and Frozen eq 'tNO'"
    item_select = "ItemCode,ItemName,QuantityOnStock,ItemWarehouseInfoCollection"

    requests: List[RequestSpec] = [
        RequestSpec(
            "invoices.headers",
            "GET",
            f"/Invoices?$filter={filter_range}&$orderby=DocDate desc, DocEntry desc"
            f"&$select={header_select}&$top=100",
        ),
    ]

    for page in range(line_pages):
        requests.append(
            RequestSpec(
                f"invoices.lines.p{page + 1}",
                "POST",
                "/QueryService_PostQuery",
                json_body=_build_query_service_payload(
                    start_date,
                    end_date,
                    top=line_page_size,
                    skip=page * line_page_size,
                ),
            )
        )

    for page in range(items_pages):
        skip = page * 100
        requests.append(
            RequestSpec(
                f"items.p{page + 1}",
                "GET",
                f"/Items?$top=100&$skip={skip}&$filter={item_filter}&$select={item_select}",
            )
        )

    requests.append(
        RequestSpec(
            "credit_notes",
            "GET",
            f"/CreditNotes?$filter={filter_range}&$orderby=DocEntry desc&$top=100",
        )
    )

    return requests


def _encode_batch(requests: List[RequestSpec], boundary: str, base_url: str) -> bytes:
    base_path = urlparse(base_url).path.rstrip("/") or "/b1s/v1"
    lines: List[str] = []

    for req in requests:
        lines.append(f"--{boundary}")
        lines.append("Content-Type: application/http")
        lines.append("Content-Transfer-Encoding: binary")
        lines.append("")
        lines.append(f"{req.method} {base_path}{req.url} HTTP/1.1")
        lines.append("Accept: application/json")

        if req.method in ("POST", "PUT", "PATCH"):
            lines.append(f"Content-Type: {req.content_type}")

        lines.append("")

        if req.json_body is not None:
            lines.append(json.dumps(req.json_body))

        lines.append("")

    lines.append(f"--{boundary}--")
    lines.append("")
    return "\r\n".join(lines).encode("utf-8")


def _parse_batch_statuses(text: str) -> List[Tuple[int, str]]:
    matches = re.findall(r"HTTP/1\.1\s+(\d{3})\s+([^\r\n]+)", text)
    return [(int(code), msg.strip()) for code, msg in matches]


async def _login(
    client: httpx.AsyncClient,
    company_db: str,
    username: str,
    password: str,
) -> httpx.Cookies:
    payload = {"CompanyDB": company_db, "UserName": username, "Password": password}
    response = await client.post("/Login", json=payload)
    response.raise_for_status()
    return response.cookies


async def _run_sequential(
    client: httpx.AsyncClient,
    requests: List[RequestSpec],
    cookies: httpx.Cookies,
) -> Tuple[float, List[Tuple[str, int, float]]]:
    results: List[Tuple[str, int, float]] = []
    start_total = time.perf_counter()

    for req in requests:
        start = time.perf_counter()
        response = await client.request(
            req.method,
            req.url,
            json=req.json_body,
            cookies=cookies,
            headers={"Prefer": "odata.maxpagesize=100"},
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        results.append((req.name, response.status_code, elapsed_ms))

    total_ms = (time.perf_counter() - start_total) * 1000
    return total_ms, results


async def _run_batch(
    client: httpx.AsyncClient,
    requests: List[RequestSpec],
    cookies: httpx.Cookies,
    base_url: str,
) -> Tuple[float, List[Tuple[str, int, str]]]:
    boundary = f"batch_{uuid.uuid4().hex}"
    body = _encode_batch(requests, boundary, base_url)

    start = time.perf_counter()
    response = await client.post(
        "/$batch",
        content=body,
        headers={"Content-Type": f"multipart/mixed; boundary={boundary}"},
        cookies=cookies,
    )
    total_ms = (time.perf_counter() - start) * 1000

    response.raise_for_status()

    statuses = _parse_batch_statuses(response.text)
    details = []
    for req, (code, msg) in zip(requests, statuses):
        details.append((req.name, code, msg))

    return total_ms, details


async def run_compare(args: argparse.Namespace) -> int:
    sap_url = _env_or_arg(args.base_url, "SAP_SERVICE_LAYER_URL")
    if not sap_url:
        print("Missing SAP_SERVICE_LAYER_URL or --base-url.")
        return 2

    base_url = _normalize_base_url(sap_url)
    company_db = _env_or_arg(args.company_db, "SAP_COMPANY_DB")
    username = _env_or_arg(args.username, "SAP_USERNAME")
    password = _env_or_arg(args.password, "SAP_PASSWORD")

    if not company_db or not username or not password:
        print("Missing SAP credentials. Provide SAP_COMPANY_DB, SAP_USERNAME, SAP_PASSWORD.")
        return 2

    verify_ssl = _env_bool("SAP_SSL_VERIFY", True)
    if args.insecure:
        verify_ssl = False

    start_date = args.date or date.today().isoformat()
    end_date = args.date or start_date

    requests = _build_requests(
        start_date,
        end_date,
        line_pages=args.line_pages,
        line_page_size=args.line_page_size,
        items_pages=args.items_pages,
    )

    timeout = httpx.Timeout(args.timeout)
    async with httpx.AsyncClient(base_url=base_url, timeout=timeout, verify=verify_ssl) as client:
        cookies = await _login(client, company_db, username, password)

        seq_total_ms, seq_results = await _run_sequential(client, requests, cookies)
        batch_total_ms, batch_results = await _run_batch(client, requests, cookies, base_url)

    print("\nSequential request timings")
    print("=" * 72)
    for name, code, ms in seq_results:
        print(f"{name:24} {code:4}  {ms:8.1f} ms")
    print(f"Total: {seq_total_ms:.1f} ms")

    print("\nBatch request results")
    print("=" * 72)
    for name, code, msg in batch_results:
        status = "OK" if code < 400 else "FAIL"
        print(f"{name:24} {status:4}  {code:4}  {msg}")
    print(f"Total: {batch_total_ms:.1f} ms")

    delta = batch_total_ms - seq_total_ms
    print("\nSummary")
    print("=" * 72)
    print(f"Sequential: {seq_total_ms:.1f} ms")
    print(f"Batch:      {batch_total_ms:.1f} ms")
    print(f"Delta:      {delta:.1f} ms (batch - sequential)")

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Compare SAP $batch vs sequential dashboard requests")
    parser.add_argument("--base-url", help="SAP Service Layer base URL (e.g., https://host:50000/b1s/v1)")
    parser.add_argument("--company-db", help="SAP company DB (or SAP_COMPANY_DB env var)")
    parser.add_argument("--username", help="SAP username (or SAP_USERNAME env var)")
    parser.add_argument("--password", help="SAP password (or SAP_PASSWORD env var)")
    parser.add_argument("--date", help="DocDate filter (YYYY-MM-DD), defaults to today")
    parser.add_argument("--timeout", type=float, default=60.0, help="Request timeout in seconds")
    parser.add_argument("--insecure", action="store_true", help="Disable TLS verification")
    parser.add_argument("--line-pages", type=int, default=2, help="Number of QueryService pages to request")
    parser.add_argument("--line-page-size", type=int, default=1000, help="Lines page size for QueryService")
    parser.add_argument("--items-pages", type=int, default=3, help="Number of Items pages to request")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    exit_code = asyncio.run(run_compare(args))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
