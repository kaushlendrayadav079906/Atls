/**
 * React Query hooks for Products.
 *
 * The product list is cached for 10 minutes (matching the backend cache TTL).
 * Mutations automatically invalidate the cache so the list stays fresh.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import * as api from '../services/api';
import { handleError, handleSuccess } from '../utils/errorHandler';
import type { Product } from '../types';
import { DASHBOARD_KEY } from './useDashboard';
import { OPERATOR_DASHBOARD_KEY } from './useOperatorDashboard';
import { useAppSelector } from '../app/hooks';

export const PRODUCTS_KEY = ['products'] as const;

// ─── Fetch all products ───────────────────────────────────────────────────────

export function useProducts(search?: string) {
  const branchId = useAppSelector((state) => state.auth?.user?.branch_id ?? null);
  return useQuery<Product[]>({
    queryKey: search ? [...PRODUCTS_KEY, branchId, search] : [...PRODUCTS_KEY, branchId],
    queryFn: () => api.getProducts(false),
    staleTime: 10 * 60 * 1000, // 10 min – mirrors backend cache TTL
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 min
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchOnMount: false, // Keep cached data on navigation/reload
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    meta: {
      errorMessage: 'Failed to load products from SAP',
    },
  });
}

// ─── Add a product ────────────────────────────────────────────────────────────

export function useAddProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Omit<Product, 'id'>) => api.addProduct(product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: OPERATOR_DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      handleSuccess('Product added successfully', 'Add Product');
      toast.success('Product added successfully!');
    },
    onError: (error) => {
      const errorMsg = handleError(error, 'Add Product');
      toast.error(errorMsg);
    },
  });
}

// ─── Update a product ─────────────────────────────────────────────────────────

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, product }: { id: string; product: Partial<Product> }) =>
      api.updateProduct(id, product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: OPERATOR_DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      handleSuccess('Product updated successfully', 'Update Product');
      toast.success('Product updated successfully!');
    },
    onError: (error) => {
      const errorMsg = handleError(error, 'Update Product');
      toast.error(errorMsg);
    },
  });
}

// ─── Delete a product ─────────────────────────────────────────────────────────

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: OPERATOR_DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      handleSuccess('Product deleted successfully', 'Delete Product');
      toast.success('Product deleted successfully!');
    },
    onError: (error) => {
      const errorMsg = handleError(error, 'Delete Product');
      toast.error(errorMsg);
    },
  });
}
