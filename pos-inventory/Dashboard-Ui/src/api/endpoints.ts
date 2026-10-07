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
