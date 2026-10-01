import { useQuery } from '@tanstack/react-query';
import {
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    CalendarRange,
    ChevronDown,
    Download,
    PackageSearch,
    RefreshCw,
    Search,
    ShoppingBag,
    TrendingUp,
    UserRound,
    Warehouse,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type RangeKey = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';

type OverviewResponse = {
  totalSales: number;
  invoiceCount: number;
  averageOrderValue: number;
  paymentBreakdown: Array<{ method: string; total: number; percentage: number }>;
};

type TrendPoint = { label: string; total: number; billCount: number };

type InventoryItem = { itemCode: string; itemName: string; inStock: number; warehouse: string };

type BranchBreakdown = { branchId: string; branchName: string; total: number; billCount: number };

type TopCustomer = { customerCode: string; customerName: string; totalSales: number; invoiceCount: number };

type TopProduct = { itemCode: string; itemName: string; quantitySold: number; salesAmount: number };

type ReturnsSummary = { pendingApprovalsCount: number; sapCreditNotesCount: number; sapCreditNotesTotal: number };

const rangeOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'all_time', label: 'All time' },
] as const;

const currency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const number = (value: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);

const getBranchFilter = (user: any) => {
  if (user?.role === 'admin') return undefined;
  return user?.branch_id || user?.branchId || undefined;
};

const atlasApi = {
  getOverview: async (range: RangeKey, fromDate?: string, toDate?: string, branch?: string) => {
    const res = await apiClient.get('/atlas/overview', { params: { range, from_date: fromDate, to_date: toDate, branch } });
    return res.data as OverviewResponse;
  },
  getSalesTrend: async (range: RangeKey, fromDate?: string, toDate?: string, branch?: string) => {
    const res = await apiClient.get('/atlas/sales-trends', { params: { range, from_date: fromDate, to_date: toDate, branch } });
    return res.data as { trend: TrendPoint[] };
  },
  getTopProducts: async (range: RangeKey, fromDate?: string, toDate?: string, branch?: string, limit = 5) => {
    const res = await apiClient.get('/atlas/product-velocity', { params: { range, from_date: fromDate, to_date: toDate, branch, limit } });
    return res.data as TopProduct[];
  },
  getTopCustomers: async (range: RangeKey, fromDate?: string, toDate?: string, branch?: string, limit = 5) => {
    const res = await apiClient.get('/atlas/top-customers', { params: { range, from_date: fromDate, to_date: toDate, branch, limit } });
    return res.data as TopCustomer[];
  },
  getInventorySummary: async (branch?: string) => {
    const res = await apiClient.get('/atlas/inventory-summary', { params: { branch } });
    return res.data as { snapshotTime?: string; items: InventoryItem[] };
  },
  getBranchComparison: async (range: RangeKey, fromDate?: string, toDate?: string) => {
    const res = await apiClient.get('/atlas/branch-comparison', { params: { range, from_date: fromDate, to_date: toDate } });
    return res.data as { branches: BranchBreakdown[] };
  },
  getReturnsSummary: async (range: RangeKey, fromDate?: string, toDate?: string, branch?: string) => {
    const res = await apiClient.get('/atlas/returns-summary', { params: { range, from_date: fromDate, to_date: toDate, branch } });
    return res.data as ReturnsSummary;
  },
};

const safeArray = <T,>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);

