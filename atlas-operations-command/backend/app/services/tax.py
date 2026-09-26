import logging
from typing import Optional
from uuid import UUID
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.tax import TaxCalculationResponse
from app.core.exceptions import (
    MissingTaxJurisdictionError,
    InapplicableTaxJurisdictionError,
    InvalidTaxRateError,
    InvalidTaxJurisdictionError,
    NotFoundException
)

logger = logging.getLogger(__name__)

MONEY_QUANTIZE = Decimal("0.01")
RATE_QUANTIZE = Decimal("0.01")

# Official 2-digit Indian GST State/UT Canonical Mapping
GST_STATE_MAP = {
    # 2-letter alpha to 2-digit numeric
    "JK": "01", "HP": "02", "PB": "03", "CH": "04", "UK": "05", "UA": "05",
    "HR": "06", "DL": "07", "RJ": "08", "UP": "09", "BR": "10", "SK": "11",
    "AR": "12", "NL": "13", "MN": "14", "MZ": "15", "TR": "16", "ML": "17",
    "AS": "18", "WB": "19", "JH": "20", "OR": "21", "OD": "21", "CG": "22",
    "CT": "22", "MP": "23", "GJ": "24", "DD": "26", "DN": "26", "MH": "27",
    "AP": "28", "KA": "29", "GA": "30", "LD": "31", "KL": "32", "TN": "33",
    "PY": "34", "AN": "35", "TS": "36", "TG": "36", "AD": "37", "LA": "38",
    # Direct numeric strings normalized to 2 digits
    "1": "01", "01": "01", "2": "02", "02": "02", "3": "03", "03": "03",
    "4": "04", "04": "04", "5": "05", "05": "05", "6": "06", "06": "06",
    "7": "07", "07": "07", "8": "08", "08": "08", "9": "09", "09": "09",
    "10": "10", "11": "11", "12": "12", "13": "13", "14": "14", "15": "15",
    "16": "16", "17": "17", "18": "18", "19": "19", "20": "20", "21": "21",
    "22": "22", "23": "23", "24": "24", "25": "25", "26": "26", "27": "27",
    "28": "28", "29": "29", "30": "30", "31": "31", "32": "32", "33": "33",
    "34": "34", "35": "35", "36": "36", "37": "37", "38": "38"
}


