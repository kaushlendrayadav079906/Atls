import { apiClient } from './client';

export interface InventoryOverview {
  total_products: number;
  total_stock_value: number;
  low_stock_items: number;
  out_of_stock: number;
  expiring_soon: number;
}

export interface InventoryDistributionStatus {
  status: string;
  count: number;
  percentage: number;
}

export interface InventoryDistribution {
  total: number;
  statuses: InventoryDistributionStatus[];
}

export interface InventoryCategoryValue {
  category: string;
  stock_value: number;
}

export interface InventoryMovement {
  period: string;
  stock_in: number;
  stock_out: number;
}

export interface ProductItem {
  id: string;
  item_code: string;
  name: string;
  sku: string;
  category: string;
  warehouse: string;
  current_stock: number;
  min_stock: number | null;
  stock_value: number;
  status: string;
  last_updated: string | null;
}

export interface ProductsResponse {
  items: ProductItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const getInventoryOverview = async (warehouse?: string): Promise<InventoryOverview> => {
  const params = new URLSearchParams();
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  const response = await apiClient.get(`/reports/inventory/overview?${params.toString()}`);
  return response.data;
};

export const getInventoryDistribution = async (warehouse?: string): Promise<InventoryDistribution> => {
  const params = new URLSearchParams();
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  const response = await apiClient.get(`/reports/inventory/distribution?${params.toString()}`);
  return response.data;
};

export const getInventoryValueByCategory = async (limit: number, warehouse?: string): Promise<{categories: InventoryCategoryValue[]}> => {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  const response = await apiClient.get(`/reports/inventory/value-by-category?${params.toString()}`);
  return response.data;
};

export const getInventoryMovements = async (days: number, warehouse?: string): Promise<{data: InventoryMovement[], status: string, message?: string}> => {
  const params = new URLSearchParams();
  params.append('days', days.toString());
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  const response = await apiClient.get(`/reports/inventory/movements?${params.toString()}`);
  return response.data;
};

export const getInventoryProducts = async (
  page: number,
  limit: number,
  filters: { warehouse?: string, category?: string, status?: string, search?: string }
): Promise<ProductsResponse> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters.warehouse && filters.warehouse !== 'All') params.append('warehouse', filters.warehouse);
  if (filters.category && filters.category !== 'All Categories') params.append('category', filters.category);
  if (filters.status && filters.status !== 'All') params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  
  const response = await apiClient.get(`/reports/inventory/products?${params.toString()}`);
  return response.data;
};
