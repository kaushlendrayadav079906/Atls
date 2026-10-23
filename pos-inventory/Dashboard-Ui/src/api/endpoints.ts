import { apiClient } from './client';

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  branch_id?: string;
  store_name?: string;
  is_active?: boolean;
  token_version?: number;
  permissions?: string[];
  phone?: string | null;
  job_role?: string | null;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  user?: UserResponse;
}

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
  subtotal?: number;
  discount?: number;
  gst?: number;
  total: number;
  items: DashboardSaleItem[];
  hasReturn?: boolean;
}

export interface SalesTrendPoint {
  label: string;
  total: number;
  billCount: number;
}

export interface DashboardAlert {
  id: string;
  request_type: string;
  status: string;
  amount: number;
  reason: string;
  branch_id: string;
  created_at: string;
}

export interface TopProduct {
  itemCode: string;
  itemName: string;
  quantitySold: number;
  salesAmount: number;
}

type AuthRequestPayload = Record<string, string | undefined>;

export const authApi = {
  login: async (data: AuthRequestPayload): Promise<AccessTokenResponse> => {
    const res = await apiClient.post('/auth/login', data);
    return res.data;
  },
  register: async (data: AuthRequestPayload): Promise<AccessTokenResponse> => {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
  },
  me: async (): Promise<UserResponse> => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
  logout: async () => {
    await apiClient.post('/auth/logout');
  }
};

export interface InventoryRiskItem {
  item_code: string;
  name: string;
  in_stock: number;
  minimal_stock: number;
  projected_stock: number;
  warehouse_code: string;
}

export const dashboardApi = {
  getSummary: async (branch_id?: string): Promise<DashboardSummary> => {
    const res = await apiClient.get('/dashboard/summary', { params: { branch_id } });
    return res.data;
  },
  getRecentSales: async (branch_id?: string): Promise<DashboardRecentSale[]> => {
    const res = await apiClient.get('/dashboard/recent-sales', { params: { branch_id } });
    return res.data;
  },
  getAlerts: async (): Promise<DashboardAlert[]> => {
    const res = await apiClient.get('/dashboard/alerts');
    return res.data;
  },
  getInventoryRisk: async (): Promise<InventoryRiskItem[]> => {
    const res = await apiClient.get('/dashboard/inventory-risk');
    return res.data;
  }
};

export const atlasApi = {
  getSalesTrend: async (branch_id?: string, range: string = 'monthly', customer?: string, category?: string, payment_method?: string, from_date?: string, to_date?: string, group_by?: string): Promise<any> => {
    const res = await apiClient.get('/atlas/sales-trends', { params: { branch: branch_id, range, customer, category, payment_method, from_date, to_date, group_by } });
    return res.data;
  },
  getRecentSalesFeed: async (params?: { range?: string, search?: string, limit?: number, offset?: number, branch?: string, customer?: string, category?: string, payment_method?: string, from_date?: string, to_date?: string }) => {
    const res = await apiClient.get('/dashboard/recent-sales-feed', { params });
    return res.data;
  },
  getOverview: async (branch_id?: string, range: string = 'monthly', customer?: string, category?: string, payment_method?: string, from_date?: string, to_date?: string) => {
    const res = await apiClient.get('/atlas/overview', { params: { branch: branch_id, range, customer, category, payment_method, from_date, to_date } });
    return res.data;
  },
  getTopProducts: async (branch_id?: string, range: string = 'monthly', customer?: string, category?: string, payment_method?: string, from_date?: string, to_date?: string): Promise<TopProduct[]> => {
    const res = await apiClient.get('/atlas/product-velocity', { params: { branch: branch_id, range, customer, category, payment_method, from_date, to_date } });
    return res.data;
  },
  getTopCustomers: async (branch_id?: string, range: string = 'monthly', customer?: string, category?: string, payment_method?: string, from_date?: string, to_date?: string): Promise<any[]> => {
    const res = await apiClient.get('/atlas/top-customers', { params: { branch: branch_id, range, customer, category, payment_method, from_date, to_date } });
    return res.data;
  },
  getBranchComparison: async (range: string = 'monthly', from_date?: string, to_date?: string): Promise<any> => {
    const res = await apiClient.get('/atlas/branch-comparison', { params: { range, from_date, to_date } });
    return res.data;
  }
};


