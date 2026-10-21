import { apiClient } from './client';

export interface CustomerInsightRow {
  cardCode: string;
  cardName: string;
  totalSpend: number;
  billCount: number;
  averageOrderValue: number;
}

export interface CustomerInsightsResponse {
  topCustomers: CustomerInsightRow[];
  totalCustomers: number;
  repeatCustomerCount: number;
  newCustomerCount: number;
  repeatRate: number;
  totalCLV: number;
}

export interface DashboardCustomer {
  cardCode?: string | null;
  cardName?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappNumber?: string | null;
  paymentMethod?: string | null;
  salesEmployee?: string | null;
  lifetimeValue?: number;
  status?: string;
  cardType?: string;
}

export interface CustomerProfile {
  cardCode: string;
  cardName: string;
  cardType: string;
  phone: string | null;
  email: string | null;
  whatsappNumber: string | null;
  address: string | null;
  status: string;
  registeredOn: string | null;
  lastPurchase: string | null;
  preferredBranch: string | null;
  recentInvoicesCount: number;
  recentReturnsCount: number;
  lifetimeValue: number;
}

export interface CustomerPurchase {
  docEntry: number;
  docNum: number;
  docDate: string;
  docTotal: number;
  status: string;
  branch: string;
  itemCount: number;
}

export interface CustomerReturn {
  docEntry: number;
  docNum: number;
  docDate: string;
  docTotal: number;
  status: string;
  branch: string;
  itemCount: number;
}

export const customersApi = {
  getInsights: async (range: string = 'monthly'): Promise<CustomerInsightsResponse> => {
    const res = await apiClient.get<CustomerInsightsResponse>('/customers/insights', {
      params: { range },
    });
    return res.data;
  },

  searchCustomers: async (params?: { search?: string; card_type?: string; status?: string } | string): Promise<DashboardCustomer[]> => {
    const queryParams: Record<string, string> = {};
    if (typeof params === 'string') {
      if (params.trim()) queryParams.search = params.trim();
    } else if (params) {
      if (params.search?.trim()) queryParams.search = params.search.trim();
      if (params.card_type) queryParams.card_type = params.card_type;
      if (params.status) queryParams.status = params.status;
    }
    const res = await apiClient.get<DashboardCustomer[]>('/dashboard/customers', {
      params: queryParams,
    });
    return res.data;
  },
  
  getCustomerProfile: async (cardCode: string): Promise<CustomerProfile> => {
    const res = await apiClient.get<CustomerProfile>(`/customers/${cardCode}`);
    return res.data;
  },
  
  getCustomerPurchases: async (cardCode: string): Promise<CustomerPurchase[]> => {
    const res = await apiClient.get<CustomerPurchase[]>(`/customers/${cardCode}/purchases`);
    return res.data;
  },
  
  getCustomerReturns: async (cardCode: string): Promise<CustomerReturn[]> => {
    const res = await apiClient.get<CustomerReturn[]>(`/customers/${cardCode}/returns`);
    return res.data;
  },
};
