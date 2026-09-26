import { useQuery } from '@tanstack/react-query';
import {
  getAtlasOverview,
  getAtlasSalesTrends,
  getAtlasInventorySummary,
  getAtlasBranchComparison,
  getAtlasReturnsSummary,
  getTopCustomers,
  getProductVelocity,
} from '../services/api';
import type {
  AtlasOverview,
  AtlasSalesTrend,
  AtlasInventorySummary,
  AtlasBranchComparison,
  AtlasReturnsSummary,
  AtlasTopCustomer,
  AtlasProductVelocity,
} from '../types';

export const useAtlasOverview = (range: string, from_date?: string, to_date?: string, branch?: string) => {
  return useQuery<AtlasOverview>({
    queryKey: ['atlas', 'overview', range, from_date, to_date, branch],
    queryFn: () => getAtlasOverview(range, from_date, to_date, branch),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAtlasSalesTrends = (range: string, from_date?: string, to_date?: string, branch?: string) => {
  return useQuery<AtlasSalesTrend>({
    queryKey: ['atlas', 'sales-trends', range, from_date, to_date, branch],
    queryFn: () => getAtlasSalesTrends(range, from_date, to_date, branch),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAtlasInventorySummary = (branch?: string, enabled: boolean = true) => {
  return useQuery<AtlasInventorySummary>({
    queryKey: ['atlas', 'inventory-summary', branch],
    queryFn: () => getAtlasInventorySummary(branch),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
};

export const useAtlasBranchComparison = (range: string, from_date?: string, to_date?: string, enabled: boolean = false) => {
  return useQuery<AtlasBranchComparison>({
    queryKey: ['atlas', 'branch-comparison', range, from_date, to_date],
    queryFn: () => getAtlasBranchComparison(range, from_date, to_date),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
};

export const useAtlasReturnsSummary = (range: string, from_date?: string, to_date?: string, branch?: string) => {
  return useQuery<AtlasReturnsSummary>({
    queryKey: ['atlas', 'returns-summary', range, from_date, to_date, branch],
    queryFn: () => getAtlasReturnsSummary(range, from_date, to_date, branch),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAtlasTopCustomers = (range: string, from_date?: string, to_date?: string, branch?: string) => {
  return useQuery<AtlasTopCustomer[]>({
    queryKey: ['atlas', 'top-customers', range, from_date, to_date, branch],
    queryFn: () => getTopCustomers({ range, from_date, to_date, branch, limit: 5 }),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAtlasProductVelocity = (range: string, from_date?: string, to_date?: string, branch?: string) => {
  return useQuery<AtlasProductVelocity[]>({
    queryKey: ['atlas', 'product-velocity', range, from_date, to_date, branch],
    queryFn: () => getProductVelocity({ range, from_date, to_date, branch, limit: 10 }),
    staleTime: 5 * 60 * 1000,
  });
};
