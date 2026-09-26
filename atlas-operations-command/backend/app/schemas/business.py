from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal

# -----------------
# Product Schemas
# -----------------
class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    status: str = Field("active", max_length=50)

class ProductResponse(ProductBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# -----------------
# Customer & Vendor
# -----------------
class CustomerBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: Optional[str] = Field(None, max_length=100)
    status: str = Field("active", max_length=50)

class CustomerResponse(CustomerBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class VendorBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: Optional[str] = Field(None, max_length=100)
    status: str = Field("active", max_length=50)

class VendorResponse(VendorBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# -----------------
# Inventory Item
# -----------------
class InventoryItemBase(BaseModel):
    factory_id: UUID
    product_id: UUID
    quantity: Decimal
    value: Decimal
    status: str = Field("active", max_length=50)

class InventoryItemResponse(InventoryItemBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# -----------------
# Financial Tx
# -----------------
class FinancialTransactionBase(BaseModel):
    factory_id: Optional[UUID] = None
    transaction_date: date
    transaction_type: str = Field(..., max_length=50)
    amount: Decimal
    currency_code: str = Field(..., max_length=3)
    description: Optional[str] = Field(None, max_length=255)
    
    # Phase 7A fields
    amount_base: Optional[Decimal] = None
    exchange_rate: Decimal = Field(Decimal("1.000000"), gt=0)
    tax_rate: Decimal = Field(Decimal("0.00"), ge=0, le=100)
    tax_amount: Decimal = Field(Decimal("0.00"), ge=0)
    is_tax_inclusive: bool = False
    hsn_sac_code: Optional[str] = Field(None, max_length=20)

    customer_id: Optional[UUID] = None
    vendor_id: Optional[UUID] = None
    product_id: Optional[UUID] = None

class FinancialTransactionResponse(FinancialTransactionBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -----------------
# Kpi Snapshot
# -----------------
class KpiSnapshotBase(BaseModel):
    factory_id: UUID
    snapshot_date: date
    metric_name: str = Field(..., max_length=100)
    metric_value: Decimal

class KpiSnapshotResponse(KpiSnapshotBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# -----------------
# Reports Schemas
# -----------------
class SalesByProductResponse(BaseModel):
    product_id: UUID
    product_name: str
    total_sales: Decimal

class TopCustomerResponse(BaseModel):
    customer_id: UUID
    customer_name: str
    total_revenue: Decimal

class MonthlyRevenueExpenditureResponse(BaseModel):
    month: int
    year: int
    revenue: Decimal
    expenditure: Decimal
    profit: Decimal

class SapBusinessDataResponse(BaseModel):
    status: str = "unavailable"
    message: str = "SAP integration is not configured or connected."

class OrganicBusinessDataResponse(BaseModel):
    total_revenue: Decimal
    total_expenditure: Decimal
    net_profit: Decimal
    active_factories: int
