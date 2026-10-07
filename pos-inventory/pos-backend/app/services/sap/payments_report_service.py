import os
"""SAP Payments Report Service"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Optional
from datetime import datetime, date
import time
import logging

from app.services.sap.client import get_sap_client
from app.core.config import settings

logger = logging.getLogger(__name__)

class SAPPaymentsReportService:
    def __init__(self):
        self.client = get_sap_client()
        self._executor = ThreadPoolExecutor(max_workers=min(32, (os.cpu_count() or 4) * 4))

    def _get_invoices_for_payments(self, payment_invoices: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
        if not payment_invoices:
            return {}
        
        doc_entries = [pi.get("DocEntry") for pi in payment_invoices if pi.get("DocEntry") is not None]
        if not doc_entries:
            return {}

        entries_str = ",".join(str(d) for d in doc_entries)
        try:
            res = self.client.get(
                "Invoices",
                {
                    "$filter": f"DocEntry eq {entries_str}" if len(doc_entries) == 1 else " or ".join([f"DocEntry eq {d}" for d in doc_entries]),
                    "$select": "DocEntry,DocNum"
                }
            )
            invoices = res.get("value", [])
            return {inv.get("DocEntry"): inv for inv in invoices if inv.get("DocEntry") is not None}
        except Exception as e:
            logger.error(f"Failed to fetch invoices for payments: {e}")
            return {}

    def get_payments_by_date(
        self,
        start_date: str,
        end_date: str,
        branch: Optional[str] = None,
        customer: Optional[str] = None,
        payment_method: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        try:
            filter_str = f"DocDate ge '{start_date}' and DocDate le '{end_date}'"
            
            if customer:
                c_low = customer.strip().lower()
                # Not standard SAP OData, but we try, else we filter in memory
                
            params = {
                "$filter": filter_str,
                "$orderby": "DocDate desc, DocEntry desc",
                "$select": "DocEntry,DocNum,DocDate,CardCode,CardName,CashSum,TransferSum,PaymentCreditCards,PaymentInvoices,BPLID,BPLName,Cancelled",
                "$top": 5000
            }
            
            response = self.client.get("IncomingPayments", params)
            payments = response.get("value", [])
            
            # Filter cancelled
            payments = [p for p in payments if p.get("Cancelled") != "tYES"]

            if branch:
                b_up = branch.strip().upper()
                payments = [p for p in payments if str(p.get("BPLName") or "").strip().upper() == b_up or str(p.get("BPLID") or "") == b_up]
                
            if customer:
                c_low = customer.strip().lower()
                payments = [p for p in payments if c_low in str(p.get("CardCode") or "").lower() or c_low in str(p.get("CardName") or "").lower()]

            # To get U_P_Method we need to fetch the linked invoices
            all_payment_invoices = []
            for p in payments:
                all_payment_invoices.extend(p.get("PaymentInvoices", []))
                
            # Batch fetch invoices
            # Just do it in small chunks if there are many
            invoices_map = {}
            if all_payment_invoices:
                chunk_size = 40
                for i in range(0, len(all_payment_invoices), chunk_size):
                    chunk = all_payment_invoices[i:i+chunk_size]
                    invoices_map.update(self._get_invoices_for_payments(chunk))

            for p in payments:
                p_invoices = p.get("PaymentInvoices", [])
                p_method = None
                doc_num = None
                
                if p_invoices:
                    inv_entry = p_invoices[0].get("DocEntry")
                    if inv_entry in invoices_map:
                        inv = invoices_map[inv_entry]
                        doc_num = inv.get("DocNum")
                        if "U_P_Method" in inv and inv.get("U_P_Method"):
                            p_method = str(inv.get("U_P_Method")).strip().lower()
                        
                p["_InvoiceDocNum"] = doc_num
                
                # Derive amount and infer payment method if missing
                cash = float(p.get("CashSum") or 0)
                trans = float(p.get("TransferSum") or 0)
                credit_cards = p.get("PaymentCreditCards", [])
                card_sum = sum(float(c.get("CreditSum") or 0) for c in credit_cards) if credit_cards else 0.0
                
                if not p_method:
                    if trans > 0:
                        p_method = "bank transfer"
                    elif card_sum > 0:
                        p_method = "card"
                    elif cash > 0:
                        p_method = "cash"
                    else:
                        p_method = "unknown"
                
                p["_PaymentMethod"] = p_method
                p["_TotalAmount"] = cash + trans + card_sum

            if payment_method:
                pm_low = payment_method.strip().lower()
                payments = [p for p in payments if p.get("_PaymentMethod") == pm_low]

            return payments

        except Exception as e:
            logger.error(f"Error fetching payments: {e}")
            return []
