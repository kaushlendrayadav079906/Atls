import { apiClient } from './apiClient';
import type { SapBusinessDataResponse } from '../types';

export const sapService = {
  /**
   * Fetches the authoritative SAP integration and business data status from the backend.
   * Calls GET /api/v1/business-data/sap
   */
  async getSapStatus(): Promise<SapBusinessDataResponse> {
    return apiClient.get<SapBusinessDataResponse>('/business-data/sap');
  },
};
