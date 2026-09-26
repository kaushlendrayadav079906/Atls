from datetime import datetime
from uuid import UUID
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class CompanyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    currency_code: str = Field(..., min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    region: str = Field(..., min_length=1, max_length=100)
    fiscal_year_start_month: int = Field(..., ge=1, le=12)
    status: str = Field("active", pattern="^(active|inactive)$")

    # Phase 7A fields
    country_code: Optional[str] = Field(None, min_length=2, max_length=2, pattern="^[A-Z]{2}$")
    timezone: str = Field("UTC", min_length=1, max_length=50)
    locale: str = Field("en-US", min_length=1, max_length=20)
    state_code: Optional[str] = Field(None, max_length=10)
    gstin: Optional[str] = Field(None, min_length=15, max_length=15)
    tax_id: Optional[str] = Field(None, max_length=50)
    default_tax_rate: Decimal = Field(Decimal("0.00"), ge=0, le=100)

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    currency_code: str | None = Field(None, min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    region: str | None = Field(None, min_length=1, max_length=100)
    fiscal_year_start_month: int | None = Field(None, ge=1, le=12)
    status: str | None = Field(None, pattern="^(active|inactive)$")
    country_code: str | None = Field(None, min_length=2, max_length=2, pattern="^[A-Z]{2}$")
    timezone: str | None = Field(None, min_length=1, max_length=50)
    locale: str | None = Field(None, min_length=1, max_length=20)
    state_code: str | None = Field(None, max_length=10)
    gstin: str | None = Field(None, min_length=15, max_length=15)
    tax_id: str | None = Field(None, max_length=50)
    default_tax_rate: Decimal | None = Field(None, ge=0, le=100)

class CompanyRead(CompanyBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

