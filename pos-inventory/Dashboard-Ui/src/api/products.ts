/**
 * Products & Stock API service.
 * Integrates with backend endpoints in pos-backend for product catalog and warehouse stock.
 */

import { apiClient } from './client';
import type { Product } from '../types/products';

export interface ProductSearchParams {
  search?: string;
  warehouse?: string;
  category?: string;
  stock_status?: string;
  force_refresh?: boolean;
}

export const productsApi = {
  /**
   * Search products by name, barcode, or item code with optional warehouse, category, and stock filters.
   * Backend: GET /api/v1/products
   */
  searchProducts: async (queryOrOptions?: string | ProductSearchParams): Promise<Product[]> => {
    const params: Record<string, string> = {};
    if (typeof queryOrOptions === 'string') {
      if (queryOrOptions.trim()) {
        params.search = queryOrOptions.trim().slice(0, 100);
      }
    } else if (queryOrOptions) {
      if (queryOrOptions.search?.trim()) {
        params.search = queryOrOptions.search.trim().slice(0, 100);
      }
      if (queryOrOptions.warehouse) {
        params.warehouse = queryOrOptions.warehouse;
      }
      if (queryOrOptions.category) {
        params.category = queryOrOptions.category;
      }
      if (queryOrOptions.stock_status) {
        params.stock_status = queryOrOptions.stock_status;
      }
      if (queryOrOptions.force_refresh) {
        params.force_refresh = 'true';
      }
    }
    const res = await apiClient.get<Product[]>('/products', { params });
    return res.data;
  },

  /**
   * Fetch a single product by barcode or item code.
   * Backend: GET /api/v1/products/{barcode}
   */
  getProductByBarcode: async (barcode: string): Promise<Product> => {
    const res = await apiClient.get<Product>(`/products/${encodeURIComponent(barcode)}`);
    return res.data;
  },
};
