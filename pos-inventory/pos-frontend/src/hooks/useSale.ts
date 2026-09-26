/**
 * React Query mutation hook for creating a sale.
 *
 * After success:
 *  - Product stock is decremented in the React Query cache (no full refetch).
 *  - Dashboard totals are invalidated so they refresh from the server.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import * as api from '../services/api';
import { handleError } from '../utils/errorHandler';
import type { CheckoutData, DashboardSummary, Product } from '../types';
import { DASHBOARD_KEY } from './useDashboard';
import { OPERATOR_DASHBOARD_KEY } from './useOperatorDashboard';
import { PRODUCTS_KEY } from './useProducts';
import { DASHBOARD_RECENT_SALES_KEY } from './useRecentSales';
import { bumpTransactionVersion } from '../features/auth/authSlice';
import type { AppDispatch } from '../app/store';

export function useSale() {
  const queryClient = useQueryClient();
  const dispatch = useDispatch<AppDispatch>();

  return useMutation({
    mutationFn: (checkoutData: CheckoutData) => api.createSale(checkoutData),

    // Optimistic update: increment dashboard totals before the server responds
    onMutate: async (checkoutData: CheckoutData) => {
      await queryClient.cancelQueries({ queryKey: DASHBOARD_KEY });

      const previous = queryClient.getQueryData<DashboardSummary>(DASHBOARD_KEY);

      queryClient.setQueryData<DashboardSummary>(DASHBOARD_KEY, (old) =>
        old
          ? {
              todayTotal: old.todayTotal + checkoutData.total,
              billCount: old.billCount + 1,
              itemsSoldCount: (old.itemsSoldCount ?? 0) + checkoutData.items.reduce((sum, i) => sum + i.quantity, 0),
            }
          : old
      );

      return { previous };
    },

    // On success: decrement stock for sold items directly in the cache
    onSuccess: (_data, checkoutData) => {
      const soldMap = new Map(
        checkoutData.items.map((item) => [item.product.id, item.quantity])
      );

      // Use setQueriesData with partial key so it matches all variants of the
      // products cache (e.g. ['products', branchId]).
      queryClient.setQueriesData<Product[]>({ queryKey: PRODUCTS_KEY }, (old) => {
        if (!old) return old;
        return old.map((product) => {
          const soldQty = soldMap.get(product.id);
          if (soldQty) {
            return { ...product, stock: Math.max(0, (product.stock ?? 0) - soldQty) };
          }
          return product;
        });
      });
    },

    // Rollback dashboard on error
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(DASHBOARD_KEY, context.previous);
      }
      // Error is handled in the Checkout component, log for debugging
      handleError(error, 'Sale Creation');
    },

    // Always refetch dashboard after the mutation settles
    onSettled: () => {
      dispatch(bumpTransactionVersion());
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: OPERATOR_DASHBOARD_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_RECENT_SALES_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'recent-sales-feed'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
  });
}
