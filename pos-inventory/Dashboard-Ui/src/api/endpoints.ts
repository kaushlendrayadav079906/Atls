import { apiClient } from './client';

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  branch_id?: string;
  store_name?: string;
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
  getSalesTrend: async (branch_id?: string, range: string = 'monthly', customer?: string, category?: string, payment_method?: string, from_date?: string, to_date?: string): Promise<any> => {
    const res = await apiClient.get('/atlas/sales-trends', { params: { branch: branch_id, range, customer, category, payment_method, from_date, to_date } });
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
  averagePaymentValue: number;
  refundsIssued: number;
  refundsAmount: number;
}

export interface PaymentDistributionItem {
  method: string;
  total: number;
  count: number;
}

export interface PaymentTrendItem {
  label: string;
  amount: number;
  count: number;
}

export interface PaymentTransactionItem {
  docEntry: number;
  docNum: number;
  invoiceDocNum?: number;
  docDate: string;
  customerCode: string;
  customerName: string;
  paymentMethod: string;
  totalAmount: number;
  status: string;
  transactionId?: string;
}

export interface PaymentTransactionsResponse {
  total: number;
  items: PaymentTransactionItem[];
}

export const paymentsReportApi = {
  getOverview: async (params?: { range?: string, from_date?: string, to_date?: string, branch?: string, customer?: string, payment_method?: string }): Promise<PaymentOverview> => {
    const res = await apiClient.get('/reports/payments/overview', { params });
    return res.data;
  },
  getDistribution: async (params?: { range?: string, from_date?: string, to_date?: string, branch?: string, customer?: string }): Promise<PaymentDistributionItem[]> => {
    const res = await apiClient.get('/reports/payments/distribution', { params });
    return res.data;
  },
  getTrend: async (params?: { range?: string, from_date?: string, to_date?: string, branch?: string, customer?: string, payment_method?: string, granularity?: string }): Promise<PaymentTrendItem[]> => {
    const res = await apiClient.get('/reports/payments/trend', { params });
    return res.data;
  },
  getTransactions: async (params?: { range?: string, from_date?: string, to_date?: string, branch?: string, customer?: string, payment_method?: string, search?: string, limit?: number, offset?: number }): Promise<PaymentTransactionsResponse> => {
    const res = await apiClient.get('/reports/payments/transactions', { params });
    return res.data;
  }
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



