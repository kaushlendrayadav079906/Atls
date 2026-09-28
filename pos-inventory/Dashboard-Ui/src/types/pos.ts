/**
 * POS & Checkout TypeScript types — derived from backend schemas.py
 * These types mirror the exact Pydantic models in the pos-backend.
 */

// ── Product (mirrors ProductResponse in schemas.py) ─────────────────────────

export interface Product {
  id: string;           // ItemCode
  name: string;
  price: number;
  barcode?: string | null;
  stock?: number | null;
  image?: string | null;
  category?: string | null;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  warehouse?: string | null;
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export interface CartLine {
  product: Product;
  quantity: number;
}

// ── Customer (mirrors CustomerDetails in schemas.py) ─────────────────────────

export interface CustomerDetails {
  name: string;                   // Required
  phone: string;                  // Required
  email?: string;
  whatsapp_number?: string;       // → U_W_Number on Invoice
  payment_method?: string;        // → U_P_Method on A/R Invoice
  sales_employee?: string;        // → U_S_Employee on A/R Invoice
  address?: string;               // → U_Address on A/R Invoice
}

// ── Customer search result (mirrors CustomerSearchResult in schemas.py) ───────

export interface CustomerSearchResult {
  name: string;
  mobile: string;
  email?: string | null;
  salesEmployee?: string | null;
  address?: string | null;
  invoiceCount?: number | null;
  latestDocNum?: number | null;
  invoiceNums?: number[] | null;
}

// ── Payment (mirrors PaymentMethod in schemas.py) ─────────────────────────────

export type PaymentMethodType = 'cash' | 'card' | 'upi' | 'wallet';

export interface PaymentMethodEntry {
  type: PaymentMethodType;
  amount: number;
}

// ── Sale Request (mirrors SaleCreate in schemas.py) ───────────────────────────

export interface SaleCartItem {
  product: Product;
  quantity: number;
}

export interface SaleCreatePayload {
  items: SaleCartItem[];
  total: number;
  subtotal?: number;
  discount?: number;
  gst?: number;
  gstPercentage?: number;
  customer: CustomerDetails;
  paymentMethods?: PaymentMethodEntry[];
}

// ── Sale Response (mirrors SaleResponse in schemas.py) ────────────────────────

export interface SaleResponse {
  saleId: string;
  total: number;
  sapDocEntry?: number | null;
  sapDocNum?: number | null;
}

// ── GST Values response ───────────────────────────────────────────────────────

export interface GstValuesResponse {
  values: number[];
  default: number;
}

// ── Discount mode ─────────────────────────────────────────────────────────────

export type DiscountMode = 'percent' | 'amount';

// ── Checkout state (client-side) ──────────────────────────────────────────────

export type CheckoutStep = 'cart' | 'review' | 'result';

export interface CheckoutResult {
  success: boolean;
  response?: SaleResponse;
  errorMessage?: string;
  /** If true, the request timed out and outcome is ambiguous */
  ambiguous?: boolean;
}
