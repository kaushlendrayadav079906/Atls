import { apiClient } from './client';

export type GoogleSheetsConnectionStatus =
  | 'connected'
  | 'not_connected'
  | 'authentication_failed'
  | 'spreadsheet_not_found'
  | 'permission_denied'
  | 'worksheet_not_found'
  | 'api_not_enabled'
  | 'configuration_missing'
  | 'not_a_google_sheet'
  | 'error';

export interface WorksheetInfo {
  name: string;
  index: number;
  row_count?: number | null;
  column_count?: number | null;
}

export interface GoogleSheetsStatus {
  configured: boolean;
  connection_status: GoogleSheetsConnectionStatus;
  spreadsheet_id?: string | null;
  spreadsheet_name?: string | null;
  spreadsheet_url?: string | null;
  worksheet_name?: string | null;
  header_row: number;
  data_start_row: number;
  last_tested_at?: string | null;
  last_successful_sync_at?: string | null;
  service_account_configured: boolean;
  service_account_email?: string | null;
  error_message?: string | null;
  activation_url?: string | null;
  worksheets: string[];
  read_only?: boolean;
  permission_mode?: 'read_write' | 'read_only' | 'not_verified';
}

export interface GoogleSheetsHeaders {
  spreadsheet_id: string;
  worksheet_name: string;
  header_row: number;
  headers: string[];
  total_columns: number;
  total_rows?: number | null;
  last_tested_at?: string | null;
}

export interface GoogleSheetsConnectPayload {
  spreadsheet_url?: string;
  spreadsheet_id?: string;
}

export interface GoogleSheetsTestPayload {
  spreadsheet_id?: string;
  spreadsheet_url?: string;
  worksheet_name?: string;
  header_row?: number;
}

export interface GoogleSheetsConfigPayload {
  spreadsheet_url?: string;
  spreadsheet_id: string;
  spreadsheet_name?: string;
  worksheet_name?: string;
  header_row: number;
  data_start_row: number;
}

export interface GoogleSheetsTestResponse {
  success: boolean;
  connection_status: GoogleSheetsConnectionStatus;
  spreadsheet_name?: string;
  spreadsheet_id?: string;
  worksheets: string[];
  service_account_email?: string;
  message: string;
  tested_at: string;
  activation_url?: string | null;
}

export interface StockConfigurationRecord {
  record_id?: string | null;
  item_code?: string | null;
  description?: string | null;
  qty?: number | null;
  stock_qty?: number | null;
  vendor_name?: string | null;
  grpo_no?: string | null;
  rcvd_qty?: number | null;
  nt_weight?: number | null;
  qc?: boolean | null;
  drw_yn?: string | null;
  v_chk?: string | null;
  ok_qty?: number | null;
  rej_qty?: number | null;
  lm?: string | null;
  olng?: string | null;
  lpk?: string | null;
  lbl?: string | null;
  mc_or_pt?: string | null;
  entry_date?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  raw_data?: Record<string, any>;
}

export interface GoogleSheetsStockRecordsResponse {
  success: boolean;
  spreadsheet_id: string;
  spreadsheet_name?: string | null;
  worksheet_name: string;
  header_row: number;
  data_start_row: number;
  headers: string[];
  column_mapping: Record<string, string>;
  total_records: number;
  records: StockConfigurationRecord[];
  unmapped_headers: string[];
  missing_expected_headers: string[];
  tested_at: string;
}

export interface GoogleSheetsSingleRecordResponse {
  success: boolean;
  message: string;
  item: StockConfigurationRecord;
  spreadsheet_id: string;
  worksheet_name: string;
  source: string;
  timestamp: string;
}

export interface GoogleSheetsBulkItemResult {
  record_id: string;
  item_code?: string;
  success: boolean;
  message?: string;
  error?: string;
  item?: StockConfigurationRecord;
}

export interface GoogleSheetsBulkStockResponse {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  source: string;
  timestamp: string;
  results: GoogleSheetsBulkItemResult[];
  errors: Record<string, any>[];
}

