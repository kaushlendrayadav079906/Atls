"""SAP Payments Report Service - Real-time SAP Business One reporting integration.

Queries IncomingPayments, Invoices, CreditNotes, and VendorPayments from SAP Business One
Service Layer with strict authorization, batch enrichment, accurate currency handling,
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
_RAW_PAYMENTS_CACHE: Dict[Tuple[Optional[str], Optional[str]], Tuple[datetime, List[Dict[str, Any]]]] = {}
_RAW_PAYMENTS_LOCK = threading.Lock()
_RAW_PAYMENTS_TTL_SECONDS = 60

_INVOICE_CACHE: Dict[int, Tuple[datetime, Dict[str, Any]]] = {}
_INVOICE_CACHE_LOCK = threading.Lock()
_INVOICE_TTL_SECONDS = 300

_OPEN_INVOICES_CACHE: Dict[Tuple[Optional[str], Optional[str]], Tuple[datetime, List[Dict[str, Any]]]] = {}
_OPEN_INVOICES_LOCK = threading.Lock()
_OPEN_INVOICES_TTL_SECONDS = 60

_CREDIT_NOTES_CACHE: Dict[Tuple[Optional[str], Optional[str]], Tuple[datetime, List[Dict[str, Any]]]] = {}
_CREDIT_NOTES_LOCK = threading.Lock()
_CREDIT_NOTES_TTL_SECONDS = 60


def clear_payments_report_cache() -> None:
    """Clear all in-memory caches in this module (useful for test isolation)."""
    with _RAW_PAYMENTS_LOCK:
        _RAW_PAYMENTS_CACHE.clear()
    with _INVOICE_CACHE_LOCK:
        _INVOICE_CACHE.clear()
    with _OPEN_INVOICES_LOCK:
        _OPEN_INVOICES_CACHE.clear()
    with _CREDIT_NOTES_LOCK:
        _CREDIT_NOTES_CACHE.clear()


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
    # If full ISO string like "2026-07-04T00:00:00Z", extract YYYY-MM-DD
    return s[:10]


class SAPPaymentsReportService:
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

    def _match_branch(self, payment_bpl_id: Any, payment_bpl_name: Any, target_branch: Optional[str]) -> bool:
        """Checks if a payment belongs to the authorized/requested branch."""
        if not target_branch:
            return True

        tb = target_branch.strip()
        tb_up = tb.upper()
        if tb_up in ("ALL", "ALL BRANCHES", "*", ""):
            return True

        # Check direct numeric BPLID match
        try:
            if payment_bpl_id is not None and int(payment_bpl_id) == int(tb):
                return True
        except ValueError:
            pass

        # Check BPLName match
        bpl_name_str = str(payment_bpl_name or "").strip().upper()
        if bpl_name_str and tb_up in bpl_name_str:
            return True

        # Check warehouse mapping
        wh_map = self._resolve_warehouse_branch_map()
        mapped_bpl = wh_map.get(tb_up)
        if mapped_bpl is not None and payment_bpl_id is not None:
            try:
                if int(payment_bpl_id) == int(mapped_bpl):
                    return True
            except ValueError:
                pass

        return False

    def _get_invoices_batch(self, doc_entries: List[int]) -> Dict[int, Dict[str, Any]]:
        """Batch-fetches invoices by DocEntry from SAP Service Layer with caching."""
        if not doc_entries:
            return {}

        now = datetime.utcnow()
        unique_entries = sorted(set(doc_entries))
        invoices_map: Dict[int, Dict[str, Any]] = {}
        missing_entries: List[int] = []

        with _INVOICE_CACHE_LOCK:
            for d in unique_entries:
                cached = _INVOICE_CACHE.get(d)
                if cached and (now - cached[0]).total_seconds() < _INVOICE_TTL_SECONDS:
                    invoices_map[d] = cached[1]
                else:
                    missing_entries.append(d)

        if missing_entries:
            chunk_size = 30
            for i in range(0, len(missing_entries), chunk_size):
                chunk = missing_entries[i : i + chunk_size]
                filter_clauses = [f"DocEntry eq {d}" for d in chunk]
                filter_str = " or ".join(filter_clauses)
                try:
                    res = self.client.get(
                        "Invoices",
                        {
                            "$filter": filter_str,
                            "$select": "DocEntry,DocNum,DocDate,DocTotal,PaidToDate,DocumentStatus,DocCurrency,CardCode,CardName,BPL_IDAssignedToInvoice,BPLName",
                        },
                    )
                    with _INVOICE_CACHE_LOCK:
                        for inv in res.get("value", []):
                            entry = inv.get("DocEntry")
                            if entry is not None:
                                invoices_map[entry] = inv
                                _INVOICE_CACHE[entry] = (now, inv)
                except Exception as e:
                    logger.error(f"Failed to fetch invoices chunk {chunk}: {e}")

        return invoices_map

    def get_payments(
        self,
        start_date: Optional[Any] = None,
        end_date: Optional[Any] = None,
        branch: Optional[str] = None,
        customer: Optional[str] = None,
        payment_method: Optional[str] = None,
        payment_status: Optional[str] = None,
        include_invoices: bool = True,
    ) -> List[Dict[str, Any]]:
        """Fetches and enriches Incoming Payments from SAP Business One with caching.

        Returns fully typed, calculated payment objects with linked invoice details.
        """
        start_str = _format_date(start_date)
        end_str = _format_date(end_date)
        cache_key = (start_str, end_str)
        now = datetime.utcnow()

        raw_payments = None
        with _RAW_PAYMENTS_LOCK:
            cached = _RAW_PAYMENTS_CACHE.get(cache_key)
            if cached and (now - cached[0]).total_seconds() < _RAW_PAYMENTS_TTL_SECONDS:
                raw_payments = cached[1]

        if raw_payments is None:
            filter_parts = []
            if start_str:
                filter_parts.append(f"DocDate ge '{start_str}'")
            if end_str:
                filter_parts.append(f"DocDate le '{end_str}'")

            params: Dict[str, Any] = {
                "$orderby": "DocDate desc, DocEntry desc",
                "$select": "DocEntry,DocNum,DocDate,CardCode,CardName,CashSum,TransferSum,TransferDate,TransferReference,PaymentCreditCards,PaymentChecks,PaymentInvoices,BPLID,BPLName,Cancelled,DocCurrency,Remarks,JournalRemarks",
                "$top": 5000,
            }
            if filter_parts:
                params["$filter"] = " and ".join(filter_parts)

            response = self.client.get("IncomingPayments", params)
            raw_payments = response.get("value", [])
            with _RAW_PAYMENTS_LOCK:
                _RAW_PAYMENTS_CACHE[cache_key] = (now, raw_payments)

        # Step 1: Branch and Customer filtering
        payments = []
        for p in raw_payments:
            # Branch filter
            if branch and not self._match_branch(p.get("BPLID"), p.get("BPLName"), branch):
                continue

            # Customer filter
            if customer:
                c_low = customer.strip().lower()
                card_code = str(p.get("CardCode") or "").lower()
                card_name = str(p.get("CardName") or "").lower()
                if c_low not in card_code and c_low not in card_name:
                    continue

            payments.append(p)

        # Step 2: Extract all linked invoice DocEntries for batch enrichment (if requested)
        invoices_map: Dict[int, Dict[str, Any]] = {}
        if include_invoices:
            all_invoice_entries: List[int] = []
            for p in payments:
                for pi in p.get("PaymentInvoices", []):
                    entry = pi.get("DocEntry")
                    if entry is not None:
                        try:
                            all_invoice_entries.append(int(entry))
                        except (ValueError, TypeError):
                            pass

            invoices_map = self._get_invoices_batch(all_invoice_entries)

        # Step 3: Compute fields and enrich each payment
        enriched_payments: List[Dict[str, Any]] = []
        for p_raw in payments:
            p = dict(p_raw)
            cash = _to_float(p.get("CashSum"))
            transfer = _to_float(p.get("TransferSum"))

            credit_cards = p.get("PaymentCreditCards") or []
            card_sum = sum(_to_float(c.get("CreditSum")) for c in credit_cards)

            checks = p.get("PaymentChecks") or []
            check_sum = sum(_to_float(c.get("CheckSum")) for c in checks)

            total_amount = round(cash + transfer + card_sum + check_sum, 2)

            # Determine dominant payment method
            # Priority: Card > Transfer > Check > Cash > Remarks
            remarks_str = (str(p.get("Remarks") or "") + " " + str(p.get("JournalRemarks") or "")).lower()
            if "upi" in remarks_str or "gpay" in remarks_str or "paytm" in remarks_str:
                method = "upi"
            elif card_sum > 0:
                method = "card"
            elif transfer > 0:
                method = "transfer"
            elif check_sum > 0:
                method = "check"
            elif cash > 0:
                method = "cash"
            else:
                method = "cash" if total_amount > 0 else "other"

            # Determine cancellation / status
            is_cancelled = p.get("Cancelled") == "tYES"
            p_invoices = p.get("PaymentInvoices") or []

            linked_invoices_info = []
            invoice_doc_nums = []
            invoice_total_sum = 0.0
            sum_applied_total = 0.0

            for pi in p_invoices:
                inv_entry = pi.get("DocEntry")
                inv_obj = invoices_map.get(inv_entry) if inv_entry is not None else None
                sum_app = _to_float(pi.get("SumApplied")) if pi.get("SumApplied") is not None else total_amount
                sum_applied_total += sum_app

                inv_num = inv_obj.get("DocNum") if inv_obj else pi.get("DocNum")
                inv_total = _to_float(inv_obj.get("DocTotal")) if inv_obj else None

                if inv_num:
                    invoice_doc_nums.append(str(inv_num))
                if inv_total is not None:
                    invoice_total_sum += inv_total

                linked_invoices_info.append({
                    "docEntry": inv_entry,
                    "docNum": inv_num,
                    "sumApplied": sum_app,
                    "invoiceTotal": inv_total,
                    "invoiceDate": inv_obj.get("DocDate") if inv_obj else None,
                    "invoiceStatus": inv_obj.get("DocumentStatus") if inv_obj else None,
                })

            if is_cancelled:
                status = "Cancelled"
            elif p_invoices and invoice_total_sum > 0 and sum_applied_total < (invoice_total_sum - 0.01):
                status = "Partial"
            elif not p_invoices:
                status = "On Account"
            else:
                status = "Success"

            # Format invoice DocNum display
            if invoice_doc_nums:
                inv_display = ", ".join(invoice_doc_nums)
            elif not p_invoices:
                inv_display = "On Account"
            else:
                inv_display = "-"

            # If total_amount was 0 but sum_applied_total > 0, fallback to sum_applied_total
            if total_amount == 0 and sum_applied_total > 0:
                total_amount = round(sum_applied_total, 2)

            p["_TotalAmount"] = total_amount
            p["_CashSum"] = cash
            p["_TransferSum"] = transfer
            p["_CardSum"] = card_sum
            p["_CheckSum"] = check_sum
            p["_PaymentMethod"] = method
            p["_Status"] = status
            p["_InvoiceDocNum"] = inv_display
            p["_InvoiceDocEntry"] = linked_invoices_info[0]["docEntry"] if linked_invoices_info else None
            p["_InvoiceAmount"] = round(invoice_total_sum, 2) if invoice_total_sum > 0 else None
            p["_SumApplied"] = round(sum_applied_total, 2)
            p["_LinkedInvoices"] = linked_invoices_info
            p["_DocCurrency"] = p.get("DocCurrency") or "INR"

            # Apply payment_method filter
            if payment_method:
                pm_target = payment_method.strip().lower()
                if pm_target not in ("all", "all methods", ""):
                    if method != pm_target and pm_target not in method:
                        continue

            # Apply payment_status filter
            if payment_status:
                ps_target = payment_status.strip().lower()
                if ps_target not in ("all", "all status", ""):
                    if ps_target in ("success", "cleared") and status not in ("Success", "On Account"):
                        continue
                    elif ps_target == "cancelled" and status != "Cancelled":
                        continue
                    elif ps_target == "partial" and status != "Partial":
                        continue

            enriched_payments.append(p)

        return enriched_payments

    def get_pending_payments(
        self,
        start_date: Optional[Any] = None,
        end_date: Optional[Any] = None,
        branch: Optional[str] = None,
        customer: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Calculates verified pending payment receivables from open SAP Invoices."""
        try:
            start_str = _format_date(start_date)
            end_str = _format_date(end_date)
            cache_key = (start_str, end_str)
            now = datetime.utcnow()

            open_invoices = None
            with _OPEN_INVOICES_LOCK:
                cached = _OPEN_INVOICES_CACHE.get(cache_key)
                if cached and (now - cached[0]).total_seconds() < _OPEN_INVOICES_TTL_SECONDS:
                    open_invoices = cached[1]

            if open_invoices is None:
                filter_parts = ["DocumentStatus eq 'bost_Open'"]
                if start_str:
                    filter_parts.append(f"DocDate ge '{start_str}'")
                if end_str:
                    filter_parts.append(f"DocDate le '{end_str}'")

                params = {
                    "$filter": " and ".join(filter_parts),
                    "$select": "DocEntry,DocNum,DocDate,CardCode,CardName,DocTotal,PaidToDate,DocumentStatus,BPL_IDAssignedToInvoice,BPLName",
                    "$top": 5000,
                }
                res = self.client.get("Invoices", params)
                open_invoices = res.get("value", [])
                with _OPEN_INVOICES_LOCK:
                    _OPEN_INVOICES_CACHE[cache_key] = (now, open_invoices)

            total_pending = 0.0
            matching_count = 0

            for inv in open_invoices:
                # Branch filter
                if branch and not self._match_branch(inv.get("BPL_IDAssignedToInvoice"), inv.get("BPLName"), branch):
                    continue

                # Customer filter
                if customer:
                    c_low = customer.strip().lower()
                    cc = str(inv.get("CardCode") or "").lower()
                    cn = str(inv.get("CardName") or "").lower()
                    if c_low not in cc and c_low not in cn:
                        continue

                doc_tot = _to_float(inv.get("DocTotal"))
                paid = _to_float(inv.get("PaidToDate"))
                balance = max(0.0, doc_tot - paid)
                total_pending += balance
                matching_count += 1

            return {
                "total": round(total_pending, 2),
                "count": matching_count,
                "rule": "Open A/R invoice outstanding balance (DocTotal - PaidToDate)",
            }
        except Exception as e:
            logger.warning(f"Error computing pending payments from SAP: {e}")
            return {
                "total": 0.0,
                "count": 0,
                "rule": "Open A/R invoice balance calculation failed",
                "error": str(e),
            }

    def get_refunds(
        self,
        start_date: Optional[Any] = None,
        end_date: Optional[Any] = None,
        branch: Optional[str] = None,
        customer: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Calculates verified refunds issued from real SAP CreditNotes (A/R Credit Memos)."""
        try:
            start_str = _format_date(start_date)
            end_str = _format_date(end_date)
            cache_key = (start_str, end_str)
            now = datetime.utcnow()

            notes = None
            with _CREDIT_NOTES_LOCK:
                cached = _CREDIT_NOTES_CACHE.get(cache_key)
                if cached and (now - cached[0]).total_seconds() < _CREDIT_NOTES_TTL_SECONDS:
                    notes = cached[1]

            if notes is None:
                filter_parts = []
                if start_str:
                    filter_parts.append(f"DocDate ge '{start_str}'")
                if end_str:
                    filter_parts.append(f"DocDate le '{end_str}'")

                params: Dict[str, Any] = {
                    "$select": "DocEntry,DocNum,DocDate,CardCode,CardName,DocTotal,Cancelled,BPL_IDAssignedToInvoice,BPLName",
                    "$top": 5000,
                }
                if filter_parts:
                    params["$filter"] = " and ".join(filter_parts)

                res = self.client.get("CreditNotes", params)
                notes = res.get("value", [])
                with _CREDIT_NOTES_LOCK:
                    _CREDIT_NOTES_CACHE[cache_key] = (now, notes)

            total_refunds = 0.0
            refund_count = 0

            for n in notes:
                if n.get("Cancelled") == "tYES":
                    continue

                # Branch filter
                if branch and not self._match_branch(n.get("BPL_IDAssignedToInvoice"), n.get("BPLName"), branch):
                    continue

                # Customer filter
                if customer:
                    c_low = customer.strip().lower()
                    cc = str(n.get("CardCode") or "").lower()
                    cn = str(n.get("CardName") or "").lower()
                    if c_low not in cc and c_low not in cn:
                        continue

                total_refunds += _to_float(n.get("DocTotal"))
                refund_count += 1

            return {
                "total": round(total_refunds, 2),
                "count": refund_count,
                "rule": "Sum of A/R Credit Memos (CreditNotes) issued to customers",
            }
        except Exception as e:
            logger.warning(f"Error computing refunds from SAP: {e}")
            return {
                "total": 0.0,
                "count": 0,
                "rule": "CreditNotes query failed",
                "error": str(e),
            }

    def get_payment_detail(self, doc_entry: int) -> Optional[Dict[str, Any]]:
        """Fetches full, un-redacted SAP IncomingPayment details with linked invoices."""
        try:
            payment = self.client.get(f"IncomingPayments({doc_entry})")
            if not payment:
                return None

            # Enrich with invoice details
            p_invoices = payment.get("PaymentInvoices") or []
            invoice_entries = [pi.get("DocEntry") for pi in p_invoices if pi.get("DocEntry")]
            invoices_map = self._get_invoices_batch(invoice_entries) if invoice_entries else {}

            linked_list = []
            for pi in p_invoices:
                e = pi.get("DocEntry")
                inv = invoices_map.get(e)
                linked_list.append({
                    "docEntry": e,
                    "docNum": inv.get("DocNum") if inv else pi.get("DocNum"),
                    "sumApplied": _to_float(pi.get("SumApplied")),
                    "invoiceTotal": _to_float(inv.get("DocTotal")) if inv else None,
                    "paidToDate": _to_float(inv.get("PaidToDate")) if inv else None,
                    "docDate": inv.get("DocDate") if inv else None,
                    "status": inv.get("DocumentStatus") if inv else None,
                })

            cash = _to_float(payment.get("CashSum"))
            transfer = _to_float(payment.get("TransferSum"))
            cards = payment.get("PaymentCreditCards") or []
            card_sum = sum(_to_float(c.get("CreditSum")) for c in cards)
            checks = payment.get("PaymentChecks") or []
            check_sum = sum(_to_float(c.get("CheckSum")) for c in checks)
            total = round(cash + transfer + card_sum + check_sum, 2)
            if total == 0 and payment.get("DocTotal"):
                total = _to_float(payment.get("DocTotal"))

            return {
                "docEntry": payment.get("DocEntry"),
                "docNum": payment.get("DocNum"),
                "docDate": payment.get("DocDate"),
                "cardCode": payment.get("CardCode"),
                "cardName": payment.get("CardName"),
                "totalAmount": total,
                "docCurrency": payment.get("DocCurrency") or "INR",
                "branchId": payment.get("BPLID"),
                "branchName": payment.get("BPLName"),
                "cancelled": payment.get("Cancelled") == "tYES",
                "cashSum": cash,
                "transferSum": transfer,
                "transferReference": payment.get("TransferReference"),
                "transferDate": payment.get("TransferDate"),
                "cardSum": card_sum,
                "creditCards": cards,
                "checkSum": check_sum,
                "checks": checks,
                "remarks": payment.get("Remarks"),
                "journalRemarks": payment.get("JournalRemarks"),
                "linkedInvoices": linked_list,
            }
        except Exception as e:
            logger.error(f"Error fetching payment details for DocEntry {doc_entry}: {e}")
            return None
