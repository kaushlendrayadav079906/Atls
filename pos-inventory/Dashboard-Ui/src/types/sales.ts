export interface DashboardSaleItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DashboardRecentSale {
  docEntry?: number;
  docNum?: number;
  saleId?: string;
  docDate?: string;
  customerCode?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  items: DashboardSaleItem[];
  hasReturn: boolean;
}

export interface DashboardRecentSalesPage {
  items: DashboardRecentSale[];
  nextOffset?: number;
  total?: number;
}

export interface SaleDetailItem {
  ItemCode?: string;
  ItemDescription?: string;
  Quantity?: number;
  UnitPrice?: number;
  Price?: number;
  LineTotal?: number;
  DiscountPercent?: number;
  VatGroup?: string;
  WarehouseCode?: string;
}

export interface SaleDetail {
  id?: number;
  saleId: string;
  total: number;
  items: SaleDetailItem[];
  customer?: string;
  syncStatus: string;
  createdAt?: string;
  sapDocEntry?: number;
  sapDocNum?: number;
}

export interface SalesFeedParams {
  range?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
  search?: string;
  limit?: number;
  offset?: number;
}
