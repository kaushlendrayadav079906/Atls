import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../services/api';
import type { DateRange, DashboardRecentSalesPage } from '../types';

const SALES_FEED_PAGE_SIZE = 10;

interface RecentSalesFeedParams {
  range: DateRange;
  search?: string;
}

export function useRecentSalesFeed({ range, search }: RecentSalesFeedParams) {
  return useInfiniteQuery<DashboardRecentSalesPage>({
    queryKey: ['dashboard', 'recent-sales-feed', range, search ?? ''],
    queryFn: ({ pageParam = 0 }) =>
      api.getRecentSalesFeed({
        range,
        search: search || undefined,
        limit: SALES_FEED_PAGE_SIZE,
        offset: pageParam as number,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    meta: {
      errorMessage: 'Failed to load live sales feed',
    },
  });
}
