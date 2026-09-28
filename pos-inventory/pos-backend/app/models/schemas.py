"""Pydantic models for API request/response validation"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr


# ============================================================
# Auth Models
# ============================================================

class UserLogin(BaseModel):
    """User login request – accepts username or email"""
    username: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(..., max_length=72)

    def get_identifier(self) -> str:
        """Return whichever identifier was provided."""
        return self.username or self.email or ""


class UserRegister(BaseModel):
    """User registration request"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=72)
    name: str = Field(..., min_length=1, max_length=100)
    master_password: Optional[str] = Field(None, min_length=0, max_length=255)
    role: str = Field("user", pattern="^(user|admin|operator|manager)$")
    branch_id: Optional[str] = None
    store_name: Optional[str] = None


class UserResponse(BaseModel):
    """User response (without password)"""
    id: str
    username: str
    email: str
    name: str
    role: str = "user"
    sap_user_code: Optional[str] = None
    branch_id: Optional[str] = None   # SAP WarehouseCode
    store_name: Optional[str] = None  # Display name for the branch/store


class AccessTokenResponse(BaseModel):
    """JWT access token response"""
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None


# ============================================================
# Admin Models
# ============================================================

class AdminUserCreate(BaseModel):
    """Admin user creation request"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=72)
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field("user", pattern="^(user|admin|operator|manager)$")
    branch_id: Optional[str] = None
    store_name: Optional[str] = None


class AdminUserUpdate(BaseModel):
    """Admin user update request (all fields optional)"""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    role: Optional[str] = Field(None, pattern="^(user|admin|operator|manager)$")
    branch_id: Optional[str] = None
    store_name: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=72)
    current_password: Optional[str] = Field(None, min_length=1, max_length=72)
    new_password: Optional[str] = Field(None, min_length=6, max_length=72)


class AdminUserResponse(BaseModel):
    """Admin user response with extended fields"""
    id: str
    username: str
    email: str
    name: str
    role: str
    sap_user_code: Optional[str] = None
    branch_id: Optional[str] = None
    store_name: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None


# ============================================================
# Product Models
# ============================================================

class ProductBase(BaseModel):
    """Base product fields"""
    name: str = Field(..., min_length=1, max_length=255)
    price: float = Field(..., gt=0)
    barcode: str = Field(..., min_length=1)
    stock: Optional[float] = None
    image: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None


class ProductCreate(ProductBase):
    """Product creation request"""
    pass


class ProductUpdate(BaseModel):
    """Product update request (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    price: Optional[float] = Field(None, gt=0)
    barcode: Optional[str] = None
    stock: Optional[float] = None
    image: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None


class ProductResponse(BaseModel):
    """Product response"""
    id: str  # ItemCode
    name: str
    price: float
    barcode: Optional[str] = None  # Barcode can be None/empty in SAP
    stock: Optional[float] = None
    image: Optional[str] = None
    category: Optional[str] = None  # Can be string or None
    brand: Optional[str] = None
    size: Optional[str] = None      # UDF_SIZE
    color: Optional[str] = None     # UDF_COLOR
    warehouse: Optional[str] = None  # Warehouse code with stock


# ============================================================
# Cart & Sale Models
# ============================================================

class CartItem(BaseModel):
    """Cart item (product + quantity)"""
    product: ProductResponse
    quantity: int = Field(..., gt=0)


class CustomerDetails(BaseModel):
    """Customer information"""
    name: str = Field(..., min_length=1, max_length=200)
    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[EmailStr] = None
    whatsapp_number: Optional[str] = None  # → U_W_Number on Invoice
    payment_method: Optional[str] = None   # fallback → U_P_Method on A/R Invoice
    sales_employee: Optional[str] = None   # → U_S_Employee on A/R Invoice
    address: Optional[str] = None          # → U_Address on A/R Invoice


class PaymentMethod(BaseModel):
    """Payment method details"""
    type: str = Field(..., pattern="^(cash|card|upi|wallet)$")
    amount: float = Field(..., gt=0)


class SaleCreate(BaseModel):
    """Sale creation request"""
    items: List[CartItem] = Field(..., min_length=1)
    total: float = Field(..., gt=0)
    subtotal: Optional[float] = None
    discount: Optional[float] = 0
    gst: Optional[float] = 0
    gstPercentage: Optional[float] = None
    customer: CustomerDetails
    paymentMethods: Optional[List[PaymentMethod]] = None


class SaleResponse(BaseModel):
    """Sale creation response"""
    saleId: str
    total: float
    sapDocEntry: Optional[int] = None
    sapDocNum: Optional[int] = None


class SaleDetail(BaseModel):
    """Detailed sale information (SAP AR Invoice)"""
    id: Optional[int] = None       # SAP DocEntry
    saleId: str
    total: float
    items: List[Dict[str, Any]]
    customer: Optional[Any] = None
    syncStatus: str = "synced"
    createdAt: Optional[Any] = None
    sapDocEntry: Optional[int] = None
    sapDocNum: Optional[int] = None


# ============================================================
# Dashboard Models
# ============================================================

class DashboardSummary(BaseModel):
    """Dashboard summary statistics"""
    todayTotal: float
    billCount: int
    itemsSoldCount: int = 0


class DashboardSaleItem(BaseModel):
    """Dashboard recent sale line item"""
    itemCode: str
    itemName: str
    quantity: float
    unitPrice: float
    lineTotal: float


class DashboardRecentSale(BaseModel):
    """Dashboard recent sale summary with printable details"""
    docEntry: Optional[int] = None
    docNum: Optional[int] = None
    saleId: Optional[str] = None
    docDate: Optional[str] = None
    customerCode: Optional[str] = None
    customerName: Optional[str] = None
    customerPhone: Optional[str] = None
    paymentMethod: Optional[str] = None
    subtotal: float = 0
    discount: float = 0
    gst: float = 0
    total: float = 0
    items: List[DashboardSaleItem] = Field(default_factory=list)
    hasReturn: bool = False


class DashboardRecentSalesPage(BaseModel):
    """Paginated recent sales feed response"""
    items: List[DashboardRecentSale] = Field(default_factory=list)
    nextOffset: Optional[int] = None
    total: Optional[int] = None


# ============================================================
# SAP Models (for internal use)
# ============================================================

class SAPLoginRequest(BaseModel):
    """SAP Service Layer login request"""
    CompanyDB: str
    UserName: str
    Password: str


class SAPItemCreate(BaseModel):
    """SAP Item creation payload"""
    ItemCode: Optional[str] = None
    ItemName: str
    BarCode: Optional[str] = None
    ItemPrices: Optional[List[Dict[str, Any]]] = None


# ============================================================
# Admin Dashboard Models
# ============================================================

class SalesTrendPoint(BaseModel):
    """A single data point in a sales trend chart"""
    label: str
    total: float
    billCount: int


class TopProduct(BaseModel):
    """Top-selling product summary"""
    itemCode: str
    itemName: str
    quantity: int
    revenue: float


class BranchSummary(BaseModel):
    """Per-branch sales breakdown"""
    branchId: str
    branchName: str
    total: float
    billCount: int


class PaymentMethodSummary(BaseModel):
    """Payment-method distribution for the selected date range"""
    method: str
    total: float
    billCount: int


class TopEmployeeSummary(BaseModel):
    """Top-performing employee by revenue."""
    employeeCode: str
    total: float
    billCount: int


class ReturnReasonSummary(BaseModel):
    """Grouped return reasons for today's returns/exchanges."""
    reason: str
    count: int


class AdminDashboardData(BaseModel):
    """Admin dashboard aggregated data"""
    totalRevenue: float
    billCount: int
    itemsSoldCount: int
    averageBillValue: float
    activeBranches: int
    activeUsers: int
    previousRevenue: float
    growthPercent: float
    topBranch: Optional[BranchSummary] = None
    branchBreakdown: List[BranchSummary] = Field(default_factory=list)
    paymentSplit: List[PaymentMethodSummary] = Field(default_factory=list)
    trend: List[SalesTrendPoint]
    topProducts: List[TopProduct]
    topEmployees: List[TopEmployeeSummary] = Field(default_factory=list)
    customerInsights: "CustomerInsightsData"
    totalReturns: int = 0
    exchangeCount: int = 0
    refundCount: int = 0
    returnRate: float = 0.0
    totalRefundedAmount: float = 0.0
    netRevenueAfterReturns: float = 0.0
    topReturnReasons: List[ReturnReasonSummary] = Field(default_factory=list)


# ============================================================
# Operator Dashboard Models
# ============================================================

class OperatorPaymentSummary(BaseModel):
    """Payment method split for today's operator summary."""
    method: str
    total: float
    billCount: int


class OperatorProductSummary(BaseModel):
    """Top/low selling product summary for the day."""
    itemCode: str
    itemName: str
    quantity: int
    revenue: float


class OperatorStockItem(BaseModel):
    """Stock item snapshot used for lookup and alerts."""
    itemCode: str
    itemName: str
    inStock: float


class ReturnedItemSummary(BaseModel):
    """Returned items summary for today."""
    itemCode: str
    itemName: str
    quantity: float


class OperatorPerformanceSummary(BaseModel):
    """Operator target vs achieved summary."""
    targetAmount: float
    achievedAmount: float
    targetBills: int
    achievedBills: int
    amountAchievementPercent: float
    billsAchievementPercent: float


class OperatorQuickAction(BaseModel):
    """Action metadata used by quick action buttons."""
    id: str
    label: str
    path: str


class OperatorDashboardData(BaseModel):
    """Daily operator dashboard payload."""
    todayTotal: float
    billCount: int
    averageBillValue: float
    itemsSoldCount: int
    paymentBreakdown: List[OperatorPaymentSummary] = Field(default_factory=list)
    recentSales: List[DashboardRecentSale] = Field(default_factory=list)
    topSellingItems: List[OperatorProductSummary] = Field(default_factory=list)
    lowSellingItems: List[OperatorProductSummary] = Field(default_factory=list)
    availableStock: List[OperatorStockItem] = Field(default_factory=list)
    lowStockAlerts: List[OperatorStockItem] = Field(default_factory=list)
    outOfStockItems: List[OperatorStockItem] = Field(default_factory=list)
    returnedItems: List[ReturnedItemSummary] = Field(default_factory=list)
    returnsCount: int = 0
    returnReasons: List[ReturnReasonSummary] = Field(default_factory=list)
    returnOrders: List["ReturnDetail"] = Field(default_factory=list)
    performance: OperatorPerformanceSummary
    customerInsights: "CustomerInsightsData"
    quickActions: List[OperatorQuickAction] = Field(default_factory=list)


class SAPInvoiceCreate(BaseModel):
    """SAP AR Invoice creation payload"""
    CardCode: Optional[str] = None
    CardName: Optional[str] = None
    DocDate: str
    DocDueDate: str
    DocumentLines: List[Dict[str, Any]]
    PaymentMethod: Optional[str] = None


# ============================================================
# Returns & Exchange Models
# ============================================================

class ReturnLineItem(BaseModel):
    """A single line item in a return or exchange request"""
    itemCode: str
    itemName: str
    quantity: int = Field(..., gt=0)
    unitPrice: float = Field(..., ge=0)
    lineTotal: float = Field(..., ge=0)
    warehouse: Optional[str] = None
    baseLine: int = 0


class ReturnCreate(BaseModel):
    """Return creation request"""
    originalDocEntry: int = Field(..., description="SAP DocEntry of the original invoice")
    originalDocNum: Optional[int] = None
    items: List[ReturnLineItem] = Field(..., min_length=1)
    reason: str = Field(..., min_length=1, max_length=500, description="Return reason (mandatory)")
    returnType: str = Field(..., pattern="^(refund|store_credit)$")
    warehouse: Optional[str] = None
    cardCode: Optional[str] = None


class ExchangeCreate(BaseModel):
    """Exchange creation request – return items + replacement items"""
    originalDocEntry: int = Field(..., description="SAP DocEntry of the original invoice")
    originalDocNum: Optional[int] = None
    returnItems: List[ReturnLineItem] = Field(..., min_length=1)
    replacementItems: List[CartItem] = Field(..., min_length=1)
    reason: str = Field(..., min_length=1, max_length=500)
    warehouse: Optional[str] = None
    cardCode: Optional[str] = None


class ReturnResponse(BaseModel):
    """Return creation response"""
    returnDocEntry: int
    returnDocNum: Optional[int] = None
    creditNoteDocEntry: Optional[int] = None
    creditNoteDocNum: Optional[int] = None
    refundAmount: float = 0.0
    returnType: str
    status: str = "success"
    requestId: Optional[str] = None


# ============================================================
# Customer Search & Insights Models
# ============================================================

class CustomerSearchResult(BaseModel):
    """A customer suggestion from invoice UDF fields (U_C_Name, U_W_Number).

    Customers in this POS are not SAP Business Partners — they are identified
    solely by the name and mobile number stored on each AR Invoice as UDFs.
    """
    name: str
    mobile: str
    email: Optional[str] = None
    salesEmployee: Optional[str] = None
    address: Optional[str] = None
    invoiceCount: Optional[int] = None
    latestDocNum: Optional[int] = None
    invoiceNums: Optional[List[int]] = None


class TopCustomer(BaseModel):
    """Top customer by total purchase value."""
    cardCode: str
    cardName: str
    totalSpend: float
    billCount: int
    averageOrderValue: float


class CustomerInsightsData(BaseModel):
    """Customer insights aggregated from invoices."""
    topCustomers: List[TopCustomer] = Field(default_factory=list)
    repeatCustomerCount: int = 0
    newCustomerCount: int = 0
    repeatRate: float = 0.0
    totalCLV: float = 0.0


class ExchangeResponse(BaseModel):
    """Exchange creation response"""
    returnDocEntry: int
    returnDocNum: Optional[int] = None
    newInvoiceDocEntry: Optional[int] = None
    newInvoiceDocNum: Optional[int] = None
    creditNoteDocEntry: Optional[int] = None
    creditNoteDocNum: Optional[int] = None
    returnAmount: float = 0.0
    newInvoiceAmount: float = 0.0
    priceDifference: float = 0.0
    status: str = "success"
    requestId: Optional[str] = None


class ReturnDetail(BaseModel):
    """Detailed return document info"""
    docEntry: int
    docNum: Optional[int] = None
    docDate: Optional[str] = None
    originalDocNum: Optional[str] = None
    customerCode: Optional[str] = None
    customerName: Optional[str] = None
    reason: Optional[str] = None
    returnType: Optional[str] = None
    items: List[ReturnLineItem] = Field(default_factory=list)
    refundAmount: float = 0.0
    creditNoteDocEntry: Optional[int] = None


AdminDashboardData.model_rebuild()
OperatorDashboardData.model_rebuild()

# ============================================================
# Atlas Dashboard Models
# ============================================================

class AtlasOverview(BaseModel):
    totalSales: float
    invoiceCount: int
    averageOrderValue: float
    paymentBreakdown: List[PaymentMethodSummary] = Field(default_factory=list)

class AtlasSalesTrend(BaseModel):
    trend: List[SalesTrendPoint] = Field(default_factory=list)

class AtlasInventoryItem(BaseModel):
    itemCode: str
    itemName: str
    inStock: float
    warehouse: str

class AtlasInventorySummary(BaseModel):
    snapshotTime: str
    items: List[AtlasInventoryItem] = Field(default_factory=list)

class AtlasBranchComparison(BaseModel):
    branches: List[BranchSummary] = Field(default_factory=list)

class AtlasReturnsSummary(BaseModel):
    pendingApprovalsCount: int
    sapCreditNotesCount: int
    sapCreditNotesTotal: float


class AtlasTopCustomer(BaseModel):
    customerCode: str
    customerName: str
    totalSales: float
    invoiceCount: int

class AtlasProductVelocity(BaseModel):
    itemCode: str
    itemName: str
    quantitySold: float
    salesAmount: float


class DashboardAlert(BaseModel):
    id: str
    request_type: str
    status: str
    amount: float
    reason: str
    branch_id: str
    created_at: str

class InventoryRiskItem(BaseModel):
    item_code: str
    name: str
    in_stock: float
    committed: float
    ordered: float
    minimal_stock: float
    warehouse: str
