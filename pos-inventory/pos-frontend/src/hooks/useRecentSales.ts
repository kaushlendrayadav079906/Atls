import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';

export const DASHBOARD_RECENT_SALES_KEY = ['dashboard', 'recent-sales'] as const;

export function useRecentDashboardSales() {
  return useQuery({
    queryKey: DASHBOARD_RECENT_SALES_KEY,
    queryFn: () => api.getRecentDashboardSales(),
    staleTime: 30_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    meta: {
      errorMessage: 'Failed to load recent sales for receipt reprint',
    },
  });
}
