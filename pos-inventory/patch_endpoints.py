import re

file_path = "Dashboard-Ui/src/api/endpoints.ts"
with open(file_path, "r") as f:
    content = f.read()

# Append the new api endpoints for payments report
new_api = """

export interface PaymentOverview {
  totalPayments: number;
  paymentCount: number;
  averagePaymentValue: number;
  refundsIssued: number;
  refundsAmount: number;
}

export interface PaymentDistributionItem {
  method: string;
  total: number;
  count: number;
}

export interface PaymentTrendItem {
  label: string;
  amount: number;
  count: number;
}

export interface PaymentTransactionItem {
  docEntry: number;
  docNum: number;
  invoiceDocNum?: number;
  docDate: string;
  customerCode: string;
  customerName: string;
  paymentMethod: string;
  totalAmount: number;
  status: string;
  transactionId?: string;
}

export interface PaymentTransactionsResponse {
  total: number;
  items: PaymentTransactionItem[];
}

export const paymentsReportApi = {
  getOverview: async (params?: { range?: string, from_date?: string, to_date?: string, branch?: string, customer?: string, payment_method?: string }): Promise<PaymentOverview> => {
    const res = await apiClient.get('/reports/payments/overview', { params });
    return res.data;
  },
  getDistribution: async (params?: { range?: string, from_date?: string, to_date?: string, branch?: string, customer?: string }): Promise<PaymentDistributionItem[]> => {
    const res = await apiClient.get('/reports/payments/distribution', { params });
    return res.data;
  },
  getTrend: async (params?: { range?: string, from_date?: string, to_date?: string, branch?: string, customer?: string, payment_method?: string }): Promise<PaymentTrendItem[]> => {
    const res = await apiClient.get('/reports/payments/trend', { params });
    return res.data;
  },
  getTransactions: async (params?: { range?: string, from_date?: string, to_date?: string, branch?: string, customer?: string, payment_method?: string, search?: string, limit?: number, offset?: number }): Promise<PaymentTransactionsResponse> => {
    const res = await apiClient.get('/reports/payments/transactions', { params });
    return res.data;
  }
};
"""

if "paymentsReportApi = {" not in content:
    content += new_api
    with open(file_path, "w") as f:
        f.write(content)
