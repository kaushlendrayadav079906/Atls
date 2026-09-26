#!/usr/bin/env python3

"""Benchmark dashboard-relevant SAP calls and optional crossjoin line fetch."""

import argparse
import time
from datetime import date, timedelta
from typing import Any, Dict, List, Tuple

from app.api.v1.dashboard import _fetch_credit_notes_for_day
from app.core.config import settings
from app.services.sap.client import get_sap_client
from app.services.sap.invoices_service import SAPInvoicesService
from app.services.sap.items_service import SAPItemsService


def _get_date_range(range_str: str) -> Tuple[date, date]:
    today = date.today()
    if range_str == "daily":
        return today, today
    if range_str == "weekly":
        return today - timedelta(days=6), today
    if range_str == "monthly":
        return today.replace(day=1), today
    if range_str == "yearly":
        return today.replace(month=1, day=1), today
    return date(2000, 1, 1), today


def _timed(label: str, fn):
    start = time.perf_counter()
    result = fn()
    elapsed = time.perf_counter() - start
    return label, elapsed, result


def _query_crossjoin_lines(
    start_date: date,
    end_date: date,
    top: int,
) -> List[Dict[str, Any]]:
    client = get_sap_client()
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    query_path = "$crossjoin(Invoices,Invoices/DocumentLines)"
    query_option = (
        "$expand=Invoices($select=DocEntry,DocNum,DocDate,DocTotal,VatSum,TotalDiscount,U_P_Method,U_S_Employee)"
        ",Invoices/DocumentLines($select=ItemCode,ItemDescription,Quantity,LineTotal,WarehouseCode)"
        "&$filter="
        "Invoices/DocEntry eq Invoices/DocumentLines/DocEntry"
        f" and Invoices/DocDate ge '{start_str}'"
        f" and Invoices/DocDate le '{end_str}'"
        f"&$top={top}"
    )

    payload = {
        "QueryPath": query_path,
        "QueryOption": query_option,
    }

    response = client.post("QueryService_PostQuery", payload)
    return response.get("value", [])


def _summarize(label: str, elapsed: float, result: Any) -> None:
    if isinstance(result, list):
        count = len(result)
    elif isinstance(result, dict) and "value" in result and isinstance(result["value"], list):
        count = len(result["value"])
    else:
        count = None

    if count is None:
        print(f"{label}: {elapsed:.2f}s")
    else:
        print(f"{label}: {elapsed:.2f}s ({count} rows)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark dashboard SAP calls")
    parser.add_argument("--range", default="daily", choices=["daily", "weekly", "monthly", "yearly", "all_time"])
    parser.add_argument("--items-top", type=int, default=300, help="Max items for stock sections")
    parser.add_argument("--crossjoin-top", type=int, default=2000, help="Max rows for QueryService crossjoin")
    parser.add_argument("--skip-crossjoin", action="store_true", help="Skip QueryService crossjoin test")
    args = parser.parse_args()

    start_date, end_date = _get_date_range(args.range)

    invoice_service = SAPInvoicesService()
    items_service = SAPItemsService()

    print("Dashboard benchmark")
    print(f"Range: {args.range} ({start_date.isoformat()} to {end_date.isoformat()})")
    print(f"SAP default warehouse: {settings.SAP_DEFAULT_WAREHOUSE}")

    label, elapsed, invoices = _timed(
        "Invoices by date (headers)",
        lambda: invoice_service.get_invoices_by_date(start_date, end_date),
    )
    _summarize(label, elapsed, invoices)

    label, elapsed, recent = _timed(
        "Recent invoices (headers)",
        lambda: invoice_service.get_recent_invoices(limit=25),
    )
    _summarize(label, elapsed, recent)

    if args.range == "daily":
        label, elapsed, items = _timed(
            "Items for stock sections",
            lambda: items_service.get_items(top=args.items_top),
        )
        _summarize(label, elapsed, items)

        label, elapsed, credit_notes = _timed(
            "Credit notes for day",
            lambda: _fetch_credit_notes_for_day("vasai"),
        )
        _summarize(label, elapsed, credit_notes)

    if not args.skip_crossjoin:
        label, elapsed, rows = _timed(
            "QueryService crossjoin lines",
            lambda: _query_crossjoin_lines(start_date, end_date, args.crossjoin_top),
        )
        _summarize(label, elapsed, rows)


if __name__ == "__main__":
    main()