export interface PaymentOverview {
  totalPayments: number;
  paymentCount: number;
  paidInvoices: number;
  pendingPayments: number;
  pendingPaymentsCount?: number;
  refundsIssued: number;
  refundsAmount: number;
  refundsCount?: number;
  averagePaymentValue: number;
  currency?: string;
  period?: {
    range?: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  rules?: Record<string, string>;
}

export interface PaymentDistributionItem {
  method: string;
  total: number;
  count: number;
  percentage?: number;
}

export interface PaymentTrendItem {
  label: string;
  amount: number;
  count: number;
  cashAmount?: number;
  transferAmount?: number;
  cardAmount?: number;
}

export interface PaymentLinkedInvoice {
  docEntry: number;
  docNum?: number;
  sumApplied: number;
  invoiceTotal?: number | null;
  paidToDate?: number | null;
  invoiceDate?: string | null;
  invoiceStatus?: string | null;
}

export interface PaymentTransactionItem {
  docEntry: number;
  docNum: number;
  invoiceDocNum?: string;
  invoiceDocEntry?: number;
  invoiceAmount?: number | null;
  docDate: string;
  customerCode: string;
  customerName: string;
  paymentMethod: string;
  totalAmount: number;
  sumApplied?: number;
  status: string;
  transactionId?: string;
  currency?: string;
  branchName?: string;
  branchId?: number;
  linkedInvoices?: PaymentLinkedInvoice[];
}

export interface PaymentTransactionsResponse {
  total: number;
  items: PaymentTransactionItem[];
  offset?: number;
  limit?: number;
}

export interface CustomerPaymentItem {
  customerCode: string;
  customerName: string;
  totalAmount: number;
  paymentCount: number;
  lastPaymentDate: string;
  preferredMethod: string;
  linkedInvoicesCount: number;
}

export interface MethodAnalysisItem {
  method: string;
  displayName: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
  averageValue: number;
  minAmount: number;
  maxAmount: number;
}

export interface PaymentDetailResponse {
  docEntry: number;
  docNum: number;
  docDate: string;
  cardCode: string;
  cardName: string;
  totalAmount: number;
  docCurrency: string;
  branchId?: number;
  branchName?: string;
  cancelled: boolean;
  cashSum: number;
  transferSum: number;
  transferReference?: string | null;
  transferDate?: string | null;
  cardSum: number;
  creditCards?: any[];
  checkSum: number;
  checks?: any[];
  remarks?: string | null;
  journalRemarks?: string | null;
  linkedInvoices: PaymentLinkedInvoice[];
}

export interface PaymentFilterParams {
  range?: string;
  from_date?: string;
  to_date?: string;
  branch?: string;
  customer?: string;
  payment_method?: string;
  payment_status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const paymentsReportApi = {
  getOverview: async (params?: PaymentFilterParams): Promise<PaymentOverview> => {
    const res = await apiClient.get('/reports/payments/overview', { params });
    return res.data;
  },
  getDistribution: async (params?: PaymentFilterParams): Promise<PaymentDistributionItem[]> => {
    const res = await apiClient.get('/reports/payments/distribution', { params });
    return res.data;
  },
  getTrend: async (params?: PaymentFilterParams & { granularity?: string }): Promise<PaymentTrendItem[]> => {
    const res = await apiClient.get('/reports/payments/trend', { params });
    return res.data;
  },
  getTransactions: async (params?: PaymentFilterParams): Promise<PaymentTransactionsResponse> => {
    const res = await apiClient.get('/reports/payments/transactions', { params });
    return res.data;
  },
  getCustomerPayments: async (params?: PaymentFilterParams): Promise<CustomerPaymentItem[]> => {
    const res = await apiClient.get('/reports/payments/customers', { params });
    return res.data;
  },
  getMethodAnalysis: async (params?: PaymentFilterParams): Promise<MethodAnalysisItem[]> => {
    const res = await apiClient.get('/reports/payments/methods', { params });
    return res.data;
  },
  getPaymentDetail: async (docEntry: number): Promise<PaymentDetailResponse> => {
    const res = await apiClient.get(`/reports/payments/detail/${docEntry}`);
    return res.data;
  },
  exportTransactions: async (params?: PaymentFilterParams & { format?: string }): Promise<Blob> => {
    const res = await apiClient.get('/reports/payments/export', { params, responseType: 'blob' });
    return res.data;
  }
};

export interface InvoiceOverview {
  totalInvoices: number;
  totalSales: number;
  totalPaid: number;
  totalDue: number;
  avgInvoiceValue: number;
  paidPercentage: number;
  duePercentage: number;
  counts: {
    paid: number;
    partiallyPaid: number;
    unpaid: number;
    cancelled: number;
  };
  growth?: {
    invoicesPct?: number;
    salesPct?: number;
    avgPct?: number;
  };
  currency?: string;
  period?: {
    range?: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  rules?: Record<string, string>;
}

export interface InvoiceListItem {
  docEntry: number;
  docNum: number;
  invoiceNo: string;
  docDate: string;
  docTime: string;
  dateTime: string;
  cardCode: string;
  cardName: string;
  docTotal: number;
  paidToDate: number;
  balanceDue: number;
  currency: string;
  invoiceStatus: 'Open' | 'Closed' | 'Cancelled';
  paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Cancelled';
  paymentMethod: string;
  branchId?: number;
  branchName?: string;
  cancelled: boolean;
  vatSum?: number;
  totalDiscount?: number;
}

export interface InvoiceListResponse {
  total: number;
  items: InvoiceListItem[];
  offset: number;
  limit: number;
}

export interface InvoiceTrendItem {
  label: string;
  invoicesCount: number;
  totalSales: number;
  totalPaid: number;
  totalDue: number;
}

export interface InvoiceStatusBreakdownItem {
  status: string;
  count: number;
  total: number;
  percentage: number;
}

export interface InvoiceAnalyticsResponse {
  trend: InvoiceTrendItem[];
  paymentStatusBreakdown: InvoiceStatusBreakdownItem[];
  invoiceStatusBreakdown: InvoiceStatusBreakdownItem[];
  topCustomers: Array<{
    cardCode: string;
    cardName: string;
    totalSales: number;
    invoicesCount: number;
  }>;
}

export interface InvoiceLineItem {
  lineNum: number;
  itemCode: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  warehouseCode?: string;
  taxCode?: string;
}

export interface InvoiceDetailResponse {
  docEntry: number;
  docNum: number;
  invoiceNo: string;
  docDate: string;
  docDueDate?: string;
  docTime: string;
  cardCode: string;
  cardName: string;
  docTotal: number;
  paidToDate: number;
  balanceDue: number;
  currency: string;
  invoiceStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  branchId?: number;
  branchName?: string;
  cancelled: boolean;
  comments?: string;
  vatSum?: number;
  totalDiscount?: number;
  lines: InvoiceLineItem[];
}

export interface InvoiceFilterParams {
  range?: string;
  from_date?: string;
  to_date?: string;
  branch?: string;
  customer?: string;
  invoice_status?: string;
  payment_status?: string;
  payment_method?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
  force_refresh?: boolean;
}

export const invoicesReportApi = {
  getOverview: async (params?: InvoiceFilterParams): Promise<InvoiceOverview> => {
    const res = await apiClient.get('/reports/invoices/overview', { params });
    return res.data;
  },
  getList: async (params?: InvoiceFilterParams): Promise<InvoiceListResponse> => {
    const res = await apiClient.get('/reports/invoices/list', { params });
    return res.data;
  },
  getAnalytics: async (params?: InvoiceFilterParams & { granularity?: string }): Promise<InvoiceAnalyticsResponse> => {
    const res = await apiClient.get('/reports/invoices/analytics', { params });
    return res.data;
  },
  getDetail: async (docEntry: number): Promise<InvoiceDetailResponse> => {
    const res = await apiClient.get(`/reports/invoices/detail/${docEntry}`);
    return res.data;
  },
  exportInvoices: async (params?: InvoiceFilterParams & { format?: string }): Promise<Blob> => {
    const res = await apiClient.get('/reports/invoices/export', { params, responseType: 'blob' });
    return res.data;
  },
};


export interface AIAssistantChatPayload {
  message: string;
  branch_id: string;
  conversation_id?: string;
  history?: Array<{ role: string; content: string }>;
  context?: Record<string, any>;
}

export interface AIAssistantChatResponse {
  answer: string;
  conversation_id: string;
  branch_context: string;
  structured_data?: any;
  suggested_follow_ups?: string[];
  intent_id?: string;
  context?: Record<string, any>;
}

export const aiAssistantApi = {
  chat: async (
    payload: AIAssistantChatPayload,
    options?: { signal?: AbortSignal; timeout?: number }
  ): Promise<AIAssistantChatResponse> => {
    const res = await apiClient.post<AIAssistantChatResponse>('/ai-assistant/chat', payload, {
      signal: options?.signal,
      timeout: options?.timeout ?? 45000,
    });
    return res.data;
  },
};

// ── Finance Overview Interfaces & API ──────────────────────────────────────────

export interface FinanceKPIItem {
  value: number;
  invoice_count?: number;
  payment_count?: number;
  growth?: number;
  is_positive?: boolean;
  subtext?: string;
}

export interface FinanceSalesPurchasesTrendPoint {
  period: string;
  month: string;
  sales: number;
  purchases: number;
}

export interface FinancePaymentsTrendPoint {
  period: string;
  month: string;
  incoming: number;
  outgoing: number;
}

export interface FinanceTopCustomer {
  rank: number;
  customerName: string;
  customerCode: string;
  invoices: number;
  netSales: number;
  percentage: number;
}

export interface FinanceTopSupplier {
  rank: number;
  supplierName: string;
  supplierCode: string;
  invoices: number;
  netPurchases: number;
  percentage: number;
}

export interface FinancePaymentItem {
  docEntry: number;
  refNo: string;
  date: string;
  customer?: string;
  supplier?: string;
  amount: number;
  status: string;
}

export interface FinanceOverviewResponse {
  period: {
    range: string;
    from_date: string;
    to_date: string;
    label: string;
  };
  kpis: {
    total_sales: FinanceKPIItem;
    total_purchases: FinanceKPIItem;
    incoming_payments: FinanceKPIItem;
    outgoing_payments: FinanceKPIItem;
    accounts_receivable: FinanceKPIItem;
    accounts_payable: FinanceKPIItem;
    gross_profit: FinanceKPIItem;
    gross_margin: FinanceKPIItem;
  };
  charts: {
    sales_vs_purchases: FinanceSalesPurchasesTrendPoint[];
    payments_trend: FinancePaymentsTrendPoint[];
  };
  tables: {
    top_customers: FinanceTopCustomer[];
    top_suppliers: FinanceTopSupplier[];
    recent_payments: {
      incoming: FinancePaymentItem[];
      outgoing: FinancePaymentItem[];
    };
  };
  meta: {
    timestamp: string;
    branch_id: string;
    is_cached: boolean;
  };
}

export interface RecordUpdateDiffItem {
  field: string;
  label: string;
  old_value: any;
  new_value: any;
  permitted: boolean;
}

export interface FinanceRecordDetails {
  entity_type: string;
  record_id: string;
  doc_num: string;
  status: string;
  can_edit: boolean;
  user_role: string;
  editable_fields: Record<string, {
    label: string;
    type: string;
    current_value: any;
    max_length?: number;
  }>;
  locked_fields: Record<string, {
    current_value: any;
    reason: string;
  }>;
  raw_record?: Record<string, any>;
}

export interface RecordUpdateValidation {
  is_valid: boolean;
  errors: string[];
  diff: RecordUpdateDiffItem[];
  record_id: string;
  entity_type: string;
}

export interface RecordSubmissionResponse {
  success: boolean;
  message: string;
  diff: RecordUpdateDiffItem[];
  audit_id?: string;
  timestamp?: string;
  updated_record?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id: string;
  username: string;
  role: string;
  entity_type: string;
  record_id: string;
  action: string;
  changes: RecordUpdateDiffItem[];
  status: string;
  sap_response?: Record<string, any>;
  error_message?: string;
  ip_address?: string;
}

export interface FinanceAdminSettings {
  assistant_mode: string;
  version: string;
  sap_status: string;
  sap_circuit_breaker: string;
  sap_authenticated: boolean;
  enabled_capabilities: string[];
  role_permission_matrix: Record<string, {
    view_all_reports: boolean;
    edit_permitted_fields: boolean;
    submit_sap_writeback: boolean;
    view_audit_trail: boolean;
    manage_settings: boolean;
  }>;
  last_synced: string;
}

export const financeApi = {
  getOverview: async (params?: {
    range?: string;
    branch?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<FinanceOverviewResponse> => {
    const res = await apiClient.get('/finance/overview', { params });
    return res.data;
  },

  getPurchaseInvoices: async (params?: any) => {
    const res = await apiClient.get('/finance/purchase-invoices', { params });
    return res.data;
  },

  getIncomingPayments: async (params?: any) => {
    const res = await apiClient.get('/finance/incoming-payments', { params });
    return res.data;
  },

  getOutgoingPayments: async (params?: any) => {
    const res = await apiClient.get('/finance/outgoing-payments', { params });
    return res.data;
  },

  getCustomerAnalysis: async (params?: any) => {
    const res = await apiClient.get('/finance/customer-analysis', { params });
    return res.data;
  },

  getSupplierAnalysis: async (params?: any) => {
    const res = await apiClient.get('/finance/supplier-analysis', { params });
    return res.data;
  },

  getProfitabilityReport: async (params?: any) => {
    const res = await apiClient.get('/finance/profitability-reports', { params });
    return res.data;
  },

  exportFinanceData: async (params: any) => {
    const res = await apiClient.get('/finance/export', { params, responseType: 'blob' });
    return res.data;
  },

  getRecordDetails: async (params: {
    entity_type: string;
    record_id: string;
  }): Promise<FinanceRecordDetails> => {
    const res = await apiClient.get('/finance/record-details', { params });
    return res.data;
  },

  validateUpdate: async (payload: {
    entity_type: string;
    record_id: string;
    updates: Record<string, any>;
  }): Promise<RecordUpdateValidation> => {
    const res = await apiClient.post('/finance/validate-update', payload);
    return res.data;
  },

  submitUpdate: async (payload: {
    entity_type: string;
    record_id: string;
    updates: Record<string, any>;
    confirm: boolean;
  }): Promise<RecordSubmissionResponse> => {
    const res = await apiClient.post('/finance/submit-update', payload);
    return res.data;
  },

  getAuditLog: async (params?: {
    entity_type?: string;
    record_id?: string;
    limit?: number;
  }): Promise<{ total_entries: number; entries: AuditLogEntry[] }> => {
    const res = await apiClient.get('/finance/audit-log', { params });
    return res.data;
  },

  getAdminSettings: async (): Promise<FinanceAdminSettings> => {
    const res = await apiClient.get('/finance/admin-settings');
    return res.data;
  },
};


export interface PermissionItem {
  id: string;
  name: string;
  module: string;
  description?: string;
}

export interface RoleItem {
  name: string;
  description?: string;
  permissions: string[];
}

export interface UserPermissionsResponse {
  user_id: string;
  role: string;
  effective_permissions: string[];
  custom_permissions?: string[];
}

export const adminApi = {
  getUsers: async () => {
    const res = await apiClient.get('/admin/users');
    return res.data;
  },
  getUser: async (userId: string) => {
    const res = await apiClient.get(`/admin/users/${userId}`);
    return res.data;
  },
  createUser: async (payload: Record<string, any>) => {
    const res = await apiClient.post('/admin/users', payload);
    return res.data;
  },
  updateUser: async (userId: string, payload: Record<string, any>) => {
    const res = await apiClient.put(`/admin/users/${userId}`, payload);
    return res.data;
  },
  getPermissions: async (): Promise<PermissionItem[]> => {
    const res = await apiClient.get('/admin/permissions');
    return res.data;
  },
  getRoles: async (): Promise<RoleItem[]> => {
    const res = await apiClient.get('/admin/roles');
    return res.data;
  },
  getUserPermissions: async (userId: string): Promise<UserPermissionsResponse> => {
    const res = await apiClient.get(`/admin/users/${userId}/permissions`);
    return res.data;
  },
  setUserPermissions: async (userId: string, permissions: string[]) => {
    const res = await apiClient.put(`/admin/users/${userId}/permissions`, { permissions });
    return res.data;
  },
  revokeSessions: async (userId: string) => {
    const res = await apiClient.post(`/admin/users/${userId}/revoke-sessions`);
    return res.data;
  },
  activateUser: async (userId: string) => {
    const res = await apiClient.put(`/admin/users/${userId}/activate`);
    return res.data;
  },
  getAuditLogs: async (limit: number = 50) => {
    const res = await apiClient.get('/admin/audit-logs', { params: { limit } });
    return res.data;
  },
};

// ── Smart Email Assistant Interfaces & API ────────────────────────────────────

export interface EmailDraftPayload {
  purpose?: string;
  recipient_email?: string;
  recipient_name?: string;
  customer_code?: string;
  supplier_code?: string;
  record_type?: string;
  record_id?: string;
  prompt?: string;
  additional_notes?: string;
  context_data?: Record<string, any>;
}

export interface EmailDraftResponse {
  draft_id: string;
  purpose: string;
  recipient_email: string;
  recipient_name: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  business_context?: Record<string, any>;
  verified_context?: Record<string, any>;
  suggested_follow_ups?: string[];
  is_ready_to_send?: boolean;
  validation_warnings?: string[];
  company_signature?: string;
}

export interface EmailSendPayload {
  draft_id?: string;
  recipient_email: string;
  recipient_name?: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  purpose?: string;
  record_type?: string;
  record_id?: string;
  business_context?: Record<string, any>;
  idempotency_key?: string;
  confirmed: boolean;
}

export interface EmailSendResponse {
  success: boolean;
  status: string;
  provider: string;
  message_id: string;
  recipient_email: string;
  subject: string;
  sent_at: string;
  audit_id: string;
  details?: Record<string, any>;
}

export interface EmailAuditLogItem {
  id: string;
  user_id?: string;
  username?: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  purpose: string;
  record_type?: string;
  record_id?: string;
  status: string;
  provider: string;
  provider_message_id?: string;
  error_message?: string;
  created_at: string;
}

export const emailApi = {
  generateDraft: async (payload: EmailDraftPayload): Promise<EmailDraftResponse> => {
    const res = await apiClient.post<EmailDraftResponse>('/email/draft', payload);
    return res.data;
  },
  sendEmail: async (payload: EmailSendPayload): Promise<EmailSendResponse> => {
    const res = await apiClient.post<EmailSendResponse>('/email/send', payload);
    return res.data;
  },
  getAuditLogs: async (params?: { limit?: number; offset?: number; recipient?: string; record_id?: string }): Promise<EmailAuditLogItem[]> => {
    const res = await apiClient.get<EmailAuditLogItem[]>('/email/audit-logs', { params });
    return res.data;
  },
  getSettings: async () => {
    const res = await apiClient.get('/email/settings');
    return res.data;
  },
};

export type {
  PurchaseInvoiceItem,
  PurchaseInvoiceSummary,
  PurchaseInvoicesResponse,
  IncomingPaymentItem,
  IncomingPaymentSummary,
  IncomingPaymentsResponse,
  OutgoingPaymentItem,
  OutgoingPaymentSummary,
  OutgoingPaymentsResponse,
  CustomerAnalysisItem,
  CustomerAnalysisSummary,
  CustomerAnalysisResponse,
  SupplierAnalysisItem,
  SupplierAnalysisSummary,
  SupplierAnalysisResponse,
  ProfitabilitySummary,
  ProfitabilityTrendItem,
  ProfitabilityResponse,
} from './finance';

