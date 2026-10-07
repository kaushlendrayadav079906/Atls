import { apiClient } from './client';

export interface PurchaseOrderLine {
  line_num: number;
  item_code: string;
  item_description: string;
  quantity: number;
  price: number;
  price_after_vat: number;
  line_total: number;
  received_quantity: number;
  open_quantity: number;
  warehouse_code: string | null;
}

export interface PurchaseOrderListItem {
  doc_entry: number;
  doc_num: number;
  doc_date: string | null;
  doc_due_date: string | null;
  card_code: string | null;
  card_name: string | null;
  doc_total: number;
  document_status: string | null;
  cancelled: string | null;
  sales_person_code: string | null;
  bpl_id: number | null;
  comments: string | null;
}

export interface PurchaseOrderListResponse {
  items: PurchaseOrderListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PurchaseOrderSummary {
  total_orders: number;
  pending_orders: number;
  received_orders: number;
  cancelled_orders: number;
}

export interface PurchaseOrderDetail {
  doc_entry: number;
  doc_num: number;
  doc_date: string | null;
  doc_due_date: string | null;
  card_code: string | null;
  card_name: string | null;
  doc_total: number;
  document_status: string | null;
  cancelled: string | null;
  sales_person_code: string | null;
  bpl_id: number | null;
  comments: string | null;
  document_lines: PurchaseOrderLine[];
}

export const purchaseOrdersApi = {
  getOrders: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    supplier?: string;
    buyer?: string;
    branch_id?: number;
    warehouse_code?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<PurchaseOrderListResponse> => {
    const res = await apiClient.get<PurchaseOrderListResponse>('/purchase-orders', { params });
    return res.data;
  },

  getSummary: async (params: { branch_id?: number; date_from?: string; date_to?: string } = {}): Promise<PurchaseOrderSummary> => {
    const res = await apiClient.get<PurchaseOrderSummary>('/purchase-orders/summary', { params });
    return res.data;
  },

  getOrderDetail: async (docEntry: number): Promise<PurchaseOrderDetail> => {
    const res = await apiClient.get<PurchaseOrderDetail>(`/purchase-orders/${docEntry}`);
    return res.data;
  }
};
