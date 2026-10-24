import { apiClient } from './client';

export interface FinanceOverviewResponse {
  period: {
    range: string;
    from_date: string;
    to_date: string;
    label: string;
  };
  kpis: {
    total_sales: {
      value: number;
      invoice_count: number;
      growth: number;
      is_positive: boolean;
      subtext: string;
    };
    total_purchases: {
      value: number;
      invoice_count: number;
      growth: number;
      is_positive: boolean;
      subtext: string;
    };
    incoming_payments: {
      value: number;
      payment_count: number;
      growth: number;
      is_positive: boolean;
      subtext: string;
    };
    outgoing_payments: {
      value: number;
      payment_count: number;
      growth: number;
      is_positive: boolean;
      subtext: string;
    };
    accounts_receivable: {
      value: number;
      subtext: string;
    };
    accounts_payable: {
      value: number;
      subtext: string;
    };
    gross_profit: {
      value: number;
      growth: number;
      is_positive: boolean;
      subtext: string;
    };
    gross_margin: {
      value: number;
      growth: number;
      is_positive: boolean;
      subtext: string;
    };
  };
  summary?: FinanceOverviewResponse['kpis'];
  charts: {
    sales_vs_purchases: Array<{
      month: string;
      sales: number;
      purchases: number;
    }>;
    payments_trend: Array<{
      month: string;
      incoming: number;
      outgoing: number;
    }>;
  };
  tables: {
    top_customers: Array<{
      customerCode: string;
      customerName: string;
      sales: number;
      receivables: number;
    }>;
    top_suppliers: Array<{
      supplierCode: string;
      supplierName: string;
      purchases: number;
      payables: number;
    }>;
    recent_payments: Array<{
      docEntry: number;
      docNum: number;
      date: string;
      bpName: string;
      bpCode: string;
      amount: number;
      type: string;
      method: string;
    }>;
  };
  meta: {
    timestamp: string;
    branch_id: string;
    is_cached: boolean;
  };
}

export interface PurchaseInvoiceItem {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  doc_due_date?: string;
  card_code: string;
  card_name: string;
  doc_total: number;
  paid_to_date: number;
  balance_due: number;
  doc_status: string;
  cancelled: string;
  payment_status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Cancelled';
  currency: string;
  branch_id?: number | string;
  comments?: string;
}

export interface PurchaseInvoiceSummary {
  total_invoices: number;
  total_purchases: number;
  total_paid: number;
  total_outstanding_balance: number;
  currency: string;
  status_counts: {
    open: number;
    closed: number;
    paid: number;
    partially_paid: number;
    unpaid: number;
    cancelled: number;
  };
}

export interface PurchaseInvoicesResponse {
  period?: {
    range: string;
    label: string;
    from_date: string;
    to_date: string;
  };
  summary: PurchaseInvoiceSummary;
  kpis?: PurchaseInvoiceSummary;
  items: PurchaseInvoiceItem[];
  invoices?: PurchaseInvoiceItem[];
  purchase_invoices?: PurchaseInvoiceItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages?: number;
  has_more: boolean;
  filters_applied: Record<string, any>;
}

export interface IncomingPaymentItem {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  card_code: string;
  card_name: string;
  doc_currency: string;
  cash_sum: number;
  transfer_sum: number;
  total_amount: number;
  payment_method: string;
  branch_id?: number | string;
  branch_name?: string;
  applied_invoices_count: number;
  applied_invoices: Array<{
    doc_entry: number;
    sum_applied: number;
    invoice_type?: string;
  }>;
}

export interface IncomingPaymentSummary {
  total_receipts_count: number;
  total_received_amount: number;
  currency: string;
  method_breakdown: {
    bank_transfer: number;
    cash: number;
    other: number;
  };
}

export interface IncomingPaymentsResponse {
  summary: IncomingPaymentSummary;
  kpis?: IncomingPaymentSummary;
  items: IncomingPaymentItem[];
  payments?: IncomingPaymentItem[];
  incoming_payments?: IncomingPaymentItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages?: number;
  has_more: boolean;
  filters_applied: Record<string, any>;
}

export interface OutgoingPaymentItem {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  card_code: string;
  card_name: string;
  doc_currency: string;
  cash_sum: number;
  transfer_sum: number;
  total_amount: number;
  payment_method: string;
  branch_id?: number | string;
  branch_name?: string;
  applied_purchase_invoices_count: number;
  applied_invoices: Array<{
    doc_entry: number;
    sum_applied: number;
    invoice_type?: string;
  }>;
}

export interface OutgoingPaymentSummary {
  total_vouchers_count: number;
  total_disbursed_amount: number;
  currency: string;
  method_breakdown: {
    bank_transfer: number;
    cash: number;
    other: number;
  };
}

export interface OutgoingPaymentsResponse {
  summary: OutgoingPaymentSummary;
  kpis?: OutgoingPaymentSummary;
  items: OutgoingPaymentItem[];
  payments?: OutgoingPaymentItem[];
  outgoing_payments?: OutgoingPaymentItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages?: number;
  has_more: boolean;
  filters_applied: Record<string, any>;
}

