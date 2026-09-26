from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal, InvalidOperation
import math
import re

CURRENCY_REGEX = re.compile(r"^[A-Z]{3}$")

def validate_currency_code(v: str, field_name: str = "currency") -> str:
    if not isinstance(v, str):
        raise ValueError(f"{field_name} must be a string")
    v_clean = v.strip().upper()
    if not CURRENCY_REGEX.match(v_clean):
        raise ValueError(f"{field_name} must be exactly 3 uppercase letters (ISO 4217)")
    return v_clean

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

# -------------------------------------------------------------
# Exchange Rate Schemas
# -------------------------------------------------------------
class ExchangeRateBase(BaseModel):
    from_currency: str = Field(..., description="Source currency ISO 4217 code (e.g. USD, EUR)")
    to_currency: str = Field(..., description="Target currency ISO 4217 code (e.g. USD, INR)")
    rate: Decimal = Field(..., gt=0, description="Direct exchange rate (must be positive Decimal)")
    effective_date: date = Field(..., description="Effective date for the exchange rate")

    @field_validator("from_currency")
    @classmethod
    def validate_from_currency(cls, v: str) -> str:
        return validate_currency_code(v, "from_currency")

    @field_validator("to_currency")
    @classmethod
    def validate_to_currency(cls, v: str) -> str:
        return validate_currency_code(v, "to_currency")

    @field_validator("rate")
    @classmethod
    def validate_rate(cls, v: Decimal) -> Decimal:
        v = validate_decimal_amount(v, "rate")
        if v <= 0:
            raise ValueError("rate must be greater than 0")
        return v


class ExchangeRateCreate(ExchangeRateBase):
    @model_validator(mode="after")
    def validate_distinct_currencies(self) -> "ExchangeRateCreate":
        if self.from_currency == self.to_currency:
            raise ValueError("from_currency and to_currency must be different for explicit rate creation")
        return self


class ExchangeRateResponse(ExchangeRateBase):
    id: UUID
    company_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Currency Conversion Schemas
# -------------------------------------------------------------
class CurrencyConvertRequest(BaseModel):
    amount: Decimal = Field(..., description="Monetary amount to convert")
    from_currency: str = Field(..., description="Source currency code")
    to_currency: str = Field(..., description="Target currency code")
    target_date: Optional[date] = Field(None, description="Effective target date (defaults to today)")

    @field_validator("from_currency")
    @classmethod
    def validate_from_currency(cls, v: str) -> str:
        return validate_currency_code(v, "from_currency")

    @field_validator("to_currency")
    @classmethod
    def validate_to_currency(cls, v: str) -> str:
        return validate_currency_code(v, "to_currency")

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        return validate_decimal_amount(v, "amount")


class CurrencyConvertResponse(BaseModel):
    original_amount: Decimal
    from_currency: str
    to_currency: str
    target_date: date
    exchange_rate: Decimal
    converted_amount: Decimal
