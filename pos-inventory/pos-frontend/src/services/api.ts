import axios, { AxiosError } from 'axios';
import type {
    AdminDashboardData,
    AdminUser,
    Branch,
    CartItem,
    CheckoutData,
    CustomerInsightsData,
    CustomerSearchResult,
    DashboardRecentSale,
    DashboardRecentSalesPage,
    DashboardSummary,
    DateRange,
    ExchangeCreate,
    ExchangeResponse,
    GstValuesResponse,
    InvoiceLookupResult,
    OperatorDashboardData,
    Product,
    ReportPreviewData,
    ReportPreviewRow,
    ReturnCreate,
    ReturnDetail,
    ReturnResponse,
} from '../types';
import { deleteCookie } from '../utils/cookies';
import { getValidToken } from '../utils/jwt';

const BASE_URL =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api/v1';

// API Error type for consistent error handling
export interface ApiError {
  message: string;
  status?: number;
  detail?: string;
}

// Helper to extract error message from API responses
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string; message?: string }>;
    // Try to get error detail from response
    if (axiosError.response?.data?.detail) {
      return axiosError.response.data.detail;
    }
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    // HTTP status based messages
    if (axiosError.response?.status === 401) {
      return 'Session expired. Please login again.';
    }
    if (axiosError.response?.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (axiosError.response?.status === 404) {
      return 'Resource not found.';
    }
    if (axiosError.response?.status === 502) {
      return 'SAP service is unavailable. Please try again later.';
    }
    if (axiosError.response?.status === 503) {
      return 'Authentication service is unavailable. Check the PostgreSQL connection.';
    }
    if (axiosError.response?.status === 500) {
      return 'Server error. Please try again later.';
    }
    if (axiosError.code === 'ECONNABORTED') {
      return 'Request timeout. Please check your connection.';
    }
    if (!axiosError.response) {
      return 'Network error. Please check your connection.';
    }
    return axiosError.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // Increased timeout for SAP calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject Bearer token on every request from cookie
api.interceptors.request.use((config) => {
  const token = getValidToken();
  const isPublicAuthPage =
    window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
  
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  } else {
    // If we're not already on login page and token is missing/expired, redirect
    if (!isPublicAuthPage) {
      window.location.href = '/login';
    }
  }
  return config;
});

// Add response interceptor to handle auth errors and auto-redirect on expired token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear expired/invalid token
      deleteCookie('pos_token');
      deleteCookie('pos_user');
      
      // Redirect to login if not already there
      if (
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/register')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = async (
  credentials: { username: string; password: string }
): Promise<{ access_token: string; token_type: string; user?: Record<string, any> }> => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const registerUser = async (
  userData: {
    username: string;
    email: string;
    password: string;
    name: string;
    master_password: string;
    role?: 'user' | 'admin';
    branch_id?: string;
    store_name?: string;
  }
): Promise<{ access_token: string; token_type: string; user?: Record<string, any> }> => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const logoutUser = async (): Promise<void> => {
  await api.post('/auth/logout');
};

// Product services - All products fetched from SAP
export const getProducts = async (forceRefresh = false): Promise<Product[]> => {
  const config = forceRefresh
    ? { params: { force_refresh: true }, headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
    : {};
  const response = await api.get('/products', config);
  return response.data;
};

export const addProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  const response = await api.post('/products', product);
  return response.data;
};

export const updateProduct = async (id: string, product: Partial<Product>): Promise<Product> => {
  const response = await api.put(`/products/${id}`, product);
  return response.data;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await api.delete(`/products/${id}`);
};

// Sales services - Creates invoice in SAP with incoming payment
export const createSale = async (
  checkoutData: CheckoutData
): Promise<{ saleId: string; total: number; sapDocEntry?: number; sapDocNum?: number }> => {
  const response = await api.post('/sales', checkoutData);
  return response.data;
};

export const getAllowedGstValues = async (): Promise<GstValuesResponse> => {
  const response = await api.get('/sales/gst-values');
  return response.data;
};

