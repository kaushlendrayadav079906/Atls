import { apiClient } from './apiClient';
import { isDemoMode } from '../config';
import { demoFactories } from './demoData';
import type { Factory, FactoryFinancials } from '../types';

export const factoryService = {
  /**
   * Retrieves all factories belonging to the authenticated tenant.
   * GET /api/v1/factories?skip=0&limit=100
   */
  getFactories: async (skip = 0, limit = 100): Promise<Factory[]> => {
    if (isDemoMode()) {
      return Promise.resolve(demoFactories);
    }
    return apiClient.get<Factory[]>(`/factories?skip=${skip}&limit=${limit}`);
  },

  /**
   * Legacy alias for backward compatibility across dashboard modules.
   */
  listFactories: async (skip = 0, limit = 100): Promise<Factory[]> => {
    return factoryService.getFactories(skip, limit);
  },

  /**
   * Retrieves single factory details by factory UUID.
   * GET /api/v1/factories/{factory_id}
   */
  getFactory: async (factoryId: string): Promise<Factory> => {
    if (isDemoMode()) {
      const found = demoFactories.find((f) => f.id === factoryId);
      if (!found) throw new Error('Factory not found');
      return Promise.resolve(found);
    }
    return apiClient.get<Factory>(`/factories/${factoryId}`);
  },

  /**
   * Retrieves factory financials for a specific year and month.
   * GET /api/v1/factories/{factory_id}/financials?year={year}&month={month}
   */
  getFactoryFinancials: async (
    factoryId: string,
    year: number,
    month: number
  ): Promise<FactoryFinancials> => {
    if (isDemoMode()) {
      const found = demoFactories.find((f) => f.id === factoryId);
      return Promise.resolve({
        factory_id: factoryId,
        factory_name: found?.name || 'Factory',
        year,
        month,
        revenue: 450000,
        expenditure: 320000,
        profit: 130000,
      });
    }
    return apiClient.get<FactoryFinancials>(
      `/factories/${factoryId}/financials?year=${year}&month=${month}`
    );
  },
};
