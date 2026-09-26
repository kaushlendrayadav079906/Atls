from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional
from decimal import Decimal, InvalidOperation


def validate_decimal_amount(v: Decimal, field_name: str = "amount") -> Decimal:
    if v is None:
        raise ValueError(f"{field_name} cannot be null")
    if not isinstance(v, Decimal):
        try:
            v = Decimal(str(v))
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError(f"Invalid decimal format for {field_name}")
    if v.is_nan() or v.is_infinite():
        raise ValueError(f"{field_name} must be a finite decimal number")
    return v


class TaxCalculationRequest(BaseModel):
    amount: Decimal = Field(..., description="Monetary amount for tax calculation")
    tax_rate: Optional[Decimal] = Field(None, description="Optional explicit tax rate percentage (0.00 - 100.00)")
    is_tax_inclusive: bool = Field(False, description="Flag indicating if the supplied amount is tax-inclusive")
    supplier_state: Optional[str] = Field(None, description="Supplier / seller Indian state code or alias (e.g. MH, 27)")
    customer_state: Optional[str] = Field(None, description="Customer / place of supply Indian state code or alias (e.g. MH, 27)")
    is_gst: bool = Field(True, description="Flag indicating if Indian GST rules (CGST/SGST/IGST) should be evaluated")
    hsn_sac_code: Optional[str] = Field(None, max_length=20, description="Optional HSN/SAC classification metadata")

    @field_validator("amount")
    @classmethod
    def validate_amount_field(cls, v: Decimal) -> Decimal:
        v = validate_decimal_amount(v, "amount")
        if v < 0:
            raise ValueError("amount must not be negative")
        return v

    @field_validator("tax_rate")
    @classmethod
    def validate_tax_rate_field(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is None:
            return None
        v = validate_decimal_amount(v, "tax_rate")
        if v < 0 or v > 100:
            raise ValueError("tax_rate must be between 0.00 and 100.00")
        return v


class TaxCalculationResponse(BaseModel):
    original_amount: Decimal
    taxable_amount: Decimal
    tax_rate: Decimal
    total_tax: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    total_amount: Decimal
    is_tax_inclusive: bool
    jurisdiction_type: str
    supplier_state: Optional[str] = None
    customer_state: Optional[str] = None
    hsn_sac_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
