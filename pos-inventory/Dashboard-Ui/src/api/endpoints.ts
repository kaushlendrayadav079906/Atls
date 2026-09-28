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
  }
};

export const atlasApi = {
  getSalesTrend: async (branch_id?: string): Promise<{ trend: SalesTrendPoint[] }> => {
    const res = await apiClient.get('/atlas/sales-trends', { params: { branch: branch_id } });
    return res.data;
  },
  getOverview: async (branch_id?: string) => {
    const res = await apiClient.get('/atlas/overview', { params: { branch: branch_id } });
    return res.data;
  },
  getTopProducts: async (branch_id?: string): Promise<TopProduct[]> => {
    const res = await apiClient.get('/atlas/product-velocity', { params: { branch: branch_id } });
    return res.data;
  }
};
