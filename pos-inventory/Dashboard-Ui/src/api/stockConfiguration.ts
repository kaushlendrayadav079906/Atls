import { apiClient } from './client';

export interface StockConfigurationItem {
  sr_no?: number;
  row_id?: string;
  record_id?: string;
  item_code: string;
  description: string;
  qty: number;
  stock_qty: number;
  vendor_name: string;
  vendor_code?: string;
  grpo_no: string;
  rcvd_qty: number;
  nt_weight: number;
  qc: boolean | 'Y' | 'N' | '' | null;
  drw_yn: 'Y' | 'N' | '';
  v_chk: 'Y' | 'N' | '';
  ok_qty: number;
  rej_qty: number;
  lm: 'Y' | 'N' | '';
  olng: 'Y' | 'N' | '';
  lpk: 'Y' | 'N' | '';
  lbl: 'Y' | 'N' | '';
  mc_or_pt: 'Y' | 'N' | '';
  items_group_code?: string;
  warehouse_code?: string;
  is_active?: boolean;
  entry_date?: string | null;
  item_create_date?: string | null;
  so_date?: string | null;
  po_date?: string | null;
  grn_date?: string | null;
  po_no?: string;
  po_doc_entry?: number | null;
  po_line_num?: number | null;
  grpo_doc_entry?: number | null;
  grpo_line_num?: number | null;
  so_no?: string;
  so_qty?: number;
  po_qty?: number;
  record_category?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
  last_submitted_at?: string | null;
  last_submitted_by?: string | null;
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
  sync_interval_seconds?: number;
}

export interface StockSyncStatusResponse {
  auto_sync_active: boolean;
  sync_interval_seconds: number;
  last_synced_at?: string | null;
  last_error?: string | null;
  sap_status: 'connected' | 'disconnected';
  sap_message?: string;
}

export interface StockQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  so_no?: string;
  vendor?: string;
  group?: string;
  warehouse?: string;
  branch?: string;
  period?: string;
  date_from?: string;
  date_to?: string;
  refresh?: boolean;
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
  row_id?: string;
  success: boolean;
  partial_success?: boolean;
  item?: StockConfigurationItem;
  item_master?: any;
  purchase_order?: any;
  sap_synced?: boolean;
  sap_message?: string;
  message?: string;
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
  ): Promise<{
    success: boolean;
    partial_success?: boolean;
    item: StockConfigurationItem;
    item_code?: string;
    item_master?: any;
    purchase_order?: any;
    sap_synced?: boolean;
    sap_message?: string;
    message?: string;
  }> => {
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

  refreshLiveStock: async (
    itemCodes?: string[]
  ): Promise<{ success: boolean; refreshed_count: number; total_items: number; timestamp: string }> => {
    const res = await apiClient.post('/stock-configuration/refresh', { item_codes: itemCodes });
    return res.data;
  },

  getSyncStatus: async (): Promise<StockSyncStatusResponse> => {
    const res = await apiClient.get<StockSyncStatusResponse>('/stock-configuration/sync-status');
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