export const googleSheetsApi = {
  getStatus: async (): Promise<GoogleSheetsStatus> => {
    const response = await apiClient.get<GoogleSheetsStatus>('/integrations/google-sheets/status');
    return response.data;
  },

  connect: async (payload: GoogleSheetsConnectPayload): Promise<GoogleSheetsTestResponse> => {
    const response = await apiClient.post<GoogleSheetsTestResponse>('/integrations/google-sheets/connect', payload);
    return response.data;
  },

  testConnection: async (payload?: GoogleSheetsTestPayload): Promise<GoogleSheetsTestResponse> => {
    const response = await apiClient.post<GoogleSheetsTestResponse>('/integrations/google-sheets/test', payload || {});
    return response.data;
  },

  getWorksheets: async (spreadsheetId?: string): Promise<{ spreadsheet_id: string; spreadsheet_name: string; worksheets: WorksheetInfo[] }> => {
    const params = spreadsheetId ? { spreadsheet_id: spreadsheetId } : {};
    const response = await apiClient.get('/integrations/google-sheets/worksheets', { params });
    return response.data;
  },

  getHeaders: async (
    worksheetName: string,
    headerRow: number = 1,
    spreadsheetId?: string
  ): Promise<GoogleSheetsHeaders> => {
    const params: Record<string, string | number> = {
      worksheet_name: worksheetName,
      header_row: headerRow,
    };
    if (spreadsheetId) {
      params.spreadsheet_id = spreadsheetId;
    }
    const response = await apiClient.get<GoogleSheetsHeaders>('/integrations/google-sheets/headers', { params });
    return response.data;
  },

  getStockRecords: async (params?: {
    worksheet_name?: string;
    header_row?: number;
    data_start_row?: number;
    limit?: number;
    spreadsheet_id?: string;
  }): Promise<GoogleSheetsStockRecordsResponse> => {
    const response = await apiClient.get<GoogleSheetsStockRecordsResponse>('/integrations/google-sheets/stock-records', {
      params,
    });
    return response.data;
  },

  createStockRecord: async (payload: Partial<StockConfigurationRecord>): Promise<GoogleSheetsSingleRecordResponse> => {
    const response = await apiClient.post<GoogleSheetsSingleRecordResponse>('/integrations/google-sheets/stock-records', payload);
    return response.data;
  },

  updateStockRecord: async (
    recordId: string,
    payload: Partial<StockConfigurationRecord> & { expected_updated_at?: string }
  ): Promise<GoogleSheetsSingleRecordResponse> => {
    const response = await apiClient.put<GoogleSheetsSingleRecordResponse>(
      `/integrations/google-sheets/stock-records/${encodeURIComponent(recordId)}`,
      payload
    );
    return response.data;
  },

  bulkUpdateStockRecords: async (
    items: Array<Partial<StockConfigurationRecord> & { expected_updated_at?: string }>
  ): Promise<GoogleSheetsBulkStockResponse> => {
    const response = await apiClient.post<GoogleSheetsBulkStockResponse>('/integrations/google-sheets/stock-records/bulk', {
      items,
    });
    return response.data;
  },

  refreshStockRecords: async (): Promise<{
    success: boolean;
    total_records: number;
    records: StockConfigurationRecord[];
    timestamp: string;
    source: string;
  }> => {
    const response = await apiClient.post('/integrations/google-sheets/stock-records/refresh');
    return response.data;
  },

  saveConfiguration: async (payload: GoogleSheetsConfigPayload): Promise<GoogleSheetsStatus> => {
    const response = await apiClient.post<GoogleSheetsStatus>('/integrations/google-sheets/configuration', payload);
    return response.data;
  },

  disconnect: async (): Promise<{ status: string; message: string }> => {
    const response = await apiClient.delete<{ status: string; message: string }>('/integrations/google-sheets/disconnect');
    return response.data;
  },
};

