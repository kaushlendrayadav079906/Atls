/**
 * React Query hook for the Dashboard summary.
 *
 * Data refresh is mutation-driven (sale/product changes) or manual.
 */
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import * as api from '../services/api';
import { useAppSelector } from '../app/hooks';

export const DASHBOARD_KEY = ['dashboard'] as const;

export function useDashboard() {
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const lastSessionRef = useRef<number | null>(null);

  return useQuery({
    queryKey: [...DASHBOARD_KEY, sessionVersion],
    queryFn: () => {
      const shouldForceRefresh = lastSessionRef.current !== sessionVersion;
      if (shouldForceRefresh) {
        lastSessionRef.current = sessionVersion;
      }
      return api.getDashboardSummary(shouldForceRefresh);
    },
    staleTime: 30_000,        // 30 s – matches backend cache TTL
    gcTime: 60_000,           // Keep in cache for 60 s
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    meta: {
      errorMessage: 'Failed to load dashboard data from SAP',
    },
  });
}
