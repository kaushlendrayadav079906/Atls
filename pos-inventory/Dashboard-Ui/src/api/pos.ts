/**
 * POS API service — integrates with backend endpoints documented in pos-backend.
 *
 * Endpoints used:
 *  GET  /api/v1/products            → product search (search param, branch-scoped by JWT)
 *  GET  /api/v1/products/{barcode}  → barcode lookup
 *  GET  /api/v1/sales/gst-values    → allowed GST percentages
 *  POST /api/v1/sales               → create sale (SaleCreate schema)
 *  GET  /api/v1/customers/search    → customer search by mobile fragment
 */

import { apiClient } from './client';
import type {
  Product,
  SaleCreatePayload,
  SaleResponse,
  GstValuesResponse,
  CustomerSearchResult,
} from '../types/pos';

export const posApi = {
  /**
   * Search products by name, barcode, or item code.
   * Backend: GET /api/v1/products?search=<term>
   * Branch-scoped stock is enforced by the backend via JWT branch_id.
   * Max search length: 100 chars (backend Query param constraint).
   */
  searchProducts: async (search: string): Promise<Product[]> => {
    const params: Record<string, string> = {};
    if (search.trim()) {
      params.search = search.trim().slice(0, 100);
    }
    const res = await apiClient.get<Product[]>('/products', { params });
    return res.data;
  },

  /**
   * Fetch a single product by barcode.
   * Backend: GET /api/v1/products/{barcode}
   * Returns 404 if not found.
   */
  getProductByBarcode: async (barcode: string): Promise<Product> => {
    const res = await apiClient.get<Product>(`/products/${encodeURIComponent(barcode)}`);
    return res.data;
  },

  /**
   * Fetch allowed GST percentage values from SAP SalesTaxCodes.
   * Backend: GET /api/v1/sales/gst-values
   * Returns { values: number[], default: number }
   */
  getGstValues: async (): Promise<GstValuesResponse> => {
    const res = await apiClient.get<GstValuesResponse>('/sales/gst-values');
    return res.data;
  },

  /**
   * Create a sale / AR Invoice in SAP.
   * Backend: POST /api/v1/sales
   * Schema: SaleCreate (mirrors SaleCreatePayload here).
   * Rate-limited: settings.RATE_LIMIT_SALES.
   * Returns SaleResponse with saleId, total, sapDocEntry, sapDocNum.
   *
   * ⚠ This is a MUTATING endpoint — creates real SAP AR Invoice.
   * Do NOT retry on ambiguous timeout (502). Show cautious message instead.
   */
  createSale: async (payload: SaleCreatePayload): Promise<SaleResponse> => {
    const res = await apiClient.post<SaleResponse>('/sales', payload);
    return res.data;
  },

  /**
   * Search customers by mobile number fragment (min 4 digits).
   * Backend: GET /api/v1/customers/search?mobile=<fragment>&top=<n>
   * Customers are stored as UDF fields on AR Invoices — NOT as SAP Business Partners.
   */
  searchCustomersByMobile: async (
    mobile: string,
    top = 10
  ): Promise<CustomerSearchResult[]> => {
    const res = await apiClient.get<CustomerSearchResult[]>('/customers/search', {
      params: { mobile: mobile.trim(), top },
    });
    return res.data;
  },
};
