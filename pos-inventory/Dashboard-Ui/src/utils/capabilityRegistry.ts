/**
 * ATLAS AI Assistant — Client-Side Central Capability Registry
 * Mirrors backend capability_registry.py to provide consistent capability definitions,
 * intent mappings, authorization rules, and route targets across the frontend.
 */

export interface BusinessCapability {
  capabilityId: string;
  name: string;
  description: string;
  module: string;
  naturalLanguageIntents: string[];
  requiredParameters: string[];
  authorizedBackendTool: string;
  requiredPermission?: string;
  supportedFilters: string[];
  supportedDateRanges: string[];
  expectedResultSchema: string;
  relatedRoute: string;
  isReadOnly: boolean;
  limitations: string;
}

export const CAPABILITY_REGISTRY: BusinessCapability[] = [
  // ── 1. Executive Dashboard & KPIs ──────────────────────────────────────────
  {
    capabilityId: 'dashboard.kpis',
    name: 'Executive KPI Summary',
    description: 'High-level business summary including total sales revenue, invoice counts, average bill value, growth %, low-stock alerts, and pending returns.',
    module: 'Dashboard',
    naturalLanguageIntents: [
      "today's sales", 'sales today', 'today revenue', 'how much did we sell today',
      "show me today's sales", 'business overview', 'dashboard summary', 'current performance',
      'sales this week', 'sales this month', 'executive overview', 'kpi summary'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_dashboard_summary',
    requiredPermission: 'dashboard.view',
    supportedFilters: ['range', 'branch', 'date_from', 'date_to'],
    supportedDateRanges: ['today', 'yesterday', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'dashboard_summary',
    relatedRoute: '/',
    isReadOnly: true,
    limitations: 'Live SAP Business One / PostgreSQL aggregate. Subject to branch scoping.'
  },
  {
    capabilityId: 'dashboard.sales_trend',
    name: 'Sales Revenue Trend & Analysis',
    description: 'Multi-period sales trend, monthly revenue breakdown, weekly sales comparisons across branches, and period-over-period delta.',
    module: 'Dashboard',
    naturalLanguageIntents: [
      'sales trend', 'revenue trend', 'compare this month with last month', 'sales comparison',
      'compare sales with last month', 'monthly sales', 'past 6 months sales', 'show sales for 2025',
      'weekly sales by branch', 'sales breakdown', 'why did profit decrease this month'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_analytical_table',
    requiredPermission: 'dashboard.view',
    supportedFilters: ['metric', 'group_by', 'range', 'branch', 'limit', 'date_from', 'date_to'],
    supportedDateRanges: ['past_6_months', '6_months', 'week', 'month', 'last_month', 'compare_last_month', 'same_month_last_year', 'compare_last_year', 'year', 'total'],
    expectedResultSchema: 'table',
    relatedRoute: '/',
    isReadOnly: true,
    limitations: 'Live analytical grouping over posted SAP AR Invoices.'
  },

  // ── 2. Products & Inventory ───────────────────────────────────────────────
  {
    capabilityId: 'inventory.stock_levels',
    name: 'Warehouse Stock Levels & SKU Lookup',
    description: 'Inspect warehouse on-hand quantities, item pricing, warehouse distribution, and specific SKU lookups.',
    module: 'Products',
    naturalLanguageIntents: [
      'check stock', 'stock of item', 'how much stock do we have', 'search product',
      'warehouse stock', 'open product', 'product details', 'lookup sku', 'find item'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_inventory_stock',
    requiredPermission: 'products.view',
    supportedFilters: ['item_code', 'warehouse', 'low_stock_only'],
    supportedDateRanges: [],
    expectedResultSchema: 'inventory_stock',
    relatedRoute: '/products',
    isReadOnly: true,
    limitations: 'Real-time on-hand stock from SAP OITW warehouse table.'
  },
  {
    capabilityId: 'inventory.low_stock',
    name: 'Low Stock & Inventory Reorder Alerts',
    description: 'Identify products that have fallen below minimum reorder thresholds or have critical shortage across warehouses.',
    module: 'Products',
    naturalLanguageIntents: [
      'which products are running low on stock', 'low stock', 'low stock items',
      'shortage items', 'products below reorder level', 'out of stock', 'critical stock',
      'inventory shortage', 'what items need reorder'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_inventory_stock',
    requiredPermission: 'products.view',
    supportedFilters: ['low_stock_only', 'warehouse'],
    supportedDateRanges: [],
    expectedResultSchema: 'inventory_stock',
    relatedRoute: '/products',
    isReadOnly: true,
    limitations: 'Items where QuantityOnStock <= MinimalStock in SAP.'
  },
  {
    capabilityId: 'inventory.top_products',
    name: 'Top Selling Products & Velocity',
    description: 'Rank products by units sold, total revenue generated, and sales velocity over a selected period.',
    module: 'Products',
    naturalLanguageIntents: [
      'top products', 'top selling products', 'best sellers', 'highest selling items',
      'show top products', 'top 5 products', 'top 10 products', 'fastest moving goods'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_products',
    requiredPermission: 'products.view',
    supportedFilters: ['top_selling_only', 'range', 'limit', 'search'],
    supportedDateRanges: ['today', 'week', 'month', 'year', 'total'],
    expectedResultSchema: 'products_list',
    relatedRoute: '/products',
    isReadOnly: true,
    limitations: 'Computed deterministically from invoiced document lines.'
  },

  // ── 3. Sales Orders ───────────────────────────────────────────────────────
  {
    capabilityId: 'sales_orders.list',
    name: 'Customer Sales Orders',
    description: 'Query SAP sales orders, track open fulfillment commitments, and filter by pending, completed, or cancelled status.',
    module: 'Sales Orders',
    naturalLanguageIntents: [
      'sales orders', 'show sales orders', 'pending sales orders', 'customer orders',
      'how many sales orders are pending', 'orders awaiting delivery', 'recent sales orders',
      'open sales orders'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_sales_orders',
    requiredPermission: 'sales_orders.view',
    supportedFilters: ['status', 'search', 'customer', 'date_from', 'date_to', 'limit'],
    supportedDateRanges: ['today', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'sales_orders',
    relatedRoute: '/sales-orders',
    isReadOnly: true,
    limitations: 'Live SAP ORDR table. Filtered by user assigned branch.'
  },

  // ── 4. AR Sales Invoices ──────────────────────────────────────────────────
  {
    capabilityId: 'invoices.list',
    name: 'AR Sales Invoices',
    description: 'Query posted SAP AR sales invoices, billed revenue amounts, document lines, customer names, and invoice status.',
    module: 'Invoices',
    naturalLanguageIntents: [
      'sales invoices', 'show invoices', 'invoices today', 'recent invoices',
      'billed invoices', 'paid invoices', 'unpaid invoices', 'show sales list'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_sales_invoices',
    requiredPermission: 'invoices.view',
    supportedFilters: ['range', 'date_from', 'date_to', 'search', 'limit'],
    supportedDateRanges: ['today', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'invoices_list',
    relatedRoute: '/sales',
    isReadOnly: true,
    limitations: 'Live SAP OINV records.'
  },

  // ── 5. Purchase Orders ────────────────────────────────────────────────────
  {
    capabilityId: 'purchase_orders.list',
    name: 'Vendor Purchase Orders',
    description: 'Query purchase orders placed with suppliers, pending goods receipts, and open supplier delivery tracking.',
    module: 'Purchase Orders',
    naturalLanguageIntents: [
      'purchase orders', 'show purchase orders', 'pending purchase orders',
      'orders awaiting receipt', 'po list', 'vendor orders', 'open purchase orders',
      'show pending purchase orders'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_purchase_orders',
    requiredPermission: 'purchase_orders.view',
    supportedFilters: ['status', 'search', 'date_from', 'date_to', 'limit'],
    supportedDateRanges: ['today', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'purchase_orders',
    relatedRoute: '/purchase-orders',
    isReadOnly: true,
    limitations: 'Live SAP OPOR records.'
  },

  // ── 6. Customers & Receivables ────────────────────────────────────────────
  {
    capabilityId: 'customers.search',
    name: 'Customer Directory & Search',
    description: 'Search customer accounts by phone number, customer CardCode, or business name, returning order and payment summaries.',
    module: 'Customers',
    naturalLanguageIntents: [
      'find customer', 'search customer', 'customer phone', 'customer by mobile',
      'search customer by mobile', 'customer balance', 'customer details'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'search_customers',
    requiredPermission: 'customers.view',
    supportedFilters: ['search_term'],
    supportedDateRanges: [],
    expectedResultSchema: 'customer_details',
    relatedRoute: '/customers',
    isReadOnly: true,
    limitations: 'Live OCRD Business Partner records.'
  },
  {
    capabilityId: 'customers.ranking',
    name: 'Top Purchasing Customers',
    description: 'Rank customers by total net billing value and invoice count from SAP Business One.',
    module: 'Customers',
    naturalLanguageIntents: [
      'top customers', 'best customers', 'find the customer with the highest sales',
      'highest buying customer', 'top billed customers', 'customer ranking', 'who bought the most'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_customer_sales_ranking',
    requiredPermission: 'customers.view',
    supportedFilters: ['range', 'order', 'limit', 'date_from', 'date_to'],
    supportedDateRanges: ['month', 'last_month', 'year', 'total', 'past_6_months'],
    expectedResultSchema: 'customer_ranking',
    relatedRoute: '/customers',
    isReadOnly: true,
    limitations: 'Aggregated from authorized AR invoices.'
  },
  {
    capabilityId: 'customers.receivables',
    name: 'Outstanding Accounts Receivable (AR)',
    description: 'Identify customers with outstanding debt balances, overdue receivables, and aging totals.',
    module: 'Finance',
    naturalLanguageIntents: [
      'which customers have outstanding balances', 'outstanding balances', 'unpaid balances',
      'accounts receivable', 'who owes us money', 'customer debt', 'receivables aging',
      'outstanding receivables'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_accounts_receivable',
    requiredPermission: 'finance.view',
    supportedFilters: ['customer_code', 'min_balance', 'limit'],
    supportedDateRanges: [],
    expectedResultSchema: 'accounts_receivable',
    relatedRoute: '/finance/customer-analysis',
    isReadOnly: true,
    limitations: 'Computed from SAP CardBalance.'
  },

  // ── 7. Returns & Approvals ────────────────────────────────────────────────
  {
    capabilityId: 'returns.approvals',
    name: 'Returns, Refunds & Manager Approvals',
    description: 'Query return merchandise requests, credit notes (AR Credit Memos), and pending manager authorizations.',
    module: 'Returns',
    naturalLanguageIntents: [
      'pending approvals', 'return requests', 'show returns', 'refund requests',
      'returns and approvals', 'manager approvals', 'credit notes', 'pending refunds'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_pending_approvals',
    requiredPermission: 'returns.view',
    supportedFilters: ['status'],
    supportedDateRanges: [],
    expectedResultSchema: 'pending_approvals',
    relatedRoute: '/returns',
    isReadOnly: true,
    limitations: 'Local approval queue and SAP ORIN records.'
  },

  // ── 8. Production & Manufacturing ─────────────────────────────────────────
  {
    capabilityId: 'production.overview',
    name: 'Production Overview & Efficiency',
    description: 'Manufacturing KPIs including total batches, planned vs produced quantities, scrap/rejection percentage, and warehouse output.',
    module: 'Production',
    naturalLanguageIntents: [
      'production overview', 'manufacturing summary', 'production status', 'plant output',
      'how much did we produce', 'factory output', 'production summary'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_production_summary',
    requiredPermission: 'production.view',
    supportedFilters: ['warehouse', 'date_from', 'date_to'],
    supportedDateRanges: ['today', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'production_summary',
    relatedRoute: '/production',
    isReadOnly: true,
    limitations: 'Live SAP OWOR work order aggregates.'
  },
  {
    capabilityId: 'production.orders',
    name: 'Production Work Orders',
    description: 'Inspect SAP production orders, scheduled due dates, item manufacturing status (Planned, Released, Closed), and pending quantities.',
    module: 'Production',
    naturalLanguageIntents: [
      'production orders', 'show pending production orders', 'pending production',
      'open work orders', 'manufacturing orders', 'batches in progress', 'released production orders'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_production_orders',
    requiredPermission: 'production.orders.view',
    supportedFilters: ['status', 'item_code', 'warehouse', 'date_from', 'date_to', 'limit'],
    supportedDateRanges: ['today', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'production_orders',
    relatedRoute: '/production/orders',
    isReadOnly: true,
    limitations: 'Live SAP OWOR work orders.'
  },
  {
    capabilityId: 'production.rejection',
    name: 'Production Rejection & Scrap Analysis',
    description: 'Scrap analysis, rejected quantities by item code, defective batch ratios, and quality control logs.',
    module: 'Production',
    naturalLanguageIntents: [
      'production rejection', 'create a report showing production rejection by item',
      'rejection trends', 'show rejection trends', 'scrap report', 'production wastage',
      'rejected quantity', 'defective items in production', 'defect rate'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_production_rejection',
    requiredPermission: 'production.view',
    supportedFilters: ['warehouse', 'date_from', 'date_to', 'search'],
    supportedDateRanges: ['today', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'production_rejection',
    relatedRoute: '/production/rejection',
    isReadOnly: true,
    limitations: 'SAP OWOR completion vs scrap delta.'
  },
  {
    capabilityId: 'production.item_wise',
    name: 'Item-wise Production Output',
    description: 'Detailed manufactured item analysis comparing planned targets against completed goods and scrap rates.',
    module: 'Production',
    naturalLanguageIntents: [
      'item-wise production', 'production by item', 'manufactured goods by item',
      'item production targets', 'product output in factory'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_production_item_wise',
    requiredPermission: 'production.view',
    supportedFilters: ['warehouse', 'date_from', 'date_to', 'search'],
    supportedDateRanges: ['today', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'production_item_wise',
    relatedRoute: '/production/item-wise',
    isReadOnly: true,
    limitations: 'Grouped item production outputs.'
  },

  // ── 9. Finance & Accounting ───────────────────────────────────────────────
  {
    capabilityId: 'finance.overview',
    name: 'Finance Executive Overview',
    description: 'Financial statements overview: Total Net Sales, AP Purchases, Customer Incoming Collections, Supplier Outgoing Disbursements, Receivables, Payables, and Gross Profit.',
    module: 'Finance',
    naturalLanguageIntents: [
      'finance overview', 'financial summary', 'cash flow', 'financial kpis',
      'total purchases', 'incoming payments', 'outgoing payments', 'accounts payable',
      'show finance overview'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_finance_summary',
    requiredPermission: 'finance.view',
    supportedFilters: ['range', 'branch', 'date_from', 'date_to'],
    supportedDateRanges: ['daily', 'weekly', 'monthly', 'yearly', 'last_month', 'past_6_months', 'all_time'],
    expectedResultSchema: 'finance_summary',
    relatedRoute: '/finance',
    isReadOnly: true,
    limitations: 'Calculated deterministically from posted SAP documents.'
  },
  {
    capabilityId: 'finance.purchase_invoices',
    name: 'AP Purchase Invoices',
    description: 'Invoices billed by vendors for inventory replenishment, item costs, payment terms, and open liability balances.',
    module: 'Finance',
    naturalLanguageIntents: [
      'purchase invoices', 'show purchase invoices for this supplier', 'vendor invoices',
      'supplier bills', 'ap invoices', 'open purchase invoices', 'supplier invoices'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_purchase_invoices',
    requiredPermission: 'finance.invoices.view',
    supportedFilters: ['range', 'supplier_code', 'status', 'search', 'date_from', 'date_to', 'limit'],
    supportedDateRanges: ['today', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'purchase_invoices',
    relatedRoute: '/finance/purchase-invoices',
    isReadOnly: true,
    limitations: 'Live SAP OPCH purchase invoice records.'
  },
  {
    capabilityId: 'finance.payments',
    name: 'Incoming Collections & Outgoing Disbursements',
    description: 'Breakdown of customer payments collected by mode (Cash, Card, UPI, Cheque, Transfer) versus vendor disbursements.',
    module: 'Finance',
    naturalLanguageIntents: [
      'incoming payments', 'outgoing payments', 'payment breakdown', 'cash collections',
      'upi payments', 'payments this month', 'payment collection report'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_incoming_payments',
    requiredPermission: 'finance.payments.view',
    supportedFilters: ['range', 'payment_method', 'customer_code', 'date_from', 'date_to', 'limit'],
    supportedDateRanges: ['today', 'week', 'month', 'last_month', 'year', 'total'],
    expectedResultSchema: 'payments_list',
    relatedRoute: '/finance/incoming-payments',
    isReadOnly: true,
    limitations: 'Live SAP ORCT incoming receipt records.'
  },
  {
    capabilityId: 'finance.profitability',
    name: 'Profitability & Margin Analysis',
    description: 'Approved gross profit and gross margin % derived deterministically from verified sales and documented cost of goods sold.',
    module: 'Finance',
    naturalLanguageIntents: [
      'profitability', 'gross profit', 'profit margin', 'why did profit decrease',
      'compare profit', 'monthly margin', 'margin breakdown'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_profitability_report',
    requiredPermission: 'finance.reports.view',
    supportedFilters: ['range', 'date_from', 'date_to'],
    supportedDateRanges: ['month', 'last_month', 'year', 'past_6_months', 'total'],
    expectedResultSchema: 'profitability_report',
    relatedRoute: '/finance/profitability-reports',
    isReadOnly: true,
    limitations: 'Verified gross margin = Net Revenue - COGS. Capped at authorized data.'
  },

  // ── 10. Reports Hub & Catalog ─────────────────────────────────────────────
  {
    capabilityId: 'reports.catalog',
    name: 'Available Reports Discovery',
    description: 'Catalog of all available reports in ATLAS, backend readiness, export options, and fast navigation links.',
    module: 'Reports',
    naturalLanguageIntents: [
      'show me all available reports', 'available reports', 'all reports',
      'what reports are available', 'show reports', 'list reports', 'open reports'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_available_reports',
    requiredPermission: 'reports.view',
    supportedFilters: [],
    supportedDateRanges: [],
    expectedResultSchema: 'report_catalog',
    relatedRoute: '/reports',
    isReadOnly: true,
    limitations: 'Active catalog of 11 reports in ATLAS.'
  },

  // ── 11. Settings & Administrative Intelligence ───────────────────────────
  {
    capabilityId: 'settings.user_lookup',
    name: 'Administrative User & Role Management',
    description: 'Administrative query to find employees, inspect user roles, assigned branches, permitted modules, and feature permissions.',
    module: 'Settings',
    naturalLanguageIntents: [
      'which employees can edit products', 'who can edit products', 'find user',
      'user roles', 'who has access to', 'list admin users', 'list managers',
      'users with permission', 'search user'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_admin_user_info',
    requiredPermission: 'users.manage',
    supportedFilters: ['search_query', 'role', 'feature_permission'],
    supportedDateRanges: [],
    expectedResultSchema: 'admin_user_info',
    relatedRoute: '/settings',
    isReadOnly: true,
    limitations: 'Strictly restricted to users with users.manage permission or Admin role.'
  },
  {
    capabilityId: 'settings.my_permissions',
    name: 'My Effective Permissions & Access',
    description: 'Self-service inquiry allowing any authenticated employee to inspect their own effective permissions and permitted dashboard modules.',
    module: 'Settings',
    naturalLanguageIntents: [
      'what can i access with my current permissions', 'my permissions',
      'what are my permissions', 'what modules can i access', 'what can i do',
      'show my role', 'my access rights'
    ],
    requiredParameters: [],
    authorizedBackendTool: 'get_my_permissions',
    requiredPermission: undefined,
    supportedFilters: [],
    supportedDateRanges: [],
    expectedResultSchema: 'my_permissions',
    relatedRoute: '/',
    isReadOnly: true,
    limitations: 'Returns only the calling user’s own effective authorization.'
  },

  // ── 12. Smart Page Navigation ─────────────────────────────────────────────
  {
    capabilityId: 'navigation.goto',
    name: 'Dashboard Module Navigation',
    description: 'Internal navigation within ATLAS dashboard to open any authorized page or record directly.',
    module: 'Navigation',
    naturalLanguageIntents: [
      'open the inventory report', 'open products', 'take me to purchase invoices',
      'show the production rejection report', 'go to users & roles', 'open ai generated reports',
      'show me the settings section', 'open sales orders', 'open finance overview',
      'take me to', 'navigate to', 'open page', 'go to'
    ],
    requiredParameters: ['target_module'],
    authorizedBackendTool: 'navigate_to_module',
    requiredPermission: undefined,
    supportedFilters: ['target_module', 'record_id', 'params'],
    supportedDateRanges: [],
    expectedResultSchema: 'navigation',
    relatedRoute: '/',
    isReadOnly: true,
    limitations: 'Respects route guards and user permissions.'
  }
];

/**
 * Filter capabilities authorized for a user based on their role and permissions.
 */
export function getCapabilitiesForUser(user: { role?: string; permissions?: string[] } | null): BusinessCapability[] {
  if (!user) return [];
  const role = (user.role || 'user').toLowerCase();
  if (role === 'admin') return CAPABILITY_REGISTRY;

  const permSet = new Set(user.permissions || []);
  return CAPABILITY_REGISTRY.filter((cap) => !cap.requiredPermission || permSet.has(cap.requiredPermission));
}
