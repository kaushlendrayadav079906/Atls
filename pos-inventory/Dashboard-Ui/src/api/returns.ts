import { apiClient } from './client';

export type ApprovalStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed'
  | 'outcome-unknown';

export type ApprovalRequestType = 'refund' | 'store_credit' | 'exchange';

export interface ApprovalRequestItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  warehouse?: string | null;
  baseLine: number;
}

export interface ApprovalRequestRow {
  id: string;
  request_type: ApprovalRequestType | string;
  status: ApprovalStatus | string;
  requester_id: string;
  approver_id?: string | null;
  branch_id: string;
  original_doc_entry: number;
  original_doc_num?: string | number | null;
  amount: number;
  payload: Record<string, any>;
  reason: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export const returnsApi = {
  getApprovalQueue: async (): Promise<ApprovalRequestRow[]> => {
    const res = await apiClient.get('/admin/approvals');
    return res.data;
  },

  approveRequest: async (requestId: string) => {
    const res = await apiClient.post(`/admin/approvals/${requestId}/approve`);
    return res.data;
  },

  rejectRequest: async (requestId: string) => {
    const res = await apiClient.post(`/admin/approvals/${requestId}/reject`);
    return res.data;
  },

  getRecentReturns: async () => {
    const res = await apiClient.get('/returns');
    return res.data;
  },
};
