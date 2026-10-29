import { apiClient } from './client';

export interface StockConfigurationItem {
  item_code: string;
  description: string;
  qty: number;
  stock_qty: number;
  vendor_name: string;
  vendor_code?: string;
  grpo_no: string;
  rcvd_qty: number;
  nt_weight: number;
  qc: boolean;
  drw_yn: 'Y' | 'N';
  v_chk: 'Y' | 'N';
  ok_qty: number;
  rej_qty: number;
  lm: 'Y' | 'N';
  olng: 'Y' | 'N';
  lpk: 'Y' | 'N';
  lbl: 'Y' | 'N';
  mc_or_pt: 'Y' | 'N';
  items_group_code?: string;
  warehouse_code?: string;
  is_active?: boolean;
  entry_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StockKpis {
  total_items: number;
  active_items: number;
  inactive_items: number;
  warehouses_count: number;
}

export interface StockFilters {
  vendors: string[];
  groups: string[];
  warehouses: string[];
}

export interface StockConfigurationResponse {
  items: StockConfigurationItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  kpis: StockKpis;
  filters: StockFilters;
  sap_status: 'connected' | 'disconnected';
  sap_message?: string;
  last_synced_at?: string | null;
}

export interface StockQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  vendor?: string;
  group?: string;
  warehouse?: string;
  branch?: string;
  period?: string;
  date_from?: string;
  date_to?: string;
}

export interface ImportPreviewResponse {
  preview: boolean;
  valid_count: number;
  invalid_count: number;
  duplicates: string[];
  errors: Array<{ row: number; field: string; message: string }>;
  sample_rows?: StockConfigurationItem[];
  imported_count?: number;
  success?: boolean;
}

export interface BulkUpdateItemResult {
  item_code: string;
  success: boolean;
  item?: StockConfigurationItem;
  sap_synced?: boolean;
  sap_message?: string;
  error?: string;
}

export interface BulkUpdateResponse {
  total: number;
  successful: number;
  failed: number;
  sap_synced_count?: number;
  results: BulkUpdateItemResult[];
}

export const stockConfigurationApi = {
  getItems: async (params?: StockQueryParams): Promise<StockConfigurationResponse> => {
    const res = await apiClient.get<StockConfigurationResponse>('/stock-configuration', { params });
    return res.data;
  },

  updateItem: async (
    itemCode: string,
    data: Partial<StockConfigurationItem>
  ): Promise<{ success: boolean; item: StockConfigurationItem; sap_synced?: boolean; sap_message?: string }> => {
    const res = await apiClient.put(`/stock-configuration/items/${encodeURIComponent(itemCode)}`, data);
    return res.data;
  },

  bulkUpdateItems: async (items: Partial<StockConfigurationItem>[]): Promise<BulkUpdateResponse> => {
    const res = await apiClient.post<BulkUpdateResponse>('/stock-configuration/bulk-update', { items });
    return res.data;
  },

  addItem: async (data: Partial<StockConfigurationItem>): Promise<{ success: boolean; item: StockConfigurationItem }> => {
    const res = await apiClient.post('/stock-configuration/items', data);
    return res.data;
  },

  deleteItem: async (itemCode: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/stock-configuration/items/${encodeURIComponent(itemCode)}`);
    return res.data;
  },

  syncFromSap: async (): Promise<{ success: boolean; synced_count: number; total_sap_items: number; timestamp: string }> => {
    const res = await apiClient.post('/stock-configuration/sync');
    return res.data;
  },

  importExcel: async (file: File, preview: boolean = true): Promise<ImportPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('preview', preview ? 'true' : 'false');
    const res = await apiClient.post<ImportPreviewResponse>('/stock-configuration/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  exportExcel: async (params?: StockQueryParams): Promise<Blob> => {
    const res = await apiClient.get('/stock-configuration/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};
