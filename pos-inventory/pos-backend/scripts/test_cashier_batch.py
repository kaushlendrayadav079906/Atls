#!/usr/bin/env python3

import argparse
import asyncio
import os
import re
import time
import uuid
import logging
import json
from urllib.parse import urlparse
from dataclasses import dataclass
from datetime import datetime
from typing import List, Tuple, Optional

from fastapi import requests
import httpx


# ---------- Logging ----------
def setup_logging(debug: bool):
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-7s | %(message)s",
    )


logger = logging.getLogger("sap-test")

# ---------- Config ----------
MAX_RETRIES = 3
RETRY_DELAY = 2


@dataclass
class BatchRequest:
    name: str
    method: str
    url: str
    body: Optional[str] = None
    content_type: str = "application/json"


# ---------- Helpers ----------
def _env_or_arg(value: Optional[str], env_key: str) -> Optional[str]:
    return value if value else os.getenv(env_key)


def _normalize_base_url(raw_url: str) -> str:
    base = raw_url.rstrip("/")
    if base.endswith("/b1s/v1"):
        return base
    return f"{base}/b1s/v1"


# ---------- HTTP ----------
async def safe_request(client, method, url, **kwargs):
    for attempt in range(1, MAX_RETRIES + 1):
        start = time.perf_counter()
        try:
            logger.debug(f"HTTP {method} {url} | attempt={attempt}")

            response = await client.request(method, url, **kwargs)

            elapsed = (time.perf_counter() - start) * 1000
            logger.debug(f"RESPONSE {method} {url} | {response.status_code} | {elapsed:.1f} ms")

            if response.status_code >= 500:
                raise httpx.HTTPStatusError("Server error", request=None, response=response)

            return response

        except Exception as e:
            logger.warning(f"{method} {url} failed (attempt {attempt}): {e}")
            if attempt == MAX_RETRIES:
                raise
            await asyncio.sleep(RETRY_DELAY)


# ---------- Login ----------
async def login(client, company_db, username, password):
    logger.info("Logging in to SAP...")

    payload = {
        "CompanyDB": company_db,
        "UserName": username,
        "Password": password,
    }

    response = await safe_request(client, "POST", "/Login", json=payload)
    response.raise_for_status()

    logger.info("Login successful")
    return response.cookies


# ---------- QueryService ----------
def build_query_service_payload(year_start: str, year_end: str, top=100, skip=0):
    filter_str = f"Invoices/DocDate ge '{year_start}' and Invoices/DocDate le '{year_end}'"

    expand = (
        "$expand=Invoices($select=DocEntry,DocNum,DocDate,DocTotal,VatSum,TotalDiscount,U_P_Method,U_S_Employee)"
        ",Invoices/DocumentLines($select=ItemCode,ItemDescription,Quantity,LineTotal,WarehouseCode,LineNum,UnitPrice)"
    )

    query_option = f"{expand}&$filter={filter_str}&$top={top}&$skip={skip}"

    payload = {
        "QueryPath": "$crossjoin(Invoices,Invoices/DocumentLines)",
        "QueryOption": query_option,
    }

    return json.dumps(payload)


# ---------- Batch Builder ----------
def build_requests(year_start: str, year_end: str) -> List[BatchRequest]:
    filter_range = f"DocDate ge '{year_start}' and DocDate le '{year_end}'"
    item_filter = "Valid eq 'tYES' and Frozen eq 'tNO'"

    return [
        BatchRequest(
            "invoices",
            "GET",
            f"/Invoices?$filter={filter_range}&$orderby=DocDate desc, DocEntry desc&$top=100"
        ),

        BatchRequest(
            "query_crossjoin",
            "POST",
            "/QueryService_PostQuery",
            body=build_query_service_payload(year_start, year_end)
        ),

        BatchRequest(
            "items_1",
            "GET",
            f"/Items?$top=100&$skip=0&$filter={item_filter}"
        ),
        BatchRequest(
            "items_2",
            "GET",
            f"/Items?$top=100&$skip=100&$filter={item_filter}"
        ),
        BatchRequest(
            "items_3",
            "GET",
            f"/Items?$top=100&$skip=200&$filter={item_filter}"
        ),

        BatchRequest(
            "credit_notes",
            "GET",
            f"/CreditNotes?$filter={filter_range}&$orderby=DocEntry desc&$top=100"
        ),
    ]


