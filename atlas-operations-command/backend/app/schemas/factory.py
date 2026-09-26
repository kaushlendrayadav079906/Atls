from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal

# -----------------
# Factory Schemas
# -----------------
class FactoryBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=255)
    status: str = Field("active", max_length=50)

class FactoryCreate(FactoryBase):
    pass

class FactoryResponse(FactoryBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FactoryFinancialsResponse(BaseModel):
    factory_id: UUID
    factory_name: str
    month: int
    year: int
    revenue: Decimal
    expenditure: Decimal
    profit: Decimal
