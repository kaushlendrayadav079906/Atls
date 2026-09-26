import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import * as api from '../services/api';
import type { ReturnCreate, ExchangeCreate, Product } from '../types';
import { PRODUCTS_KEY } from './useProducts';
import { DASHBOARD_KEY } from './useDashboard';
import { OPERATOR_DASHBOARD_KEY } from './useOperatorDashboard';
import { bumpTransactionVersion } from '../features/auth/authSlice';
import type { AppDispatch } from '../app/store';

export const RETURNS_LIST_KEY = ['returns', 'list'] as const;
export const INVOICE_LOOKUP_KEY = (q: string) => ['returns', 'lookup', q] as const;

export function useLookupInvoice(q: string) {
  return useQuery({
    queryKey: INVOICE_LOOKUP_KEY(q),
    queryFn: () => api.lookupInvoice(q),
    enabled: q.trim().length >= 1,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useReturns() {
  return useQuery({
    queryKey: RETURNS_LIST_KEY,
    queryFn: () => api.getReturns(),
    staleTime: 30_000,
    gcTime: 120_000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useCreateReturn() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch<AppDispatch>();
  return useMutation({
    mutationFn: (data: ReturnCreate) => api.createReturn(data),
    onSuccess: (_data, variables) => {
      const returnMap = new Map<string, number>();
      for (const item of variables.items) {
        const next = (returnMap.get(item.itemCode) ?? 0) + item.quantity;
        returnMap.set(item.itemCode, next);
      }

      queryClient.setQueriesData<Product[]>({ queryKey: PRODUCTS_KEY }, (old) => {
        if (!old) return old;
        return old.map((product) => {
          const delta = returnMap.get(product.id);
          if (delta) {
            return { ...product, stock: (product.stock ?? 0) + delta };
          }
          return product;
        });
      });
      queryClient.invalidateQueries({ queryKey: RETURNS_LIST_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: OPERATOR_DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'recent-sales-feed'] });
      dispatch(bumpTransactionVersion());
    },
  });
}

export function useCreateExchange() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch<AppDispatch>();
  return useMutation({
    mutationFn: (data: ExchangeCreate) => api.createExchange(data),
    onSuccess: (_data, variables) => {
      const deltaMap = new Map<string, number>();

      for (const item of variables.returnItems) {
        const next = (deltaMap.get(item.itemCode) ?? 0) + item.quantity;
        deltaMap.set(item.itemCode, next);
      }

      for (const item of variables.replacementItems) {
        const next = (deltaMap.get(item.product.id) ?? 0) - item.quantity;
        deltaMap.set(item.product.id, next);
      }

      queryClient.setQueriesData<Product[]>({ queryKey: PRODUCTS_KEY }, (old) => {
        if (!old) return old;
        return old.map((product) => {
          const delta = deltaMap.get(product.id);
          if (delta) {
            return { ...product, stock: Math.max(0, (product.stock ?? 0) + delta) };
          }
          return product;
        });
      });
      queryClient.invalidateQueries({ queryKey: RETURNS_LIST_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: OPERATOR_DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'recent-sales-feed'] });
      dispatch(bumpTransactionVersion());
    },
  });
}
