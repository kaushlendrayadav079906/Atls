import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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

export const useSystemHealth = (pollIntervalMs = 20000): SystemHealthState => {
  const queryClient = useQueryClient();
  const [isSapConnected, setIsSapConnected] = useState<boolean | null>(null);
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
  const [sapDetails, setSapDetails] = useState<SapHealthDetails | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const prevSapConnectedRef = useRef<boolean | null>(null);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api/v1';

    try {
      // 1. Try dedicated SAP health endpoint first (30s timeout for cold-start SAP login over VPN)
      const sapRes = await axios.get<SapHealthDetails>(`${baseURL}/health/sap`, { timeout: 30000 });
      const sapOk = sapRes.data?.status === 'connected';

      setSapDetails(sapRes.data);
      setIsSapConnected(sapOk);
      setLastChecked(new Date());

      // Check if SAP just reconnected after an outage
      if (prevSapConnectedRef.current === false && sapOk) {
        queryClient.invalidateQueries({ queryKey: ['atlasOverview'] });
        queryClient.invalidateQueries({ queryKey: ['recentSales'] });
        queryClient.invalidateQueries({ queryKey: ['topProducts'] });
        queryClient.invalidateQueries({ queryKey: ['salesTrend'] });
        queryClient.invalidateQueries({ queryKey: ['inventoryRisk'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardAlerts'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-overview'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-distribution'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-category-value'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-movements-list'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-valuation'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-low-stock'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-expiry'] });
      }
      prevSapConnectedRef.current = sapOk;
    } catch {
      // Fallback to top-level /health
      try {
        const rootHealthUrl = baseURL.replace(/\/api\/v1\/?$/, '/health');
        const rootRes = await axios.get(rootHealthUrl, { timeout: 30000 });
        const sapStatus = rootRes.data?.dependencies?.sap === 'connected';
        const dbStatus = rootRes.data?.dependencies?.database === 'connected';

        setIsSapConnected(sapStatus);
        setIsDbConnected(dbStatus);
        setSapDetails({
          status: sapStatus ? 'connected' : 'disconnected',
          authenticated: sapStatus,
          message: sapStatus ? 'SAP connected' : 'SAP unavailable',
        });
        setLastChecked(new Date());

        if (prevSapConnectedRef.current === false && sapStatus) {
          console.info('[useSystemHealth] SAP reconnected via fallback! Invalidating queries...');
          queryClient.invalidateQueries({ queryKey: ['atlasOverview'] });
          queryClient.invalidateQueries({ queryKey: ['recentSales'] });
          queryClient.invalidateQueries({ queryKey: ['topProducts'] });
          queryClient.invalidateQueries({ queryKey: ['salesTrend'] });
          queryClient.invalidateQueries({ queryKey: ['inventoryRisk'] });
          queryClient.invalidateQueries({ queryKey: ['dashboardAlerts'] });
        }
        prevSapConnectedRef.current = sapStatus;
      } catch {
        setIsSapConnected(false);
        setIsDbConnected(false);
        setSapDetails({
          status: 'disconnected',
          authenticated: false,
          message: 'Backend server unreachable',
        });
        setLastChecked(new Date());
        prevSapConnectedRef.current = false;
      }
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, pollIntervalMs);
    return () => clearInterval(timer);
  }, [checkHealth, pollIntervalMs]);

  return {
    isSapConnected,
    isDbConnected,
    sapDetails,
    lastChecked,
    isLoading,
    checkHealth,
  };
};
