import { useQuery } from '@tanstack/react-query';
import { useRef, useCallback } from 'react';
import * as api from '../services/api';
import type { DateRange, OperatorDashboardData } from '../types';
import { useAppSelector } from '../app/hooks';

export const OPERATOR_DASHBOARD_KEY = ['dashboard', 'operator'] as const;
const OPERATOR_DASHBOARD_STORAGE_KEY = 'pos:operator-dashboard:v1';

function readCachedOperatorDashboard(): OperatorDashboardData | undefined {
  try {
    const raw = localStorage.getItem(OPERATOR_DASHBOARD_STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as OperatorDashboardData;
  } catch {
    return undefined;
  }
}

function persistOperatorDashboard(data: OperatorDashboardData): void {
  try {
    localStorage.setItem(OPERATOR_DASHBOARD_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota/private-mode failures.
  }
}

export function useOperatorDashboard(range: DateRange = 'daily') {
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const transactionVersion = useAppSelector((state) => state.auth.transactionVersion);
  const lastSessionRef = useRef<number | null>(null);
  const lastTransactionRef = useRef<number | null>(null);
  const forceRefreshRef = useRef(false);

  const query = useQuery({
    queryKey: [...OPERATOR_DASHBOARD_KEY, range, sessionVersion, transactionVersion],
    queryFn: async () => {
      let force = forceRefreshRef.current;
      forceRefreshRef.current = false;

      // On session change, automatically force-refresh once
      if (lastSessionRef.current !== sessionVersion) {
        lastSessionRef.current = sessionVersion;
        force = true;
      }

      // On sale/return completion, force-refresh to bypass backend cache
      if (lastTransactionRef.current !== transactionVersion) {
        lastTransactionRef.current = transactionVersion;
        if (transactionVersion > 0) {
          force = true;
        }
      }

      const result = await api.getOperatorDashboard(range, force);
      // Only persist daily data as the local cache seed
      if (range === 'daily') persistOperatorDashboard(result);
      return result;
    },
    // Only pre-populate with local cache for the daily view.
    // initialDataUpdatedAt: 0 marks the seed as immediately stale so React Query
    // always fires a background fetch even when initialData is present.
    initialData: range === 'daily' ? readCachedOperatorDashboard : undefined,
    initialDataUpdatedAt: 0,
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    meta: {
      errorMessage: 'Failed to load operator dashboard data',
    },
  });

  /** Call this to trigger a hard refresh that bypasses the backend cache. */
  const forceRefresh = useCallback(() => {
    forceRefreshRef.current = true;
    void query.refetch();
  }, [query]);

  return { ...query, forceRefresh };
}