export interface CustomerAnalysisItem {
  card_code: string;
  card_name: string;
  sales_revenue: number;
  invoice_count: number;
  payments_received: number;
  outstanding_receivables: number;
  last_transaction_date: string;
  sales_share_pct: number;
  currency: string;
}

export interface CustomerAnalysisSummary {
  total_customers_analyzed: number;
  total_sales_revenue: number;
  total_outstanding_receivables: number;
  currency: string;
}

export interface CustomerAnalysisResponse {
  summary: CustomerAnalysisSummary;
  kpis?: CustomerAnalysisSummary;
  items: CustomerAnalysisItem[];
  customers?: CustomerAnalysisItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages?: number;
  has_more: boolean;
  filters_applied: Record<string, any>;
}

export interface SupplierAnalysisItem {
  card_code: string;
  card_name: string;
  purchase_spend: number;
  invoice_count: number;
  disbursements: number;
  outstanding_payables: number;
  last_purchase_date: string;
  spend_share_pct: number;
  currency: string;
}

export interface SupplierAnalysisSummary {
  total_suppliers_analyzed: number;
  total_purchase_spend: number;
  total_outstanding_payables: number;
  currency: string;
}

export interface SupplierAnalysisResponse {
  summary: SupplierAnalysisSummary;
  kpis?: SupplierAnalysisSummary;
  items: SupplierAnalysisItem[];
  suppliers?: SupplierAnalysisItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages?: number;
  has_more: boolean;
  filters_applied: Record<string, any>;
}

export interface ProfitabilityTrendItem {
  period: string;
  revenue: number;
  cost: number;
  gross_profit: number;
  margin_pct: number;
}

export interface ProfitabilitySummary {
  net_sales_revenue: number;
  procurement_cogs_basis: number;
  gross_profit: number;
  gross_margin_pct: number;
  sales_invoice_count: number;
  purchase_invoice_count: number;
  currency: string;
  accounting_note: string;
}

export interface ProfitabilityResponse {
  summary: ProfitabilitySummary;
  kpis?: ProfitabilitySummary;
  monthly_breakdown: ProfitabilityTrendItem[];
  breakdown?: ProfitabilityTrendItem[];
  date_scope: {
    range: string;
    from_date: string;
    to_date: string;
  };
  filters_applied: Record<string, any>;
}

export const financeApi = {
  getOverview: async (params?: {
    range?: string;
    branch?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<FinanceOverviewResponse> => {
    const res = await apiClient.get<FinanceOverviewResponse>('/finance/overview', { params });
    return res.data;
  },

  getPurchaseInvoices: async (params?: {
    range?: string;
    branch?: string;
    from_date?: string;
    to_date?: string;
    supplier_code?: string;
    status?: string;
    search?: string;
    page?: number;
    page_size?: number;
    refresh?: boolean;
  }): Promise<PurchaseInvoicesResponse> => {
    const res = await apiClient.get<PurchaseInvoicesResponse>('/finance/purchase-invoices', { params });
    return res.data;
  },

  getIncomingPayments: async (params?: {
    range?: string;
    branch?: string;
    from_date?: string;
    to_date?: string;
    customer_code?: string;
    payment_method?: string;
    search?: string;
    page?: number;
    page_size?: number;
    refresh?: boolean;
  }): Promise<IncomingPaymentsResponse> => {
    const res = await apiClient.get<IncomingPaymentsResponse>('/finance/incoming-payments', { params });
    return res.data;
  },

  getOutgoingPayments: async (params?: {
    range?: string;
    branch?: string;
    from_date?: string;
    to_date?: string;
    supplier_code?: string;
    payment_method?: string;
    search?: string;
    page?: number;
    page_size?: number;
    refresh?: boolean;
  }): Promise<OutgoingPaymentsResponse> => {
    const res = await apiClient.get<OutgoingPaymentsResponse>('/finance/outgoing-payments', { params });
    return res.data;
  },

  getCustomerAnalysis: async (params?: {
    range?: string;
    branch?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    page_size?: number;
  }): Promise<CustomerAnalysisResponse> => {
    const res = await apiClient.get<CustomerAnalysisResponse>('/finance/customer-analysis', { params });
    return res.data;
  },

  getSupplierAnalysis: async (params?: {
    range?: string;
    branch?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    page_size?: number;
  }): Promise<SupplierAnalysisResponse> => {
    const res = await apiClient.get<SupplierAnalysisResponse>('/finance/supplier-analysis', { params });
    return res.data;
  },

  getProfitabilityReport: async (params?: {
    range?: string;
    branch?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<ProfitabilityResponse> => {
    const res = await apiClient.get<ProfitabilityResponse>('/finance/profitability-reports', { params });
    return res.data;
  },

  exportFinanceData: async (params: {
    module: 'purchase_invoices' | 'incoming_payments' | 'outgoing_payments' | 'customer_analysis' | 'supplier_analysis' | 'profitability';
    range?: string;
    branch?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
    status?: string;
  }): Promise<Blob> => {
    const res = await apiClient.get('/finance/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};
