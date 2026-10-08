export interface ProductionSummaryResponse {
  total_production: number;
  open_orders: number;
  released_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_rejection: number;
  rejection_percentage: number;
  pending_production: number;
  production_efficiency: number | null;
}

export interface ProductionOrderSummary {
  production_order_no: number;
  item_code: string;
  item_name: string | null;
  production_type: string | null;
  status: string | null;
  planned_qty: number;
  produced_qty: number;
  rejected_qty: number;
  pending_qty: number;
  production_percentage: number;
  rejection_percentage: number;
  posting_date: string | null;
  start_date: string | null;
  due_date: string | null;
  warehouse: string | null;
  priority: number | null;
}

export interface ProductionOrderComponent {
  item_code: string;
  item_name: string | null;
  base_qty: number;
  planned_qty: number;
  issued_qty: number;
  pending_qty: number;
  warehouse: string | null;
}

export interface ProductionOrderDetail extends ProductionOrderSummary {
  creation_date: string | null;
  project: string | null;
  components: ProductionOrderComponent[];
}

export interface ProductionOrderListResponse {
  items: ProductionOrderSummary[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ProductionItemWiseAggregation {
  item_code: string;
  item_name: string | null;
  planned_qty: number;
  produced_qty: number;
  pending_qty: number;
  rejected_qty: number;
  production_percentage: number;
  rejection_percentage: number;
  warehouse: string | null;
}

export interface ProductionRejectionItem {
  item_code: string;
  item_name: string | null;
  produced_qty: number;
  rejected_qty: number;
  rejection_percentage: number;
  production_percentage: number;
  warehouse: string | null;
}

export interface ProductionRejectionAggregation {
  total_rejected_qty: number;
  rejection_percentage: number;
  items_with_rejection: number;
  items: ProductionRejectionItem[];
}

export interface ProductionDateWiseItem {
  date: string;
  planned_qty: number;
  produced_qty: number;
  rejected_qty: number;
  pending_qty: number;
  production_percentage: number;
  rejection_percentage: number;
}

export interface ProductionStatusDistributionItem {
  status: string;
  label: string;
  count: number;
  percentage: number;
}

export interface ProductionWarehouseSummaryItem {
  warehouse: string;
  planned_qty: number;
  produced_qty: number;
  rejected_qty: number;
  pending_qty: number;
  production_percentage: number;
}

export interface ProductionFilters {
  date_from?: string;
  date_to?: string;
  warehouse?: string;
  search?: string;
}

export interface ProductionOrderListFilters extends ProductionFilters {
  page?: number;
  page_size?: number;
  status?: string;
  item_code?: string;
  production_type?: string;
  priority?: number;
}
