import { apiClient } from './apiClient';
import { isDemoMode } from '../config';
import { demoRealtimeSummary } from './demoData';
import type {
  RealtimeDashboardSummary,
  RealtimeOperationalHealth,
  RealtimeAlertItem,
} from '../types';

export const realtimeService = {
  getSummary: async (factoryId?: string): Promise<RealtimeDashboardSummary> => {
    if (isDemoMode()) {
      return Promise.resolve(demoRealtimeSummary);
    }
    const query = factoryId ? `?factory_id=${factoryId}` : '';
    return apiClient.get<RealtimeDashboardSummary>(`/realtime/summary${query}`);
  },

  getOperationalHealth: async (): Promise<RealtimeOperationalHealth> => {
    if (isDemoMode()) {
      return Promise.resolve({
        status: 'HEALTHY',
        active_plants: 3,
        total_plants: 4,
        active_critical_alerts: 0,
        last_data_sync: new Date().toISOString(),
      });
    }
    return apiClient.get<RealtimeOperationalHealth>('/realtime/operational-health');
  },

  getAlerts: async (severity?: string, limit = 10): Promise<RealtimeAlertItem[]> => {
    if (isDemoMode()) {
      return Promise.resolve([]);
    }
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    params.append('limit', limit.toString());
    return apiClient.get<RealtimeAlertItem[]>(`/realtime/alerts?${params.toString()}`);
  },
};