class TaxService:
    def __init__(self, db: Session):
        self.db = db

    def normalize_gst_state(self, state_input: Optional[str]) -> str:
        """
        Normalizes alpha/numeric Indian state inputs to canonical 2-digit Indian GST numeric codes.
        Raises InvalidTaxJurisdictionError if state code is unknown.
        """
        if not state_input:
            raise MissingTaxJurisdictionError("State code is required for Indian GST calculation.")
        
        cleaned = str(state_input).strip().upper()
        if cleaned in GST_STATE_MAP:
            return GST_STATE_MAP[cleaned]
        
        raise InvalidTaxJurisdictionError(f"Invalid Indian GST state code: '{state_input}'.")

    def calculate_tax(
        self,
        company_id: UUID,
        amount: Decimal,
        tax_rate: Optional[Decimal] = None,
        is_tax_inclusive: bool = False,
        supplier_state: Optional[str] = None,
        customer_state: Optional[str] = None,
        is_gst: bool = True,
        hsn_sac_code: Optional[str] = None
    ) -> TaxCalculationResponse:
        """
        Calculates taxes deterministically with exact Decimal arithmetic.
        
        Strict Indian GST Rules:
        - If is_gst=True:
            - Company.country_code MUST be 'IN' (NULL or non-IN rejected with HTTP 422).
            - supplier_state and customer_state are mandatory (falls back to Company.state_code for supplier if configured).
            - Canonical state codes are compared (Intra-State -> CGST+SGST, Inter-State -> IGST).
            - Exact reconciliation: CGST + SGST == total_tax.
        - If is_gst=False:
            - Generic flat tax evaluated without CGST/SGST/IGST breakdown.
        """
        company = self.db.query(Company).filter(Company.id == company_id).first()
        if not company:
            raise NotFoundException(f"Company {company_id} not found.")

        # 1. Resolve Effective Tax Rate
        if tax_rate is not None:
            effective_rate = Decimal(str(tax_rate))
        elif company.default_tax_rate is not None:
            effective_rate = Decimal(str(company.default_tax_rate))
        else:
            effective_rate = Decimal("0.00")

        if effective_rate < Decimal("0.00") or effective_rate > Decimal("100.00"):
            raise InvalidTaxRateError(f"tax_rate must be between 0.00 and 100.00, got {effective_rate}")

        raw_amount = Decimal(str(amount))
        if raw_amount < Decimal("0.00"):
            raise InvalidTaxRateError("amount must not be negative.")

        # 2. Compute Base Taxable and Total Tax Amount
        if is_tax_inclusive:
            gross_amount = raw_amount.quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
            rate_divisor = Decimal("1.00") + (effective_rate / Decimal("100.00"))
            taxable_amount = (gross_amount / rate_divisor).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
            total_tax = gross_amount - taxable_amount
            total_amount = gross_amount
        else:
            taxable_amount = raw_amount.quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
            total_tax = (taxable_amount * (effective_rate / Decimal("100.00"))).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
            total_amount = taxable_amount + total_tax

        # 3. Handle Indian GST vs Generic Non-GST Mode
        if is_gst:
            # Country Gating: Company country_code MUST be 'IN'
            if company.country_code is None:
                raise InapplicableTaxJurisdictionError(
                    "Indian GST calculation requires Company country_code to be configured as 'IN'."
                )
            if company.country_code.upper() != "IN":
                raise InapplicableTaxJurisdictionError(
                    f"Indian GST calculation is not applicable for company with country_code '{company.country_code}'."
                )

            # Resolve Supplier State (Request parameter takes highest precedence, fallback to Company.state_code)
            raw_supplier = supplier_state if supplier_state is not None else company.state_code
            if not raw_supplier:
                raise MissingTaxJurisdictionError(
                    "Missing required state jurisdiction: supplier_state must be provided for Indian GST calculation."
                )
            if not customer_state:
                raise MissingTaxJurisdictionError(
                    "Missing required state jurisdiction: customer_state must be provided for Indian GST calculation."
                )

            canonical_supplier = self.normalize_gst_state(raw_supplier)
            canonical_customer = self.normalize_gst_state(customer_state)

            if canonical_supplier == canonical_customer:
                # Intra-State: CGST (50%) + SGST (50%)
                jurisdiction_type = "INTRA_STATE"
                cgst_rate = (effective_rate / Decimal("2.0")).quantize(RATE_QUANTIZE, rounding=ROUND_HALF_UP)
                sgst_rate = (effective_rate - cgst_rate).quantize(RATE_QUANTIZE, rounding=ROUND_HALF_UP)
                igst_rate = Decimal("0.00")

                cgst_amount = (total_tax / Decimal("2.0")).quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP)
                sgst_amount = total_tax - cgst_amount # Exact penny reconciliation
                igst_amount = Decimal("0.00")
            else:
                # Inter-State: IGST (100%)
                jurisdiction_type = "INTER_STATE"
                cgst_rate = Decimal("0.00")
                sgst_rate = Decimal("0.00")
                igst_rate = effective_rate.quantize(RATE_QUANTIZE, rounding=ROUND_HALF_UP)

                cgst_amount = Decimal("0.00")
                sgst_amount = Decimal("0.00")
                igst_amount = total_tax
        else:
            # Generic Flat Tax
            jurisdiction_type = "GENERIC_NON_GST"
            canonical_supplier = None
            canonical_customer = None
            cgst_rate = Decimal("0.00")
            cgst_amount = Decimal("0.00")
            sgst_rate = Decimal("0.00")
            sgst_amount = Decimal("0.00")
            igst_rate = Decimal("0.00")
            igst_amount = Decimal("0.00")

        return TaxCalculationResponse(
            original_amount=raw_amount.quantize(MONEY_QUANTIZE, rounding=ROUND_HALF_UP),
            taxable_amount=taxable_amount,
            tax_rate=effective_rate.quantize(RATE_QUANTIZE, rounding=ROUND_HALF_UP),
            total_tax=total_tax,
            cgst_rate=cgst_rate,
            cgst_amount=cgst_amount,
            sgst_rate=sgst_rate,
            sgst_amount=sgst_amount,
            igst_rate=igst_rate,
            igst_amount=igst_amount,
            total_amount=total_amount,
            is_tax_inclusive=is_tax_inclusive,
            jurisdiction_type=jurisdiction_type,
            supplier_state=canonical_supplier,
            customer_state=canonical_customer,
            hsn_sac_code=hsn_sac_code
        )
