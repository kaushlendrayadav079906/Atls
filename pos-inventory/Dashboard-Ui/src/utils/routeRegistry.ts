/**
 * ATLAS Internal Application Route Registry
 * Central, trusted internal route registry constructed from actual React Router paths.
 */

export interface InternalRoute {
  id: string;
  name: string;
  path: string;
  module: string;
  description: string;
  supportedFilters: string[];
  detailRoutePattern?: string;
  badge?: string;
}

export const INTERNAL_ROUTES: InternalRoute[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
    module: 'dashboard',
    description: 'Executive retail operations overview, live KPIs, sales trends, and recent sales feed',
    supportedFilters: ['period', 'branch_id', 'date_from', 'date_to'],
  },
  {
    id: 'pos',
    name: 'Point of Sale',
    path: '/pos',
    module: 'pos',
    description: 'Point of Sale cash checkout, barcode scanning, customer billing',
    supportedFilters: ['warehouse'],
  },
  {
    id: 'products',
    name: 'Products & Inventory',
    path: '/products',
    module: 'inventory',
    description: 'Product catalog, barcode lookup, warehouse stock levels, low-stock alerts',
    supportedFilters: ['search', 'warehouse', 'low_stock', 'sku', 'openDetails'],
    detailRoutePattern: '/products/:id',
  },
  {
    id: 'sales',
    name: 'Sales Invoices',
    path: '/sales',
    module: 'sales',
    description: 'AR Sales invoices list, completed bills, customer payments and invoice details',
    supportedFilters: ['search', 'date_from', 'date_to', 'branch', 'customer'],
    detailRoutePattern: '/sales/:id',
  },
  {
    id: 'sales_orders',
    name: 'Sales Orders',
    path: '/sales-orders',
    module: 'sales_orders',
    description: 'Customer sales orders, pending delivery, order approvals, fulfillment tracking',
    supportedFilters: ['status', 'search', 'date_from', 'date_to', 'branch_id', 'customer'],
  },
  {
    id: 'purchase_orders',
    name: 'Purchase Orders',
    path: '/purchase-orders',
    module: 'purchase_orders',
    description: 'Supplier purchase orders, open orders, pending receipts, vendor deliveries',
    supportedFilters: ['status', 'search', 'date_from', 'date_to', 'supplier'],
  },
  {
    id: 'customers',
    name: 'Customers',
    path: '/customers',
    module: 'customers',
    description: 'Customer directory, mobile search, purchase history, outstanding balances',
    supportedFilters: ['search', 'mobile'],
  },
  {
    id: 'returns',
    name: 'Returns & Approvals',
    path: '/returns',
    module: 'returns',
    description: 'Customer returns, exchanges, credit memos, manager approval requests',
    supportedFilters: ['status', 'search', 'date_from', 'date_to', 'branch_id'],
  },
  {
    id: 'analytics',
    name: 'Atlas Analytics',
    path: '/analytics',
    module: 'analytics',
    description: 'Multi-branch comparison, sales velocity, product trends, customer analytics',
    supportedFilters: ['range', 'branch', 'from_date', 'to_date'],
  },
  {
    id: 'production_overview',
    name: 'Production Overview',
    path: '/production',
    module: 'production',
    description: 'Production summary KPIs, batch progress, planned vs produced metrics',
    supportedFilters: ['warehouse', 'date_from', 'date_to'],
  },
  {
    id: 'production_orders',
    name: 'Production Orders',
    path: '/production/orders',
    module: 'production',
    description: 'SAP Production Orders listing, batch statuses, planned and completed quantities',
    supportedFilters: ['status', 'item_code', 'warehouse', 'date_from', 'date_to', 'search'],
  },
  {
    id: 'production_item_wise',
    name: 'Item-wise Production',
    path: '/production/item-wise',
    module: 'production',
    description: 'Item-wise production output, scrap ratios, target completion rates',
    supportedFilters: ['warehouse', 'date_from', 'date_to', 'search'],
  },
  {
    id: 'production_rejection',
    name: 'Production Rejection',
    path: '/production/rejection',
    module: 'production',
    description: 'Scrap and defect tracking, rejection rates by item, quality control logs',
    supportedFilters: ['warehouse', 'date_from', 'date_to', 'search'],
  },
  {
    id: 'production_date_wise',
    name: 'Date-wise Production',
    path: '/production/date-wise',
    module: 'production',
    description: 'Daily and weekly production volume trends, planned targets vs actual output',
    supportedFilters: ['warehouse', 'date_from', 'date_to'],
  },
  {
    id: 'production_reports',
    name: 'Production Reports',
    path: '/production/reports',
    module: 'production',
    description: 'Comprehensive production efficiency summaries, exportable operational reports',
    supportedFilters: ['warehouse', 'date_from', 'date_to'],
  },
  {
    id: 'reports_overview',
    name: 'Reports Hub',
    path: '/reports',
    module: 'reports',
    description: 'Central reporting hub for sales, invoices, payments, and inventory',
    supportedFilters: [],
  },
  {
    id: 'reports_sales',
    name: 'Sales Reports',
    path: '/reports/sales',
    module: 'reports',
    description: 'Detailed sales revenue reports, category breakdowns, customer spend',
    supportedFilters: ['range', 'from_date', 'to_date', 'branch', 'customer'],
  },
  {
    id: 'reports_invoice',
    name: 'Invoice Reports',
    path: '/reports/invoice',
    module: 'reports',
    description: 'Invoice totals, tax breakdown, payment settlement summaries',
    supportedFilters: ['range', 'from_date', 'to_date', 'branch'],
  },
  {
    id: 'reports_payment',
    name: 'Payment Reports',
    path: '/reports/payment',
    module: 'reports',
    description: 'Payment collection breakdown by cash, card, UPI, bank settlement',
    supportedFilters: ['range', 'from_date', 'to_date', 'branch', 'payment_method'],
  },
  {
    id: 'reports_inventory',
    name: 'Inventory Reports',
    path: '/reports/inventory',
    module: 'reports',
    description: 'Stock valuation by category, inventory movements, low stock analysis',
    supportedFilters: ['warehouse', 'category'],
  },
  {
    id: 'finance_overview',
    name: 'Finance Overview',
    path: '/finance',
    module: 'finance',
    description: 'Executive financial summary, revenue vs purchases, incoming vs outgoing payments, and live cash position',
    supportedFilters: ['range', 'branch', 'from_date', 'to_date'],
  },
  {
    id: 'finance_purchase_invoices',
    name: 'Purchase Invoices',
    path: '/finance/purchase-invoices',
    module: 'finance',
    description: 'Vendor AP purchase invoices, tax breakdowns, and pending payment dues',
    supportedFilters: ['search', 'vendor', 'status', 'from_date', 'to_date'],
  },
  {
    id: 'finance_incoming_payments',
    name: 'Incoming Payments',
    path: '/finance/incoming-payments',
    module: 'finance',
    description: 'Customer payment receipts across cash, card, UPI, and bank transfers',
    supportedFilters: ['search', 'customer', 'payment_method', 'from_date', 'to_date'],
  },
  {
    id: 'finance_outgoing_payments',
    name: 'Outgoing Payments',
    path: '/finance/outgoing-payments',
    module: 'finance',
    description: 'Disbursements to vendors and operational payment settlements',
    supportedFilters: ['search', 'vendor', 'payment_method', 'from_date', 'to_date'],
  },
  {
    id: 'finance_customer_analysis',
    name: 'Customer Analysis',
    path: '/finance/customer-analysis',
    module: 'finance',
    description: 'Receivables aging, outstanding customer balances, and top revenue drivers',
    supportedFilters: ['search', 'range'],
  },
  {
    id: 'finance_supplier_analysis',
    name: 'Supplier Analysis',
    path: '/finance/supplier-analysis',
    module: 'finance',
    description: 'Accounts payable aging, top vendors by purchase spend, and procurement trends',
    supportedFilters: ['search', 'range'],
  },
  {
    id: 'finance_profitability_reports',
    name: 'Profitability Reports',
    path: '/finance/profitability-reports',
    module: 'finance',
    description: 'Gross margin by category, branch profit contribution, and net operational earnings',
    supportedFilters: ['range', 'branch', 'from_date', 'to_date'],
  },
  {
    id: 'reports_customer',
    name: 'Customer Reports',
    path: '/reports/customer',
    module: 'reports',
    description: 'Customer retention, repeat purchase patterns, account aging, and lifetime value analytics',
    supportedFilters: ['range', 'customer', 'branch'],
  },
  {
    id: 'reports_ai',
    name: 'AI Generated Reports',
    path: '/reports/ai',
    module: 'reports',
    description: 'Automated natural-language business intelligence narratives and AI insights from SAP data',
    supportedFilters: ['range', 'branch'],
  },
  {
    id: 'product_landing',
    name: 'Product Overview',
    path: '/product',
    module: 'landing',
    description: 'ATLAS Retail OS product features and POS platform architecture overview',
    supportedFilters: [],
  },
  {
    id: 'solutions_landing',
    name: 'Solutions & Workflows',
    path: '/solutions',
    module: 'landing',
    description: 'Enterprise retail, inventory, and SAP ERP integration capabilities',
    supportedFilters: [],
  },
  {
    id: 'contact',
    name: 'Contact & Support',
    path: '/contact',
    module: 'support',
    description: 'System support, ATLAS engineering contact, and help resources',
    supportedFilters: [],
  },
  {
    id: 'settings',
    name: 'Settings & Users',
    path: '/settings',
    module: 'settings',
    description: 'System configuration, user accounts, store and warehouse management',
    supportedFilters: [],
  },
];