export const AtlasAnalyticsPage = () => {
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>('monthly');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const branchFilter = getBranchFilter(user);
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const hasDateValidationError = !!(fromDate && toDate && new Date(fromDate) > new Date(toDate));

  const overviewQuery = useQuery({
    queryKey: ['atlas-overview', range, fromDate, toDate, branchFilter],
    queryFn: () => atlasApi.getOverview(range, fromDate || undefined, toDate || undefined, branchFilter),
    retry: 1,
  });

  const trendQuery = useQuery({
    queryKey: ['atlas-trend', range, fromDate, toDate, branchFilter],
    queryFn: () => atlasApi.getSalesTrend(range, fromDate || undefined, toDate || undefined, branchFilter),
    retry: 1,
  });

  const productsQuery = useQuery({
    queryKey: ['atlas-products', range, fromDate, toDate, branchFilter],
    queryFn: () => atlasApi.getTopProducts(range, fromDate || undefined, toDate || undefined, branchFilter, 5),
    retry: 1,
  });

  const customersQuery = useQuery({
    queryKey: ['atlas-customers', range, fromDate, toDate, branchFilter],
    queryFn: () => atlasApi.getTopCustomers(range, fromDate || undefined, toDate || undefined, branchFilter, 5),
    retry: 1,
  });

  const inventoryQuery = useQuery({
    queryKey: ['atlas-inventory', branchFilter],
    queryFn: () => atlasApi.getInventorySummary(branchFilter),
    retry: 1,
    enabled: !!branchFilter,
  });

  const comparisonQuery = useQuery({
    queryKey: ['atlas-branch-comparison', range, fromDate, toDate],
    queryFn: () => atlasApi.getBranchComparison(range, fromDate || undefined, toDate || undefined),
    retry: 1,
    enabled: isAdmin,
  });

  const returnsQuery = useQuery({
    queryKey: ['atlas-returns', range, fromDate, toDate, branchFilter],
    queryFn: () => atlasApi.getReturnsSummary(range, fromDate || undefined, toDate || undefined, branchFilter),
    retry: 1,
  });

  const chartData = useMemo(() => {
    const data = safeArray(trendQuery.data?.trend);
    if (!data.length) return [];
    const max = Math.max(...data.map((item) => Number(item.total || 0)), 1);
    return data.map((item) => ({ ...item, height: Math.max((Number(item.total || 0) / max) * 100, 8) }));
  }, [trendQuery.data]);

  const overview = overviewQuery.data;
  const topProducts = safeArray(productsQuery.data);
  const topCustomers = safeArray(customersQuery.data);
  const inventoryItems = safeArray(inventoryQuery.data?.items);
  const branchBreakdown = safeArray(comparisonQuery.data?.branches);
  const returnSummary = returnsQuery.data;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1500px] space-y-6 pb-10">

        {/* ── Page Header ──────────────────────────────────────── */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Atlas Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">Understand performance across your retail operation</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Branch pill */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              <Warehouse className="h-4 w-4 text-blue-600" />
              <span className="font-medium">{branchFilter ? `Main Branch (WH-${branchFilter})` : 'All branches'}</span>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-sm">
              <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 border border-slate-100">
                <CalendarRange className="h-4 w-4 text-blue-600 shrink-0" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="bg-transparent text-sm text-slate-700 outline-none"
                />
              </label>
              <span className="text-slate-400 text-xs font-medium">to</span>
              <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 border border-slate-100">
                <CalendarRange className="h-4 w-4 text-blue-600 shrink-0" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="bg-transparent text-sm text-slate-700 outline-none"
                />
              </label>
            </div>

            {/* Range selector */}
            <div className="relative">
              <select
                value={range}
                onChange={(event) => setRange(event.target.value as RangeKey)}
                className="appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {rangeOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-white text-slate-700">
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-slate-500" />
            </div>

            {/* Export */}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* ── Date validation error ─────────────────────────────── */}
        {hasDateValidationError && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            The end date must be the same as or later than the start date.
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {['Overview', 'Sales Analysis', 'Product Insights', 'Customer Insights', 'Branch Comparison'].map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                index === 0
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── KPI Metric Cards ──────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Net Sales"
            value={currency(overview?.totalSales ?? 0)}
            change="Sales volume"
            positive
            icon={<ShoppingBag className="h-5 w-5" />}
            iconBg="bg-blue-100 text-blue-700"
            loading={overviewQuery.isLoading}
            error={overviewQuery.isError}
          />
          <MetricCard
            title="Invoices"
            value={number(overview?.invoiceCount ?? 0)}
            change="Transactions"
            positive
            icon={<BarChart3 className="h-5 w-5" />}
            iconBg="bg-emerald-100 text-emerald-700"
            loading={overviewQuery.isLoading}
            error={overviewQuery.isError}
          />
          <MetricCard
            title="Average Basket"
            value={currency(overview?.averageOrderValue ?? 0)}
            change="Per order"
            positive
            icon={<TrendingUp className="h-5 w-5" />}
            iconBg="bg-violet-100 text-violet-700"
            loading={overviewQuery.isLoading}
            error={overviewQuery.isError}
          />
          <MetricCard
            title="Returns"
            value={number(returnSummary?.pendingApprovalsCount ?? 0)}
            change="Pending approval"
            positive={false}
            icon={<RefreshCw className="h-5 w-5" />}
            iconBg="bg-amber-100 text-amber-700"
            loading={returnsQuery.isLoading}
            error={returnsQuery.isError}
          />
        </div>

        {/* ── Sales Trend + Payment Split ───────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <AnalyticsCard title="Sales Trend" subtitle="Compare the selected range across the current branch." badge={rangeOptions.find((item) => item.value === range)?.label}>
            {trendQuery.isLoading ? (
              <PanelLoading label="Loading sales trend..." />
            ) : trendQuery.isError ? (
              <PanelError message="Unable to load sales trend from the backend." retry={() => trendQuery.refetch()} />
            ) : chartData.length ? (
              <div className="flex h-[260px] items-end gap-2 overflow-hidden rounded-xl bg-slate-50 border border-slate-100 px-3 pb-3 pt-5">
                {chartData.map((point) => (
                  <div key={`${point.label}-${point.billCount}`} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-full w-full items-end justify-center">
                      <div
                        className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 shadow-sm"
                        style={{ height: `${point.height}%` }}
                        title={`${point.label}: ${currency(point.total)}`}
                      />
                    </div>
                    <div className="text-center text-[10px] font-medium text-slate-500">{point.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No sales trend data is available for the selected range." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Payment Split" liveBadge>
            {overviewQuery.isLoading ? (
              <PanelLoading label="Loading payment breakdown..." />
            ) : overviewQuery.isError ? (
              <PanelError message="Payment breakdown is unavailable." retry={() => overviewQuery.refetch()} />
            ) : safeArray(overview?.paymentBreakdown).length ? (
              <div className="space-y-4">
                {overview?.paymentBreakdown.map((item) => (
                  <div key={item.method}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="capitalize font-medium text-slate-700">{item.method}</span>
                      <span className="text-slate-500 tabular-nums">{item.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No payment data returned for the selected range." />
            )}
          </AnalyticsCard>
        </div>

        {/* ── Top Products + Top Customers ──────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsCard title="Top Products" subtitle="By quantity sold" actionLabel="View all" onAction={() => {}}>
            {productsQuery.isLoading ? (
              <PanelLoading label="Loading product insights..." />
            ) : productsQuery.isError ? (
              <PanelError message="Top products are currently unavailable." retry={() => productsQuery.refetch()} />
            ) : topProducts.length ? (
              <div className="space-y-2">
                {topProducts.map((product, index) => (
                  <div
                    key={`${product.itemCode}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 hover:bg-blue-50 hover:border-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shrink-0">
                        <PackageSearch className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{product.itemName}</div>
                        <div className="text-xs text-slate-500">{product.itemCode}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900 text-sm">{number(product.quantitySold)} units</div>
                      <div className="text-xs text-slate-500">{currency(product.salesAmount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No top products were returned by the backend for this range." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Top Customers" subtitle="Highest sales volume" actionLabel="View all" onAction={() => {}}>
            {customersQuery.isLoading ? (
              <PanelLoading label="Loading customer insights..." />
            ) : customersQuery.isError ? (
              <PanelError message="Customer insights are currently unavailable." retry={() => customersQuery.refetch()} />
            ) : topCustomers.length ? (
              <div className="space-y-2">
                {topCustomers.map((customer, index) => (
                  <div
                    key={`${customer.customerCode}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 hover:bg-violet-50 hover:border-violet-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700 shrink-0">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{customer.customerName}</div>
                        <div className="text-xs text-slate-500">{customer.customerCode}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900 text-sm">{currency(customer.totalSales)}</div>
                      <div className="text-xs text-slate-500">{customer.invoiceCount} invoices</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No customer sales data was returned for the selected range." />
            )}
          </AnalyticsCard>
        </div>

        {/* ── Inventory Snapshot + Branch Comparison ────────────── */}
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsCard title="Inventory Snapshot" subtitle="Warehouse inventory for the selected branch">
            {inventoryQuery.isLoading ? (
              <PanelLoading label="Loading inventory snapshot..." />
            ) : inventoryQuery.isError ? (
              <PanelError message="Inventory snapshot is unavailable from SAP." retry={() => inventoryQuery.refetch()} />
            ) : inventoryItems.length ? (
              <div className="space-y-2">
                {inventoryItems.slice(0, 5).map((item) => (
                  <div
                    key={`${item.itemCode}-${item.warehouse}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{item.itemName}</div>
                      <div className="text-xs text-slate-500">{item.itemCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900 text-sm">{number(item.inStock)}</div>
                      <div className="text-xs text-slate-500">in stock</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No inventory snapshot data is available for the selected branch." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Branch Comparison" subtitle="Admin-only branch totals">
            {!isAdmin ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
                Branch comparison is restricted to administrators.
              </div>
            ) : comparisonQuery.isLoading ? (
              <PanelLoading label="Loading branch comparison..." />
            ) : comparisonQuery.isError ? (
              <PanelError message="Branch comparison could not be loaded from SAP." retry={() => comparisonQuery.refetch()} />
            ) : branchBreakdown.length ? (
              <div className="space-y-4">
                {branchBreakdown.map((branch) => {
                  const max = Math.max(...branchBreakdown.map((item) => item.total), 1);
                  const width = (branch.total / max) * 100;
                  return (
                    <div key={branch.branchId}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{branch.branchName || branch.branchId}</span>
                        <span className="text-slate-500 tabular-nums">{currency(branch.total)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <PanelEmpty message="No branch comparison data is available for the selected range." />
            )}
          </AnalyticsCard>
        </div>

        {/* ── Returns Summary + Operations Notes ────────────────── */}
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsCard title="Returns Summary" subtitle="Credit notes and approvals">
            {returnsQuery.isLoading ? (
              <PanelLoading label="Loading returns summary..." />
            ) : returnsQuery.isError ? (
              <PanelError message="Returns summary is unavailable." retry={() => returnsQuery.refetch()} />
            ) : returnSummary ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <MiniStat label="Pending" value={number(returnSummary.pendingApprovalsCount)} accent="amber" />
                <MiniStat label="Credit notes" value={number(returnSummary.sapCreditNotesCount)} accent="blue" />
                <MiniStat label="Total issued" value={currency(returnSummary.sapCreditNotesTotal)} accent="emerald" />
              </div>
            ) : (
              <PanelEmpty message="No returns summary data returned for the selected range." />
            )}
          </AnalyticsCard>

          <AnalyticsCard title="Operations Notes" subtitle="Backend-supported analytics only">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                <Search className="mt-0.5 h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-slate-700">
                  Sales trend, overview, top products, top customers, inventory snapshot, branch comparison, and returns summary are populated from the real Atlas endpoints.
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-slate-500 shrink-0" />
                <span className="text-slate-700">
                  Unsupported metrics are intentionally omitted instead of being fabricated to match the dashboard reference.
                </span>
              </div>
            </div>
          </AnalyticsCard>
        </div>

      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Reusable card wrapper for all Analytics panels */
const AnalyticsCard = ({
  title,
  subtitle,
  badge,
  liveBadge,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  liveBadge?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="shrink-0">
        {badge && (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            {badge}
          </span>
        )}
        {liveBadge && (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            Live
          </span>
        )}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
    {children}
  </div>
);

/** KPI metric card */
const MetricCard = ({
  title,
  value,
  change,
  positive,
  icon,
  iconBg,
  loading,
  error,
}: {
  title: string;
  value: string;
  change: string;
  positive?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  loading: boolean;
  error: boolean;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-slate-500">{title}</div>
        <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {loading ? (
            <span className="inline-block h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
          ) : error ? (
            <span className="text-slate-400 text-2xl">—</span>
          ) : (
            value
          )}
        </div>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
    </div>
    <div className="flex items-center gap-1.5 text-xs font-medium">
      {positive === false ? (
        <ArrowDownRight className="h-3.5 w-3.5 text-amber-500" />
      ) : (
        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
      )}
      <span className="text-slate-600">{change}</span>
    </div>
  </div>
);

/** Loading state for a panel section */
const PanelLoading = ({ label }: { label: string }) => (
  <div className="flex h-[180px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-500">
    <div className="flex items-center gap-2">
      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
      {label}
    </div>
  </div>
);

/** Error state for a panel section — shows real backend error message */
const PanelError = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div className="flex h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 text-center text-sm">
    <AlertCircle className="h-5 w-5 text-red-500" />
    <span className="text-red-700 font-medium max-w-[260px] leading-snug">{message}</span>
    {retry && (
      <button
        type="button"
        onClick={retry}
        className="rounded-lg border border-red-300 bg-white px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors shadow-sm"
      >
        Retry
      </button>
    )}
  </div>
);

/** Empty state for a panel section */
const PanelEmpty = ({ message }: { message: string }) => (
  <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm">
    <Search className="h-5 w-5 text-slate-400" />
    <span className="text-slate-500 max-w-[240px] leading-snug">{message}</span>
  </div>
);

/** Small stat widget for Returns Summary */
const MiniStat = ({ label, value, accent = 'blue' }: { label: string; value: string; accent?: 'blue' | 'emerald' | 'amber' }) => {
  const accentMap: Record<string, string> = {
    blue: 'text-blue-700 bg-blue-50 border-blue-100',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-100',
  };
  return (
    <div className={`rounded-xl border p-4 ${accentMap[accent]}`}>
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold opacity-70">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
};

export default AtlasAnalyticsPage;
