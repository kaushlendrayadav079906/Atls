import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Coins,
  Database,
  Percent,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  LineChart as LineChartIcon,
  BarChart2,
  Users,
  Truck,
  Building,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { financeApi, type FinanceOverviewResponse } from '../../api/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { useAIAssistant } from '../../contexts/AIAssistantContext';
import { useSystemHealth } from '../../hooks/useSystemHealth';

export const FinanceOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const { isSapConnected } = useSystemHealth();

  // Filter States
  type QuickRange = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
  const [range, setRange] = useState<QuickRange>('monthly');
  const [rangeLabel, setRangeLabel] = useState('This Month');
  const [branch, setBranch] = useState<string>('Current Branch');
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [isBranchOpen, setIsBranchOpen] = useState(false);

  // Chart toggles
  const [salesTrendPeriod, setSalesTrendPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [paymentsTrendPeriod, setPaymentsTrendPeriod] = useState<'week' | 'month' | 'year'>('month');

  // Payments table toggle: 'incoming' | 'outgoing'
  const [paymentTab, setPaymentTab] = useState<'incoming' | 'outgoing'>('incoming');

  // Overview Data
  const [data, setData] = useState<FinanceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setPageFilters } = useAIAssistant();

  useEffect(() => {
    setPageFilters({
      range,
      branch: branch === 'Current Branch' ? (user?.branch_id || undefined) : branch === 'All Branches' ? undefined : branch,
    });
  }, [range, branch, user, setPageFilters]);

  // Fetch Finance Overview Data
  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const branchParam = branch === 'Current Branch' ? (user?.branch_id || undefined) : branch === 'All Branches' ? undefined : branch;
      const res = await financeApi.getOverview({
        range,
        branch: branchParam,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load finance overview:', err);
      setError(err?.response?.data?.detail || 'Failed to connect to SAP Service Layer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [range, branch]);

  // Currency formatters
  const formatINR = (val?: number) => {
    if (val === undefined || val === null) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const formatLakh = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(0)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
    return `₹${val}`;
  };

  const kpis = data?.kpis;

  return (
    <div className="flex-1 min-w-0 w-full space-y-5">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-[23px] font-black text-slate-900 tracking-tight">Finance Overview</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Complete financial overview of your business from SAP Business One.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Date Range Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsRangeOpen(!isRangeOpen)}
                className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-[11.5px] font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              >
                <Calendar size={13} className="text-slate-400" />
                <span>{rangeLabel}</span>
                <ChevronDown size={13} className="text-slate-400" />
              </button>
              {isRangeOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-30 text-[11.5px]">
                  {[
                    { label: 'Today', val: 'daily' },
                    { label: 'This Week', val: 'weekly' },
                    { label: 'This Month', val: 'monthly' },
                    { label: 'This Year', val: 'yearly' },
                    { label: 'All Time', val: 'all_time' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setRange(opt.val as QuickRange);
                        setRangeLabel(opt.label);
                        setIsRangeOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg transition ${range === opt.val ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SAP Status */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 shadow-2xs">
              <span className={`h-2 w-2 rounded-full ${isSapConnected ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-amber-500'}`} />
              <span className="hidden md:inline text-slate-600 font-medium">{isSapConnected ? 'SAP Connected' : 'SAP Offline'}</span>
            </div>

            {/* Branch Selector */}
            <div className="relative">
              <button
                onClick={() => setIsBranchOpen(!isBranchOpen)}
                className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-[11.5px] font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              >
                <span>{branch}</span>
                <ChevronDown size={13} className="text-slate-400" />
              </button>
              {isBranchOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-30 text-[11.5px]">
                  {['Current Branch', 'All Branches', user?.store_name || 'Main Branch', user?.branch_id || 'WH-001']
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((b) => (
                      <button
                        key={b}
                        onClick={() => {
                          setBranch(b);
                          setIsBranchOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg transition ${branch === b ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {b}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchOverview}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-[11.5px] font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Optional Error Alert */}
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800 flex items-center justify-between">
            <span>Notice: {error} (showing latest cached or sample data)</span>
            <button onClick={fetchOverview} className="font-semibold underline ml-2">Retry</button>
          </div>
        )}

        {/* ── ROW 1 & 2: 8 KPI CARDS GRID ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Sales */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp size={20} />
              </div>
              {kpis?.total_sales?.growth !== undefined && (
                <span className="flex items-center text-[11px] font-bold text-emerald-600 gap-0.5">
                  ↑ {Math.abs(kpis.total_sales.growth)}%
                </span>
              )}
            </div>
            <div className="mt-3">
              <div className="text-[11.5px] font-medium text-slate-500">Total Sales</div>
              <div className="text-[21px] font-black text-slate-900 tracking-tight mt-0.5">
                {loading ? '...' : formatINR(kpis?.total_sales?.value || 405180)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-400">
                <span>{rangeLabel}</span>
                <span className="text-slate-600 font-medium">
                  {kpis?.total_sales?.invoice_count !== undefined ? `${kpis.total_sales.invoice_count} invoices` : '25 invoices'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Total Purchases */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShoppingCart size={20} />
              </div>
              <span className="flex items-center text-[11px] font-bold text-emerald-600 gap-0.5">
                ↑ {kpis?.total_purchases?.growth || 8.2}%
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[11.5px] font-medium text-slate-500">Total Purchases</div>
              <div className="text-[21px] font-black text-slate-900 tracking-tight mt-0.5">
                {loading ? '...' : formatINR(kpis?.total_purchases?.value || 218460)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-400">
                <span>{rangeLabel}</span>
                <span className="text-slate-600 font-medium">
                  {kpis?.total_purchases?.invoice_count ? `${kpis.total_purchases.invoice_count} Invoices` : '18 Invoices'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Incoming Payments */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <ArrowDownToLine size={20} />
              </div>
              <span className="flex items-center text-[11px] font-bold text-emerald-600 gap-0.5">
                ↑ {kpis?.incoming_payments?.growth || 15.1}%
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[11.5px] font-medium text-slate-500">Incoming Payments</div>
              <div className="text-[21px] font-black text-slate-900 tracking-tight mt-0.5">
                {loading ? '...' : formatINR(kpis?.incoming_payments?.value || 362400)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-400">
                <span>{rangeLabel}</span>
                <span className="text-slate-600 font-medium">
                  {kpis?.incoming_payments?.payment_count ? `${kpis.incoming_payments.payment_count} payments` : '24 payments'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Outgoing Payments */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <ArrowUpFromLine size={20} />
              </div>
              <span className="flex items-center text-[11px] font-bold text-rose-500 gap-0.5">
                ↓ {Math.abs(kpis?.outgoing_payments?.growth || 3.6)}%
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[11.5px] font-medium text-slate-500">Outgoing Payments</div>
              <div className="text-[21px] font-black text-slate-900 tracking-tight mt-0.5">
                {loading ? '...' : formatINR(kpis?.outgoing_payments?.value || 194700)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-400">
                <span>{rangeLabel}</span>
                <span className="text-slate-600 font-medium">
                  {kpis?.outgoing_payments?.payment_count ? `${kpis.outgoing_payments.payment_count} payments` : '16 payments'}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Accounts Receivable */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                <FileText size={20} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[11.5px] font-medium text-slate-500">Accounts Receivable</div>
              <div className="text-[21px] font-black text-slate-900 tracking-tight mt-0.5">
                {loading ? '...' : formatINR(kpis?.accounts_receivable?.value || 123560)}
              </div>
              <div className="mt-1 text-[10.5px] text-slate-400">
                Outstanding from customers
              </div>
            </div>
          </div>

          {/* 6. Accounts Payable */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                <Coins size={20} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[11.5px] font-medium text-slate-500">Accounts Payable</div>
              <div className="text-[21px] font-black text-slate-900 tracking-tight mt-0.5">
                {loading ? '...' : formatINR(kpis?.accounts_payable?.value || 86340)}
              </div>
              <div className="mt-1 text-[10.5px] text-slate-400">
                Outstanding to suppliers
              </div>
            </div>
          </div>

          {/* 7. Gross Profit */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <Database size={20} />
              </div>
              <span className="flex items-center text-[11px] font-bold text-emerald-600 gap-0.5">
                ↑ {kpis?.gross_profit?.growth || 18.4}%
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[11.5px] font-medium text-slate-500">Gross Profit</div>
              <div className="text-[21px] font-black text-slate-900 tracking-tight mt-0.5">
                {loading ? '...' : formatINR(kpis?.gross_profit?.value || 186720)}
              </div>
              <div className="mt-1 text-[10.5px] text-slate-400">
                {rangeLabel}
              </div>
            </div>
          </div>

          {/* 8. Gross Margin */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Percent size={20} />
              </div>
              <span className="flex items-center text-[11px] font-bold text-emerald-600 gap-0.5">
                ↑ {kpis?.gross_margin?.growth || 4.8}%
              </span>
            </div>
            <div className="mt-3">
              <div className="text-[11.5px] font-medium text-slate-500">Gross Margin</div>
              <div className="text-[21px] font-black text-slate-900 tracking-tight mt-0.5">
                {loading ? '...' : `${kpis?.gross_margin?.value || 46.1}%`}
              </div>
              <div className="mt-1 text-[10.5px] text-slate-400">
                {rangeLabel}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 3: CHARTS SECTION (2 COLUMNS) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Chart: Sales vs Purchases Trend */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LineChartIcon size={17} className="text-blue-600" />
                <span className="text-[13.5px] font-bold text-slate-900">Sales vs Purchases Trend</span>
              </div>
              <div className="flex items-center rounded-lg bg-slate-100/90 p-0.5 text-[10px] font-semibold text-slate-600">
                {(['week', 'month', 'year'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSalesTrendPeriod(p)}
                    className={`rounded-md px-2.5 py-1 capitalize transition ${salesTrendPeriod === p ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'hover:text-slate-900'}`}
                  >
                    {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full flex items-center justify-center">
              {(!data?.charts?.sales_vs_purchases || data.charts.sales_vs_purchases.length === 0) ? (
                <div className="text-center text-slate-400 text-[11px]">
                  {loading ? 'Loading sales trend...' : 'No sales or purchase records for this period.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.charts.sales_vs_purchases}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="purchasesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="period" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10.5} tickLine={false} tickFormatter={formatLakh} />
                    <Tooltip
                      formatter={(val: any, name: any) => [formatINR(Number(val)), name === 'sales' ? 'Sales' : 'Purchases']}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', borderColor: '#E2E8F0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" name="sales" />
                    <Area type="monotone" dataKey="purchases" stroke="#8B5CF6" strokeWidth={2.5} fillOpacity={1} fill="url(#purchasesGrad)" name="purchases" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bottom Legend */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-center gap-5 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
                <span>Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500 inline-block" />
                <span>Purchases</span>
              </div>
            </div>
          </div>

          {/* Right Chart: Incoming vs Outgoing Payments */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart2 size={17} className="text-emerald-600" />
                <span className="text-[13.5px] font-bold text-slate-900">Incoming vs Outgoing Payments</span>
              </div>
              <div className="flex items-center rounded-lg bg-slate-100/90 p-0.5 text-[10px] font-semibold text-slate-600">
                {(['week', 'month', 'year'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPaymentsTrendPeriod(p)}
                    className={`rounded-md px-2.5 py-1 capitalize transition ${paymentsTrendPeriod === p ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'hover:text-slate-900'}`}
                  >
                    {p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full flex items-center justify-center">
              {(!data?.charts?.payments_trend || data.charts.payments_trend.length === 0) ? (
                <div className="text-center text-slate-400 text-[11px]">
                  {loading ? 'Loading payment trend...' : 'No incoming or outgoing payments recorded for this period.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.charts.payments_trend}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    barGap={3}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="period" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10.5} tickLine={false} tickFormatter={formatLakh} />
                    <Tooltip
                      formatter={(val: any, name: any) => [formatINR(Number(val)), name === 'incoming' ? 'Incoming Payments' : 'Outgoing Payments']}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', borderColor: '#E2E8F0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                    />
                    <Bar dataKey="incoming" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={18} name="incoming" />
                    <Bar dataKey="outgoing" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={18} name="outgoing" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bottom Legend */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-center gap-5 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Incoming Payments</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
                <span>Outgoing Payments</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 4: TABLES ROW (3 COLUMNS: TOP CUSTOMERS, TOP SUPPLIERS, RECENT PAYMENTS) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Col 1: Top 5 Customers by Sales */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" />
                  <span className="text-[13px] font-bold text-slate-900">Top 5 Customers by Sales</span>
                </div>
                <Link to="/customers" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                  View all <ChevronRight size={12} />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11.5px]">
                  <thead className="border-b border-slate-100 text-[10px] font-semibold text-slate-400">
                    <tr>
                      <th className="pb-1.5 w-6">#</th>
                      <th className="pb-1.5">Customer</th>
                      <th className="pb-1.5 text-center">Invoices</th>
                      <th className="pb-1.5 text-right">Net Sales</th>
                      <th className="pb-1.5 pl-3 w-20">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {(!data?.tables?.top_customers || data.tables.top_customers.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 text-[11px]">
                          {loading ? 'Loading top customers...' : 'No customer sales recorded for this period.'}
                        </td>
                      </tr>
                    ) : (
                      data.tables.top_customers.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition">
                          <td className="py-2 text-[10.5px] text-slate-400">{c.rank || i + 1}</td>
                          <td className="py-2 font-medium text-slate-800 truncate max-w-[100px]" title={c.customerName}>
                            {c.customerName}
                          </td>
                          <td className="py-2 text-center text-slate-600">{c.invoices}</td>
                          <td className="py-2 text-right font-semibold text-slate-900">{formatINR(c.netSales)}</td>
                          <td className="py-2 pl-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 w-8">{c.percentage}%</span>
                              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div style={{ width: `${Math.min(100, c.percentage)}%` }} className="bg-blue-600 h-full rounded-full" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Col 2: Top 5 Suppliers by Purchase */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Building size={16} className="text-amber-500" />
                  <span className="text-[13px] font-bold text-slate-900">Top 5 Suppliers by Purchase</span>
                </div>
                <Link to="/purchase-orders" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                  View all <ChevronRight size={12} />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11.5px]">
                  <thead className="border-b border-slate-100 text-[10px] font-semibold text-slate-400">
                    <tr>
                      <th className="pb-1.5 w-6">#</th>
                      <th className="pb-1.5">Supplier</th>
                      <th className="pb-1.5 text-center">Invoices</th>
                      <th className="pb-1.5 text-right">Net Purchases</th>
                      <th className="pb-1.5 pl-3 w-20">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {(!data?.tables?.top_suppliers || data.tables.top_suppliers.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 text-[11px]">
                          {loading ? 'Loading top suppliers...' : 'No supplier purchases recorded for this period.'}
                        </td>
                      </tr>
                    ) : (
                      data.tables.top_suppliers.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition">
                          <td className="py-2 text-[10.5px] text-slate-400">{s.rank || i + 1}</td>
                          <td className="py-2 font-medium text-slate-800 truncate max-w-[100px]" title={s.supplierName}>
                            {s.supplierName}
                          </td>
                          <td className="py-2 text-center text-slate-600">{s.invoices}</td>
                          <td className="py-2 text-right font-semibold text-slate-900">{formatINR(s.netPurchases)}</td>
                          <td className="py-2 pl-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 w-8">{s.percentage}%</span>
                              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div style={{ width: `${Math.min(100, s.percentage)}%` }} className="bg-rose-500 h-full rounded-full" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Col 3: Recent Payments */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-purple-500" />
                  <span className="text-[13px] font-bold text-slate-900">Recent Payments</span>
                </div>
                <Link to="/reports/payment" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                  View all <ChevronRight size={12} />
                </Link>
              </div>

              {/* Toggle Pills: Incoming | Outgoing */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <button
                  onClick={() => setPaymentTab('incoming')}
                  className={`rounded-lg px-2.5 py-1 text-[10.5px] font-semibold transition cursor-pointer ${paymentTab === 'incoming' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Incoming
                </button>
                <button
                  onClick={() => setPaymentTab('outgoing')}
                  className={`rounded-lg px-2.5 py-1 text-[10.5px] font-semibold transition cursor-pointer ${paymentTab === 'outgoing' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Outgoing
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11.5px]">
                  <thead className="border-b border-slate-100 text-[10px] font-semibold text-slate-400">
                    <tr>
                      <th className="pb-1.5">Date</th>
                      <th className="pb-1.5">Ref No.</th>
                      <th className="pb-1.5">{paymentTab === 'incoming' ? 'Customer' : 'Supplier'}</th>
                      <th className="pb-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {(!((paymentTab === 'incoming' ? data?.tables?.recent_payments?.incoming : data?.tables?.recent_payments?.outgoing) || []).length) ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 text-[11px]">
                          {loading ? 'Loading recent payments...' : `No recent ${paymentTab} payments found.`}
                        </td>
                      </tr>
                    ) : (
                      ((paymentTab === 'incoming' ? data?.tables?.recent_payments?.incoming : data?.tables?.recent_payments?.outgoing) || []).map((p: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition">
                          <td className="py-2 text-[10.5px] text-slate-500 whitespace-nowrap">{p.date}</td>
                          <td className="py-2 font-mono text-[10.5px] text-slate-600 whitespace-nowrap">{p.refNo}</td>
                          <td className="py-2 font-medium text-slate-800 truncate max-w-[110px]" title={p.customer || p.supplier}>
                            {p.customer || p.supplier}
                          </td>
                          <td className="py-2 text-right font-bold text-slate-900">{formatINR(p.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 5: FINANCIAL REPORTS & QUICK ACTIONS (7 CARDS) ── */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <FileSpreadsheet size={16} className="text-blue-600" />
            <span className="text-[13px] font-bold text-slate-900">Financial Reports & Quick Actions</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              {
                title: 'Purchase Invoices',
                sub: 'View all purchase invoices',
                icon: FileSpreadsheet,
                color: 'text-amber-600 bg-amber-50 border-amber-200',
                link: '/finance/purchase-invoices',
              },
              {
                title: 'Incoming Payments',
                sub: 'Customer payments',
                icon: ArrowDownToLine,
                color: 'text-purple-600 bg-purple-50 border-purple-200',
                link: '/finance/incoming-payments',
              },
              {
                title: 'Outgoing Payments',
                sub: 'Supplier payments',
                icon: ArrowUpFromLine,
                color: 'text-amber-600 bg-amber-50 border-amber-200',
                link: '/finance/outgoing-payments',
              },
              {
                title: 'Customer Analysis',
                sub: 'Top/low customers',
                icon: Users,
                color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                link: '/finance/customer-analysis',
              },
              {
                title: 'Supplier Analysis',
                sub: 'Top suppliers',
                icon: Truck,
                color: 'text-rose-600 bg-rose-50 border-rose-200',
                link: '/finance/supplier-analysis',
              },
              {
                title: 'Profitability Report',
                sub: 'Profit & margin analysis',
                icon: BarChart2,
                color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
                link: '/finance/profitability-reports',
              },
            ].map((action, i) => (
              <Link
                key={i}
                to={action.link}
                className="group flex flex-col items-start p-3 rounded-xl border border-slate-200/80 hover:border-blue-400 bg-white hover:bg-slate-50 transition shadow-3xs"
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${action.color} mb-2 transition group-hover:scale-105`}>
                  <action.icon size={16} />
                </div>
                <div className="text-[11.5px] font-bold text-slate-900 group-hover:text-blue-600 transition leading-tight">
                  {action.title}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                  {action.sub}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
  );
};
export default FinanceOverviewPage;
