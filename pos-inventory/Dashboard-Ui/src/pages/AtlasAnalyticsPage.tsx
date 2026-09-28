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
    <div className="min-h-full bg-[#071d34] text-slate-100">
      <div className="mx-auto max-w-[1500px] space-y-6 pb-10">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Atlas Analytics</h1>
            <p className="mt-1 text-sm text-slate-300">Understand performance across your retail operation</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-sky-800 bg-[#0a2744] px-3 py-2 text-sm text-sky-100">
              <Warehouse className="h-4 w-4 text-sky-300" />
              <span>{branchFilter ? `Main Branch (WH-${branchFilter})` : 'All branches'}</span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-sky-800 bg-[#0a2744] p-2 text-sm text-sky-100">
              <label className="flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-2 py-1.5">
                <CalendarRange className="h-4 w-4 text-sky-300" />
                <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="bg-transparent text-sm text-sky-100 outline-none" />
              </label>
              <span className="text-slate-400">to</span>
              <label className="flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-2 py-1.5">
                <CalendarRange className="h-4 w-4 text-sky-300" />
                <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="bg-transparent text-sm text-sky-100 outline-none" />
              </label>
            </div>

            <div className="relative">
              <select
                value={range}
                onChange={(event) => setRange(event.target.value as RangeKey)}
                className="appearance-none rounded-xl border border-sky-800 bg-[#0a2744] px-3 py-2.5 pr-8 text-sm font-medium text-sky-100 outline-none"
              >
                {rangeOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#071d34] text-sky-100">
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-sky-300" />
            </div>

            <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/20 hover:bg-blue-500">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {hasDateValidationError && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            The end date must be the same as or later than the start date.
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-sky-900/80 pb-3">
          {['Overview', 'Sales Analysis', 'Product Insights', 'Customer Insights', 'Branch Comparison'].map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                index === 0 ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20' : 'bg-[#0a2744] text-sky-200 hover:bg-[#113c63]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Net Sales" value={currency(overview?.totalSales ?? 0)} change="Sales volume" positive icon={<ShoppingBag className="h-5 w-5" />} loading={overviewQuery.isLoading} error={overviewQuery.isError} />
          <MetricCard title="Invoices" value={number(overview?.invoiceCount ?? 0)} change="Transactions" positive icon={<BarChart3 className="h-5 w-5" />} loading={overviewQuery.isLoading} error={overviewQuery.isError} />
          <MetricCard title="Average Basket" value={currency(overview?.averageOrderValue ?? 0)} change="Per order" positive icon={<TrendingUp className="h-5 w-5" />} loading={overviewQuery.isLoading} error={overviewQuery.isError} />
          <MetricCard title="Returns" value={number(returnSummary?.pendingApprovalsCount ?? 0)} change="Pending approval" positive={false} icon={<RefreshCw className="h-5 w-5" />} loading={returnsQuery.isLoading} error={returnsQuery.isError} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Sales Trend</h2>
                <p className="text-sm text-slate-400">Compare the selected range across the current branch.</p>
              </div>
              <div className="rounded-lg bg-[#0d2f4e] px-2.5 py-1.5 text-xs font-medium text-sky-200">{rangeOptions.find((item) => item.value === range)?.label}</div>
            </div>

            {trendQuery.isLoading ? (
              <PanelLoading label="Loading sales trend..." />
            ) : trendQuery.isError ? (
              <PanelError message="Unable to load sales trend from the backend." retry={() => trendQuery.refetch()} />
            ) : chartData.length ? (
              <div className="flex h-[260px] items-end gap-3 overflow-hidden rounded-xl bg-[#0a2744] px-3 pb-3 pt-5">
                {chartData.map((point) => (
                  <div key={`${point.label}-${point.billCount}`} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-full w-full items-end justify-center">
                      <div className="w-full max-w-[40px] rounded-t-xl bg-gradient-to-t from-blue-600 to-sky-400 shadow-sm" style={{ height: `${point.height}%` }} title={`${point.label}: ${currency(point.total)}`} />
                    </div>
                    <div className="text-center text-[10px] font-medium text-slate-400">{point.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No sales trend data is available for the selected range." />
            )}
          </div>

          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Payment Split</h2>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">Live</span>
            </div>

            {overviewQuery.isLoading ? (
              <PanelLoading label="Loading payment breakdown..." />
            ) : overviewQuery.isError ? (
              <PanelError message="Payment breakdown is unavailable." retry={() => overviewQuery.refetch()} />
            ) : safeArray(overview?.paymentBreakdown).length ? (
              <div className="space-y-4">
                {overview?.paymentBreakdown.map((item) => (
                  <div key={item.method}>
                    <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                      <span className="capitalize">{item.method}</span>
                      <span>{item.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#0d2f4e]">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-500" style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No payment data returned for the selected range." />
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Top Products</h2>
                <p className="text-sm text-slate-400">By quantity sold</p>
              </div>
              <button type="button" className="text-sm font-semibold text-sky-300 hover:text-sky-200">View all</button>
            </div>

            {productsQuery.isLoading ? (
              <PanelLoading label="Loading product insights..." />
            ) : productsQuery.isError ? (
              <PanelError message="Top products are currently unavailable." retry={() => productsQuery.refetch()} />
            ) : topProducts.length ? (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={`${product.itemCode}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-sky-800 bg-[#0b2c4d] p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-200">
                        <PackageSearch className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-100">{product.itemName}</div>
                        <div className="text-xs text-slate-400">{product.itemCode}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{number(product.quantitySold)}</div>
                      <div className="text-xs text-slate-400">{currency(product.salesAmount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No top products were returned by the backend for this range." />
            )}
          </div>

          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Top Customers</h2>
                <p className="text-sm text-slate-400">Highest sales volume</p>
              </div>
              <button type="button" className="text-sm font-semibold text-sky-300 hover:text-sky-200">View all</button>
            </div>

            {customersQuery.isLoading ? (
              <PanelLoading label="Loading customer insights..." />
            ) : customersQuery.isError ? (
              <PanelError message="Customer insights are currently unavailable." retry={() => customersQuery.refetch()} />
            ) : topCustomers.length ? (
              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div key={`${customer.customerCode}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-sky-800 bg-[#0b2c4d] p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-100">{customer.customerName}</div>
                        <div className="text-xs text-slate-400">{customer.customerCode}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{currency(customer.totalSales)}</div>
                      <div className="text-xs text-slate-400">{customer.invoiceCount} invoices</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No customer sales data was returned for the selected range." />
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Inventory Snapshot</h2>
                <p className="text-sm text-slate-400">Warehouse inventory for the selected branch</p>
              </div>
            </div>

            {inventoryQuery.isLoading ? (
              <PanelLoading label="Loading inventory snapshot..." />
            ) : inventoryQuery.isError ? (
              <PanelError message="Inventory snapshot is unavailable from SAP." retry={() => inventoryQuery.refetch()} />
            ) : inventoryItems.length ? (
              <div className="space-y-3">
                {inventoryItems.slice(0, 5).map((item) => (
                  <div key={`${item.itemCode}-${item.warehouse}`} className="flex items-center justify-between rounded-xl border border-sky-800 bg-[#0b2c4d] p-3">
                    <div>
                      <div className="font-semibold text-slate-100">{item.itemName}</div>
                      <div className="text-xs text-slate-400">{item.itemCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">{number(item.inStock)}</div>
                      <div className="text-xs text-slate-400">in stock</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PanelEmpty message="No inventory snapshot data is available for the selected branch." />
            )}
          </div>

          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Branch Comparison</h2>
                <p className="text-sm text-slate-400">Admin-only branch totals</p>
              </div>
            </div>

            {!isAdmin ? (
              <div className="rounded-xl border border-sky-800 bg-[#0a2744] p-4 text-sm text-slate-300">Branch comparison is restricted to administrators.</div>
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
                      <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                        <span>{branch.branchName || branch.branchId}</span>
                        <span>{currency(branch.total)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#0d2f4e]">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <PanelEmpty message="No branch comparison data is available for the selected range." />
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Returns Summary</h2>
                <p className="text-sm text-slate-400">Credit notes and approvals</p>
              </div>
            </div>

            {returnsQuery.isLoading ? (
              <PanelLoading label="Loading returns summary..." />
            ) : returnsQuery.isError ? (
              <PanelError message="Returns summary is unavailable." retry={() => returnsQuery.refetch()} />
            ) : returnSummary ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <MiniStat label="Pending" value={number(returnSummary.pendingApprovalsCount)} />
                <MiniStat label="Credit notes" value={number(returnSummary.sapCreditNotesCount)} />
                <MiniStat label="Total issued" value={currency(returnSummary.sapCreditNotesTotal)} />
              </div>
            ) : (
              <PanelEmpty message="No returns summary data returned for the selected range." />
            )}
          </div>

          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Operations Notes</h2>
                <p className="text-sm text-slate-400">Backend-supported analytics only</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3 rounded-xl bg-[#0a2744] p-3">
                <Search className="mt-0.5 h-4 w-4 text-sky-300" />
                <span>Sales trend, overview, top products, top customers, inventory snapshot, branch comparison, and returns summary are populated from the real Atlas endpoints.</span>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-[#0a2744] p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-sky-300" />
                <span>Unsupported metrics are intentionally omitted instead of being fabricated to match the dashboard reference.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, change, positive, icon, loading, error }: { title: string; value: string; change: string; positive?: boolean; icon: React.ReactNode; loading: boolean; error: boolean }) => (
  <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-4 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-slate-300">{title}</div>
        <div className="mt-2 text-3xl font-bold tracking-tight text-white">
          {loading ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-slate-700" /> : error ? '—' : value}
        </div>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d2f4e] text-sky-200">{icon}</div>
    </div>
    <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
      {positive === false ? <ArrowDownRight className="h-3.5 w-3.5 text-amber-400" /> : <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />}
      <span>{change}</span>
    </div>
  </div>
);

const PanelLoading = ({ label }: { label: string }) => (
  <div className="flex h-[180px] items-center justify-center rounded-xl border border-sky-800 bg-[#0a2744] text-sm text-slate-300">
    <div className="flex items-center gap-2">
      <RefreshCw className="h-4 w-4 animate-spin text-sky-300" />
      {label}
    </div>
  </div>
);

const PanelError = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div className="flex h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-red-400/30 bg-red-500/10 text-center text-sm text-red-100">
    <AlertCircle className="h-5 w-5" />
    <span>{message}</span>
    {retry && (
      <button type="button" onClick={retry} className="rounded-lg bg-red-500 px-3 py-1.5 font-medium text-white hover:bg-red-400">
        Retry
      </button>
    )}
  </div>
);

const PanelEmpty = ({ message }: { message: string }) => (
  <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sky-800 bg-[#0a2744] text-center text-sm text-slate-300">
    <Search className="h-5 w-5 text-slate-400" />
    <span>{message}</span>
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-sky-800 bg-[#0b2c4d] p-3">
    <div className="text-[10px] uppercase tracking-[0.18em] text-sky-300">{label}</div>
    <div className="mt-2 text-xl font-bold text-white">{value}</div>
  </div>
);

export default AtlasAnalyticsPage;
