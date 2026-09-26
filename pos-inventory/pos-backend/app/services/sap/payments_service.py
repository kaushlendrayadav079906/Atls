"""SAP Payments service - Payment processing"""

from typing import Dict, Any, Optional
from datetime import date, datetime, timedelta
import time
import logging

from app.services.sap.client import get_sap_client, SAPValidationError
from app.core.config import settings


logger = logging.getLogger(__name__)

_SERIES_PERIOD_MISMATCH_TEXT = "series period does not match current period"
_SERIES_CACHE_TTL = timedelta(minutes=15)
_recent_series_cache: Optional[int] = None
_recent_series_cached_at: Optional[datetime] = None


class SAPPaymentsService:
    """Service for SAP Incoming Payments operations"""
    
    def __init__(self):
        self.client = get_sap_client()

    def _is_series_period_mismatch_error(self, error: Exception) -> bool:
        return _SERIES_PERIOD_MISMATCH_TEXT in str(error).lower()

    def _get_recent_payment_series(self) -> Optional[int]:
        """Resolve a fallback ORCT series from the latest successful incoming payment."""
        global _recent_series_cache, _recent_series_cached_at
        if _recent_series_cache is not None and _recent_series_cached_at:
            if datetime.utcnow() - _recent_series_cached_at <= _SERIES_CACHE_TTL:
                return _recent_series_cache
        try:
            start = time.perf_counter()
            response = self.client.get(
                "IncomingPayments",
                {
                    "$select": "Series,DocEntry",
                    "$orderby": "DocEntry desc",
                    "$top": 1,
                },
            )
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            logger.info(f"[SAP TIMING] IncomingPayments GET duration_ms={elapsed_ms:.2f}")
        except Exception as e:
            logger.warning(f"Could not resolve fallback incoming payment series: {e}")
            return None

        values = response.get("value") if isinstance(response, dict) else None
        if not values:
            return None

        series = values[0].get("Series")
        try:
            resolved = int(series) if series is not None else None
            _recent_series_cache = resolved
            _recent_series_cached_at = datetime.utcnow()
            return resolved
        except (TypeError, ValueError):
            return None
    
    def create_incoming_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create incoming payment in SAP
        
        Args:
            payment_data: Payment details (card_code, amount, doc_entry, etc.)
            
        Returns:
            Created payment with DocEntry
        """
        try:
            today = date.today().strftime("%Y-%m-%d")
            
            payload = {
                "CardCode": payment_data["card_code"],
                "DocDate": today,
            }

            if settings.SAP_INCOMING_PAYMENT_SERIES is not None:
                payload["Series"] = settings.SAP_INCOMING_PAYMENT_SERIES
            else:
                # Prefer last known working ORCT series to avoid SAP default-series period mismatches.
                recent_series = self._get_recent_payment_series()
                if recent_series is not None:
                    payload["Series"] = recent_series
            
            # Set payment amounts based on type
            cash_amount = payment_data.get("cash_amount", 0.0)
            # card_amount = payment_data.get("card_amount", 0.0)
            # transfer_amount = payment_data.get("transfer_amount", 0.0)
            
            if cash_amount > 0:
                payload["CashSum"] = cash_amount

            # NOTE:
            # Card/UPI/Wallet are currently tracked via invoice UDF only (`U_P_Method`).
            # We do not send method-specific IncomingPayments fields for now.
            #
            # if card_amount > 0:
            #     payload["CreditCardSum"] = card_amount
            # if transfer_amount > 0:
            #     payload["TransferSum"] = transfer_amount
            
            # Link to invoice if provided
            if payment_data.get("invoice_doc_entry"):
                payload["PaymentInvoices"] = [
                    {
                        "DocEntry": payment_data["invoice_doc_entry"],
                        "SumApplied": payment_data["amount"],
                    }
                ]

            try:
                start = time.perf_counter()
                result = self.client.post("IncomingPayments", payload)
                elapsed_ms = (time.perf_counter() - start) * 1000.0
                logger.info(f"[SAP TIMING] IncomingPayments POST duration_ms={elapsed_ms:.2f}")
            except SAPValidationError as e:
                if not self._is_series_period_mismatch_error(e):
                    raise

                current_series = payload.get("Series")
                fallback_series = self._get_recent_payment_series()
                if fallback_series is None or fallback_series == current_series:
                    logger.warning(
                        "Incoming payment series mismatch and no alternative fallback series could be resolved."
                    )
                    raise

                retry_payload = dict(payload)
                retry_payload["Series"] = fallback_series
                logger.warning(
                    "Incoming payment series mismatch. Retrying with fallback series=%s",
                    fallback_series,
                )
                start = time.perf_counter()
                result = self.client.post("IncomingPayments", retry_payload)
                elapsed_ms = (time.perf_counter() - start) * 1000.0
                logger.info(f"[SAP TIMING] IncomingPayments POST duration_ms={elapsed_ms:.2f}")
            
            doc_entry = result.get("DocEntry")
            logger.info(f"Created incoming payment in SAP: {doc_entry}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating payment in SAP: {str(e)}")
            raise
