"""SAP Invoices service - Sales document management"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, date, timedelta
import time
import logging
import re

from app.services.sap.client import get_sap_client
from app.services.sap.payments_service import SAPPaymentsService
from app.core.config import settings


logger = logging.getLogger(__name__)

# Default customer for cash/walk-in sales
DEFAULT_CUSTOMER_CODE = "C0001"
DEFAULT_CUSTOMER_NAME = "CASH"
DEFAULT_CUSTOMER_TYPE = "Customer"

# Shared caches to reduce SAP round-trips across requests.
_CACHE_TTL = timedelta(hours=max(1, int(getattr(settings, "SAP_LOOKUP_CACHE_HOURS", 6))))
_sales_tax_codes_cache: Optional[List[Dict[str, Any]]] = None
_sales_tax_codes_cached_at: Optional[datetime] = None
_company_location_cache: Optional[Tuple[Optional[str], Optional[str]]] = None
_company_location_cached_at: Optional[datetime] = None
_item_tax_code_cache: Dict[str, Tuple[Optional[str], datetime]] = {}
_customer_location_cache: Dict[str, Tuple[Tuple[Optional[str], Optional[str]], datetime]] = {}


def _cache_get_with_ttl(cache: Dict[str, Tuple[Any, datetime]], key: str) -> Optional[Any]:
    entry = cache.get(key)
    if entry is None:
        return None
    value, cached_at = entry
    if datetime.utcnow() - cached_at <= _CACHE_TTL:
        return value
    cache.pop(key, None)
    return None


def _cache_set_with_ttl(cache: Dict[str, Tuple[Any, datetime]], key: str, value: Any) -> None:
    cache[key] = (value, datetime.utcnow())


def _log_timing(label: str, started_at: float) -> None:
    elapsed_ms = (time.perf_counter() - started_at) * 1000.0
    logger.info(f"[SAP TIMING] {label} duration_ms={elapsed_ms:.2f}")


def _compute_discount_percent(sale_data: Dict[str, Any]) -> float:
    """
    Compute the header DiscountPercent for the SAP A/R Invoice.

    SAP treats GrossPrice as the PRE-TAX unit price and applies GST on top:

        DocTotal = GrossPrice_sum × (1 - DiscPct/100) × (1 + gstRate)

    We want DocTotal = effectiveTotal (what the customer pays, GST-inclusive,
    after all discounts including extraDiscount).

    Solving for DiscPct:

        DiscPct = (sap_full_amount - effectiveTotal) / sap_full_amount × 100

    where:
        sap_full_amount = subtotal × (1 + gstRate)   (full price with GST, no discount)

    gstRate is derived from gstPercentage if provided, otherwise back-calculated
    from the gst amount: gstRate = gst / (total - gst).
    """
    subtotal = float(sale_data.get("subtotal") or 0)
    if subtotal <= 0:
        return 0.0

    total = float(sale_data.get("total") or 0)
    gst_amount = float(sale_data.get("gst") or 0)

    # Derive gst_rate: prefer explicit gstPercentage, fallback to back-calculation.
    gst_pct = sale_data.get("gstPercentage")
    if gst_pct is not None:
        try:
            gst_rate = float(gst_pct) / 100.0
        except (TypeError, ValueError):
            gst_rate = None
    else:
        gst_rate = None

    if gst_rate is None:
        # Back-calculate: gst = total × gstRate / (1 + gstRate)  → gstRate = gst / (total - gst)
        taxable = total - gst_amount
        gst_rate = (gst_amount / taxable) if taxable > 0 else 0.0

    # Full amount SAP would charge with no discount (pre-tax × GST)
    sap_full_amount = subtotal * (1.0 + gst_rate)

    if sap_full_amount <= 0 or total >= sap_full_amount:
        return 0.0

    percent = (sap_full_amount - total) / sap_full_amount * 100

    # Keep value within SAP logical bounds.
    return round(max(0.0, min(100.0, percent)), 6)


class SAPInvoicesService:
    """Service for SAP AR Invoices (Sales Documents) operations"""
    
    def __init__(self):
        self.client = get_sap_client()
        self.payments_service = SAPPaymentsService()
        self.default_warehouse = settings.SAP_DEFAULT_WAREHOUSE
        self._sales_tax_codes_cache = None
        self._company_location_cache = None
        self._item_tax_code_cache = None
    
    def create_invoice(self, sale_data: Dict[str, Any], create_payment: bool = True) -> Dict[str, Any]:
        """
        Create AR Invoice in SAP with optional Incoming Payment.
        
        Flow:
        1. Always use default customer (CASH / C001)
        2. Create AR Invoice
        3. Optionally create Incoming Payment linked to the invoice
        
        Args:
            sale_data: Sale information including items, customer, total
            
        Returns:
            Created invoice with DocEntry, DocNum, and payment info
        """
        try:
            start_total = time.perf_counter()
            # ── Step 1: Always use default customer ─────────────────────────────
            card_code = DEFAULT_CUSTOMER_CODE
            card_name = DEFAULT_CUSTOMER_NAME
            customer_data: Dict[str, Any] = sale_data.get("customer") or {}

            # ── Step 2: Resolve GST context ─────────────────────────────────────
            interstate_sale = self._is_interstate_sale(card_code)

            # ── Step 3: Build document lines ─────────────────────────────────────
            document_lines = []
            for item in sale_data["items"]:
                product = item["product"]
                warehouse = product.get("warehouse") or self.default_warehouse

                line = {
                    "ItemCode": product["id"],  # id is ItemCode
                    "Quantity": item["quantity"],
                    # GrossPrice = VAT-inclusive price (MRP / selling price).
                    # SAP internally extracts the pre-tax base from GrossPrice,
                    # which means DocTotal = GrossPrice_sum × (1 - DiscountPercent/100)
                    # regardless of the item's actual tax rate.
                    "GrossPrice": product["price"],
                    "WarehouseCode": warehouse,
                }

                tax_code = self._resolve_line_tax_code(product, interstate_sale)
                if tax_code:
                    line["TaxCode"] = tax_code

                document_lines.append(line)

            # ── Step 4: Build invoice payload ─────────────────────────────────────
            today = date.today().strftime("%Y-%m-%d")

            payload: Dict[str, Any] = {
                "DocDate": today,
                "DocDueDate": today,
                "DocumentLines": document_lines,
                "CardCode": card_code,
                "CardName": card_name,
            }

            # Add discount if provided
            discount_percent = _compute_discount_percent(sale_data)
            if discount_percent > 0:
                payload["DiscountPercent"] = discount_percent

            # ── UDF fields on the A/R Invoice ───────────────────────────────────
            if customer_data:
                if customer_data.get("name"):
                    payload["U_C_Name"] = customer_data["name"]
                whatsapp = customer_data.get("whatsapp_number") or customer_data.get("phone")
                if whatsapp:
                    payload["U_W_Number"] = whatsapp
                if customer_data.get("email"):
                    payload["U_Email"] = customer_data["email"]
                if customer_data.get("sales_employee"):
                    payload["U_S_Employee"] = customer_data["sales_employee"]
                if customer_data.get("address"):
                    payload["U_Address"] = customer_data["address"]

            # ── Step 5: Payment info (for IncomingPayment, not for Invoice) ──────
            payment_methods = sale_data.get("paymentMethods", [])
            primary_payment_type = "cash"
            payment_amount = sale_data.get("total", 0)

            if payment_methods:
                primary_payment = payment_methods[0]
                primary_payment_type = primary_payment.get("type", "cash")
                payment_amount = primary_payment.get("amount", payment_amount)

            # Store sale payment method in invoice UDF.
            payload["U_P_Method"] = primary_payment_type or customer_data.get("payment_method") or "cash"

            # ── Step 6: Create invoice ────────────────────────────────────────────
            logger.info(
                f"[INVOICE CREATE] BEFORE -> CardCode={card_code}, CardName={card_name}, "
                f"lines={len(document_lines)}, discount={payload.get('DiscountPercent', 0)}, "
                f"U_C_Name={payload.get('U_C_Name')}, U_W_Number={payload.get('U_W_Number')}, "
                f"U_Email={payload.get('U_Email')}, U_P_Method={payload.get('U_P_Method')}, "
                f"U_S_Employee={payload.get('U_S_Employee')}"
            )
            start_invoice = time.perf_counter()
            result = self.client.post("Invoices", payload)
            _log_timing("Invoices POST", start_invoice)

            doc_entry = result.get("DocEntry")
            doc_num = result.get("DocNum")
            doc_total = result.get("DocTotal", payment_amount)

            logger.info(
                f"[INVOICE CREATE] AFTER  -> DocEntry={doc_entry}, DocNum={doc_num}, "
                f"DocTotal={doc_total}"
            )
            
            # Create incoming payment linked to the invoice (optional)
            payment_result = None
            if doc_entry is not None and create_payment:
                payment_result = self.create_payment_for_invoice(
                    card_code=card_code,
                    invoice_doc_entry=int(doc_entry),
                    amount=float(doc_total) if doc_total else payment_amount,
                    payment_type=primary_payment_type,
                )
            
            _log_timing("Create invoice total", start_total)
            return {
                "DocEntry": doc_entry,
                "DocNum": doc_num,
                "CardCode": card_code,
                "DocTotal": doc_total,
                "PaymentDocEntry": payment_result.get("DocEntry") if payment_result else None,
                "PaymentType": primary_payment_type,
                "PaymentAmount": float(doc_total) if doc_total else payment_amount,
            }
            
        except Exception as e:
            logger.error(f"Error creating invoice in SAP: {str(e)}")
            raise

    def _normalize_code(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        return str(value).strip().upper() or None

    def _extract_customer_location(
        self, customer: Optional[Dict[str, Any]]
    ) -> Tuple[Optional[str], Optional[str]]:
        if not customer:
            return None, None

        country = self._normalize_code(customer.get("Country"))
        state = self._normalize_code(customer.get("State1") or customer.get("State"))

        addresses = customer.get("BPAddresses") or []
        if addresses:
            ship_to = next(
                (a for a in addresses if a.get("AddressType") == "bo_ShipTo"),
                addresses[0],
            )
            country = country or self._normalize_code(ship_to.get("Country"))
            state = state or self._normalize_code(ship_to.get("State") or ship_to.get("County"))

        return country, state

    def _get_company_location(self) -> Tuple[Optional[str], Optional[str]]:
        global _company_location_cache, _company_location_cached_at

        if _company_location_cache is not None and _company_location_cached_at:
            if datetime.utcnow() - _company_location_cached_at <= _CACHE_TTL:
                return _company_location_cache

        try:
            start = time.perf_counter()
            admin_info = self.client.post("CompanyService_GetAdminInfo", {})
            _log_timing("CompanyService_GetAdminInfo POST", start)
            country = self._normalize_code(admin_info.get("Country"))
            state = self._normalize_code(admin_info.get("State"))
            _company_location_cache = (country, state)
            _company_location_cached_at = datetime.utcnow()
            return _company_location_cache
        except Exception as e:
            logger.warning(f"Could not resolve company location from SAP admin info: {e}")
            _company_location_cache = (None, None)
            _company_location_cached_at = datetime.utcnow()
            return _company_location_cache

    def _get_customer_location(self, card_code: str) -> Tuple[Optional[str], Optional[str]]:
        global _customer_location_cache
        cached = _cache_get_with_ttl(_customer_location_cache, card_code)
        if cached is not None:
            return cached
        try:
            start = time.perf_counter()
            customer = self.client.get(f"BusinessPartners('{card_code}')")
            _log_timing("BusinessPartners GET", start)
            location = self._extract_customer_location(customer)
            _cache_set_with_ttl(_customer_location_cache, card_code, location)
            return location
        except Exception as e:
            logger.warning(f"Could not resolve customer location for {card_code}: {e}")
            return None, None

    def _is_interstate_sale(self, card_code: str) -> bool:
        company_country, company_state = self._get_company_location()
        customer_country, customer_state = self._get_customer_location(card_code)

        if company_country and customer_country and company_country != customer_country:
            return True

        if company_state and customer_state:
            return company_state != customer_state

        # For India, when customer state is missing SAP often enforces IGST.
        if company_country == "IN" and not customer_state:
            return True

        return False

    def _get_sales_tax_codes(self) -> List[Dict[str, Any]]:
        global _sales_tax_codes_cache, _sales_tax_codes_cached_at

        if _sales_tax_codes_cache is not None and _sales_tax_codes_cached_at:
            if datetime.utcnow() - _sales_tax_codes_cached_at <= _CACHE_TTL:
                assert _sales_tax_codes_cache is not None
                return _sales_tax_codes_cache.copy()

        try:
            start = time.perf_counter()
            response = self.client.get("SalesTaxCodes")
            _log_timing("SalesTaxCodes GET", start)
            _sales_tax_codes_cache = response.get("value") or []
            _sales_tax_codes_cached_at = datetime.utcnow()
            assert _sales_tax_codes_cache is not None
            return _sales_tax_codes_cache.copy()
        except Exception as e:
            logger.warning(f"Could not fetch SalesTaxCodes from SAP: {e}")
            _sales_tax_codes_cache = []
            _sales_tax_codes_cached_at = datetime.utcnow()
            return []

    def _tax_type(self, code: Optional[str], name: Optional[str]) -> str:
        token = f"{code or ''} {name or ''}".upper()
        if "IGST" in token:
            return "IGST"
        if "CG+SG" in token or ("CGST" in token and "SGST" in token):
            return "CGSG"
        return "OTHER"

    def _parse_rate_from_code(self, code: Optional[str]) -> Optional[float]:
        if not code:
            return None
        match = re.search(r"(\d+(?:\.\d+)?)", code)
        if not match:
            return None
        try:
            return float(match.group(1))
        except (TypeError, ValueError):
            return None

    def _match_tax_code(
        self, codes: List[Dict[str, Any]], desired_type: str, preferred_rate: Optional[float]
    ) -> Optional[str]:
        candidates = [
            c for c in codes
            if c.get("ValidForAR") == "tYES"
            and c.get("Inactive") != "tYES"
            and self._tax_type(c.get("Code"), c.get("Name")) == desired_type
        ]
        if not candidates:
            return None

        if preferred_rate is not None:
            for c in candidates:
                rate = c.get("Rate")
                try:
                    if rate is not None and abs(float(rate) - float(preferred_rate)) < 0.001:
                        return c.get("Code")
                except (TypeError, ValueError):
                    continue

        # Prefer 5% as the default fallback when exact rate isn't available.
        for c in candidates:
            try:
                if abs(float(c.get("Rate") or 0.0) - 5.0) < 0.001:
                    return c.get("Code")
            except (TypeError, ValueError):
                continue

        return candidates[0].get("Code")

    def _get_item_base_tax_code(self, product: Dict[str, Any]) -> Optional[str]:
        for key in ("TaxCode", "taxCode", "SalesVATGroup", "salesVatGroup", "vatGroup"):
            if product.get(key):
                return str(product.get(key))

        item_code = str(product.get("id") or product.get("ItemCode") or "").strip()
        if not item_code:
            return None

        global _item_tax_code_cache
        cached = _cache_get_with_ttl(_item_tax_code_cache, item_code)
        if cached is not None:
            return cached

        try:
            start = time.perf_counter()
            item = self.client.get(f"Items('{item_code}')", {"$select": "SalesVATGroup"})
            _log_timing("Items GET", start)
            base_tax_code = item.get("SalesVATGroup")
            _cache_set_with_ttl(_item_tax_code_cache, item_code, base_tax_code)
            return base_tax_code
        except Exception as e:
            logger.warning(f"Could not resolve SalesVATGroup for item {item_code}: {e}")
            _cache_set_with_ttl(_item_tax_code_cache, item_code, None)
            return None

    def _resolve_line_tax_code(self, product: Dict[str, Any], interstate_sale: bool) -> Optional[str]:
        codes = self._get_sales_tax_codes()
        if not codes:
            return None

        desired_type = "IGST" if interstate_sale else "CGSG"
        base_code = self._get_item_base_tax_code(product)
        preferred_rate: Optional[float] = None

        if base_code:
            base_entry = next((c for c in codes if c.get("Code") == base_code), None)
            if base_entry:
                base_type = self._tax_type(base_entry.get("Code"), base_entry.get("Name"))
                if base_type == desired_type:
                    return base_code
                rate_value = base_entry.get("Rate")
                if rate_value is not None:
                    try:
                        preferred_rate = float(rate_value)
                    except (TypeError, ValueError):
                        preferred_rate = None
            else:
                preferred_rate = self._parse_rate_from_code(base_code)

        matched = self._match_tax_code(codes, desired_type, preferred_rate)
        if matched:
            return matched

        return base_code

    def get_allowed_gst_percentages(self) -> List[float]:
        """Return distinct GST percentages allowed by SAP SalesTaxCodes.
        5% is always included as it is a standard Indian GST slab.
        """
        codes = self._get_sales_tax_codes()
        if not codes:
            return [5.0]

        rates: set[float] = set()
        for code in codes:
            if code.get("ValidForAR") != "tYES" or code.get("Inactive") == "tYES":
                continue

            tax_type = self._tax_type(code.get("Code"), code.get("Name"))
            if tax_type not in ("IGST", "CGSG"):
                continue

            rate_value = code.get("Rate")
            try:
                rate = float(rate_value) if rate_value is not None else None
            except (TypeError, ValueError):
                rate = None
            if rate is None:
                rate = self._parse_rate_from_code(code.get("Code")) or 0.0

            if rate >= 0:
                rates.add(round(rate, 2))

        # Always guarantee 5% as a selectable slab regardless of SAP config.
        rates.add(5.0)

        if not rates:
            return [5.0]

        return sorted(rates)
    
    def _prepare_payment_data(
        self,
        card_code: str,
        invoice_doc_entry: int,
        amount: float,
        payment_type: str
    ) -> Dict[str, Any]:
        """
        Prepare payment data for incoming payment creation.
        
        Args:
            card_code: Customer CardCode
            invoice_doc_entry: Invoice DocEntry to link payment
            amount: Payment amount
            payment_type: Payment type (cash, card, upi, wallet)
            
        Returns:
            Payment data dictionary for SAPPaymentsService
        """
        payment_data = {
            "card_code": card_code,
            "invoice_doc_entry": invoice_doc_entry,
            "amount": amount,
            "cash_amount": 0.0,
            "card_amount": 0.0,
            "transfer_amount": 0.0,
        }

        # NOTE:
        # For now, Card/UPI/Wallet are treated as *payment method labels only*.
        # The method is stored on the A/R Invoice via UDF `U_P_Method`.
        # We intentionally do not map card/upi/wallet into different SAP IncomingPayments
        # fields (CreditCardSum / TransferSum). Instead, we post the full amount as cash.
        payment_data["cash_amount"] = amount

        # Previous implementation (kept for later, intentionally disabled):
        #
        # if payment_type == "cash":
        #     payment_data["cash_amount"] = amount
        # elif payment_type == "card":
        #     payment_data["card_amount"] = amount
        # elif payment_type in ("upi", "wallet"):
        #     payment_data["transfer_amount"] = amount
        # else:
        #     payment_data["cash_amount"] = amount
        
        return payment_data

    def create_payment_for_invoice(
        self,
        card_code: str,
        invoice_doc_entry: int,
        amount: float,
        payment_type: str,
    ) -> Optional[Dict[str, Any]]:
        payment_data = self._prepare_payment_data(
            card_code=card_code,
            invoice_doc_entry=invoice_doc_entry,
            amount=amount,
            payment_type=payment_type,
        )

        attempts = max(1, int(getattr(settings, "SAP_PAYMENT_RETRY_ATTEMPTS", 3)))
        delay = float(getattr(settings, "SAP_PAYMENT_RETRY_DELAY_SEC", 1.5))

        for attempt in range(1, attempts + 1):
            try:
                start_payment = time.perf_counter()
                payment_result = self.payments_service.create_incoming_payment(payment_data)
                _log_timing("IncomingPayments POST", start_payment)
                logger.info(
                    f"Created incoming payment: DocEntry={payment_result.get('DocEntry')}"
                )
                return payment_result
            except Exception as e:
                # Log but don't fail the sale - invoice was created successfully.
                if "series period does not match current period" in str(e).lower():
                    logger.warning(
                        f"Incoming payment skipped for invoice {invoice_doc_entry}: {e}"
                    )
                    return None

                logger.error(
                    f"Failed to create incoming payment for invoice {invoice_doc_entry} "
                    f"(attempt {attempt}/{attempts}): {e}"
                )
                if attempt < attempts:
                    time.sleep(delay)
                    delay = min(delay * 2.0, 10.0)

        return None
    
    def get_invoice(self, doc_entry: int) -> Optional[Dict[str, Any]]:
        """
        Get invoice by DocEntry
        
        Args:
            doc_entry: SAP Invoice DocEntry
            
        Returns:
            Invoice or None
        """
        try:
            endpoint = f"Invoices({doc_entry})"
            invoice = self.client.get(endpoint)
            return invoice
            
        except Exception as e:
            logger.error(f"Error fetching invoice {doc_entry}: {str(e)}")
            return None

    def get_invoice_by_doc_num(self, doc_num: int) -> Optional[Dict[str, Any]]:
        """Get invoice by DocNum, then hydrate by DocEntry if found."""
        try:
            params = {
                "$filter": f"DocNum eq {int(doc_num)}",
                "$select": "DocEntry",
                "$top": 1,
            }
            response = self.client.get("Invoices", params)
            rows = response.get("value", [])
            if not rows:
                return None
            doc_entry = rows[0].get("DocEntry")
            if doc_entry is None:
                return None
            return self.get_invoice(int(doc_entry))
        except Exception as e:
            logger.error(f"Error fetching invoice by DocNum {doc_num}: {str(e)}")
            return None
    
    def get_recent_invoices(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get the most recent AR Invoices regardless of date.

        Args:
            limit: Maximum number of invoices to return (default 100)

        Returns:
            List of invoices ordered by DocEntry desc (works across all series)
        """
        try:
            header_select = (
                "DocEntry,DocNum,DocDate,DocTotal,VatSum,TotalDiscount,CardCode,CardName,"
                "U_C_Name,U_W_Number,U_P_Method,U_S_Employee"
            )
            params = {
                "$orderby": "DocEntry desc",
                "$select": header_select,
                "$top": limit,
            }
            response = self.client.get("Invoices", params)
            return response.get("value", [])
        except Exception as e:
            logger.error(f"Error fetching recent invoices: {str(e)}")
            return []

    def get_recent_invoices_with_lines(
        self,
        limit: int = 100,
        max_line_rows: int = 5000,
        page_size: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Get recent invoices and hydrate DocumentLines using QueryService crossjoin."""
        headers = self.get_recent_invoices(limit=limit)
        if not headers:
            return headers

        doc_entries = [inv.get("DocEntry") for inv in headers if inv.get("DocEntry") is not None]
        line_rows = self._get_invoice_lines_by_doc_entries(
            doc_entries,
            max_rows=max_line_rows,
            page_size=page_size,
        )
        self._attach_lines_to_invoices(headers, line_rows)
        return headers

    def search_by_mobile(self, mobile_fragment: str, top: int = 10) -> List[Dict[str, Any]]:
        """Search invoices by U_W_Number fragment and return deduplicated customer list.

        Customers in this system are stored entirely as UDF fields on AR Invoices
        (U_C_Name = name, U_W_Number = mobile/WhatsApp). There are no individual
        SAP Business Partner records per customer.

        Args:
            mobile_fragment: Partial mobile number (4+ digits, digits-only fragment)
            top: Maximum distinct customers to return

        Returns:
            List of dicts with keys: name, mobile, email, salesEmployee, address, invoiceCount,
            latestDocNum, invoiceNums
        """
        fragment = re.sub(r"\D", "", mobile_fragment)
        if len(fragment) < 4:
            return []
        try:
            params = {
                "$top": 200,
                "$select": "DocNum,DocDate,U_C_Name,U_W_Number,U_Email,U_S_Employee,U_Address",
                "$filter": f"contains(U_W_Number, '{fragment}')",
                "$orderby": "DocDate desc",
            }
            response = self.client.get("Invoices", params)
            raw = response.get("value", [])

            def _clean(value: Any) -> Optional[str]:
                cleaned = str(value or "").strip()
                return cleaned or None

            seen: Dict[str, Dict[str, Any]] = {}
            for inv in raw:
                mobile = re.sub(r"\s+", "", str(inv.get("U_W_Number") or "")).strip()
                if not mobile:
                    continue
                name = str(inv.get("U_C_Name") or "").strip()
                email = _clean(inv.get("U_Email"))
                sales_employee = _clean(inv.get("U_S_Employee"))
                address = _clean(inv.get("U_Address"))
                doc_num = inv.get("DocNum")
                if mobile not in seen:
                    seen[mobile] = {
                        "name": name,
                        "mobile": mobile,
                        "email": email,
                        "salesEmployee": sales_employee,
                        "address": address,
                        "invoiceCount": 0,
                        "latestDocNum": doc_num,
                        "invoiceNums": [doc_num] if doc_num is not None else [],
                    }
                else:
                    if name and not seen[mobile]["name"]:
                        seen[mobile]["name"] = name
                    if email and not seen[mobile].get("email"):
                        seen[mobile]["email"] = email
                    if sales_employee and not seen[mobile].get("salesEmployee"):
                        seen[mobile]["salesEmployee"] = sales_employee
                    if address and not seen[mobile].get("address"):
                        seen[mobile]["address"] = address
                    # Invoices are ordered by DocDate desc, first seen = most recent
                    if seen[mobile]["latestDocNum"] is None:
                        seen[mobile]["latestDocNum"] = doc_num
                    if doc_num is not None and doc_num not in seen[mobile]["invoiceNums"]:
                        seen[mobile]["invoiceNums"].append(doc_num)
                seen[mobile]["invoiceCount"] += 1

            return list(seen.values())[:top]
        except Exception as exc:
            logger.error("Error searching invoices by mobile fragment %r: %s", fragment, exc)
            raise

    def get_invoices_by_date(
        self,
        start_date: date,
        end_date: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get invoices for a date range using header fields only.

        Paginates with $skip to handle ranges that exceed SAP's 100-row Prefer cap.
        """
        try:
            if not end_date:
                end_date = start_date

            start_str = start_date.strftime("%Y-%m-%d")
            end_str = end_date.strftime("%Y-%m-%d")

            filter_str = f"DocDate ge '{start_str}' and DocDate le '{end_str}'"
            page_size = 100
            all_invoices: List[Dict[str, Any]] = []
            skip = 0

            header_select = (
                "DocEntry,DocNum,DocDate,DocTotal,VatSum,TotalDiscount,CardCode,CardName,"
                "U_C_Name,U_W_Number,U_P_Method,U_S_Employee"
            )

            while True:
                params = {
                    "$filter": filter_str,
                    "$orderby": "DocDate desc, DocEntry desc",
                    "$select": header_select,
                    "$top": page_size,
                    "$skip": skip,
                }
                response = self.client.get("Invoices", params)
                page = response.get("value", [])
                if not page:
                    break
                all_invoices.extend(page)
                if len(page) < page_size:
                    break
                skip += page_size

            return all_invoices

        except Exception as e:
            logger.error(f"Error fetching invoices by date: {str(e)}")
            return []

    def get_invoices_by_date_with_lines(
        self,
        start_date: date,
        end_date: Optional[date] = None,
        max_line_rows: int = 20000,
        page_size: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Get invoices for a date range and hydrate DocumentLines via crossjoin."""
        headers = self.get_invoices_by_date(start_date, end_date)
        if not headers:
            return headers

        line_rows = self._get_invoice_lines_by_date(
            start_date,
            end_date or start_date,
            max_rows=max_line_rows,
            page_size=page_size,
        )
        self._attach_lines_to_invoices(headers, line_rows)
        return headers

    def _get_invoice_lines_by_date(
        self,
        start_date: date,
        end_date: date,
        max_rows: int = 20000,
        page_size: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Fetch invoice line rows via QueryService crossjoin for a date range."""
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")
        filter_str = (
            "Invoices/DocEntry eq Invoices/DocumentLines/DocEntry"
            f" and Invoices/DocDate ge '{start_str}'"
            f" and Invoices/DocDate le '{end_str}'"
        )
        return self._query_crossjoin_lines(filter_str, max_rows=max_rows, page_size=page_size)

    def _get_invoice_lines_by_doc_entries(
        self,
        doc_entries: List[Any],
        max_rows: int = 5000,
        page_size: int = 1000,
        chunk_size: int = 30,
    ) -> List[Dict[str, Any]]:
        """Fetch invoice line rows via crossjoin for a list of DocEntry values."""
        cleaned = [int(v) for v in doc_entries if v is not None]
        if not cleaned:
            return []

        rows: List[Dict[str, Any]] = []
        for i in range(0, len(cleaned), chunk_size):
            subset = cleaned[i:i + chunk_size]
            or_filter = " or ".join([f"Invoices/DocEntry eq {val}" for val in subset])
            filter_str = (
                "Invoices/DocEntry eq Invoices/DocumentLines/DocEntry"
                f" and ({or_filter})"
            )
            rows.extend(
                self._query_crossjoin_lines(
                    filter_str,
                    max_rows=max_rows - len(rows),
                    page_size=page_size,
                )
            )
            if len(rows) >= max_rows:
                break

        return rows[:max_rows]

    def _query_crossjoin_lines(
        self,
        filter_str: str,
        max_rows: int,
        page_size: int,
    ) -> List[Dict[str, Any]]:
        """QueryService crossjoin for invoice lines with paging."""
        if max_rows <= 0:
            return []

        rows: List[Dict[str, Any]] = []
        skip = 0

        expand = (
            "$expand=Invoices($select=DocEntry,DocNum,DocDate,DocTotal,VatSum,TotalDiscount,U_P_Method,U_S_Employee)"
            ",Invoices/DocumentLines($select=ItemCode,ItemDescription,Quantity,LineTotal,WarehouseCode,LineNum,UnitPrice)"
        )

        while len(rows) < max_rows:
            top = min(page_size, max_rows - len(rows))
            query_option = f"{expand}&$filter={filter_str}&$top={top}&$skip={skip}"
            payload = {
                "QueryPath": "$crossjoin(Invoices,Invoices/DocumentLines)",
                "QueryOption": query_option,
            }
            response = self.client.post("QueryService_PostQuery", payload)
            page = response.get("value", [])
            if not page:
                break
            rows.extend(page)
            if len(page) < top:
                break
            skip += top

        if len(rows) >= max_rows:
            logger.info("Crossjoin lines capped at %s rows", max_rows)
        return rows[:max_rows]

    def _attach_lines_to_invoices(
        self,
        invoices: List[Dict[str, Any]],
        line_rows: List[Dict[str, Any]],
    ) -> None:
        """Attach DocumentLines to invoice headers based on crossjoin rows."""
        if not invoices or not line_rows:
            return

        by_doc_entry: Dict[int, List[Dict[str, Any]]] = {}
        for row in line_rows:
            invoice, line = self._extract_crossjoin_row(row)
            if not invoice or not line:
                continue
            doc_entry = invoice.get("DocEntry")
            if doc_entry is None:
                continue
            try:
                doc_entry_int = int(doc_entry)
            except (TypeError, ValueError):
                continue
            by_doc_entry.setdefault(doc_entry_int, []).append(line)

        for inv in invoices:
            doc_entry = inv.get("DocEntry")
            if doc_entry is None:
                continue
            try:
                doc_entry_int = int(doc_entry)
            except (TypeError, ValueError):
                continue
            if inv.get("DocumentLines"):
                continue
            lines = by_doc_entry.get(doc_entry_int)
            if lines:
                inv["DocumentLines"] = lines

    def _extract_crossjoin_row(self, row: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """Extract invoice header and line from a QueryService crossjoin row."""
        invoice = row.get("Invoices")
        if invoice is None:
            for key, value in row.items():
                if key.endswith("Invoices") and isinstance(value, dict):
                    invoice = value
                    break

        line = row.get("Invoices/DocumentLines") or row.get("DocumentLines")
        if line is None:
            for key, value in row.items():
                if "DocumentLines" in key and isinstance(value, dict):
                    line = value
                    break

        return invoice, line
    
    def cancel_invoice(self, doc_entry: int) -> bool:
        """
        Cancel invoice (set Cancelled = 'Y')
        
        Args:
            doc_entry: SAP Invoice DocEntry
            
        Returns:
            True if successful
        """
        try:
            endpoint = f"Invoices({doc_entry})"
            payload = {"Cancelled": "tYES"}
            
            self.client.patch(endpoint, payload)
            logger.info(f"Cancelled invoice in SAP: {doc_entry}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error cancelling invoice {doc_entry}: {str(e)}")
            raise
