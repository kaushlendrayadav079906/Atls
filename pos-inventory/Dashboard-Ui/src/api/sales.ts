import { apiClient } from './client';
import type { DashboardRecentSalesPage, SaleDetail, SalesFeedParams } from '../types/sales';

export const salesApi = {
  getSalesFeed: async (params: SalesFeedParams): Promise<DashboardRecentSalesPage> => {
    const res = await apiClient.get('/dashboard/recent-sales-feed', { params });
    return res.data;
  },
  
  getSaleDetail: async (saleId: string): Promise<SaleDetail> => {
    // Requires SAP DocEntry or DocNum (usually DocEntry as sale_id for the endpoint)
    const res = await apiClient.get(`/sales/${saleId}`);
    return res.data;
  }
};
