import { apiClient } from './apiClient';
import { isDemoMode } from '../config';
import { demoTopCustomers, demoSalesByProduct, demoMonthlyTrend } from './demoData';
import type { TopCustomer, SalesByProduct, MonthlyRevenueExpenditure } from '../types';

export const reportService = {
  getTopCustomers: async (limit = 5): Promise<TopCustomer[]> => {
    if (isDemoMode()) {
      return Promise.resolve(demoTopCustomers.slice(0, limit));
    }
    return apiClient.get<TopCustomer[]>(`/reports/top-customers?limit=${limit}`);
  },

  getSalesByProduct: async (limit = 5): Promise<SalesByProduct[]> => {
    if (isDemoMode()) {
      return Promise.resolve(demoSalesByProduct.slice(0, limit));
    }
    return apiClient.get<SalesByProduct[]>(`/reports/sales-by-product?limit=${limit}`);
  },

  getMonthlyRevenueExpenditure: async (
    year: number,
    month: number
  ): Promise<MonthlyRevenueExpenditure> => {
    if (isDemoMode()) {
      const found = demoMonthlyTrend.find((m) => m.year === year && m.month === month);
      return Promise.resolve(
        found || {
          month,
          year,
          revenue: 0,
          expenditure: 0,
          profit: 0,
        }
      );
    }
    return apiClient.get<MonthlyRevenueExpenditure>(
      `/reports/monthly-revenue-expenditure?year=${year}&month=${month}`
    );
  },
};
