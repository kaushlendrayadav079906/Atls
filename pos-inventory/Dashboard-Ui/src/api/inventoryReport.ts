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

export interface MovementRecord {
  id: string;
  doc_num: string;
  doc_type: string;
  doc_date: string;
  item_code: string;
  item_name: string;
  quantity: number;
  warehouse: string;
  comments?: string;
}

export interface MovementsListResponse {
  items: MovementRecord[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ValuationItem {
  id: string;
  item_code: string;
  name: string;
  category: string;
  warehouse: string;
  current_stock: number;
  unit_cost: number;
  stock_value: number;
  valuation_method: string;
  percentage_of_total: number;
}

export interface ValuationResponse {
  items: ValuationItem[];
  total_stock_value: number;
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface LowStockItem {
  id: string;
  item_code: string;
  name: string;
  category: string;
  warehouse: string;
  current_stock: number;
  min_stock: number;
  deficit: number;
  status: string;
}

export interface LowStockResponse {
  items: LowStockItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ExpiryItem {
  id: string;
  item_code: string;
  name: string;
  batch_number: string;
  admission_date?: string;
  expiration_date?: string;
  status: string;
  tracking_supported: boolean;
  notice?: string;
}

export interface ExpiryResponse {
  items: ExpiryItem[];
  total: number;
  expiring_count: number;
  page: number;
  limit: number;
  total_pages: number;
  limitation_notice?: string;
}

export const getInventoryOverview = async (warehouse?: string, category?: string): Promise<InventoryOverview> => {
  const params = new URLSearchParams();
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  if (category && category !== 'All Categories' && category !== 'All') params.append('category', category);
  const response = await apiClient.get(`/reports/inventory/overview?${params.toString()}`);
  return response.data;
};

export const getInventoryDistribution = async (warehouse?: string, category?: string): Promise<InventoryDistribution> => {
  const params = new URLSearchParams();
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  if (category && category !== 'All Categories' && category !== 'All') params.append('category', category);
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

export const getInventoryMovements = async (
  period: string,
  warehouse?: string,
  fromDate?: string,
  toDate?: string
): Promise<{data: InventoryMovement[], status: string, message?: string}> => {
  const params = new URLSearchParams();
  params.append('period', period);
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  if (fromDate) params.append('from_date', fromDate);
  if (toDate) params.append('to_date', toDate);
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
  if (filters.category && filters.category !== 'All Categories' && filters.category !== 'All') params.append('category', filters.category);
  if (filters.status && filters.status !== 'All') params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  
  const response = await apiClient.get(`/reports/inventory/products?${params.toString()}`);
  return response.data;
};

export const getInventoryMovementsList = async (
  page: number,
  limit: number,
  filters: { warehouse?: string, search?: string, movement_type?: string, from_date?: string, to_date?: string }
): Promise<MovementsListResponse> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters.warehouse && filters.warehouse !== 'All') params.append('warehouse', filters.warehouse);
  if (filters.search) params.append('search', filters.search);
  if (filters.movement_type && filters.movement_type !== 'All') params.append('movement_type', filters.movement_type);
  if (filters.from_date) params.append('from_date', filters.from_date);
  if (filters.to_date) params.append('to_date', filters.to_date);

  const response = await apiClient.get(`/reports/inventory/movements-list?${params.toString()}`);
  return response.data;
};

export const getInventoryValuation = async (
  page: number,
  limit: number,
  filters: { warehouse?: string, category?: string, search?: string }
): Promise<ValuationResponse> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters.warehouse && filters.warehouse !== 'All') params.append('warehouse', filters.warehouse);
  if (filters.category && filters.category !== 'All Categories' && filters.category !== 'All') params.append('category', filters.category);
  if (filters.search) params.append('search', filters.search);

  const response = await apiClient.get(`/reports/inventory/valuation?${params.toString()}`);
  return response.data;
};

export const getInventoryLowStock = async (
  page: number,
  limit: number,
  filters: { warehouse?: string, category?: string, search?: string }
): Promise<LowStockResponse> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters.warehouse && filters.warehouse !== 'All') params.append('warehouse', filters.warehouse);
  if (filters.category && filters.category !== 'All Categories' && filters.category !== 'All') params.append('category', filters.category);
  if (filters.search) params.append('search', filters.search);

  const response = await apiClient.get(`/reports/inventory/low-stock?${params.toString()}`);
  return response.data;
};

export const getInventoryExpiry = async (
  page: number,
  limit: number,
  filters: { search?: string }
): Promise<ExpiryResponse> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters.search) params.append('search', filters.search);

  const response = await apiClient.get(`/reports/inventory/expiry?${params.toString()}`);
  return response.data;
};

export const downloadInventoryCsv = (
  tab: string,
  filters: { warehouse?: string, category?: string, status?: string, search?: string, from_date?: string, to_date?: string }
) => {
  const params = new URLSearchParams();
  params.append('tab', tab);
  if (filters.warehouse && filters.warehouse !== 'All') params.append('warehouse', filters.warehouse);
  if (filters.category && filters.category !== 'All Categories' && filters.category !== 'All') params.append('category', filters.category);
  if (filters.status && filters.status !== 'All') params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.from_date) params.append('from_date', filters.from_date);
  if (filters.to_date) params.append('to_date', filters.to_date);

  const url = `${apiClient.defaults.baseURL}/reports/inventory/export?${params.toString()}`;
  window.open(url, '_blank');
};
