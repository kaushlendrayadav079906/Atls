// Product type
export interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string;
  stock?: number;
  image?: string;
  category?: string;
  brand?: string;
  size?: string;       // UDF_SIZE
  color?: string;      // UDF_COLOR
  warehouse?: string;  // Warehouse code with stock
}

// Cart item type
export interface CartItem {
  product: Product;
  quantity: number;
}

// Sale type
export interface Sale {
  id: string;
  items: CartItem[];
  total: number;
  timestamp: string;
}

// Dashboard summary type
export interface DashboardSummary {
  todayTotal: number;
  billCount: number;
  itemsSoldCount: number;
}

export interface DashboardSaleItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DashboardRecentSale {
  docEntry?: number;
  docNum?: number;
  saleId?: string;
  docDate?: string;
  customerCode?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  items: DashboardSaleItem[];
  hasReturn?: boolean;
}

export interface DashboardRecentSalesPage {
  items: DashboardRecentSale[];
  nextOffset?: number | null;
  total?: number;
}

// Customer details type
export interface CustomerDetails {
  name: string;
  phone: string;
  email?: string;
  sales_employee?: string;
  address?: string;
}

// Payment method type
export interface PaymentMethod {
  type: 'cash' | 'card' | 'upi' | 'wallet';
  amount: number;
}

// Checkout data type
export interface CheckoutData {
  items: CartItem[];
  subtotal: number;
  discount: number;
  gst: number;
  gstPercentage?: number;
  total: number;
  customer?: CustomerDetails;
  paymentMethods: PaymentMethod[];
}

// API response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface GstValuesResponse {
  values: number[];
  default: number;
}

// ── Admin / Multi-Branch Types ────────────────────────────────────────────────

export interface Branch {
  id: string;
  name: string;
  location?: string;
}

export type DateRange = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  sap_user_code?: string;
  branch_id?: string;
  store_name?: string;
  is_active: boolean;
  created_at?: string;
}

export interface SalesTrendPoint {
  label: string;
  total: number;
  billCount: number;
}

export interface TopProduct {
  itemCode: string;
  itemName: string;
  quantity: number;
  revenue: number;
}

export interface BranchSummary {
  branchId: string;
  branchName: string;
  total: number;
  billCount: number;
}

export interface PaymentMethodSummary {
  method: string;
  total: number;
  billCount: number;
}

export interface TopEmployeeSummary {
  employeeCode: string;
  total: number;
  billCount: number;
}

export interface AdminDashboardData {
  totalRevenue: number;
  billCount: number;
  itemsSoldCount: number;
  averageBillValue: number;
  activeBranches: number;
  activeUsers: number;
  previousRevenue: number;
  growthPercent: number;
  topBranch?: BranchSummary | null;
  branchBreakdown: BranchSummary[];
  paymentSplit: PaymentMethodSummary[];
  trend: SalesTrendPoint[];
  topProducts: TopProduct[];
  topEmployees: TopEmployeeSummary[];
  customerInsights: CustomerInsightsData;
  totalReturns: number;
  exchangeCount: number;
  refundCount: number;
  returnRate: number;
  totalRefundedAmount: number;
  netRevenueAfterReturns: number;
  topReturnReasons: ReturnReasonSummary[];
}

export interface ReportPreviewRow {
  docNum: string;
  date: string;
  customer: string;
  mobile?: string;
  salesEmployee?: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
}

export interface ReportPreviewData {
  rows: ReportPreviewRow[];
  totals: {
    subtotal: number;
    discount: number;
    gst: number;
    total: number;
  };
}

// ── Operator Dashboard Types ───────────────────────────────────────────────

export interface OperatorPaymentSummary {
  method: string;
  total: number;
  billCount: number;
}

export interface OperatorProductSummary {
  itemCode: string;
  itemName: string;
  quantity: number;
  revenue: number;
}

