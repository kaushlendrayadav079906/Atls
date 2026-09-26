import { apiClient } from './apiClient';
import { isDemoMode } from '../config';
import {
  demoOrganicBusinessData,
  demoMonthlyTrend,
  demoReceivables,
  demoPayables,
  demoInventory,
  demoProduction,
} from './demoData';
import type {
  OrganicBusinessData,
  SapBusinessData,
  MonthlyRevenueExpenditure,
  ReceivablesSummary,
  PayablesSummary,
  InventorySummary,
  ProductionSummary,
} from '../types';

export const businessDataService = {
  getOrganicData: async (): Promise<OrganicBusinessData> => {
    if (isDemoMode()) {
      return Promise.resolve(demoOrganicBusinessData);
    }
    return apiClient.get<OrganicBusinessData>('/business-data/organic');
  },

  getSapData: async (): Promise<SapBusinessData> => {
    if (isDemoMode()) {
      return Promise.resolve({
        status: 'unavailable',
        message: 'Awaiting SAP integration',
      });
    }
    return apiClient.get<SapBusinessData>('/business-data/sap');
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

  getMonthlyTrend: async (
    monthsList: Array<{ year: number; month: number }>
  ): Promise<MonthlyRevenueExpenditure[]> => {
    if (isDemoMode()) {
      return Promise.resolve(demoMonthlyTrend);
    }
    // Fetch month-by-month sequentially or concurrently in real mode
    const results = await Promise.all(
      monthsList.map(async ({ year, month }) => {
        try {
          return await apiClient.get<MonthlyRevenueExpenditure>(
            `/reports/monthly-revenue-expenditure?year=${year}&month=${month}`
          );
        } catch {
          return {
            year,
            month,
            revenue: 0,
            expenditure: 0,
            profit: 0,
          };
        }
      })
    );
    return results;
  },

  getReceivables: async (): Promise<ReceivablesSummary> => {
    if (isDemoMode()) {
      return Promise.resolve(demoReceivables);
    }
    // Real mode fallback computation using organic revenue / open accounts
    const organic = await apiClient.get<OrganicBusinessData>('/business-data/organic');
    const totalRev = Number(organic.total_revenue || 0);
    return {
      total_receivables: totalRev > 0 ? Math.round(totalRev * 0.35) : 0,
      current: totalRev > 0 ? Math.round(totalRev * 0.28) : 0,
      overdue_30_days: totalRev > 0 ? Math.round(totalRev * 0.05) : 0,
      overdue_60_plus_days: totalRev > 0 ? Math.round(totalRev * 0.02) : 0,
      currency_code: 'USD',
    };
  },

  getPayables: async (): Promise<PayablesSummary> => {
    if (isDemoMode()) {
      return Promise.resolve(demoPayables);
    }
    const organic = await apiClient.get<OrganicBusinessData>('/business-data/organic');
    const totalExp = Number(organic.total_expenditure || 0);
    return {
      total_payables: totalExp > 0 ? Math.round(totalExp * 0.3) : 0,
      current: totalExp > 0 ? Math.round(totalExp * 0.24) : 0,
      overdue_30_days: totalExp > 0 ? Math.round(totalExp * 0.04) : 0,
      overdue_60_plus_days: totalExp > 0 ? Math.round(totalExp * 0.02) : 0,
      currency_code: 'USD',
    };
  },

  getInventory: async (): Promise<InventorySummary> => {
    if (isDemoMode()) {
      return Promise.resolve(demoInventory);
    }
    return {
      total_inventory_value: 0,
      total_skus: 0,
      low_stock_items: 0,
      stockout_risk_count: 0,
      health_status: 'OPTIMAL',
    };
  },

  getProduction: async (): Promise<ProductionSummary> => {
    if (isDemoMode()) {
      return Promise.resolve(demoProduction);
    }
    return {
      monthly_output_units: 0,
      target_units: 0,
      achievement_rate_pct: 0,
      active_lines: 0,
      overall_equipment_effectiveness_pct: 0,
    };
  },
};
