import { useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export interface SapHealthDetails {
  status: 'connected' | 'disconnected' | 'error';
  authenticated: boolean;
  circuit_breaker?: string;
  message?: string;
  timestamp?: string;
}

export interface SystemHealthState {
  isSapConnected: boolean | null;
  isDbConnected: boolean | null;
  sapDetails: SapHealthDetails | null;
  lastChecked: Date | null;
  isLoading: boolean;
  checkHealth: () => Promise<void>;
}

interface RawHealthResult {
  isSapConnected: boolean;
  isDbConnected: boolean;
  sapDetails: SapHealthDetails;
}

const fetchHealth = async (): Promise<RawHealthResult> => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api/v1';

  try {
    // 1. Try dedicated SAP health endpoint (4s timeout max, never blocks the browser or server)
    const sapRes = await axios.get<SapHealthDetails>(`${baseURL}/health/sap`, { timeout: 4000 });
    const sapOk = sapRes.data?.status === 'connected';

    return {
      isSapConnected: sapOk,
      isDbConnected: true,
      sapDetails: sapRes.data,
    };
  } catch {
    // 2. Fallback to top-level /health
    try {
      const rootHealthUrl = baseURL.replace(/\/api\/v1\/?$/, '/health');
      const rootRes = await axios.get(rootHealthUrl, { timeout: 4000 });
      const sapStatus = rootRes.data?.dependencies?.sap === 'connected';
      const dbStatus = rootRes.data?.dependencies?.database === 'connected';

      return {
        isSapConnected: sapStatus,
        isDbConnected: dbStatus,
        sapDetails: {
          status: sapStatus ? 'connected' : 'disconnected',
          authenticated: sapStatus,
          message: sapStatus ? 'SAP connected' : 'SAP unavailable',
        },
      };
    } catch {
      return {
        isSapConnected: false,
        isDbConnected: false,
        sapDetails: {
          status: 'disconnected',
          authenticated: false,
          message: 'Backend server unreachable',
        },
      };
    }
  }
};

export const useSystemHealth = (pollIntervalMs = 30000): SystemHealthState => {
  const queryClient = useQueryClient();
  const prevSapConnectedRef = useRef<boolean | null>(null);

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<RawHealthResult>({
    queryKey: ['systemHealthState'],
    queryFn: async () => {
      const result = await fetchHealth();
      const sapOk = result.isSapConnected;

      // Invalidate dashboard queries once SAP reconnects
      if (prevSapConnectedRef.current === false && sapOk) {
        queryClient.invalidateQueries({ queryKey: ['atlasOverview'] });
        queryClient.invalidateQueries({ queryKey: ['recentSales'] });
        queryClient.invalidateQueries({ queryKey: ['topProducts'] });
        queryClient.invalidateQueries({ queryKey: ['salesTrend'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryRisk'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardAlerts'] });
        queryClient.invalidateQueries({ queryKey: ['executiveCommand'] });
      }
      prevSapConnectedRef.current = sapOk;
      return result;
    },
    staleTime: 20000,
    refetchInterval: pollIntervalMs,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const checkHealth = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    isSapConnected: data ? data.isSapConnected : null,
    isDbConnected: data ? data.isDbConnected : null,
    sapDetails: data ? data.sapDetails : null,
    lastChecked: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isLoading,
    checkHealth,
  };
};