# ---------- Batch Encoding ----------
def encode_batch(requests: List[BatchRequest], boundary: str, base_url: str) -> bytes:
    base_path = urlparse(base_url).path.rstrip("/") or "/b1s/v1"
    lines = []

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

        if req.body:
            lines.append(req.body)

        lines.append("")

    lines.append(f"--{boundary}--")
    return "\r\n".join(lines).encode("utf-8")


# ---------- Parse ----------
def parse_batch_status(text: str):
    matches = re.findall(r"HTTP/1\.1\s+(\d{3})\s+([^\r\n]+)", text)
    return [(int(c), m.strip()) for c, m in matches]


def extract_batch_json_parts(text: str):
    results = []
    brace_stack = 0
    start = None

    for i, ch in enumerate(text):
        if ch == "{":
            if brace_stack == 0:
                start = i
            brace_stack += 1

        elif ch == "}":
            brace_stack -= 1

            if brace_stack == 0 and start is not None:
                chunk = text[start:i+1]

                try:
                    data = json.loads(chunk)

                    # Only keep meaningful SAP responses
                    if isinstance(data, dict) and (
                        "value" in data or "error" in data
                    ):
                        results.append(data)

                except Exception:
                    pass

                start = None

    return results

# ---------- Runner ----------
async def run_batch(args):
    base_url = _normalize_base_url(_env_or_arg(args.base_url, "SAP_SERVICE_LAYER_URL"))

    async with httpx.AsyncClient(base_url=base_url, timeout=60.0, verify=not args.insecure) as client:

        cookies = await login(
            client,
            _env_or_arg(args.company_db, "SAP_COMPANY_DB"),
            _env_or_arg(args.username, "SAP_USERNAME"),
            _env_or_arg(args.password, "SAP_PASSWORD"),
        )

        # YEAR RANGE
        base_date = datetime.strptime(args.date, "%Y-%m-%d") if args.date else datetime.today()
        year_start = base_date.replace(month=1, day=1).strftime("%Y-%m-%d")
        year_end = base_date.replace(month=12, day=31).strftime("%Y-%m-%d")

        logger.info(f"Fetching data from {year_start} → {year_end}")

        requests = build_requests(year_start, year_end)

        boundary = f"batch_{uuid.uuid4().hex}"
        body = encode_batch(requests, boundary, base_url)

        response = await safe_request(
            client,
            "POST",
            "/$batch",
            content=body,
            headers={"Content-Type": f"multipart/mixed; boundary={boundary}"},
            cookies=cookies,
        )

        response.raise_for_status()

        statuses = parse_batch_status(response.text)
        data_parts = extract_batch_json_parts(response.text)

        if args.debug:
            logger.debug("RAW RESPONSE START ----------------")
            logger.debug(response.text[:2000])
            logger.debug("RAW RESPONSE END ----------------")

            logger.info("----- RESULTS -----")

        for req, (code, msg) in zip(requests, statuses):
            logger.info(f"{req.name:<20} | {code} | {msg}")

        
        output = {
            "meta": {
                "timestamp": datetime.now().isoformat(),
                "year_start": year_start,
                "year_end": year_end,
                "total_requests": len(requests),
            },
            "data": {}
        }

        logger.info("----- FORMATTED DATA -----")

        for i, req in enumerate(requests):
            logger.info(f"\n=== {req.name.upper()} ===")

            if i < len(data_parts):
                data = data_parts[i]

                output["data"][req.name] = data

                if "value" in data:
                    records = data["value"]
                    logger.info(f"Records: {len(records)}")

                    for row in records[:args.max_log_rows]:
                        logger.info(json.dumps(row, indent=2))

                    if len(records) > args.max_log_rows:
                        logger.info(f"... ({len(records)-args.max_log_rows} more rows)")
                else:
                    logger.info(json.dumps(data, indent=2))
            else:
                logger.warning("No data parsed for this request")
                output["data"][req.name] = None

        filename = args.output or f"sap_batch_{year_start}_{year_end}.json"
        save_to_json_file(output, filename)
        return 0

def save_to_json_file(data: dict, filename: str):
    try:
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Saved full response to {filename}")

    except Exception as e:
        logger.error(f"Failed to save JSON file: {e}")

# ---------- CLI ----------
def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("--base-url")
    parser.add_argument("--company-db")
    parser.add_argument("--username")
    parser.add_argument("--password")
    parser.add_argument("--date")
    parser.add_argument("--insecure", action="store_true")
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--max-log-rows", type=int, default=5)
    parser.add_argument("--output", help="Output JSON file path")

    args = parser.parse_args()

    setup_logging(args.debug)

    exit_code = asyncio.run(run_batch(args))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()