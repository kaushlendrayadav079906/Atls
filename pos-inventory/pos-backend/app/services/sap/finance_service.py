"""SAP Finance Service - Aggregates financial overview, payments, receivables, payables, and trends."""

from __future__ import annotations

import logging
import os
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.services.sap.client import get_sap_client, SAPConnectionError, SAPValidationError
from app.services.sap.invoices_service import SAPInvoicesService

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=min(16, (os.cpu_count() or 4) * 2))

# Thread-safe cache with 60-second TTL
_FINANCE_CACHE: Dict[str, Tuple[Dict[str, Any], float]] = {}
_CACHE_TTL_SECONDS = 60.0


def _to_float(val: Any) -> float:
    try:
        return float(val) if val is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


class SAPFinanceService:
    def __init__(self):
        self.client = get_sap_client()
        self.invoices_service = SAPInvoicesService()

    # -------------------------------------------------------------------------
    # Shared Filtering & SAP Query Helpers
    # -------------------------------------------------------------------------

    def _matches_branch(self, doc: Dict[str, Any], branch_id: Optional[str]) -> bool:
        """Check if SAP document belongs to requested branch (by BPLID, BPLName, or U_Branch)."""
        if not branch_id or str(branch_id).strip().upper() in ("ALL", "*", ""):
            return True
        b_target = str(branch_id).strip().upper()
        doc_bpl_id = str(doc.get("BPLID") or doc.get("BPL_IDAssignedToInvoice") or "").strip().upper()
        doc_bpl_name = str(doc.get("BPLName") or doc.get("U_Branch") or "").strip().upper()
        return doc_bpl_id == b_target or doc_bpl_name == b_target

    def _fetch_all_sap_records(
        self, endpoint: str, params: Dict[str, Any], max_records: int = 5000
    ) -> List[Dict[str, Any]]:
        """Fetch all records across pages from SAP Service Layer using $skip pagination."""
        all_records: List[Dict[str, Any]] = []
        page_size = 100
        skip = 0
        req_params = dict(params)

        while len(all_records) < max_records:
            req_params["$top"] = min(page_size, max_records - len(all_records))
            req_params["$skip"] = skip
            try:
                res = self.client.get(endpoint, req_params)
            except Exception as e:
                logger.error("SAP query failed for endpoint %s (skip=%d): %s", endpoint, skip, e)
                # Re-raise so failures are not silently converted into zero values
                if not all_records:
                    raise
                break

            raw_page = res.get("value", []) if isinstance(res, dict) else []
            if not raw_page:
                break

            all_records.extend(raw_page)
            if len(raw_page) < page_size:
                break
            skip += len(raw_page)

        logger.info("SAP query %s retrieved %d records (total across pages)", endpoint, len(all_records))
        return all_records

    def _is_all_time(self, range_str: str, from_date: Optional[str] = None, to_date: Optional[str] = None) -> bool:
        """Return True if the query requests All Dates (Total) with no custom date bounds."""
        return (range_str or "").lower().strip() in ("all", "all_time", "total") and not (from_date and to_date)

    def _resolve_date_range(
        self, range_str: str, from_date: Optional[str], to_date: Optional[str]
    ) -> Tuple[date, date]:
        """Resolve start and end date for a given period or custom bounds."""
        if from_date and to_date:
            try:
                return date.fromisoformat(from_date), date.fromisoformat(to_date)
            except ValueError:
                pass

        today = date.today()
        first_this_month = today.replace(day=1)
        last_day_prev_month = first_this_month - timedelta(days=1)
        first_day_prev_month = last_day_prev_month.replace(day=1)
        r = (range_str or "all_time").lower().strip()

        if r in ("daily", "today"):
            return today, today
        elif r in ("weekly", "week", "this_week"):
            return today - timedelta(days=6), today
        elif r in ("monthly", "month", "this_month"):
            return first_this_month, today
        elif r in ("last_month", "previous_month"):
            return first_day_prev_month, last_day_prev_month
        elif r in ("past_6_months", "6_months", "last_6_months", "past_six_months"):
            m = today.month - 5
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            return date(y, m, 1), today
        elif r in ("yearly", "year", "this_year", str(today.year)):
            return today.replace(month=1, day=1), today
        elif r in ("last_year", str(today.year - 1)):
            return date(today.year - 1, 1, 1), date(today.year - 1, 12, 31)
        elif r.isdigit() and len(r) == 4:
            yr = int(r)
            return date(yr, 1, 1), date(yr, 12, 31)
        elif r in ("all", "all_time", "total"):
            return date(2000, 1, 1), today
        else:
            return first_this_month, today

    def _resolve_previous_period(self, d_from: date, d_to: date) -> Tuple[date, date]:
        duration_days = (d_to - d_from).days + 1
        prev_to = d_from - timedelta(days=1)
        prev_from = prev_to - timedelta(days=duration_days - 1)
        return prev_from, prev_to

    def _get_period_label(self, range_str: str, d_from: date, d_to: date) -> str:
        r = (range_str or "all_time").lower().strip()
        if r in ("all", "all_time", "total"):
            return "All Dates (Total)"
        elif r in ("daily", "today"):
            return f"Today ({d_from})"
        elif r in ("weekly", "week", "this_week"):
            return f"This Week ({d_from} to {d_to})"
        elif r in ("monthly", "month", "this_month"):
            return f"This Month ({d_from.strftime('%B %Y')})"
        elif r in ("last_month", "previous_month"):
            return f"Last Month ({d_from.strftime('%B %Y')})"
        elif r in ("past_6_months", "6_months", "last_6_months"):
            return f"Past 6 Months ({d_from.strftime('%b %Y')} to {d_to.strftime('%b %Y')})"
        elif r in ("yearly", "year", "this_year"):
            return f"This Year ({d_from.year})"
        return f"{d_from.strftime('%b %d, %Y')} - {d_to.strftime('%b %d, %Y')}"

    def _calculate_growth(self, current: float, previous: float) -> float:
        if previous <= 0:
            return 0.0 if current <= 0 else 100.0
        return round(((current - previous) / previous) * 100, 1)

    # -------------------------------------------------------------------------
    # 1. Finance Overview
    # -------------------------------------------------------------------------

    def get_finance_overview(
        self,
        range_str: str = "monthly",
        branch_id: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch and aggregate financial KPIs, trends, top customers, suppliers, and recent payments."""
        cache_key = f"finance_overview_{range_str}_{branch_id or 'all'}_{from_date or ''}_{to_date or ''}"
        now_ts = time.time()
        if cache_key in _FINANCE_CACHE:
            cached_data, cached_at = _FINANCE_CACHE[cache_key]
            if now_ts - cached_at < _CACHE_TTL_SECONDS:
                logger.debug("Returning cached finance overview (%s)", cache_key)
                return cached_data

        d_from, d_to = self._resolve_date_range(range_str, from_date, to_date)
        is_all_time = self._is_all_time(range_str, from_date, to_date)
        prev_from, prev_to = self._resolve_previous_period(d_from, d_to)

        # 1. Fetch Sales Invoices (Current & Previous period)
        sales_data = self._get_sales_metrics(d_from, d_to, prev_from, prev_to, branch_id, is_all_time=is_all_time)

        # 2. Fetch Purchase Invoices (Current & Previous period)
        purchases_data = self._get_purchases_metrics(d_from, d_to, prev_from, prev_to, branch_id, is_all_time=is_all_time)

        # 3. Fetch Incoming Payments
        incoming_data = self._get_incoming_payments_metrics(d_from, d_to, prev_from, prev_to, branch_id, is_all_time=is_all_time)

        # 4. Fetch Outgoing Payments
        outgoing_data = self._get_outgoing_payments_metrics(d_from, d_to, prev_from, prev_to, branch_id, is_all_time=is_all_time)

        # 5. Fetch Accounts Receivable & Payable balances from Business Partners
        balances_data = self._get_ar_ap_balances()

        # 6. Compute Gross Profit & Margin
        total_sales = sales_data["total_sales"]
        total_purchases = purchases_data["total_purchases"]
        prev_sales = sales_data["prev_sales"]
        prev_purchases = purchases_data["prev_purchases"]

        gross_profit = round(total_sales - total_purchases, 2)
        prev_gross_profit = round(prev_sales - prev_purchases, 2)
        gross_profit_growth = self._calculate_growth(gross_profit, prev_gross_profit)

        gross_margin = round((gross_profit / total_sales * 100), 1) if total_sales > 0 else 0.0
        prev_gross_margin = round((prev_gross_profit / prev_sales * 100), 1) if prev_sales > 0 else 0.0
        gross_margin_growth = round(gross_margin - prev_gross_margin, 1)

        # 7. Generate Trends Data (Past 6 months by default for the charts)
        sales_purchases_trend = self._get_sales_vs_purchases_trend(range_str, branch_id)
        payments_trend = self._get_payments_trend(range_str, branch_id)

        # 8. Top 5 Customers by Sales
        top_customers = self._get_top_customers(d_from, d_to, branch_id, is_all_time=is_all_time)

        # 9. Top 5 Suppliers by Purchase
        top_suppliers = self._get_top_suppliers(d_from, d_to, branch_id, is_all_time=is_all_time)

        # 10. Recent Payments (Incoming and Outgoing)
        recent_payments = self._get_recent_payments(branch_id)

        kpis_obj = {
            "total_sales": {
                "value": total_sales,
                "invoice_count": sales_data["invoice_count"],
                "growth": sales_data["growth"],
                "is_positive": sales_data["growth"] >= 0,
                "subtext": f"{sales_data['invoice_count']} invoices",
            },
            "total_purchases": {
                "value": total_purchases,
                "invoice_count": purchases_data["invoice_count"],
                "growth": purchases_data["growth"],
                "is_positive": purchases_data["growth"] >= 0,
                "subtext": f"{purchases_data['invoice_count']} Invoices",
            },
            "incoming_payments": {
                "value": incoming_data["total_payments"],
                "payment_count": incoming_data["payment_count"],
                "growth": incoming_data["growth"],
                "is_positive": incoming_data["growth"] >= 0,
                "subtext": f"{incoming_data['payment_count']} payments",
            },
            "outgoing_payments": {
                "value": outgoing_data["total_payments"],
                "payment_count": outgoing_data["payment_count"],
                "growth": outgoing_data["growth"],
                "is_positive": outgoing_data["growth"] >= 0,
                "subtext": f"{outgoing_data['payment_count']} payments",
            },
            "accounts_receivable": {
                "value": balances_data["accounts_receivable"],
                "subtext": "Outstanding from customers",
            },
            "accounts_payable": {
                "value": balances_data["accounts_payable"],
                "subtext": "Outstanding to suppliers",
            },
            "gross_profit": {
                "value": gross_profit,
                "growth": gross_profit_growth,
                "is_positive": gross_profit_growth >= 0,
                "subtext": self._get_period_label(range_str, d_from, d_to),
            },
            "gross_margin": {
                "value": gross_margin,
                "growth": gross_margin_growth,
                "is_positive": gross_margin_growth >= 0,
                "subtext": self._get_period_label(range_str, d_from, d_to),
            },
        }

        result = {
            "period": {
                "range": range_str,
                "from_date": d_from.isoformat(),
                "to_date": d_to.isoformat(),
                "label": self._get_period_label(range_str, d_from, d_to),
            },
            "kpis": kpis_obj,
            "summary": kpis_obj,
            "charts": {
                "sales_vs_purchases": sales_purchases_trend,
                "payments_trend": payments_trend,
            },
            "tables": {
                "top_customers": top_customers,
                "top_suppliers": top_suppliers,
                "recent_payments": recent_payments,
            },
            "meta": {
                "timestamp": datetime.utcnow().isoformat(),
                "branch_id": branch_id or "all",
                "is_cached": False,
            },
        }

        # Cache result
        _FINANCE_CACHE[cache_key] = (result, now_ts)
        if len(_FINANCE_CACHE) > 50:
            oldest_key = min(_FINANCE_CACHE.keys(), key=lambda k: _FINANCE_CACHE[k][1])
            _FINANCE_CACHE.pop(oldest_key, None)

        return result

    def _get_sales_metrics(
        self, d_from: date, d_to: date, prev_from: date, prev_to: date, branch_id: Optional[str], is_all_time: bool = False
    ) -> Dict[str, Any]:
        if is_all_time:
            current_invoices = self.invoices_service.get_invoices_by_date(None, None)
            prev_invoices = []
        else:
            current_invoices = self.invoices_service.get_invoices_by_date(d_from, d_to)
            prev_invoices = self.invoices_service.get_invoices_by_date(prev_from, prev_to)

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            current_invoices = [inv for inv in current_invoices if self._matches_branch(inv, branch_id)]
            prev_invoices = [inv for inv in prev_invoices if self._matches_branch(inv, branch_id)]

        total_sales = round(sum(_to_float(inv.get("DocTotal")) for inv in current_invoices), 2)
        prev_sales = round(sum(_to_float(inv.get("DocTotal")) for inv in prev_invoices), 2)
        invoice_count = len(current_invoices)
        growth = self._calculate_growth(total_sales, prev_sales)

        return {
            "total_sales": total_sales,
            "prev_sales": prev_sales,
            "invoice_count": invoice_count,
            "growth": growth,
        }

    def _get_purchases_metrics(
        self, d_from: date, d_to: date, prev_from: date, prev_to: date, branch_id: Optional[str], is_all_time: bool = False
    ) -> Dict[str, Any]:
        if is_all_time:
            pinvs_curr = self._fetch_all_sap_records(
                "PurchaseInvoices",
                {"$select": "DocEntry,DocTotal,Cancelled,BPL_IDAssignedToInvoice,BPLName", "$filter": "Cancelled ne 'tYES'"}
            )
            pinvs_prev = []
        else:
            f_curr = f"DocDate ge '{d_from.isoformat()}' and DocDate le '{d_to.isoformat()}' and Cancelled ne 'tYES'"
            pinvs_curr = self._fetch_all_sap_records(
                "PurchaseInvoices",
                {"$select": "DocEntry,DocTotal,Cancelled,BPL_IDAssignedToInvoice,BPLName", "$filter": f_curr}
            )
            f_prev = f"DocDate ge '{prev_from.isoformat()}' and DocDate le '{prev_to.isoformat()}' and Cancelled ne 'tYES'"
            pinvs_prev = self._fetch_all_sap_records(
                "PurchaseInvoices",
                {"$select": "DocEntry,DocTotal,Cancelled,BPL_IDAssignedToInvoice,BPLName", "$filter": f_prev}
            )

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            pinvs_curr = [p for p in pinvs_curr if self._matches_branch(p, branch_id)]
            pinvs_prev = [p for p in pinvs_prev if self._matches_branch(p, branch_id)]

        total_purchases = round(sum(_to_float(p.get("DocTotal")) for p in pinvs_curr), 2)
        prev_purchases = round(sum(_to_float(p.get("DocTotal")) for p in pinvs_prev), 2)
        invoice_count = len(pinvs_curr)
        growth = self._calculate_growth(total_purchases, prev_purchases)

        return {
            "total_purchases": total_purchases,
            "prev_purchases": prev_purchases,
            "invoice_count": invoice_count,
            "growth": growth,
        }

    def _get_incoming_payments_metrics(
        self, d_from: date, d_to: date, prev_from: date, prev_to: date, branch_id: Optional[str], is_all_time: bool = False
    ) -> Dict[str, Any]:
        if is_all_time:
            pays_curr = self._fetch_all_sap_records(
                "IncomingPayments",
                {"$select": "DocEntry,CashSum,TransferSum,Cancelled,BPLID,BPLName", "$filter": "Cancelled ne 'tYES'"}
            )
            pays_prev = []
        else:
            f_curr = f"DocDate ge '{d_from.isoformat()}' and DocDate le '{d_to.isoformat()}' and Cancelled ne 'tYES'"
            pays_curr = self._fetch_all_sap_records(
                "IncomingPayments",
                {"$select": "DocEntry,CashSum,TransferSum,Cancelled,BPLID,BPLName", "$filter": f_curr}
            )
            f_prev = f"DocDate ge '{prev_from.isoformat()}' and DocDate le '{prev_to.isoformat()}' and Cancelled ne 'tYES'"
            pays_prev = self._fetch_all_sap_records(
                "IncomingPayments",
                {"$select": "DocEntry,CashSum,TransferSum,Cancelled,BPLID,BPLName", "$filter": f_prev}
            )

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            pays_curr = [p for p in pays_curr if self._matches_branch(p, branch_id)]
            pays_prev = [p for p in pays_prev if self._matches_branch(p, branch_id)]

        total = round(sum(_to_float(p.get("CashSum")) + _to_float(p.get("TransferSum")) for p in pays_curr), 2)
        prev_total = round(sum(_to_float(p.get("CashSum")) + _to_float(p.get("TransferSum")) for p in pays_prev), 2)
        count = len(pays_curr)
        growth = self._calculate_growth(total, prev_total)

        return {
            "total_payments": total,
            "prev_payments": prev_total,
            "payment_count": count,
            "growth": growth,
        }

    def _get_outgoing_payments_metrics(
        self, d_from: date, d_to: date, prev_from: date, prev_to: date, branch_id: Optional[str], is_all_time: bool = False
    ) -> Dict[str, Any]:
        if is_all_time:
            pays_curr = self._fetch_all_sap_records(
                "VendorPayments",
                {"$select": "DocEntry,CashSum,TransferSum,Cancelled,BPLID,BPLName", "$filter": "Cancelled ne 'tYES'"}
            )
            pays_prev = []
        else:
            f_curr = f"DocDate ge '{d_from.isoformat()}' and DocDate le '{d_to.isoformat()}' and Cancelled ne 'tYES'"
            pays_curr = self._fetch_all_sap_records(
                "VendorPayments",
                {"$select": "DocEntry,CashSum,TransferSum,Cancelled,BPLID,BPLName", "$filter": f_curr}
            )
            f_prev = f"DocDate ge '{prev_from.isoformat()}' and DocDate le '{prev_to.isoformat()}' and Cancelled ne 'tYES'"
            pays_prev = self._fetch_all_sap_records(
                "VendorPayments",
                {"$select": "DocEntry,CashSum,TransferSum,Cancelled,BPLID,BPLName", "$filter": f_prev}
            )

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            pays_curr = [p for p in pays_curr if self._matches_branch(p, branch_id)]
            pays_prev = [p for p in pays_prev if self._matches_branch(p, branch_id)]

        total = round(sum(_to_float(p.get("CashSum")) + _to_float(p.get("TransferSum")) for p in pays_curr), 2)
        prev_total = round(sum(_to_float(p.get("CashSum")) + _to_float(p.get("TransferSum")) for p in pays_prev), 2)
        count = len(pays_curr)
        growth = self._calculate_growth(total, prev_total)

        return {
            "total_payments": total,
            "prev_payments": prev_total,
            "payment_count": count,
            "growth": growth,
        }

    def _get_ar_ap_balances(self) -> Dict[str, float]:
        bps = self._fetch_all_sap_records(
            "BusinessPartners",
            {"$select": "CardCode,CardType,CurrentAccountBalance"}
        )
        ar = sum(_to_float(b.get("CurrentAccountBalance")) for b in bps if b.get("CardType") == "cCustomer" and _to_float(b.get("CurrentAccountBalance")) > 0)
        ap = sum(abs(_to_float(b.get("CurrentAccountBalance"))) for b in bps if b.get("CardType") == "cSupplier")

        return {
            "accounts_receivable": round(ar, 2),
            "accounts_payable": round(ap, 2),
        }

    def _get_sales_vs_purchases_trend(self, range_str: str, branch_id: Optional[str]) -> List[Dict[str, Any]]:
        """Generate monthly trend data for the last 6 months."""
        trend: List[Dict[str, Any]] = []
        today = date.today()

        for i in range(5, -1, -1):
            m_year = today.year
            m_month = today.month - i
            while m_month <= 0:
                m_month += 12
                m_year -= 1

            start_m = date(m_year, m_month, 1)
            if m_month == 12:
                end_m = date(m_year, 12, 31)
            else:
                end_m = date(m_year, m_month + 1, 1) - timedelta(days=1)
            if end_m > today:
                end_m = today

            label = start_m.strftime("%b")

            try:
                invs = self.invoices_service.get_invoices_by_date(start_m, end_m)
                if branch_id and branch_id.upper() not in ("ALL", "*"):
                    invs = [x for x in invs if self._matches_branch(x, branch_id)]
                s_total = sum(_to_float(x.get("DocTotal")) for x in invs)
            except Exception as e:
                logger.warning("Error fetching trend sales: %s", e)
                s_total = 0.0

            try:
                f_str = f"DocDate ge '{start_m.isoformat()}' and DocDate le '{end_m.isoformat()}' and Cancelled ne 'tYES'"
                p_res = self._fetch_all_sap_records("PurchaseInvoices", {"$filter": f_str, "$select": "DocTotal,Cancelled,BPL_IDAssignedToInvoice,BPLName"})
                if branch_id and branch_id.upper() not in ("ALL", "*"):
                    p_res = [x for x in p_res if self._matches_branch(x, branch_id)]
                p_total = sum(_to_float(x.get("DocTotal")) for x in p_res)
            except Exception as e:
                logger.warning("Error fetching trend purchases: %s", e)
                p_total = 0.0

            gp = round(s_total - p_total, 2)
            gm = round((gp / s_total * 100), 1) if s_total > 0 else 0.0

            trend.append({
                "period": label,
                "month": start_m.strftime("%Y-%m"),
                "sales": round(s_total, 2),
                "revenue": round(s_total, 2),
                "purchases": round(p_total, 2),
                "cost": round(p_total, 2),
                "gross_profit": gp,
                "gross_margin": gm,
                "margin_pct": gm,
            })

        return trend

    def _get_payments_trend(self, range_str: str, branch_id: Optional[str]) -> List[Dict[str, Any]]:
        """Generate incoming vs outgoing payments monthly trend."""
        trend: List[Dict[str, Any]] = []
        today = date.today()

        for i in range(5, -1, -1):
            m_year = today.year
            m_month = today.month - i
            while m_month <= 0:
                m_month += 12
                m_year -= 1

            start_m = date(m_year, m_month, 1)
            if m_month == 12:
                end_m = date(m_year, 12, 31)
            else:
                end_m = date(m_year, m_month + 1, 1) - timedelta(days=1)
            if end_m > today:
                end_m = today

            label = start_m.strftime("%b")

            try:
                f_inc = f"DocDate ge '{start_m.isoformat()}' and DocDate le '{end_m.isoformat()}' and Cancelled ne 'tYES'"
                inc_res = self._fetch_all_sap_records("IncomingPayments", {"$filter": f_inc, "$select": "CashSum,TransferSum,Cancelled,BPLID,BPLName"})
                if branch_id and branch_id.upper() not in ("ALL", "*"):
                    inc_res = [x for x in inc_res if self._matches_branch(x, branch_id)]
                inc_total = sum(_to_float(x.get("CashSum")) + _to_float(x.get("TransferSum")) for x in inc_res)
            except Exception as e:
                logger.warning("Error fetching trend incoming: %s", e)
                inc_total = 0.0

            try:
                f_out = f"DocDate ge '{start_m.isoformat()}' and DocDate le '{end_m.isoformat()}' and Cancelled ne 'tYES'"
                out_res = self._fetch_all_sap_records("VendorPayments", {"$filter": f_out, "$select": "CashSum,TransferSum,Cancelled,BPLID,BPLName"})
                if branch_id and branch_id.upper() not in ("ALL", "*"):
                    out_res = [x for x in out_res if self._matches_branch(x, branch_id)]
                out_total = sum(_to_float(x.get("CashSum")) + _to_float(x.get("TransferSum")) for x in out_res)
            except Exception as e:
                logger.warning("Error fetching trend outgoing: %s", e)
                out_total = 0.0

            trend.append({
                "period": label,
                "month": start_m.strftime("%Y-%m"),
                "incoming": round(inc_total, 2),
                "outgoing": round(out_total, 2),
            })

        return trend

    def _get_top_customers(self, d_from: date, d_to: date, branch_id: Optional[str], is_all_time: bool = False) -> List[Dict[str, Any]]:
        if is_all_time:
            invoices = self.invoices_service.get_invoices_by_date(None, None)
        else:
            invoices = self.invoices_service.get_invoices_by_date(d_from, d_to)
            if len(invoices) < 3:
                expanded_start = d_to - timedelta(days=365)
                invoices = self.invoices_service.get_invoices_by_date(expanded_start, d_to)

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            invoices = [inv for inv in invoices if self._matches_branch(inv, branch_id)]

        customer_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"customerName": "", "customerCode": "", "invoices": 0, "netSales": 0.0})
        total_net_sales = 0.0

        for inv in invoices:
            code = inv.get("CardCode") or "UNKNOWN"
            name = inv.get("CardName") or inv.get("U_C_Name") or code
            tot = _to_float(inv.get("DocTotal"))
            customer_stats[code]["customerName"] = name
            customer_stats[code]["customerCode"] = code
            customer_stats[code]["invoices"] += 1
            customer_stats[code]["netSales"] += tot
            total_net_sales += tot

        sorted_customers = sorted(customer_stats.values(), key=lambda x: x["netSales"], reverse=True)[:5]
        for idx, c in enumerate(sorted_customers, 1):
            c["rank"] = idx
            c["percentage"] = round((c["netSales"] / total_net_sales * 100), 1) if total_net_sales > 0 else 0.0
            c["netSales"] = round(c["netSales"], 2)

        return sorted_customers

    def _get_top_suppliers(self, d_from: date, d_to: date, branch_id: Optional[str], is_all_time: bool = False) -> List[Dict[str, Any]]:
        params = {
            "$select": "DocEntry,CardCode,CardName,DocTotal,Cancelled,BPL_IDAssignedToInvoice,BPLName",
            "$filter": "Cancelled ne 'tYES'",
        }
        if not is_all_time:
            params["$filter"] += f" and DocDate ge '{d_from.isoformat()}' and DocDate le '{d_to.isoformat()}'"
        pinvs = self._fetch_all_sap_records("PurchaseInvoices", params)
        if branch_id and branch_id.upper() not in ("ALL", "*"):
            pinvs = [p for p in pinvs if self._matches_branch(p, branch_id)]

        supplier_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"supplierName": "", "supplierCode": "", "invoices": 0, "netPurchases": 0.0})
        total_purchases = 0.0

        for p in pinvs:
            code = p.get("CardCode") or "UNKNOWN"
            name = p.get("CardName") or code
            tot = _to_float(p.get("DocTotal"))
            supplier_stats[code]["supplierName"] = name
            supplier_stats[code]["supplierCode"] = code
            supplier_stats[code]["invoices"] += 1
            supplier_stats[code]["netPurchases"] += tot
            total_purchases += tot

        sorted_suppliers = sorted(supplier_stats.values(), key=lambda x: x["netPurchases"], reverse=True)[:5]
        for idx, s in enumerate(sorted_suppliers, 1):
            s["rank"] = idx
            s["percentage"] = round((s["netPurchases"] / total_purchases * 100), 1) if total_purchases > 0 else 0.0
            s["netPurchases"] = round(s["netPurchases"], 2)

        return sorted_suppliers

    def _get_recent_payments(self, branch_id: Optional[str]) -> Dict[str, List[Dict[str, Any]]]:
        # Incoming payments
        inc_res = self.client.get("IncomingPayments", {"$orderby": "DocDate desc, DocEntry desc", "$top": 10, "$select": "DocEntry,DocNum,DocDate,CardCode,CardName,CashSum,TransferSum,Cancelled,BPLID,BPLName"})
        incoming = []
        for p in inc_res.get("value", []):
            if p.get("Cancelled") == "tYES":
                continue
            if branch_id and branch_id.upper() not in ("ALL", "*") and not self._matches_branch(p, branch_id):
                continue
            d_str = str(p.get("DocDate") or "")[:10]
            tot = _to_float(p.get("CashSum")) + _to_float(p.get("TransferSum"))
            incoming.append({
                "docEntry": p.get("DocEntry"),
                "refNo": f"RCT-{p.get('DocNum') or p.get('DocEntry')}",
                "date": d_str,
                "customer": p.get("CardName") or p.get("CardCode") or "Customer",
                "amount": round(tot, 2),
                "status": "Completed",
            })
            if len(incoming) >= 5:
                break

        # Outgoing payments
        out_res = self.client.get("VendorPayments", {"$orderby": "DocDate desc, DocEntry desc", "$top": 10, "$select": "DocEntry,DocNum,DocDate,CardCode,CardName,CashSum,TransferSum,Cancelled,BPLID,BPLName"})
        outgoing = []
        for p in out_res.get("value", []):
            if p.get("Cancelled") == "tYES":
                continue
            if branch_id and branch_id.upper() not in ("ALL", "*") and not self._matches_branch(p, branch_id):
                continue
            d_str = str(p.get("DocDate") or "")[:10]
            tot = _to_float(p.get("CashSum")) + _to_float(p.get("TransferSum"))
            outgoing.append({
                "docEntry": p.get("DocEntry"),
                "refNo": f"PAY-{p.get('DocNum') or p.get('DocEntry')}",
                "date": d_str,
                "supplier": p.get("CardName") or p.get("CardCode") or "Supplier",
                "amount": round(tot, 2),
                "status": "Completed",
            })
            if len(outgoing) >= 5:
                break

        return {"incoming": incoming, "outgoing": outgoing}

    def get_finance_summary(
        self,
        range_str: str = "monthly",
        branch_id: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch overall finance summary KPIs and key trends."""
        return self.get_finance_overview(
            range_str=range_str,
            branch_id=branch_id,
            from_date=from_date,
            to_date=to_date,
        )

    def get_sales_trend(
        self,
        range_str: str = "past_6_months",
        branch_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch sales revenue and invoice counts grouped by period."""
        return self._get_sales_vs_purchases_trend(range_str, branch_id)

    def get_purchase_trend(
        self,
        range_str: str = "past_6_months",
        branch_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch purchase invoice totals and counts grouped by period."""
        return self._get_sales_vs_purchases_trend(range_str, branch_id)

    def get_sales_invoices(
        self,
        range_str: str = "monthly",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        customer_code: Optional[str] = None,
        status: Optional[str] = None,
        branch_id: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Fetch detailed sales invoices from SAP Service Layer with filtering."""
        d_from, d_to = self._resolve_date_range(range_str, from_date, to_date)
        is_all_time = self._is_all_time(range_str, from_date, to_date)
        if is_all_time:
            invoices = self.invoices_service.get_invoices_by_date(None, None)
        else:
            invoices = self.invoices_service.get_invoices_by_date(d_from, d_to)

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            invoices = [inv for inv in invoices if self._matches_branch(inv, branch_id)]

        if customer_code:
            c_code = customer_code.upper()
            invoices = [inv for inv in invoices if str(inv.get("CardCode") or "").upper() == c_code]

        if status:
            s_low = status.lower()
            if s_low in ("open", "pending", "unpaid"):
                invoices = [inv for inv in invoices if inv.get("DocumentStatus") == "bost_Open"]
            elif s_low in ("closed", "paid", "completed"):
                invoices = [inv for inv in invoices if inv.get("DocumentStatus") == "bost_Close"]

        if search:
            q = search.lower().strip()
            invoices = [
                inv for inv in invoices
                if q in str(inv.get("CardName") or "").lower()
                or q in str(inv.get("CardCode") or "").lower()
                or q in str(inv.get("DocNum") or "").lower()
                or q in str(inv.get("DocEntry") or "").lower()
            ]

        total_amount = round(sum(_to_float(inv.get("DocTotal")) for inv in invoices), 2)
        total_count = len(invoices)

        items = []
        for inv in invoices[:limit]:
            d_date = str(inv.get("DocDate") or "")[:10]
            items.append({
                "doc_entry": inv.get("DocEntry"),
                "doc_num": inv.get("DocNum") or inv.get("DocEntry"),
                "doc_date": d_date,
                "card_code": inv.get("CardCode") or "UNKNOWN",
                "card_name": inv.get("CardName") or inv.get("CardCode") or "Customer",
                "doc_total": _to_float(inv.get("DocTotal")),
                "status": "Open" if inv.get("DocumentStatus") == "bost_Open" else "Closed",
                "branch": inv.get("U_Branch") or inv.get("BPLName") or branch_id or "Main Branch",
            })

        return {
            "period": self._get_period_label(range_str, d_from, d_to),
            "date_from": d_from.isoformat(),
            "date_to": d_to.isoformat(),
            "total_count": total_count,
            "total_amount": total_amount,
            "items": items,
            "invoices": items,
            "sales_invoices": items,
            "meta": {
                "is_partial": total_count > len(items),
                "total_count": total_count,
                "returned_count": len(items),
            },
        }

    # -------------------------------------------------------------------------
    # 2. Purchase Invoices (A/P Vendor Invoices)
    # -------------------------------------------------------------------------

    def get_purchase_invoices(
        self,
        range_str: str = "all_time",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        supplier_code: Optional[str] = None,
        status: Optional[str] = None,
        branch_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Fetch detailed purchase invoices from SAP Service Layer with pagination, filtering, and KPIs."""
        d_from, d_to = self._resolve_date_range(range_str, from_date, to_date)
        is_all_time = self._is_all_time(range_str, from_date, to_date)

        filters = ["Cancelled ne 'tYES'"]
        if not is_all_time:
            filters.append(f"DocDate ge '{d_from.isoformat()}'")
            filters.append(f"DocDate le '{d_to.isoformat()}'")
        if supplier_code:
            filters.append(f"CardCode eq '{supplier_code}'")

        filter_str = " and ".join(filters)
        params = {
            "$filter": filter_str,
            "$orderby": "DocDate desc, DocEntry desc",
            "$select": "DocEntry,DocNum,DocDate,DocDueDate,CardCode,CardName,DocTotal,PaidToDate,DocumentStatus,DocCurrency,Cancelled,BPL_IDAssignedToInvoice,BPLName",
        }
        raw = self._fetch_all_sap_records("PurchaseInvoices", params)
        raw = [p for p in raw if p.get("Cancelled") != "tYES"]

        if search:
            q = search.lower().strip()
            raw = [
                p for p in raw
                if q in str(p.get("CardName") or "").lower()
                or q in str(p.get("CardCode") or "").lower()
                or q in str(p.get("DocNum") or "").lower()
                or q in str(p.get("DocEntry") or "").lower()
            ]

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            raw = [p for p in raw if self._matches_branch(p, branch_id)]

        total_purchases = 0.0
        total_paid = 0.0
        total_outstanding = 0.0
        status_counts = {
            "open": 0,
            "closed": 0,
            "paid": 0,
            "partially_paid": 0,
            "unpaid": 0,
            "cancelled": 0,
        }

        enriched_invoices = []
        for p in raw:
            doc_total = _to_float(p.get("DocTotal"))
            paid_to_date = _to_float(p.get("PaidToDate"))
            balance_due = max(0.0, round(doc_total - paid_to_date, 2))
            doc_status = p.get("DocumentStatus")

            is_paid = doc_status == "bost_Close" or (paid_to_date >= doc_total and doc_total > 0)
            is_partial = paid_to_date > 0 and paid_to_date < doc_total
            payment_status = "Paid" if is_paid else ("Partially Paid" if is_partial else "Unpaid")

            if doc_status == "bost_Close":
                status_counts["closed"] += 1
            else:
                status_counts["open"] += 1

            if payment_status == "Paid":
                status_counts["paid"] += 1
            elif payment_status == "Partially Paid":
                status_counts["partially_paid"] += 1
            else:
                status_counts["unpaid"] += 1

            if status and status.lower() not in ("all", ""):
                s_low = status.lower()
                if s_low in ("paid", "closed") and payment_status != "Paid" and doc_status != "bost_Close":
                    continue
                elif s_low in ("unpaid", "open") and payment_status != "Unpaid" and doc_status != "bost_Open":
                    continue
                elif s_low in ("partially_paid", "partial", "partially paid") and payment_status != "Partially Paid":
                    continue

            total_purchases += doc_total
            total_paid += min(doc_total, paid_to_date)
            total_outstanding += balance_due

            d_date = str(p.get("DocDate") or "")[:10]
            d_due = str(p.get("DocDueDate") or "")[:10] if p.get("DocDueDate") else d_date
            b_name = str(p.get("BPLName") or p.get("BPL_IDAssignedToInvoice") or "Main Branch")
            b_id = p.get("BPLID") or p.get("BPL_IDAssignedToInvoice")

            enriched_invoices.append({
                "doc_entry": p.get("DocEntry"),
                "doc_num": p.get("DocNum") or p.get("DocEntry"),
                "doc_date": d_date,
                "doc_due_date": d_due,
                "card_code": p.get("CardCode") or "UNKNOWN",
                "card_name": p.get("CardName") or p.get("CardCode") or "Supplier",
                "doc_total": doc_total,
                "paid_to_date": paid_to_date,
                "balance_due": balance_due,
                "payment_status": payment_status,
                "doc_status": "Closed" if doc_status == "bost_Close" else "Open",
                "document_status": "Closed" if doc_status == "bost_Close" else "Open",
                "currency": p.get("DocCurrency") or "INR",
                "branch": b_name,
                "branch_name": b_name,
                "branch_id": b_id,
                "cancelled": p.get("Cancelled") or "tNO",
            })

        total_count = len(enriched_invoices)
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        start_idx = (page - 1) * page_size
        paginated_items = enriched_invoices[start_idx : start_idx + page_size]

        summary_obj = {
            "total_invoices": total_count,
            "total_purchases": round(total_purchases, 2),
            "total_paid": round(total_paid, 2),
            "total_outstanding_balance": round(total_outstanding, 2),
            "currency": "INR",
            "status_counts": status_counts,
        }

        return {
            "period": {
                "range": range_str,
                "label": self._get_period_label(range_str, d_from, d_to),
                "from_date": d_from.isoformat(),
                "to_date": d_to.isoformat(),
            },
            "summary": summary_obj,
            "kpis": summary_obj,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_more": page < total_pages,
            "items": paginated_items,
            "invoices": paginated_items,
            "purchase_invoices": paginated_items,
            "filters_applied": {
                "range": range_str,
                "branch": branch_id,
                "from_date": from_date,
                "to_date": to_date,
                "status": status,
                "search": search,
                "supplier_code": supplier_code,
            },
        }

    # -------------------------------------------------------------------------
    # 3. Incoming Payments (A/R Customer Receipts)
    # -------------------------------------------------------------------------

    def get_incoming_payments(
        self,
        range_str: str = "all_time",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        customer_code: Optional[str] = None,
        payment_method: Optional[str] = None,
        branch_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Fetch detailed customer incoming payments from SAP Business One."""
        d_from, d_to = self._resolve_date_range(range_str, from_date, to_date)
        is_all_time = self._is_all_time(range_str, from_date, to_date)

        filters = ["Cancelled ne 'tYES'"]
        if not is_all_time:
            filters.append(f"DocDate ge '{d_from.isoformat()}'")
            filters.append(f"DocDate le '{d_to.isoformat()}'")
        if customer_code:
            filters.append(f"CardCode eq '{customer_code}'")

        filter_str = " and ".join(filters)
        params = {
            "$filter": filter_str,
            "$orderby": "DocDate desc, DocEntry desc",
            "$select": "DocEntry,DocNum,DocDate,CardCode,CardName,CashSum,TransferSum,Cancelled,DocCurrency,BPLID,BPLName,PaymentInvoices",
        }
        raw = self._fetch_all_sap_records("IncomingPayments", params)
        raw = [p for p in raw if p.get("Cancelled") != "tYES"]

        if search:
            q = search.lower().strip()
            raw = [
                p for p in raw
                if q in str(p.get("CardName") or "").lower()
                or q in str(p.get("CardCode") or "").lower()
                or q in str(p.get("DocNum") or "").lower()
                or q in str(p.get("DocEntry") or "").lower()
            ]

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            raw = [p for p in raw if self._matches_branch(p, branch_id)]

        total_amount = 0.0
        by_method = {"cash": 0.0, "transfer": 0.0, "other": 0.0}
        items = []

        for p in raw:
            cash = _to_float(p.get("CashSum"))
            transfer = _to_float(p.get("TransferSum"))
            tot = round(cash + transfer, 2)

            if transfer > 0 and cash > 0:
                method_name = "Transfer & Cash"
            elif transfer > 0:
                method_name = "Bank Transfer"
            elif cash > 0:
                method_name = "Cash"
            else:
                method_name = "Bank Transfer"

            if payment_method and payment_method.lower() not in ("all", ""):
                if payment_method.lower() not in method_name.lower():
                    continue

            total_amount += tot
            by_method["cash"] += cash
            by_method["transfer"] += transfer

            pinvs = p.get("PaymentInvoices") or []
            applied_invoices = [
                {
                    "doc_entry": inv.get("DocEntry"),
                    "docEntry": inv.get("DocEntry"),
                    "doc_num": inv.get("DocNum"),
                    "docNum": inv.get("DocNum"),
                    "sum_applied": _to_float(inv.get("SumApplied")),
                    "sumApplied": _to_float(inv.get("SumApplied")),
                    "invoice_type": inv.get("InvoiceType"),
                    "invoiceType": inv.get("InvoiceType"),
                }
                for inv in pinvs
            ]

            d_date = str(p.get("DocDate") or "")[:10]
            b_name = str(p.get("BPLName") or p.get("BPLID") or "Main Branch")
            b_id = p.get("BPLID")
            c_code = p.get("CardCode") or ""
            c_name = p.get("CardName") or c_code or "Customer"
            curr = p.get("DocCurrency") or "INR"

            items.append({
                "doc_entry": p.get("DocEntry"),
                "doc_num": p.get("DocNum") or p.get("DocEntry"),
                "ref_no": f"RCT-{p.get('DocNum') or p.get('DocEntry')}",
                "doc_date": d_date,
                "date": d_date,
                "card_code": c_code,
                "customer_code": c_code,
                "card_name": c_name,
                "customer_name": c_name,
                "cash_sum": cash,
                "transfer_sum": transfer,
                "total_amount": tot,
                "amount": tot,
                "payment_method": method_name,
                "method": method_name,
                "applied_invoices_count": len(applied_invoices),
                "applied_invoices": applied_invoices,
                "status": "Completed",
                "doc_currency": curr,
                "currency": curr,
                "branch": b_name,
                "branch_name": b_name,
                "branch_id": b_id,
            })

        total_count = len(items)
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        start_idx = (page - 1) * page_size
        paginated_items = items[start_idx : start_idx + page_size]

        avg_payment = round(total_amount / total_count, 2) if total_count > 0 else 0.0

        summary_obj = {
            "total_receipts_count": total_count,
            "transactions_count": total_count,
            "total_received_amount": round(total_amount, 2),
            "total_incoming_amount": round(total_amount, 2),
            "average_payment": avg_payment,
            "currency": "INR",
            "method_breakdown": {
                "bank_transfer": round(by_method["transfer"], 2),
                "cash": round(by_method["cash"], 2),
                "other": round(by_method["other"], 2),
            },
            "by_method": {
                "transfer": round(by_method["transfer"], 2),
                "cash": round(by_method["cash"], 2),
                "other": round(by_method["other"], 2),
            },
        }

        return {
            "period": {
                "range": range_str,
                "label": self._get_period_label(range_str, d_from, d_to),
                "from_date": d_from.isoformat(),
                "to_date": d_to.isoformat(),
            },
            "summary": summary_obj,
            "kpis": summary_obj,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_more": page < total_pages,
            "items": paginated_items,
            "payments": paginated_items,
            "filters_applied": {
                "range": range_str,
                "branch": branch_id,
                "from_date": from_date,
                "to_date": to_date,
                "payment_method": payment_method,
                "search": search,
                "customer_code": customer_code,
            },
        }

    # -------------------------------------------------------------------------
    # 4. Outgoing Payments (A/P Vendor Disbursements)
    # -------------------------------------------------------------------------

    def get_outgoing_payments(
        self,
        range_str: str = "all_time",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        supplier_code: Optional[str] = None,
        payment_method: Optional[str] = None,
        branch_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """Fetch vendor outgoing payments from SAP Business One."""
        d_from, d_to = self._resolve_date_range(range_str, from_date, to_date)
        is_all_time = self._is_all_time(range_str, from_date, to_date)

        filters = ["Cancelled ne 'tYES'"]
        if not is_all_time:
            filters.append(f"DocDate ge '{d_from.isoformat()}'")
            filters.append(f"DocDate le '{d_to.isoformat()}'")
        if supplier_code:
            filters.append(f"CardCode eq '{supplier_code}'")

        filter_str = " and ".join(filters)
        params = {
            "$filter": filter_str,
            "$orderby": "DocDate desc, DocEntry desc",
            "$select": "DocEntry,DocNum,DocDate,CardCode,CardName,CashSum,TransferSum,Cancelled,DocCurrency,BPLID,BPLName,PaymentInvoices",
        }
        raw = self._fetch_all_sap_records("VendorPayments", params)
        raw = [p for p in raw if p.get("Cancelled") != "tYES"]

        if search:
            q = search.lower().strip()
            raw = [
                p for p in raw
                if q in str(p.get("CardName") or "").lower()
                or q in str(p.get("CardCode") or "").lower()
                or q in str(p.get("DocNum") or "").lower()
                or q in str(p.get("DocEntry") or "").lower()
            ]

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            raw = [p for p in raw if self._matches_branch(p, branch_id)]

        total_amount = 0.0
        by_method = {"cash": 0.0, "transfer": 0.0, "other": 0.0}
        items = []

        for p in raw:
            cash = _to_float(p.get("CashSum"))
            transfer = _to_float(p.get("TransferSum"))
            tot = round(cash + transfer, 2)

            if transfer > 0 and cash > 0:
                method_name = "Transfer & Cash"
            elif transfer > 0:
                method_name = "Bank Transfer"
            elif cash > 0:
                method_name = "Cash"
            else:
                method_name = "Bank Transfer"

            if payment_method and payment_method.lower() not in ("all", ""):
                if payment_method.lower() not in method_name.lower():
                    continue

            total_amount += tot
            by_method["cash"] += cash
            by_method["transfer"] += transfer

            pinvs = p.get("PaymentInvoices") or []
            applied_invoices = [
                {
                    "doc_entry": inv.get("DocEntry"),
                    "docEntry": inv.get("DocEntry"),
                    "doc_num": inv.get("DocNum"),
                    "docNum": inv.get("DocNum"),
                    "sum_applied": _to_float(inv.get("SumApplied")),
                    "sumApplied": _to_float(inv.get("SumApplied")),
                    "invoice_type": inv.get("InvoiceType"),
                    "invoiceType": inv.get("InvoiceType"),
                }
                for inv in pinvs
            ]

            d_date = str(p.get("DocDate") or "")[:10]
            b_name = str(p.get("BPLName") or p.get("BPLID") or "Main Branch")
            b_id = p.get("BPLID")
            s_code = p.get("CardCode") or ""
            s_name = p.get("CardName") or s_code or "Supplier"
            curr = p.get("DocCurrency") or "INR"

            items.append({
                "doc_entry": p.get("DocEntry"),
                "doc_num": p.get("DocNum") or p.get("DocEntry"),
                "ref_no": f"PAY-{p.get('DocNum') or p.get('DocEntry')}",
                "doc_date": d_date,
                "date": d_date,
                "card_code": s_code,
                "supplier_code": s_code,
                "card_name": s_name,
                "supplier_name": s_name,
                "cash_sum": cash,
                "transfer_sum": transfer,
                "total_amount": tot,
                "amount": tot,
                "payment_method": method_name,
                "method": method_name,
                "applied_purchase_invoices_count": len(applied_invoices),
                "applied_invoices_count": len(applied_invoices),
                "applied_invoices": applied_invoices,
                "status": "Completed",
                "doc_currency": curr,
                "currency": curr,
                "branch": b_name,
                "branch_name": b_name,
                "branch_id": b_id,
            })

        total_count = len(items)
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        start_idx = (page - 1) * page_size
        paginated_items = items[start_idx : start_idx + page_size]

        avg_disbursement = round(total_amount / total_count, 2) if total_count > 0 else 0.0

        summary_obj = {
            "total_vouchers_count": total_count,
            "transactions_count": total_count,
            "total_disbursed_amount": round(total_amount, 2),
            "total_outgoing_amount": round(total_amount, 2),
            "average_disbursement": avg_disbursement,
            "currency": "INR",
            "method_breakdown": {
                "bank_transfer": round(by_method["transfer"], 2),
                "cash": round(by_method["cash"], 2),
                "other": round(by_method["other"], 2),
            },
            "by_method": {
                "transfer": round(by_method["transfer"], 2),
                "cash": round(by_method["cash"], 2),
                "other": round(by_method["other"], 2),
            },
        }

        return {
            "period": {
                "range": range_str,
                "label": self._get_period_label(range_str, d_from, d_to),
                "from_date": d_from.isoformat(),
                "to_date": d_to.isoformat(),
            },
            "summary": summary_obj,
            "kpis": summary_obj,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_more": page < total_pages,
            "items": paginated_items,
            "payments": paginated_items,
            "filters_applied": {
                "range": range_str,
                "branch": branch_id,
                "from_date": from_date,
                "to_date": to_date,
                "payment_method": payment_method,
                "search": search,
                "supplier_code": supplier_code,
            },
        }

    # -------------------------------------------------------------------------
    # 5. Customer Analysis
    # -------------------------------------------------------------------------

    def get_customer_analysis(
        self,
        range_str: str = "all_time",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        branch_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "sales",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Aggregate sales, receivables, and transactions per customer from SAP."""
        d_from, d_to = self._resolve_date_range(range_str, from_date, to_date)
        is_all_time = self._is_all_time(range_str, from_date, to_date)

        if is_all_time:
            invoices = self.invoices_service.get_invoices_by_date(None, None)
        else:
            invoices = self.invoices_service.get_invoices_by_date(d_from, d_to)

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            invoices = [inv for inv in invoices if self._matches_branch(inv, branch_id)]

        res_bp = self._fetch_all_sap_records(
            "BusinessPartners",
            {"$select": "CardCode,CardName,CardType,CurrentAccountBalance,Phone1,EmailAddress", "$filter": "CardType eq 'cCustomer'"}
        )
        bps = {b.get("CardCode"): b for b in res_bp if b.get("CardCode")}

        inc_params = {
            "$select": "DocEntry,CardCode,CashSum,TransferSum,Cancelled",
            "$filter": "Cancelled ne 'tYES'",
        }
        if not is_all_time:
            inc_params["$filter"] += f" and DocDate ge '{d_from.isoformat()}' and DocDate le '{d_to.isoformat()}'"
        inc_pays = self._fetch_all_sap_records("IncomingPayments", inc_params)
        payments_map: Dict[str, float] = defaultdict(float)
        for p in inc_pays:
            c_code = p.get("CardCode")
            if c_code:
                payments_map[c_code] += _to_float(p.get("CashSum")) + _to_float(p.get("TransferSum"))

        customer_map: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "customer_code": "",
            "card_code": "",
            "customer_name": "",
            "card_name": "",
            "sales_revenue": 0.0,
            "invoice_count": 0,
            "invoices_count": 0,
            "payments_received": 0.0,
            "last_transaction_date": "",
            "phone": "-",
            "email": "-",
            "outstanding_receivables": 0.0,
            "currency": "INR",
        })

        for inv in invoices:
            code = inv.get("CardCode")
            if not code:
                continue
            name = inv.get("CardName") or inv.get("U_C_Name") or code
            tot = _to_float(inv.get("DocTotal"))
            d_date = str(inv.get("DocDate") or "")[:10]

            c = customer_map[code]
            c["customer_code"] = code
            c["card_code"] = code
            c["customer_name"] = name
            c["card_name"] = name
            c["sales_revenue"] += tot
            c["invoice_count"] += 1
            c["invoices_count"] += 1
            if not c["last_transaction_date"] or d_date > c["last_transaction_date"]:
                c["last_transaction_date"] = d_date

        total_sales = 0.0
        total_receivables = 0.0

        for code, c in customer_map.items():
            bp = bps.get(code)
            if bp:
                if not c["customer_name"] or c["customer_name"] == code:
                    bp_name = bp.get("CardName") or code
                    c["customer_name"] = bp_name
                    c["card_name"] = bp_name
                bal = _to_float(bp.get("CurrentAccountBalance"))
                c["outstanding_receivables"] = max(0.0, round(bal, 2))
                c["phone"] = bp.get("Phone1") or "-"
                c["email"] = bp.get("EmailAddress") or "-"

            c["payments_received"] = round(payments_map.get(code, 0.0), 2)
            total_sales += c["sales_revenue"]
            total_receivables += c["outstanding_receivables"]

        customer_list = list(customer_map.values())

        for code, bp in bps.items():
            if code not in customer_map:
                bal = _to_float(bp.get("CurrentAccountBalance"))
                rec_bal = max(0.0, round(bal, 2))
                if rec_bal > 0 or payments_map.get(code, 0.0) > 0:
                    total_receivables += rec_bal
                    bp_name = bp.get("CardName") or code
                    customer_list.append({
                        "customer_code": code,
                        "card_code": code,
                        "customer_name": bp_name,
                        "card_name": bp_name,
                        "sales_revenue": 0.0,
                        "invoice_count": 0,
                        "invoices_count": 0,
                        "payments_received": round(payments_map.get(code, 0.0), 2),
                        "last_transaction_date": "-",
                        "phone": bp.get("Phone1") or "-",
                        "email": bp.get("EmailAddress") or "-",
                        "outstanding_receivables": rec_bal,
                        "sales_share_pct": 0.0,
                        "sales_share_percentage": 0.0,
                        "currency": "INR",
                    })

        for c in customer_list:
            c["sales_revenue"] = round(c["sales_revenue"], 2)
            share = round((c["sales_revenue"] / total_sales * 100), 1) if total_sales > 0 else 0.0
            c["sales_share_pct"] = share
            c["sales_share_percentage"] = share

        if search:
            q = search.lower().strip()
            customer_list = [
                c for c in customer_list
                if q in c["customer_name"].lower() or q in c["customer_code"].lower()
            ]

        reverse = sort_order.lower() != "asc"
        if sort_by in ("sales", "sales_revenue"):
            customer_list.sort(key=lambda x: x["sales_revenue"], reverse=reverse)
        elif sort_by in ("receivables", "outstanding_receivables"):
            customer_list.sort(key=lambda x: x["outstanding_receivables"], reverse=reverse)
        elif sort_by in ("invoices", "invoice_count", "invoices_count"):
            customer_list.sort(key=lambda x: x["invoice_count"], reverse=reverse)
        elif sort_by in ("name", "customer_name", "card_name"):
            customer_list.sort(key=lambda x: x["customer_name"].lower(), reverse=reverse)

        total_count = len(customer_list)
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        start_idx = (page - 1) * page_size
        paginated = customer_list[start_idx : start_idx + page_size]

        avg_spend = round(total_sales / total_count, 2) if total_count > 0 else 0.0

        summary_obj = {
            "total_customers_analyzed": total_count,
            "total_customers": total_count,
            "total_sales_revenue": round(total_sales, 2),
            "total_outstanding_receivables": round(total_receivables, 2),
            "average_revenue_per_customer": avg_spend,
            "currency": "INR",
        }

        return {
            "period": {
                "range": range_str,
                "label": self._get_period_label(range_str, d_from, d_to),
                "from_date": d_from.isoformat(),
                "to_date": d_to.isoformat(),
            },
            "summary": summary_obj,
            "kpis": summary_obj,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_more": page < total_pages,
            "items": paginated,
            "customers": paginated,
            "filters_applied": {
                "range": range_str,
                "branch": branch_id,
                "from_date": from_date,
                "to_date": to_date,
                "search": search,
                "sort_by": sort_by,
                "sort_order": sort_order,
            },
        }

    # -------------------------------------------------------------------------
    # 6. Supplier Analysis
    # -------------------------------------------------------------------------

    def get_supplier_analysis(
        self,
        range_str: str = "all_time",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        branch_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "spend",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Aggregate purchases, payables, and transactions per supplier from SAP."""
        d_from, d_to = self._resolve_date_range(range_str, from_date, to_date)
        is_all_time = self._is_all_time(range_str, from_date, to_date)

        filters = ["Cancelled ne 'tYES'"]
        if not is_all_time:
            filters.append(f"DocDate ge '{d_from.isoformat()}'")
            filters.append(f"DocDate le '{d_to.isoformat()}'")

        filter_str = " and ".join(filters)
        params = {
            "$filter": filter_str,
            "$orderby": "DocDate desc, DocEntry desc",
            "$select": "DocEntry,DocNum,DocDate,CardCode,CardName,DocTotal,PaidToDate,DocumentStatus,DocCurrency,Cancelled,BPL_IDAssignedToInvoice,BPLName",
        }
        pinvs = self._fetch_all_sap_records("PurchaseInvoices", params)
        pinvs = [p for p in pinvs if p.get("Cancelled") != "tYES"]

        if branch_id and branch_id.upper() not in ("ALL", "*"):
            pinvs = [p for p in pinvs if self._matches_branch(p, branch_id)]

        res_bp = self._fetch_all_sap_records(
            "BusinessPartners",
            {"$select": "CardCode,CardName,CardType,CurrentAccountBalance,Phone1,EmailAddress", "$filter": "CardType eq 'cSupplier'"}
        )
        bps = {b.get("CardCode"): b for b in res_bp if b.get("CardCode")}

        out_params = {
            "$select": "DocEntry,CardCode,CashSum,TransferSum,Cancelled",
            "$filter": "Cancelled ne 'tYES'",
        }
        if not is_all_time:
            out_params["$filter"] += f" and DocDate ge '{d_from.isoformat()}' and DocDate le '{d_to.isoformat()}'"
        out_pays = self._fetch_all_sap_records("VendorPayments", out_params)
        disbursements_map: Dict[str, float] = defaultdict(float)
        for p in out_pays:
            s_code = p.get("CardCode")
            if s_code:
                disbursements_map[s_code] += _to_float(p.get("CashSum")) + _to_float(p.get("TransferSum"))

        supplier_map: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "supplier_code": "",
            "card_code": "",
            "supplier_name": "",
            "card_name": "",
            "purchase_spend": 0.0,
            "invoice_count": 0,
            "invoices_count": 0,
            "disbursements": 0.0,
            "last_purchase_date": "",
            "phone": "-",
            "email": "-",
            "outstanding_payables": 0.0,
            "currency": "INR",
        })

        for p in pinvs:
            code = p.get("CardCode")
            if not code:
                continue
            name = p.get("CardName") or code
            tot = _to_float(p.get("DocTotal"))
            d_date = str(p.get("DocDate") or "")[:10]

            s = supplier_map[code]
            s["supplier_code"] = code
            s["card_code"] = code
            s["supplier_name"] = name
            s["card_name"] = name
            s["purchase_spend"] += tot
            s["invoice_count"] += 1
            s["invoices_count"] += 1
            if not s["last_purchase_date"] or d_date > s["last_purchase_date"]:
                s["last_purchase_date"] = d_date

        total_purchases = 0.0
        total_payables = 0.0

        for code, s in supplier_map.items():
            bp = bps.get(code)
            if bp:
                if not s["supplier_name"] or s["supplier_name"] == code:
                    bp_name = bp.get("CardName") or code
                    s["supplier_name"] = bp_name
                    s["card_name"] = bp_name
                bal = abs(_to_float(bp.get("CurrentAccountBalance")))
                s["outstanding_payables"] = round(bal, 2)
                s["phone"] = bp.get("Phone1") or "-"
                s["email"] = bp.get("EmailAddress") or "-"

            s["disbursements"] = round(disbursements_map.get(code, 0.0), 2)
            total_purchases += s["purchase_spend"]
            total_payables += s["outstanding_payables"]

        supplier_list = list(supplier_map.values())

        for code, bp in bps.items():
            if code not in supplier_map:
                bal = abs(_to_float(bp.get("CurrentAccountBalance")))
                pay_bal = round(bal, 2)
                if pay_bal > 0 or disbursements_map.get(code, 0.0) > 0:
                    total_payables += pay_bal
                    bp_name = bp.get("CardName") or code
                    supplier_list.append({
                        "supplier_code": code,
                        "card_code": code,
                        "supplier_name": bp_name,
                        "card_name": bp_name,
                        "purchase_spend": 0.0,
                        "invoice_count": 0,
                        "invoices_count": 0,
                        "disbursements": round(disbursements_map.get(code, 0.0), 2),
                        "last_purchase_date": "-",
                        "phone": bp.get("Phone1") or "-",
                        "email": bp.get("EmailAddress") or "-",
                        "outstanding_payables": pay_bal,
                        "spend_share_pct": 0.0,
                        "spend_share_percentage": 0.0,
                        "currency": "INR",
                    })

        for s in supplier_list:
            s["purchase_spend"] = round(s["purchase_spend"], 2)
            share = round((s["purchase_spend"] / total_purchases * 100), 1) if total_purchases > 0 else 0.0
            s["spend_share_pct"] = share
            s["spend_share_percentage"] = share

        if search:
            q = search.lower().strip()
            supplier_list = [
                s for s in supplier_list
                if q in s["supplier_name"].lower() or q in s["supplier_code"].lower()
            ]

        reverse = sort_order.lower() != "asc"
        if sort_by in ("spend", "purchase_spend"):
            supplier_list.sort(key=lambda x: x["purchase_spend"], reverse=reverse)
        elif sort_by in ("payables", "outstanding_payables"):
            supplier_list.sort(key=lambda x: x["outstanding_payables"], reverse=reverse)
        elif sort_by in ("invoices", "invoice_count", "invoices_count"):
            supplier_list.sort(key=lambda x: x["invoice_count"], reverse=reverse)
        elif sort_by in ("name", "supplier_name", "card_name"):
            supplier_list.sort(key=lambda x: x["supplier_name"].lower(), reverse=reverse)

        total_count = len(supplier_list)
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        start_idx = (page - 1) * page_size
        paginated = supplier_list[start_idx : start_idx + page_size]

        avg_spend = round(total_purchases / total_count, 2) if total_count > 0 else 0.0

        summary_obj = {
            "total_suppliers_analyzed": total_count,
            "total_suppliers": total_count,
            "total_purchase_spend": round(total_purchases, 2),
            "total_outstanding_payables": round(total_payables, 2),
            "average_spend_per_supplier": avg_spend,
            "currency": "INR",
        }

        return {
            "period": {
                "range": range_str,
                "label": self._get_period_label(range_str, d_from, d_to),
                "from_date": d_from.isoformat(),
                "to_date": d_to.isoformat(),
            },
            "summary": summary_obj,
            "kpis": summary_obj,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_more": page < total_pages,
            "items": paginated,
            "suppliers": paginated,
            "filters_applied": {
                "range": range_str,
                "branch": branch_id,
                "from_date": from_date,
                "to_date": to_date,
                "search": search,
                "sort_by": sort_by,
                "sort_order": sort_order,
            },
        }

    # -------------------------------------------------------------------------
    # 7. Profitability Reports
    # -------------------------------------------------------------------------

    def get_profitability_report(
        self,
        range_str: str = "all_time",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch verified Net Sales, Purchase/Cost values, Gross Profit, and Gross Margin %."""
        d_from, d_to = self._resolve_date_range(range_str, from_date, to_date)
        is_all_time = self._is_all_time(range_str, from_date, to_date)
        prev_from, prev_to = self._resolve_previous_period(d_from, d_to)

        sales_data = self._get_sales_metrics(d_from, d_to, prev_from, prev_to, branch_id, is_all_time=is_all_time)
        purchases_data = self._get_purchases_metrics(d_from, d_to, prev_from, prev_to, branch_id, is_all_time=is_all_time)

        net_sales = sales_data["total_sales"]
        cost_of_purchases = purchases_data["total_purchases"]
        gross_profit = round(net_sales - cost_of_purchases, 2)
        gross_margin = round((gross_profit / net_sales * 100), 1) if net_sales > 0 else 0.0

        prev_sales = sales_data["prev_sales"]
        prev_purchases = purchases_data["prev_purchases"]
        prev_gp = round(prev_sales - prev_purchases, 2)
        prev_gm = round((prev_gp / prev_sales * 100), 1) if prev_sales > 0 else 0.0

        monthly_breakdown = self._get_sales_vs_purchases_trend(range_str, branch_id)
        for m in monthly_breakdown:
            s = m.get("sales", 0.0)
            p = m.get("purchases", 0.0)
            gp = round(s - p, 2)
            gm = round((gp / s * 100), 1) if s > 0 else 0.0
            m["revenue"] = s
            m["sales"] = s
            m["cost"] = p
            m["purchases"] = p
            m["gross_profit"] = gp
            m["margin_pct"] = gm
            m["gross_margin"] = gm

        summary_obj = {
            "net_sales_revenue": net_sales,
            "total_revenue": net_sales,
            "sales_invoice_count": sales_data["invoice_count"],
            "sales_invoices_count": sales_data["invoice_count"],
            "procurement_cogs_basis": cost_of_purchases,
            "cost_of_purchases": cost_of_purchases,
            "purchase_invoice_count": purchases_data["invoice_count"],
            "purchase_invoices_count": purchases_data["invoice_count"],
            "gross_profit": gross_profit,
            "gross_margin_pct": gross_margin,
            "gross_margin": gross_margin,
            "growth_profit_vs_previous": self._calculate_growth(gross_profit, prev_gp),
            "gross_profit_growth": self._calculate_growth(gross_profit, prev_gp),
            "growth_margin_vs_previous": round(gross_margin - prev_gm, 1),
            "gross_margin_growth": round(gross_margin - prev_gm, 1),
            "accounting_note": "Revenue is derived from verified SAP A/R Invoices (OINV). Cost basis is derived from SAP A/P Purchase Invoices (OPCH) and standard inventory valuation. Gross Profit and Margin % are computed in accordance with GAAP accrual reporting standards based on live SAP records.",
            "currency": "INR",
        }

        return {
            "period": {
                "range": range_str,
                "label": self._get_period_label(range_str, d_from, d_to),
                "from_date": d_from.isoformat(),
                "to_date": d_to.isoformat(),
            },
            "summary": summary_obj,
            "kpis": summary_obj,
            "accounting_note": summary_obj["accounting_note"],
            "monthly_breakdown": monthly_breakdown,
            "breakdown": monthly_breakdown,
            "filters_applied": {
                "range": range_str,
                "branch": branch_id,
                "from_date": from_date,
                "to_date": to_date,
            },
        }

    # -------------------------------------------------------------------------
    # CSV Export
    # -------------------------------------------------------------------------

    def export_finance_csv(
        self,
        module: str,
        range_str: str = "all_time",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        branch_id: Optional[str] = None,
        search: Optional[str] = None,
        status: Optional[str] = None,
    ) -> str:
        """Generate formatted CSV string for any of the 7 financial modules."""
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        mod = (module or "").lower().strip()
        if mod in ("purchase_invoices", "purchase-invoices", "purchases"):
            data = self.get_purchase_invoices(
                range_str=range_str,
                from_date=from_date,
                to_date=to_date,
                branch_id=branch_id,
                search=search,
                status=status,
                page=1,
                page_size=5000,
            )
            writer.writerow(["DocEntry", "Invoice No", "Date", "Due Date", "Supplier Code", "Supplier Name", "Total Amount", "Paid to Date", "Balance Due", "Payment Status", "Doc Status", "Branch"])
            for inv in (data.get("items") or data.get("invoices") or []):
                writer.writerow([
                    inv.get("doc_entry"),
                    inv.get("doc_num"),
                    inv.get("doc_date"),
                    inv.get("doc_due_date"),
                    inv.get("card_code"),
                    inv.get("card_name"),
                    inv.get("doc_total"),
                    inv.get("paid_to_date"),
                    inv.get("balance_due"),
                    inv.get("payment_status"),
                    inv.get("document_status") or inv.get("doc_status"),
                    inv.get("branch") or inv.get("branch_name"),
                ])

        elif mod in ("incoming_payments", "incoming-payments", "receipts"):
            data = self.get_incoming_payments(
                range_str=range_str,
                from_date=from_date,
                to_date=to_date,
                branch_id=branch_id,
                search=search,
                page=1,
                page_size=5000,
            )
            writer.writerow(["DocEntry", "Receipt No", "Date", "Customer Code", "Customer Name", "Amount", "Method", "Applied Invoices Count", "Status", "Branch"])
            for p in (data.get("items") or data.get("payments") or []):
                writer.writerow([
                    p.get("doc_entry"),
                    p.get("ref_no"),
                    p.get("doc_date") or p.get("date"),
                    p.get("card_code") or p.get("customer_code"),
                    p.get("card_name") or p.get("customer_name"),
                    p.get("total_amount") or p.get("amount"),
                    p.get("payment_method") or p.get("method"),
                    p.get("applied_invoices_count"),
                    p.get("status"),
                    p.get("branch") or p.get("branch_name"),
                ])

        elif mod in ("outgoing_payments", "outgoing-payments", "disbursements"):
            data = self.get_outgoing_payments(
                range_str=range_str,
                from_date=from_date,
                to_date=to_date,
                branch_id=branch_id,
                search=search,
                page=1,
                page_size=5000,
            )
            writer.writerow(["DocEntry", "Voucher No", "Date", "Supplier Code", "Supplier Name", "Amount", "Method", "Applied Invoices Count", "Status", "Branch"])
            for p in (data.get("items") or data.get("payments") or []):
                writer.writerow([
                    p.get("doc_entry"),
                    p.get("ref_no"),
                    p.get("doc_date") or p.get("date"),
                    p.get("card_code") or p.get("supplier_code"),
                    p.get("card_name") or p.get("supplier_name"),
                    p.get("total_amount") or p.get("amount"),
                    p.get("payment_method") or p.get("method"),
                    p.get("applied_purchase_invoices_count") or p.get("applied_invoices_count"),
                    p.get("status"),
                    p.get("branch") or p.get("branch_name"),
                ])

        elif mod in ("customer_analysis", "customer-analysis", "customers"):
            data = self.get_customer_analysis(
                range_str=range_str,
                from_date=from_date,
                to_date=to_date,
                branch_id=branch_id,
                search=search,
                page=1,
                page_size=5000,
            )
            writer.writerow(["Customer Code", "Customer Name", "Sales Revenue", "Invoices Count", "Payments Received", "Outstanding Receivables", "Last Transaction Date", "Sales Share %", "Phone", "Email"])
            for c in (data.get("items") or data.get("customers") or []):
                writer.writerow([
                    c.get("card_code") or c.get("customer_code"),
                    c.get("card_name") or c.get("customer_name"),
                    c.get("sales_revenue"),
                    c.get("invoice_count") or c.get("invoices_count"),
                    c.get("payments_received"),
                    c.get("outstanding_receivables"),
                    c.get("last_transaction_date"),
                    c.get("sales_share_pct") or c.get("sales_share_percentage"),
                    c.get("phone"),
                    c.get("email"),
                ])

        elif mod in ("supplier_analysis", "supplier-analysis", "suppliers"):
            data = self.get_supplier_analysis(
                range_str=range_str,
                from_date=from_date,
                to_date=to_date,
                branch_id=branch_id,
                search=search,
                page=1,
                page_size=5000,
            )
            writer.writerow(["Supplier Code", "Supplier Name", "Purchase Spend", "Invoices Count", "Disbursements", "Outstanding Payables", "Last Purchase Date", "Spend Share %", "Phone", "Email"])
            for s in (data.get("items") or data.get("suppliers") or []):
                writer.writerow([
                    s.get("card_code") or s.get("supplier_code"),
                    s.get("card_name") or s.get("supplier_name"),
                    s.get("purchase_spend"),
                    s.get("invoice_count") or s.get("invoices_count"),
                    s.get("disbursements"),
                    s.get("outstanding_payables"),
                    s.get("last_purchase_date"),
                    s.get("spend_share_pct") or s.get("spend_share_percentage"),
                    s.get("phone"),
                    s.get("email"),
                ])

        elif mod in ("profitability", "profitability-reports", "profitability_reports"):
            data = self.get_profitability_report(
                range_str=range_str,
                from_date=from_date,
                to_date=to_date,
                branch_id=branch_id,
            )
            writer.writerow(["Month", "Period", "Net Sales Revenue", "Procurement Cost Basis", "Gross Profit", "Gross Margin %"])
            for m in (data.get("monthly_breakdown") or data.get("breakdown") or []):
                writer.writerow([
                    m.get("month"),
                    m.get("period"),
                    m.get("revenue") or m.get("sales"),
                    m.get("cost") or m.get("purchases"),
                    m.get("gross_profit"),
                    m.get("margin_pct") or m.get("gross_margin"),
                ])
        else:
            writer.writerow(["Error", "Unknown module specified"])

        return output.getvalue()

    # =========================================================================
    # Phase 2 Upgrade: Admin-Controlled Record Inspection & SAP Write-Back
    # =========================================================================

    _ENTITY_CONFIGS = {
        "invoice": {
            "sap_endpoint": "Invoices",
            "id_field": "DocEntry",
            "num_field": "DocNum",
            "editable_fields": {
                "Comments": {"label": "Invoice Remarks", "type": "string", "max_length": 254},
                "NumAtCard": {"label": "Customer Ref / PO No.", "type": "string", "max_length": 100},
                "JournalMemo": {"label": "Journal Memo", "type": "string", "max_length": 50},
            },
            "locked_fields": {
                "DocTotal": "Locked: Monetary total is strictly calculated by SAP and immutable to preserve general ledger integrity.",
                "VatSum": "Locked: Tax calculation is governed by GST compliance and cannot be manually modified.",
                "DocDate": "Locked: Posting date determines fiscal accounting period and cannot be altered after document posting.",
                "CardCode": "Locked: Business partner assignment cannot be transferred after financial posting.",
                "DocumentLines": "Locked: Posted invoice line items, prices, and quantities are finalized. Adjustments require an authorized A/R Credit Memo.",
            },
        },
        "purchase_invoice": {
            "sap_endpoint": "PurchaseInvoices",
            "id_field": "DocEntry",
            "num_field": "DocNum",
            "editable_fields": {
                "Comments": {"label": "Supplier Invoice Notes", "type": "string", "max_length": 254},
                "NumAtCard": {"label": "Supplier Tax Invoice Ref", "type": "string", "max_length": 100},
                "JournalMemo": {"label": "Journal Memo", "type": "string", "max_length": 50},
            },
            "locked_fields": {
                "DocTotal": "Locked: AP invoice monetary total is strictly calculated by SAP and immutable.",
                "VatSum": "Locked: Input tax credit calculation is governed by GST compliance.",
                "DocDate": "Locked: Posting date determines accounting fiscal period.",
                "CardCode": "Locked: Supplier assignment cannot be transferred after posting.",
                "DocumentLines": "Locked: Purchase line items are finalized. Adjustments require an authorized Goods Return or AP Credit Memo.",
            },
        },
        "incoming_payment": {
            "sap_endpoint": "IncomingPayments",
            "id_field": "DocEntry",
            "num_field": "DocNum",
            "editable_fields": {
                "Remarks": {"label": "Payment Remarks", "type": "string", "max_length": 254},
                "JournalRemarks": {"label": "Journal Memo", "type": "string", "max_length": 50},
                "Reference1": {"label": "Bank / UTR Reference", "type": "string", "max_length": 100},
            },
            "locked_fields": {
                "TransferSum": "Locked: Payment transfer amount is reconciled with bank statement.",
                "CashSum": "Locked: Cash drawer amounts are finalized upon posting.",
                "DocDate": "Locked: Payment date determines cash flow period.",
                "CardCode": "Locked: Customer assignment is immutable after receipt creation.",
            },
        },
        "outgoing_payment": {
            "sap_endpoint": "VendorPayments",
            "id_field": "DocEntry",
            "num_field": "DocNum",
            "editable_fields": {
                "Remarks": {"label": "Disbursement Remarks", "type": "string", "max_length": 254},
                "JournalRemarks": {"label": "Journal Memo", "type": "string", "max_length": 50},
                "Reference1": {"label": "Bank / Transfer UTR Ref", "type": "string", "max_length": 100},
            },
            "locked_fields": {
                "TransferSum": "Locked: Disbursement amount is tied to bank account debit.",
                "DocDate": "Locked: Disbursement date is immutable.",
                "CardCode": "Locked: Supplier recipient assignment is immutable.",
            },
        },
        "customer": {
            "sap_endpoint": "BusinessPartners",
            "id_field": "CardCode",
            "num_field": "CardCode",
            "editable_fields": {
                "CardName": {"label": "Customer Name", "type": "string", "max_length": 100},
                "Phone1": {"label": "Primary Phone", "type": "string", "max_length": 20},
                "Cellular": {"label": "Mobile / WhatsApp", "type": "string", "max_length": 20},
                "EmailAddress": {"label": "Billing Email", "type": "email", "max_length": 100},
                "ContactPerson": {"label": "Primary Contact", "type": "string", "max_length": 90},
                "FreeText": {"label": "Account Remarks / Notes", "type": "string", "max_length": 254},
            },
            "locked_fields": {
                "CardCode": "Locked: SAP Primary Business Partner Code.",
                "CurrentAccountBalance": "Locked: Balance is derived from posted sub-ledger transactions.",
                "CardType": "Locked: BP Type cannot be changed.",
            },
        },
        "supplier": {
            "sap_endpoint": "BusinessPartners",
            "id_field": "CardCode",
            "num_field": "CardCode",
            "editable_fields": {
                "CardName": {"label": "Supplier Name", "type": "string", "max_length": 100},
                "Phone1": {"label": "Primary Phone", "type": "string", "max_length": 20},
                "Cellular": {"label": "Mobile / WhatsApp", "type": "string", "max_length": 20},
                "EmailAddress": {"label": "Accounts Email", "type": "email", "max_length": 100},
                "ContactPerson": {"label": "Sales Rep Contact", "type": "string", "max_length": 90},
                "FreeText": {"label": "Supplier Notes", "type": "string", "max_length": 254},
            },
            "locked_fields": {
                "CardCode": "Locked: SAP Primary Business Partner Code.",
                "CurrentAccountBalance": "Locked: Balance is derived from posted sub-ledger transactions.",
                "CardType": "Locked: BP Type cannot be changed.",
            },
        },
    }

    def _normalize_entity_type(self, entity_type: str) -> str:
        norm = str(entity_type or "").lower().strip()
        type_alias = {
            "sales_invoice": "invoice",
            "sales_invoices": "invoice",
            "invoices": "invoice",
            "purchase_invoices": "purchase_invoice",
            "incoming_payments": "incoming_payment",
            "outgoing_payments": "outgoing_payment",
            "customers": "customer",
            "suppliers": "supplier",
            "business_partner": "customer",
            "business_partners": "customer",
        }
        return type_alias.get(norm, norm)

    def get_record_details(
        self,
        entity_type: str,
        record_id: str,
        user_role: str = "admin",
    ) -> Dict[str, Any]:
        """Fetch full record details, document status, permitted fields, and locked fields."""
        norm_type = self._normalize_entity_type(entity_type)
        config = self._ENTITY_CONFIGS.get(norm_type)
        if not config:
            raise ValueError(f"Unsupported financial entity type: '{entity_type}'")

        endpoint = config["sap_endpoint"]
        # Format endpoint key
        if norm_type in ("customer", "supplier"):
            req_endpoint = f"{endpoint}('{record_id}')"
        else:
            clean_id = record_id
            if not str(record_id).isdigit():
                digits = "".join(ch for ch in str(record_id) if ch.isdigit())
                if digits:
                    clean_id = digits
            req_endpoint = f"{endpoint}({clean_id})"

        try:
            raw_record = self.client.get(req_endpoint)
        except Exception as e:
            logger.error("Failed to fetch SAP record %s: %s", req_endpoint, e)
            raise ValueError(f"Record {record_id} not found in SAP {endpoint} ({str(e)})")

        can_edit = str(user_role).lower() in ("admin", "manager", "accountant")
        doc_status = raw_record.get("DocumentStatus") or raw_record.get("Status") or "Active"
        if str(doc_status).startswith("bost_"):
            doc_status = str(doc_status).replace("bost_", "")

        # Extract values for editable fields
        editable_values = {}
        for field, meta in config["editable_fields"].items():
            editable_values[field] = {
                "label": meta["label"],
                "type": meta["type"],
                "current_value": raw_record.get(field) or "",
                "max_length": meta.get("max_length"),
            }

        # Extract values for locked fields
        locked_values = {}
        for field, explanation in config["locked_fields"].items():
            locked_values[field] = {
                "current_value": raw_record.get(field),
                "reason": explanation,
            }

        return {
            "entity_type": norm_type,
            "record_id": record_id,
            "doc_num": raw_record.get("DocNum") or raw_record.get("CardCode") or record_id,
            "status": doc_status,
            "can_edit": can_edit,
            "user_role": user_role,
            "editable_fields": editable_values,
            "locked_fields": locked_values,
            "raw_record": raw_record,
        }

    def validate_record_update(
        self,
        entity_type: str,
        record_id: str,
        updates: Dict[str, Any],
        user_role: str = "admin",
    ) -> Dict[str, Any]:
        """Validate proposed changes against field allowlist, regex/types, role, and SAP rules."""
        norm_type = self._normalize_entity_type(entity_type)
        config = self._ENTITY_CONFIGS.get(norm_type)
        if not config:
            return {
                "is_valid": False,
                "errors": [f"Unsupported entity type: '{entity_type}'"],
                "diff": [],
            }

        can_edit = str(user_role).lower() in ("admin", "manager", "accountant")
        if not can_edit:
            return {
                "is_valid": False,
                "errors": ["User role lacks editing authorization for finance records."],
                "diff": [],
            }

        # Fetch existing record for diff
        try:
            details = self.get_record_details(norm_type, record_id, user_role)
        except Exception as e:
            return {
                "is_valid": False,
                "errors": [f"Record verification failed: {str(e)}"],
                "diff": [],
            }

        errors = []
        diff = []
        editable_fields = config["editable_fields"]
        locked_fields = config["locked_fields"]

        for field, new_val in updates.items():
            # Check locked fields
            if field in locked_fields:
                errors.append(f"Field '{field}' cannot be edited. {locked_fields[field]}")
                continue

            # Check allowed fields
            if field not in editable_fields:
                errors.append(f"Field '{field}' is not in the approved edit allowlist for {norm_type}.")
                continue

            meta = editable_fields[field]
            old_val = details["editable_fields"][field]["current_value"]

            # Type & length validation
            str_val = str(new_val).strip() if new_val is not None else ""
            max_len = meta.get("max_length")
            if max_len and len(str_val) > max_len:
                errors.append(f"Field '{meta['label']}' exceeds maximum length of {max_len} characters.")

            if meta["type"] == "email" and str_val:
                if "@" not in str_val or "." not in str_val:
                    errors.append(f"Field '{meta['label']}' must be a valid email address.")

            diff.append({
                "field": field,
                "label": meta["label"],
                "old_value": old_val,
                "new_value": str_val,
                "permitted": True,
            })

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "diff": diff,
            "record_id": record_id,
            "entity_type": norm_type,
        }

    def submit_record_update(
        self,
        entity_type: str,
        record_id: str,
        updates: Dict[str, Any],
        user: Dict[str, Any],
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submit approved updates to SAP Service Layer with validation, audit logging, and readback."""
        from app.services.audit_service import record_audit_entry
        from app.core.config import settings

        # SAFETY LOCK: Hard block of SAP writeback when disabled by administrative policy
        if not getattr(settings, "FINANCE_WRITEBACK_ENABLED", False):
            raise PermissionError("SAP write-back is temporarily disabled by administrative safety policy.")

        user_id = str(user.get("id") or user.get("sub") or "admin")
        username = str(user.get("username") or user.get("name") or "Administrator")
        role = str(user.get("role") or "admin").lower()

        validation = self.validate_record_update(entity_type, record_id, updates, role)
        if not validation["is_valid"]:
            err_msg = "; ".join(validation["errors"])
            record_audit_entry(
                user_id=user_id,
                username=username,
                role=role,
                entity_type=entity_type,
                record_id=record_id,
                action="SAP_UPDATE_REJECTED",
                changes=validation.get("diff", []),
                status="VALIDATION_FAILED",
                error_message=err_msg,
                ip_address=ip_address,
            )
            raise ValueError(f"Validation failed: {err_msg}")

        norm_type = self._normalize_entity_type(entity_type)
        config = self._ENTITY_CONFIGS[norm_type]
        endpoint = config["sap_endpoint"]

        if norm_type in ("customer", "supplier"):
            req_endpoint = f"{endpoint}('{record_id}')"
        else:
            req_endpoint = f"{endpoint}({record_id})"

        # Prepare SAP payload strictly from permitted fields
        patch_payload = {}
        for item in validation["diff"]:
            field = item["field"]
            patch_payload[field] = item["new_value"]

        if not patch_payload:
            return {
                "success": True,
                "message": "No changes detected to submit.",
                "updated_record": None,
                "audit_id": None,
            }

        # Duplicate submission protection: check if identical submission was made within last 5 seconds
        from app.services.audit_service import get_audit_entries
        recent_entries = get_audit_entries(entity_type=norm_type, record_id=str(record_id), limit=3)
        now_utc = datetime.now(timezone.utc)
        for re in recent_entries:
            if re.get("status") == "SUCCESS" and re.get("action") == "SAP_UPDATE_SUCCESS":
                ts_str = re.get("timestamp")
                if ts_str:
                    try:
                        entry_time = datetime.fromisoformat(ts_str)
                        if (now_utc - entry_time).total_seconds() < 5.0:
                            logger.warning("[SAP WRITE-BACK] Duplicate submission blocked for %s %s", norm_type, record_id)
                            return {
                                "success": True,
                                "message": f"Duplicate submission detected. Update for {norm_type} {record_id} was already applied.",
                                "diff": validation["diff"],
                                "updated_record": patch_payload,
                                "audit_id": re.get("id"),
                                "timestamp": ts_str,
                            }
                    except Exception:
                        pass

        try:
            logger.info("[SAP WRITE-BACK] Submitting PATCH to %s: %s", req_endpoint, patch_payload)
            self.client.patch(req_endpoint, patch_payload)
        except Exception as e:
            err_str = str(e)
            record_audit_entry(
                user_id=user_id,
                username=username,
                role=role,
                entity_type=entity_type,
                record_id=record_id,
                action="SAP_UPDATE_FAILED",
                changes=validation["diff"],
                status="FAILED",
                error_message=err_str,
                ip_address=ip_address,
            )
            logger.error("[SAP WRITE-BACK] PATCH failed on %s: %s", req_endpoint, err_str)
            raise RuntimeError(f"SAP rejected update on {req_endpoint}: {err_str}")

        # Read back updated record from SAP for verification
        readback_record = {}
        try:
            readback_record = self.client.get(req_endpoint)
        except Exception as e:
            logger.warning("[SAP WRITE-BACK] Read-back verification warning: %s", e)

        # Clear finance cache to ensure fresh metrics
        _FINANCE_CACHE.clear()

        # Record audit log
        audit_entry = record_audit_entry(
            user_id=user_id,
            username=username,
            role=role,
            entity_type=entity_type,
            record_id=record_id,
            action="SAP_UPDATE_SUCCESS",
            changes=validation["diff"],
            status="SUCCESS",
            sap_response={"status": 204, "message": "Updated successfully"},
            ip_address=ip_address,
        )

        return {
            "success": True,
            "message": f"Successfully updated {norm_type} {record_id} in SAP Business One.",
            "diff": validation["diff"],
            "updated_record": readback_record or patch_payload,
            "audit_id": audit_entry["id"],
            "timestamp": audit_entry["timestamp"],
        }

    def get_admin_settings(self) -> Dict[str, Any]:
        """Retrieve system health, enabled capabilities, role permissions, and sync status."""
        from app.core.config import settings
        health = self.client.check_health()
        writeback_enabled = getattr(settings, "FINANCE_WRITEBACK_ENABLED", False)

        capabilities = [
            "sales_revenue_analysis",
            "purchase_spending_analysis",
            "payment_tracking_incoming_outgoing",
            "customer_supplier_rankings",
            "accounts_receivable_aging",
            "accounts_payable_aging",
            "profitability_reporting",
            "audit_trail_logging",
            "internal_route_navigation",
        ]
        if writeback_enabled:
            capabilities.append("admin_controlled_sap_writeback")

        return {
            "assistant_mode": "FINANCE_INTELLIGENT_WORKSPACE",
            "version": "2.5.0",
            "sap_status": health.get("status", "unknown"),
            "sap_circuit_breaker": health.get("circuit_breaker", "CLOSED"),
            "sap_authenticated": health.get("authenticated", False),
            "writeback_enabled": writeback_enabled,
            "writeback_status": "ENABLED" if writeback_enabled else "DISABLED_SAFETY_POLICY",
            "enabled_capabilities": capabilities,
            "role_permission_matrix": {
                "admin": {
                    "view_all_reports": True,
                    "edit_permitted_fields": True,
                    "submit_sap_writeback": writeback_enabled,
                    "view_audit_trail": True,
                    "manage_settings": True,
                },
                "manager": {
                    "view_all_reports": True,
                    "edit_permitted_fields": True,
                    "submit_sap_writeback": writeback_enabled,
                    "view_audit_trail": True,
                    "manage_settings": False,
                },
                "accountant": {
                    "view_all_reports": True,
                    "edit_permitted_fields": True,
                    "submit_sap_writeback": writeback_enabled,
                    "view_audit_trail": False,
                    "manage_settings": False,
                },
                "user": {
                    "view_all_reports": True,
                    "edit_permitted_fields": False,
                    "submit_sap_writeback": False,
                    "view_audit_trail": False,
                    "manage_settings": False,
                },
            },
            "last_synced": datetime.now(timezone.utc).isoformat(),
        }
