import { apiClient } from './client';

export interface SalesOrderListItem {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  doc_due_date: string;
  card_code: string;
  card_name: string;
  doc_total: number;
  document_status: string;
  cancelled: string;
  sales_person_code: string | null;
  agent_name?: string | null;
  bpl_id: number | null;
  comments: string | null;
  payment_group_code?: number | null;
  payment_terms?: string | null;
}

export interface SalesOrderListResponse {
  items: SalesOrderListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface SalesOrderSummary {
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  cancelled_orders: number;
}

export interface SalesOrderLine {
  line_num: number;
  item_code: string;
  item_description: string;
  quantity: number;
  price: number;
  price_after_vat: number;
  line_total: number;
  warehouse_code: string;
  dispatch_qty?: number;
  balance_qty?: number;
}

export interface SalesOrderDetail {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  doc_due_date: string;
  card_code: string;
  card_name: string;
  doc_total: number;
  document_status: string;
  cancelled: string;
  sales_person_code: string | null;
  agent_name?: string | null;
  bpl_id: number | null;
  comments: string | null;
  payment_group_code?: number | null;
  payment_terms?: string | null;
  document_lines: SalesOrderLine[];
}

export const salesOrdersApi = {
  getOrders: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    customer?: string;
    sales_employee?: string;
    branch_id?: number;
    warehouse_code?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<SalesOrderListResponse> => {
    const res = await apiClient.get<SalesOrderListResponse>('/sales-orders', { params });
    return res.data;
  },

  getSummary: async (params: { branch_id?: number; date_from?: string; date_to?: string } = {}): Promise<SalesOrderSummary> => {
    const res = await apiClient.get<SalesOrderSummary>('/sales-orders/summary', { params });
    return res.data;
  },

  getOrderDetail: async (docEntry: number): Promise<SalesOrderDetail> => {
    const res = await apiClient.get<SalesOrderDetail>(`/sales-orders/${docEntry}`);
    return res.data;
  }
};
