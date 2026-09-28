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
}

export const customersApi = {
  getInsights: async (range: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time' = 'monthly'): Promise<CustomerInsightsResponse> => {
    const res = await apiClient.get<CustomerInsightsResponse>('/customers/insights', {
      params: { range },
    });
    return res.data;
  },

  searchCustomers: async (search?: string): Promise<DashboardCustomer[]> => {
    const res = await apiClient.get<DashboardCustomer[]>('/dashboard/customers', {
      params: search ? { search } : {},
    });
    return res.data;
  },
};
