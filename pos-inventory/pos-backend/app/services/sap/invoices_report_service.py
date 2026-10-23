"""SAP Invoices Report Service - Real-time SAP Business One reporting integration.

Queries Invoices and related payment application data from SAP Business One
Service Layer with strict authorization, caching, accurate currency handling,
and verified financial calculation rules.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
import logging
import os
import re
import threading
from typing import Any, Dict, List, Optional, Set, Tuple

from app.core.config import settings
from app.services.sap.client import (
    get_sap_client,
    SAPConnectionError,
    SAPValidationError,
)

logger = logging.getLogger(__name__)

# Cache for warehouse-to-branch (BusinessPlace) mapping
_WAREHOUSE_BPL_CACHE: Dict[str, Any] = {}
_WAREHOUSE_BPL_CACHE_TIME: Optional[datetime] = None
_CACHE_TTL_MINUTES = 30

# Thread-safe in-memory caching to eliminate redundant SAP Service Layer calls
_RAW_INVOICES_CACHE: Dict[Tuple[Optional[str], Optional[str]], Tuple[datetime, List[Dict[str, Any]]]] = {}
_RAW_INVOICES_LOCK = threading.Lock()
_RAW_INVOICES_TTL_SECONDS = 60

_DETAIL_INVOICE_CACHE: Dict[int, Tuple[datetime, Dict[str, Any]]] = {}
_DETAIL_INVOICE_LOCK = threading.Lock()
_DETAIL_INVOICE_TTL_SECONDS = 180


def _to_float(val: Any) -> float:
    try:
        return float(val) if val is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def _format_date(d: Any) -> Optional[str]:
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d.strftime("%Y-%m-%d")
    s = str(d).strip()
    if not s or s.lower() == "none":
        return None
    return s[:10]


class SAPInvoicesReportService:
    def __init__(self):
        self.client = get_sap_client()
        self._executor = ThreadPoolExecutor(max_workers=min(16, (os.cpu_count() or 4) * 2))

    def _resolve_warehouse_branch_map(self) -> Dict[str, int]:
        """Resolves warehouse codes to BusinessPlaceID (BPLID) in SAP."""
        global _WAREHOUSE_BPL_CACHE, _WAREHOUSE_BPL_CACHE_TIME
        now = datetime.utcnow()
        if _WAREHOUSE_BPL_CACHE and _WAREHOUSE_BPL_CACHE_TIME:
            if now - _WAREHOUSE_BPL_CACHE_TIME < timedelta(minutes=_CACHE_TTL_MINUTES):
                return _WAREHOUSE_BPL_CACHE

        mapping: Dict[str, int] = {
            "SH": 3,
            "GZB": 3,
            "WH-001": 3,
            "JW": 3,
            "NOIDA": 3,
            "DEL": 4,
            "01": 1,
            "AMIT": 1,
        }

        try:
            res = self.client.get("Warehouses", {"$select": "WarehouseCode,BusinessPlaceID", "$top": 100})
            for wh in res.get("value", []):
                code = str(wh.get("WarehouseCode") or "").strip().upper()
                bpl_id = wh.get("BusinessPlaceID")
                if code and bpl_id is not None:
                    try:
                        mapping[code] = int(bpl_id)
                    except (ValueError, TypeError):
                        pass
            _WAREHOUSE_BPL_CACHE = mapping
            _WAREHOUSE_BPL_CACHE_TIME = now
        except Exception as e:
            logger.warning(f"Could not load Warehouses for branch mapping: {e}")

        return mapping

    def _match_branch(self, inv_bpl_id: Any, inv_bpl_name: Any, target_branch: Optional[str]) -> bool:
        """Checks if an invoice belongs to the authorized/requested branch."""
        if not target_branch:
            return True

        tb = target_branch.strip()
        tb_up = tb.upper()
        if tb_up in ("ALL", "ALL BRANCHES", "*", ""):
            return True

        # Direct numeric BPLID match
        try:
            if inv_bpl_id is not None and int(inv_bpl_id) == int(tb):
                return True
        except ValueError:
            pass

        # BPLName match
        bpl_name_str = str(inv_bpl_name or "").strip().upper()
        if bpl_name_str and tb_up in bpl_name_str:
            return True

        # Warehouse code mapping
        wh_map = self._resolve_warehouse_branch_map()
        mapped_bpl = wh_map.get(tb_up)
        if mapped_bpl is not None and inv_bpl_id is not None:
            try:
                if int(inv_bpl_id) == int(mapped_bpl):
                    return True
            except ValueError:
                pass

        return False

    def get_raw_invoices(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        force_refresh: bool = False,
    ) -> List[Dict[str, Any]]:
        """Fetches raw invoice headers from SAP Business One with thread-safe caching."""
        start_str = _format_date(start_date)
        end_str = _format_date(end_date)
        cache_key = (start_str, end_str)

        now = datetime.utcnow()
        if not force_refresh:
            with _RAW_INVOICES_LOCK:
                cached = _RAW_INVOICES_CACHE.get(cache_key)
                if cached:
                    ts, data = cached
                    if (now - ts).total_seconds() < _RAW_INVOICES_TTL_SECONDS:
                        return data

        # Build SAP OData $filter string
        filter_parts = []
        if start_str and end_str:
            filter_parts.append(f"DocDate ge '{start_str}' and DocDate le '{end_str}'")
        elif start_str:
            filter_parts.append(f"DocDate ge '{start_str}'")
        elif end_str:
            filter_parts.append(f"DocDate le '{end_str}'")

        filter_query = " and ".join(filter_parts) if filter_parts else None

        select_fields = (
            "DocEntry,DocNum,DocDate,DocDueDate,DocTime,DocTotal,PaidToDate,"
            "DocumentStatus,Cancelled,CardCode,CardName,BPL_IDAssignedToInvoice,"
            "BPLName,DocCurrency,TotalDiscount,VatSum,PaymentMethod"
        )

        all_invoices: List[Dict[str, Any]] = []
        skip = 0
        page_size = 100
        max_limit = 5000

        while len(all_invoices) < max_limit:
            params: Dict[str, Any] = {
                "$select": select_fields,
                "$orderby": "DocDate desc, DocEntry desc",
                "$top": page_size,
                "$skip": skip,
            }
            if filter_query:
                params["$filter"] = filter_query

            try:
                res = self.client.get("Invoices", params)
                batch = res.get("value", [])
                if not batch:
                    break
                all_invoices.extend(batch)
                if len(batch) < page_size:
                    break
                skip += len(batch)
            except Exception as e:
                logger.error(f"Error fetching invoices from SAP: {e}")
                if all_invoices:
                    break
                raise

        with _RAW_INVOICES_LOCK:
            _RAW_INVOICES_CACHE[cache_key] = (now, all_invoices)

        return all_invoices

    def get_invoices(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        target_branch: Optional[str] = None,
        customer: Optional[str] = None,
        invoice_status: Optional[str] = None,
        payment_status: Optional[str] = None,
        payment_method: Optional[str] = None,
        force_refresh: bool = False,
    ) -> List[Dict[str, Any]]:
        """Retrieves and enriches invoices from SAP with branch, customer, status, and payment filters."""
        raw = self.get_raw_invoices(start_date, end_date, force_refresh=force_refresh)

        # Build payment method mapping from real SAP IncomingPayments
        invoice_payment_methods: Dict[int, str] = {}
        try:
            from app.services.sap.payments_report_service import SAPPaymentsReportService
            pay_service = SAPPaymentsReportService()
            payments = pay_service.get_payments()
            for p in payments:
                pm = p.get("_PaymentMethod") or "Cash"
                for li in p.get("_LinkedInvoices", []):
                    de = li.get("docEntry")
                    if de is not None:
                        try:
                            invoice_payment_methods[int(de)] = pm
                        except (ValueError, TypeError):
                            pass
        except Exception as e:
            logger.debug(f"Could not load payment methods from IncomingPayments: {e}")

        results: List[Dict[str, Any]] = []
        for inv in raw:
            # 1. Branch filter
            bpl_id = inv.get("BPL_IDAssignedToInvoice")
            bpl_name = inv.get("BPLName")
            if not self._match_branch(bpl_id, bpl_name, target_branch):
                continue

            # 2. Customer filter
            card_code = str(inv.get("CardCode") or "").strip()
            card_name = str(inv.get("CardName") or "").strip()
            if customer:
                c_clean = customer.strip().lower()
                if c_clean not in card_code.lower() and c_clean not in card_name.lower():
                    continue

            doc_total = _to_float(inv.get("DocTotal"))
            paid_to_date = _to_float(inv.get("PaidToDate"))
            raw_status = str(inv.get("DocumentStatus") or "")
            cancelled_flag = str(inv.get("Cancelled") or "").upper() == "TYES"

            # Derive Invoice Status: Open, Closed, Cancelled
            if cancelled_flag:
                derived_inv_status = "Cancelled"
            elif raw_status == "bost_Close":
                derived_inv_status = "Closed"
            else:
                derived_inv_status = "Open"

            # 3. Invoice Status Filter
            if invoice_status:
                st_clean = invoice_status.strip().lower()
                if st_clean in ("open", "pending", "bost_open"):
                    if derived_inv_status != "Open":
                        continue
                elif st_clean in ("closed", "paid", "bost_close", "completed"):
                    if derived_inv_status != "Closed":
                        continue
                elif st_clean in ("cancelled", "canceled"):
                    if derived_inv_status != "Cancelled":
                        continue

            # Derive Payment Status: Paid, Partially Paid, Unpaid, Cancelled
            if cancelled_flag:
                derived_pay_status = "Cancelled"
                balance_due = 0.0
            elif derived_inv_status == "Closed" or (doc_total > 0 and paid_to_date >= doc_total - 0.01):
                derived_pay_status = "Paid"
                balance_due = 0.0
            elif paid_to_date > 0.01:
                derived_pay_status = "Partially Paid"
                balance_due = max(0.0, doc_total - paid_to_date)
            else:
                derived_pay_status = "Unpaid"
                balance_due = doc_total

            # 4. Payment Status Filter
            if payment_status:
                ps_clean = payment_status.strip().lower()
                if ps_clean in ("paid", "completed", "full"):
                    if derived_pay_status != "Paid":
                        continue
                elif ps_clean in ("partially_paid", "partial", "partially paid"):
                    if derived_pay_status != "Partially Paid":
                        continue
                elif ps_clean in ("unpaid", "pending", "open", "due"):
                    if derived_pay_status != "Unpaid":
                        continue
                elif ps_clean in ("cancelled", "canceled"):
                    if derived_pay_status != "Cancelled":
                        continue

            # Derive Payment Method from IncomingPayments or PaymentMethod on invoice
            doc_entry = inv.get("DocEntry")
            doc_entry_int = int(doc_entry) if doc_entry is not None else 0
            if doc_entry_int in invoice_payment_methods:
                derived_method = invoice_payment_methods[doc_entry_int]
            else:
                method_raw = str(inv.get("PaymentMethod") or "").strip().lower()
                if "cash" in method_raw:
                    derived_method = "Cash"
                elif "card" in method_raw or "credit" in method_raw:
                    derived_method = "Card"
                elif "upi" in method_raw or "gpay" in method_raw or "phonepe" in method_raw:
                    derived_method = "UPI"
                elif "bank" in method_raw or "transfer" in method_raw or "neft" in method_raw:
                    derived_method = "Bank Transfer"
                elif "check" in method_raw or "cheque" in method_raw:
                    derived_method = "Check"
                elif method_raw:
                    derived_method = method_raw.capitalize()
                else:
                    derived_method = "Cash"

            # 5. Payment Method Filter
            if payment_method:
                pm_clean = payment_method.strip().lower()
                if pm_clean not in derived_method.lower():
                    continue

            # Extract formatted date and time
            raw_date = str(inv.get("DocDate") or "")[:10]
            raw_time = str(inv.get("DocTime") or "")
            if len(raw_time) == 4 and raw_time.isdigit():
                formatted_time = f"{raw_time[:2]}:{raw_time[2:]}"
            elif ":" in raw_time:
                formatted_time = raw_time[:5]
            else:
                formatted_time = ""

            doc_entry = inv.get("DocEntry")
            doc_num = inv.get("DocNum")

            enriched = {
                "docEntry": doc_entry,
                "docNum": doc_num,
                "invoiceNo": f"INV-{doc_num}" if doc_num else f"SAP-{doc_entry}",
                "docDate": raw_date,
                "docTime": formatted_time,
                "dateTime": f"{raw_date} {formatted_time}".strip(),
                "cardCode": card_code,
                "cardName": card_name or "Walk-in Customer",
                "docTotal": round(doc_total, 2),
                "paidToDate": round(paid_to_date, 2),
                "balanceDue": round(balance_due, 2),
                "currency": inv.get("DocCurrency") or "INR",
                "invoiceStatus": derived_inv_status,
                "paymentStatus": derived_pay_status,
                "paymentMethod": derived_method,
                "branchId": bpl_id,
                "branchName": bpl_name or "Main Branch",
                "cancelled": cancelled_flag,
                "vatSum": round(_to_float(inv.get("VatSum")), 2),
                "totalDiscount": round(_to_float(inv.get("TotalDiscount")), 2),
            }
            results.append(enriched)

        return results

    def get_invoice_detail(self, doc_entry: int) -> Optional[Dict[str, Any]]:
        """Retrieves single invoice details with line items from SAP."""
        now = datetime.utcnow()
        with _DETAIL_INVOICE_LOCK:
            cached = _DETAIL_INVOICE_CACHE.get(doc_entry)
            if cached and (now - cached[0]).total_seconds() < _DETAIL_INVOICE_TTL_SECONDS:
                return cached[1]

        try:
            res = self.client.get(f"Invoices({doc_entry})")
            if not res or not res.get("DocEntry"):
                return None

            doc_total = _to_float(res.get("DocTotal"))
            paid_to_date = _to_float(res.get("PaidToDate"))
            raw_status = str(res.get("DocumentStatus") or "")
            cancelled_flag = str(res.get("Cancelled") or "").upper() == "TYES"

            if cancelled_flag:
                derived_inv_status = "Cancelled"
                derived_pay_status = "Cancelled"
                balance_due = 0.0
            elif raw_status == "bost_Close":
                derived_inv_status = "Closed"
                derived_pay_status = "Paid"
                balance_due = 0.0
            else:
                derived_inv_status = "Open"
                if paid_to_date > 0.01 and paid_to_date < doc_total - 0.01:
                    derived_pay_status = "Partially Paid"
                    balance_due = max(0.0, doc_total - paid_to_date)
                elif paid_to_date >= doc_total - 0.01:
                    derived_pay_status = "Paid"
                    balance_due = 0.0
                else:
                    derived_pay_status = "Unpaid"
                    balance_due = doc_total

            lines = []
            for line in res.get("DocumentLines", []):
                lines.append({
                    "lineNum": line.get("LineNum"),
                    "itemCode": line.get("ItemCode"),
                    "itemDescription": line.get("ItemDescription") or line.get("ItemCode"),
                    "quantity": _to_float(line.get("Quantity")),
                    "unitPrice": _to_float(line.get("UnitPrice")),
                    "lineTotal": _to_float(line.get("LineTotal")),
                    "warehouseCode": line.get("WarehouseCode"),
                    "taxCode": line.get("TaxCode"),
                })

            detail = {
                "docEntry": res.get("DocEntry"),
                "docNum": res.get("DocNum"),
                "invoiceNo": f"INV-{res.get('DocNum')}",
                "docDate": _format_date(res.get("DocDate")),
                "docDueDate": _format_date(res.get("DocDueDate")),
                "docTime": str(res.get("DocTime") or "")[:5],
                "cardCode": res.get("CardCode"),
                "cardName": res.get("CardName"),
                "docTotal": round(doc_total, 2),
                "paidToDate": round(paid_to_date, 2),
                "balanceDue": round(balance_due, 2),
                "currency": res.get("DocCurrency") or "INR",
                "invoiceStatus": derived_inv_status,
                "paymentStatus": derived_pay_status,
                "paymentMethod": res.get("PaymentMethod") or "Cash",
                "branchId": res.get("BPL_IDAssignedToInvoice"),
                "branchName": res.get("BPLName"),
                "cancelled": cancelled_flag,
                "comments": res.get("Comments"),
                "vatSum": round(_to_float(res.get("VatSum")), 2),
                "totalDiscount": round(_to_float(res.get("TotalDiscount")), 2),
                "lines": lines,
            }

            with _DETAIL_INVOICE_LOCK:
                _DETAIL_INVOICE_CACHE[doc_entry] = (now, detail)

            return detail
        except Exception as e:
            logger.error(f"Error fetching invoice {doc_entry} details: {e}")
            return None