/**
 * Validate and safely build internal navigation target URL.
 * Only resolves registered paths.
 */
export function resolveInternalRoute(
  routeIdOrPath: string,
  params?: Record<string, string | number | undefined>
): { path: string; name: string } | null {
  if (!routeIdOrPath) return null;

  // Split query string if routeIdOrPath already contains ?
  const [baseInputPath, existingQuery] = routeIdOrPath.split('?');

  // Canonical route aliases
  const ROUTE_ALIASES: Record<string, string> = {
    '/finance/overview': '/finance',
    'finance': '/finance',
    'settings_users': '/settings',
    'users': '/settings',
  };

  const lookupKey = ROUTE_ALIASES[routeIdOrPath] || ROUTE_ALIASES[baseInputPath] || routeIdOrPath;
  const lookupBase = ROUTE_ALIASES[baseInputPath] || baseInputPath;

  // Match by id or by exact path or base path
  const target = INTERNAL_ROUTES.find(
    (r) => r.id === lookupKey || r.path === lookupKey || r.path === lookupBase || r.id === routeIdOrPath || r.path === routeIdOrPath || r.path === baseInputPath
  );

  if (!target) {
    // If path is a sub-path of an existing route, e.g. /sales/123 or /products/AMIT000121
    if (routeIdOrPath.startsWith('/sales/') && routeIdOrPath.length > 7) {
      return { path: routeIdOrPath, name: 'Invoice Details' };
    }
    if (routeIdOrPath.startsWith('/products/') && routeIdOrPath.length > 10) {
      return { path: routeIdOrPath, name: 'Product Details' };
    }
    return null;
  }

  // Handle detail route replacement if an ID is provided
  let finalPath = target.path;
  if (target.detailRoutePattern && params?.id) {
    finalPath = target.detailRoutePattern.replace(':id', String(params.id));
    return { path: finalPath, name: `${target.name} #${params.id}` };
  }

  // Parse existing query params if any
  const query = new URLSearchParams(existingQuery || '');

  // Append supported query params if provided
  if (params && Object.keys(params).length > 0) {
    for (const [k, v] of Object.entries(params)) {
      if (k !== 'id' && v !== undefined && v !== '' && target.supportedFilters.includes(k)) {
        query.set(k, String(v));
      }
    }
  }

  const qs = query.toString();
  if (qs) {
    finalPath = `${finalPath}?${qs}`;
  }

  return { path: finalPath, name: target.name };
}
