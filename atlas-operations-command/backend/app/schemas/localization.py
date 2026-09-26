from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class FormattingMetadata(BaseModel):
    currency_symbol: str = Field(..., description="Display currency symbol")
    currency_decimals: int = Field(2, description="Standard decimal places for currency")
    date_format: str = Field("YYYY-MM-DD", description="Standard ISO date format")
    decimal_separator: str = Field(".", description="Decimal separator")
    thousands_separator: str = Field(",", description="Thousands grouping separator")


class LocalizationConfigResponse(BaseModel):
    company_id: UUID
    name: str
    country_code: Optional[str] = None
    timezone: str
    locale: str
    currency_code: str
    state_code: Optional[str] = None
    gstin: Optional[str] = None
    tax_id: Optional[str] = None
    default_tax_rate: Decimal
    fiscal_year_start_month: int
    formatting: FormattingMetadata

    model_config = ConfigDict(from_attributes=True)


class FiscalYearInfoResponse(BaseModel):
    company_id: UUID
    fiscal_year_start_month: int = Field(..., ge=1, le=12)
    as_of_date: date
    fiscal_year: int
    fiscal_year_label: str
    fiscal_quarter: int = Field(..., ge=1, le=4)
    fiscal_quarter_label: str
    fiscal_period: int = Field(..., ge=1, le=12)
    fiscal_year_start_date: date
    fiscal_year_end_date: date
    quarter_start_date: date
    quarter_end_date: date

    model_config = ConfigDict(from_attributes=True)