export interface OperatorStockItem {
  itemCode: string;
  itemName: string;
  inStock: number;
}

export interface ReturnedItemSummary {
  itemCode: string;
  itemName: string;
  quantity: number;
}

export interface ReturnReasonSummary {
  reason: string;
  count: number;
}

export interface OperatorPerformanceSummary {
  targetAmount: number;
  achievedAmount: number;
  targetBills: number;
  achievedBills: number;
  amountAchievementPercent: number;
  billsAchievementPercent: number;
}

export interface OperatorQuickAction {
  id: string;
  label: string;
  path: string;
}

export interface OperatorDashboardData {
  todayTotal: number;
  billCount: number;
  averageBillValue: number;
  itemsSoldCount: number;
  paymentBreakdown: OperatorPaymentSummary[];
  recentSales: DashboardRecentSale[];
  topSellingItems: OperatorProductSummary[];
  lowSellingItems: OperatorProductSummary[];
  availableStock: OperatorStockItem[];
  lowStockAlerts: OperatorStockItem[];
  outOfStockItems: OperatorStockItem[];
  returnedItems: ReturnedItemSummary[];
  returnsCount: number;
  returnReasons: ReturnReasonSummary[];
  returnOrders: ReturnDetail[];
  performance: OperatorPerformanceSummary;
  customerInsights: CustomerInsightsData;
  quickActions: OperatorQuickAction[];
}

// ── Returns & Exchange Types ───────────────────────────────────────────────

export interface ReturnLineItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  warehouse?: string;
  baseLine?: number;
}

export interface ReturnCreate {
  originalDocEntry: number;
  originalDocNum?: number;
  items: ReturnLineItem[];
  reason: string;
  returnType: 'refund' | 'store_credit';
  warehouse?: string;
  cardCode?: string;
}

export interface ExchangeCreate {
  originalDocEntry: number;
  originalDocNum?: number;
  returnItems: ReturnLineItem[];
  replacementItems: CartItem[];
  reason: string;
  warehouse?: string;
  cardCode?: string;
}

export interface ReturnResponse {
  returnDocEntry: number;
  returnDocNum?: number;
  creditNoteDocEntry?: number;
  creditNoteDocNum?: number;
  refundAmount: number;
  returnType: string;
  status: string;
  requestId?: string;
}

export interface ExchangeResponse {
  returnDocEntry: number;
  returnDocNum?: number;
  newInvoiceDocEntry?: number;
  newInvoiceDocNum?: number;
  creditNoteDocEntry?: number;
  creditNoteDocNum?: number;
  returnAmount: number;
  newInvoiceAmount: number;
  priceDifference: number;
  status: string;
  requestId?: string;
}

export interface ReturnDetail {
  docEntry: number;
  docNum?: number;
  docDate?: string;
  originalDocNum?: string;
  customerCode?: string;
  customerName?: string;
  reason?: string;
  returnType?: string;
  items: ReturnLineItem[];
  refundAmount: number;
  creditNoteDocEntry?: number;
}

export interface InvoiceLookupResult {
  docEntry: number;
  docNum: number;
  docDate?: string;
  customerCode?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  total: number;
  items: ReturnLineItem[];
  hasReturn?: boolean;
}

// ── Customer Search & Insights ────────────────────────────────────────────────

/** Customer suggestion from invoice UDF fields (U_C_Name / U_W_Number). */
export interface CustomerSearchResult {
  name: string;
  mobile: string;
  email?: string;
  salesEmployee?: string;
  address?: string;
  invoiceCount?: number;
  latestDocNum?: number;
  invoiceNums?: number[];
}

export interface TopCustomer {
  cardCode: string;
  cardName: string;
  totalSpend: number;
  billCount: number;
  averageOrderValue: number;
}

export interface CustomerInsightsData {
  topCustomers: TopCustomer[];
  repeatCustomerCount: number;
  newCustomerCount: number;
  repeatRate: number;
  totalCLV: number;
}