// Dashboard services - Fetched from SAP
export const getDashboardSummary = async (forceRefresh = false): Promise<DashboardSummary> => {
  const config = forceRefresh
    ? { params: { force_refresh: true }, headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
    : {};
  const response = await api.get('/dashboard/summary', config);
  return response.data;
};

export const getRecentDashboardSales = async (): Promise<DashboardRecentSale[]> => {
  const response = await api.get('/dashboard/recent-sales');
  return response.data;
};

export const getRecentSalesFeed = async (params: {
  range?: DateRange;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<DashboardRecentSalesPage> => {
  const response = await api.get('/dashboard/recent-sales-feed', { params });
  return response.data;
};

export const getOperatorDashboard = async (range: DateRange = 'daily', forceRefresh = false): Promise<OperatorDashboardData> => {
  const config = forceRefresh
    ? { params: { range, force_refresh: true }, headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
    : { params: { range } };
  const response = await api.get('/dashboard/operator', config);
  return response.data;
};

// ── Admin services ─────────────────────────────────────────────────────────

export const getAdminBranches = async (): Promise<Branch[]> => {
  const response = await api.get('/admin/branches');
  return response.data;
};

export const getAdminUsers = async (): Promise<AdminUser[]> => {
  const response = await api.get('/admin/users');
  return response.data;
};

export const createAdminUser = async (userData: {
  username: string;
  email: string;
  password: string;
  name: string;
  role: string;
  branch_id?: string;
  store_name?: string;
}): Promise<AdminUser> => {
  const response = await api.post('/admin/users', userData);
  return response.data;
};

export const updateAdminUser = async (
  userId: string,
  data: Partial<Pick<AdminUser, 'name' | 'email' | 'role' | 'branch_id' | 'store_name' | 'is_active'> & {
    username?: string;
    password?: string;
    current_password?: string;
    new_password?: string;
  }>
): Promise<AdminUser> => {
  const response = await api.put(`/admin/users/${userId}`, data);
  return response.data;
};

export const deactivateAdminUser = async (userId: string): Promise<void> => {
  await api.delete(`/admin/users/${userId}`);
};

export const getAdminDashboard = async (
  range: DateRange = 'monthly',
  branch?: string,
  forceRefresh = false
): Promise<AdminDashboardData> => {
  const params: Record<string, string> = { range };
  if (branch) params.branch = branch;
  if (forceRefresh) params.force_refresh = 'true';
  const config = forceRefresh
    ? { params, headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
    : { params };
  const response = await api.get('/admin/dashboard', config);
  return response.data;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  values.push(current.trim());
  return values;
}

function parseCsvReport(csv: string): ReportPreviewData {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: ReportPreviewRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const columns = parseCsvLine(lines[i]);
    if (columns.length < 9) continue;

    const hasSalesEmployee = columns.length >= 10;
    const salesEmployee = hasSalesEmployee ? columns[4] : undefined;
    const paymentMethod = hasSalesEmployee ? columns[5] : columns[4];
    const subtotal = Number(columns[hasSalesEmployee ? 6 : 5]) || 0;
    const discount = Number(columns[hasSalesEmployee ? 7 : 6]) || 0;
    const gst = Number(columns[hasSalesEmployee ? 8 : 7]) || 0;
    const total = Number(columns[hasSalesEmployee ? 9 : 8]) || 0;

    rows.push({
      docNum: columns[0],
      date: columns[1],
      customer: columns[2] || '-',
      mobile: columns[3] || undefined,
      salesEmployee,
      paymentMethod,
      subtotal,
      discount,
      gst,
      total,
    });
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.subtotal += row.subtotal;
      acc.discount += row.discount;
      acc.gst += row.gst;
      acc.total += row.total;
      return acc;
    },
    { subtotal: 0, discount: 0, gst: 0, total: 0 },
  );

  return {
    rows,
    totals,
  };
}

export const getReportPreview = async (
  range: DateRange = 'monthly',
  branch?: string,
  fromDate?: string,
  toDate?: string,
  reportType: 'sales' | 'invoice' | 'payment' = 'sales',
): Promise<ReportPreviewData> => {
  const params: Record<string, string> = { range, format: 'csv', report_type: reportType };
  if (branch) params.branch = branch;
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;

  const response = await api.get<string>('/admin/reports/export', {
    params,
    responseType: 'text',
    transformResponse: [(data) => data],
  });

  return parseCsvReport(response.data);
};

export const exportReport = async (
  range: DateRange = 'monthly',
  format: 'csv' | 'xlsx' = 'xlsx',
  branch?: string,
  fromDate?: string,
  toDate?: string,
  reportType: 'sales' | 'invoice' | 'payment' = 'sales',
): Promise<void> => {
  const params: Record<string, string> = { range, format, report_type: reportType };
  if (branch) params.branch = branch;
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;

  const response = await api.get('/admin/reports/export', {
    params,
    responseType: 'blob',
  });

  const mimeType = format === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv';
  const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  const today = new Date().toISOString().split('T')[0];
  const extension = format === 'xlsx' ? 'xlsx' : 'csv';
  link.setAttribute('download', `sales_report_${range}_${today}.${extension}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Operator report functions (uses operator-accessible endpoint)
export const getOperatorReportPreview = async (
  range: DateRange = 'monthly',
  fromDate?: string,
  toDate?: string,
  reportType: 'sales' | 'invoice' | 'payment' = 'sales',
): Promise<ReportPreviewData> => {
  const params: Record<string, string> = { range, format: 'csv', report_type: reportType };
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;

  const response = await api.get<string>('/dashboard/reports/export', {
    params,
    responseType: 'text',
    transformResponse: [(data) => data],
  });

  return parseCsvReport(response.data);
};

export const exportOperatorReport = async (
  range: DateRange = 'monthly',
  fromDate?: string,
  toDate?: string,
  reportType: 'sales' | 'invoice' | 'payment' = 'sales',
): Promise<void> => {
  const params: Record<string, string> = { range, format: 'xlsx', report_type: reportType };
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;

  const response = await api.get('/dashboard/reports/export', {
    params,
    responseType: 'blob',
  });

  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  const today = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `my_sales_report_${range}_${today}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Export the axios instance for custom requests
export default api;
// Re-export CartItem so hooks can use it without importing from types directly
export type { CartItem };

// ── Returns & Exchange API ───────────────────────────────────────────────

export const lookupInvoice = async (q: string): Promise<InvoiceLookupResult> => {
  const response = await api.get('/returns/lookup', { params: { q } });
  return response.data;
};

export const createReturn = async (data: ReturnCreate): Promise<ReturnResponse> => {
  const response = await api.post('/returns', data);
  return response.data;
};

export const createExchange = async (data: ExchangeCreate): Promise<ExchangeResponse> => {
  const response = await api.post('/returns/exchange', data);
  return response.data;
};

export const getReturns = async (): Promise<ReturnDetail[]> => {
  const response = await api.get('/returns');
  return response.data;
};

export const getReturnDetail = async (docEntry: number): Promise<ReturnDetail> => {
  const response = await api.get(`/returns/${docEntry}`);
  return response.data;
};

// ── Customer Search & Insights API ──────────────────────────────────────────

export const searchCustomersByMobile = async (
  mobile: string,
  top = 10,
): Promise<CustomerSearchResult[]> => {
  const response = await api.get('/customers/search', { params: { mobile, top } });
  return response.data;
};

export const getCustomerInsights = async (
  range: DateRange = 'monthly',
  branch?: string,
  forceRefresh = false,
): Promise<CustomerInsightsData> => {
  const params: Record<string, string> = { range };
  if (branch) params.branch = branch;
  if (forceRefresh) params.force_refresh = 'true';
  const config = forceRefresh
    ? { params, headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
    : { params };
  const response = await api.get('/customers/insights', config);
  return response.data;
};

// ============================================================
// Atlas Analytics
// ============================================================

export const getAtlasOverview = async (range: string, from_date?: string, to_date?: string, branch?: string) => {
  const params: Record<string, string> = { range };
  if (from_date) params.from_date = from_date;
  if (to_date) params.to_date = to_date;
  if (branch) params.branch = branch;
  const response = await api.get('/atlas/overview', { params });
  return response.data;
};

export const getAtlasSalesTrends = async (range: string, from_date?: string, to_date?: string, branch?: string) => {
  const params: Record<string, string> = { range };
  if (from_date) params.from_date = from_date;
  if (to_date) params.to_date = to_date;
  if (branch) params.branch = branch;
  const response = await api.get('/atlas/sales-trends', { params });
  return response.data;
};

export const getAtlasInventorySummary = async (branch?: string) => {
  const params: Record<string, string> = {};
  if (branch) params.branch = branch;
  const response = await api.get('/atlas/inventory-summary', { params });
  return response.data;
};

export const getAtlasBranchComparison = async (range: string, from_date?: string, to_date?: string) => {
  const params: Record<string, string> = { range };
  if (from_date) params.from_date = from_date;
  if (to_date) params.to_date = to_date;
  const response = await api.get('/atlas/branch-comparison', { params });
  return response.data;
};

export const getAtlasReturnsSummary = async (range: string, from_date?: string, to_date?: string, branch?: string) => {
  const params: Record<string, string> = { range };
  if (from_date) params.from_date = from_date;
  if (to_date) params.to_date = to_date;
  if (branch) params.branch = branch;
  const response = await api.get('/atlas/returns-summary', { params });
  return response.data;
};

export const cancelSale = async (docEntry: number): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(`/sales/${docEntry}/cancel`);
  return response.data;
};

export const getTopCustomers = async (params: {
  range: string;
  from_date?: string;
  to_date?: string;
  branch?: string;
  limit?: number;
}) => {
  const response = await api.get('/atlas/top-customers', { params });
  return response.data;
};

export const getProductVelocity = async (params: {
  range: string;
  from_date?: string;
  to_date?: string;
  branch?: string;
  limit?: number;
}) => {
  const response = await api.get('/atlas/product-velocity', { params });
  return response.data;
};

export const getAlerts = async () => {
  const response = await api.get('/dashboard/alerts');
  return response.data;
};

export const getInventoryRisk = async () => {
  const response = await api.get('/dashboard/inventory-risk');
  return response.data;
};
