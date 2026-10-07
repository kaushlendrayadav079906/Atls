import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays, Download, FileText, RotateCcw, TrendingUp, Warehouse,
  AlertCircle, ShoppingBag, Users, Box, CreditCard, BarChart2, Filter, Eye, MoreVertical
} from 'lucide-react';
import { atlasApi } from '../../api/endpoints';
import {
  ComposedChart, Line, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const StateMessage = ({ type, message }: { type: 'error' | 'empty' | 'loading'; message: string }) => (
  <div className="flex h-[250px] w-full flex-col items-center justify-center gap-2 px-4 text-center border border-slate-200 rounded-xl bg-slate-50">
    {type === 'error' ? <AlertCircle className="h-8 w-8 text-red-400" /> : <FileText className="h-8 w-8 text-slate-500" />}
    <div className={type === 'error' ? 'text-red-400 text-sm' : 'text-slate-500 text-sm'}>{message}</div>
  </div>
);

const DEFAULT_RANGE = 'yearly';

export const SalesReportPage = () => {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [branchId, setBranchId] = useState<string>('');
  const [customer, setCustomer] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [reportView, setReportView] = useState<string>('Summary');
  const [groupBy, setGroupBy] = useState<string>('Date (Monthly)');

  const [appliedFilters, setAppliedFilters] = useState({
    range: DEFAULT_RANGE,
    fromDate: '',
    toDate: '',
    branchId: undefined as string | undefined,
    customer: '',
    category: '',
    paymentMethod: '',
    groupBy: 'Date (Monthly)'
  });

  const [activeTab, setActiveTab] = useState('Sales Details');
  const [page, setPage] = useState(1);

  const itemsPerPage = 8;

  const { data: trendData, isLoading: loadingTrend, isError: isErrorTrend, error: trendError } = useQuery({
    queryKey: ['salesTrend', appliedFilters],
    queryFn: () => atlasApi.getSalesTrend(appliedFilters.branchId, appliedFilters.range, appliedFilters.customer, appliedFilters.category, appliedFilters.paymentMethod, appliedFilters.fromDate || undefined, appliedFilters.toDate || undefined),
    retry: 1,
  });



  const { data: overviewData, isLoading: loadingOverview } = useQuery({
    queryKey: ['salesOverview', appliedFilters],
    queryFn: () => atlasApi.getOverview(appliedFilters.branchId, appliedFilters.range, appliedFilters.customer, appliedFilters.category, appliedFilters.paymentMethod, appliedFilters.fromDate || undefined, appliedFilters.toDate || undefined),
    retry: 1,
  });

  const { data: feedData, isLoading: loadingFeed } = useQuery({
    queryKey: ['salesFeed', appliedFilters, page],
    queryFn: () => atlasApi.getRecentSalesFeed({
      range: appliedFilters.range,
      branch: appliedFilters.branchId,
      customer: appliedFilters.customer,
      category: appliedFilters.category,
      payment_method: appliedFilters.paymentMethod,
      from_date: appliedFilters.fromDate || undefined,
      to_date: appliedFilters.toDate || undefined,
      limit: itemsPerPage,
      offset: (page - 1) * itemsPerPage
    }),
    retry: 1,
  });

  const { data: topProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ['topProducts', appliedFilters],
    queryFn: () => atlasApi.getTopProducts(appliedFilters.branchId, appliedFilters.range, appliedFilters.customer, appliedFilters.category, appliedFilters.paymentMethod, appliedFilters.fromDate || undefined, appliedFilters.toDate || undefined),
    retry: 1,
  });

  const { data: topCustomers, isLoading: loadingCustomers } = useQuery({
    queryKey: ['topCustomers', appliedFilters],
    queryFn: () => atlasApi.getTopCustomers(appliedFilters.branchId, appliedFilters.range, appliedFilters.customer, appliedFilters.category, appliedFilters.paymentMethod, appliedFilters.fromDate || undefined, appliedFilters.toDate || undefined),
    retry: 1,
  });

  const { data: branchComparison, isLoading: loadingBranchComparison } = useQuery({
    queryKey: ['branchComparison', appliedFilters],
    queryFn: () => atlasApi.getBranchComparison(appliedFilters.range, appliedFilters.fromDate || undefined, appliedFilters.toDate || undefined),
    retry: 1,
  });




  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
    setAppliedFilters(prev => ({ ...prev, range: newRange, fromDate: '', toDate: '' }));
    setPage(1);
  };
  const handleApplyFilters = () => {
    setAppliedFilters({
      range,
      fromDate,
      toDate,
      branchId: branchId || undefined,
      customer,
      category,
      paymentMethod,
      groupBy
    });
    setPage(1);
  };

  const handleReset = useCallback(() => {
    setRange(DEFAULT_RANGE);
    setFromDate('');
    setToDate('');
    setBranchId('');
    setCustomer('');
    setCategory('');
    setPaymentMethod('');
    setReportView('Summary');
    setGroupBy('Date (Monthly)');
    setPage(1);
    setAppliedFilters({
      range: DEFAULT_RANGE,
      fromDate: '',
      toDate: '',
      branchId: undefined,
      customer: '',
      category: '',
      paymentMethod: '',
      groupBy: 'Date (Monthly)'
    });
  }, []);

  const trendPoints = trendData?.trend ?? [];
  const paymentBreakdown = overviewData?.paymentBreakdown ?? [];
  const feedItems = feedData?.items ?? [];
  const totalFeedItems = feedData?.total || feedItems.length;
  const totalPages = Math.ceil(totalFeedItems / itemsPerPage) || 1;


  const getPaymentColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('cash')) return '#3b82f6';
    if (n.includes('card')) return '#a855f7';
    if (n.includes('upi') || n.includes('wallet')) return '#f59e0b';
    if (n.includes('credit')) return '#10b981';
    return '#94a3b8';
  };

  const paymentChartData = paymentBreakdown.map((item: any) => ({
    name: item.method,
    value: Number(item.total) || 0,
    count: item.count || 0
  })).filter((i: any) => i.value > 0);

  const totalPaymentAmount = paymentChartData.reduce((sum: number, item: any) => sum + item.value, 0);

  const getErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { detail?: string } } };
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;
      if (status === 401) return 'Session expired. Please log in again.';
      if (status === 403) return detail || 'Access denied for this branch or role.';
      if (status === 404) return 'Report endpoint not found.';
      if (status === 422) return `Invalid filter parameters: ${detail || 'check date range.'}`;
      if (status === 502) return `SAP data unavailable: ${detail || 'SAP Service Layer returned an error.'}`;
      if (status === 503) return 'SAP Service Layer is offline.';
      if (detail) return detail;
    }
    return 'Failed to load report data. Please try again.';
  };

  const handleExport = () => {
    if (!feedItems.length) return;
    const headers = ['#', 'Invoice No.', 'Date', 'Customer', 'Items', 'Amount', 'Payment Method', 'Status'];
    const rows = feedItems.map((r: any, i: number) => [
      i + 1,
      r.docNum ? `INV-${r.docNum}` : r.saleId,
      r.docDate || '',
      r.customerName || r.customerCode || 'Walk-in',
      r.items?.length || 0,
      r.total,
      r.paymentMethod || 'Unknown',
      r.hasReturn ? 'Refunded' : 'Completed',
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${appliedFilters.range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isCustomRange = range === 'custom';

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales Report</h1>
            <p className="mt-0.5 text-[13px] text-slate-500">View and export sales summary, items, and customer wise reports.</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
          disabled={loadingFeed || feedItems.length === 0}
          onClick={handleExport}
        >
          <Download className="h-4 w-4" />
          Quick Export
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Date Range</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
              <select value={range} onChange={(e) => setRange(e.target.value)} className="flex-1 bg-transparent outline-none">
                <option value="daily">Today</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
                <option value="yearly">This Year</option>
                <option value="all_time">Total (All Time)</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {isCustomRange && (
              <div className="mt-2 flex gap-2">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-1/2 rounded border border-slate-200 p-1 text-[11px]" />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-1/2 rounded border border-slate-200 p-1 text-[11px]" />
              </div>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Branch</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <Warehouse className="h-3.5 w-3.5 text-blue-600" />
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="flex-1 bg-transparent outline-none">
                <option value="">All Branches</option>
                <option value="B1">Main Branch (WH-001)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Report View</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <BarChart2 className="h-3.5 w-3.5 text-blue-600" />
              <select value={reportView} onChange={(e) => setReportView(e.target.value)} className="flex-1 bg-transparent outline-none">
                <option value="Summary">Summary</option>
                <option value="Detailed">Detailed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Group By</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <Filter className="h-3.5 w-3.5 text-blue-600" />
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="flex-1 bg-transparent outline-none">
                <option value="Date (Hourly)">Date (Hourly)</option>
                <option value="Date (Daily)">Date (Daily)</option>
                <option value="Date (Monthly)">Date (Monthly)</option>
                <option value="Date (Yearly)">Date (Yearly)</option>
                <option value="Customer">Customer</option>
                <option value="Product">Product</option>
                <option value="Branch">Branch</option>
                <option value="Payment Method">Payment Method</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Customer</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <input type="text" placeholder="All Customers" value={customer} onChange={(e) => setCustomer(e.target.value)} className="flex-1 bg-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Product Category</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <Box className="h-3.5 w-3.5 text-blue-600" />
              <input type="text" placeholder="All Categories" value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 bg-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Payment Method</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <CreditCard className="h-3.5 w-3.5 text-blue-600" />
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="flex-1 bg-transparent outline-none">
                <option value="">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="wallet">Wallet</option>
              </select>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleApplyFilters}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={handleReset}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 text-[12px] font-semibold text-slate-600 hover:bg-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Total Sales', val: overviewData ? money.format(overviewData.totalSales) : '₹0.00', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: TrendingUp },
          { title: 'Total Invoices', val: overviewData ? `${overviewData.invoiceCount}` : '0', color: 'text-purple-600', bg: 'bg-purple-100', icon: FileText },
          { title: 'Total Customers', val: overviewData ? `${overviewData.invoiceCount > 0 ? (overviewData.invoiceCount - 1) : 0}` : '0', color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
          { title: 'Avg. Order Value', val: overviewData ? money.format(overviewData.averageOrderValue) : '₹0.00', color: 'text-amber-500', bg: 'bg-amber-50', icon: ShoppingBag },
        ].map((card, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500 mb-0.5">{card.title}</p>
              <div className="flex items-end gap-2">
                <span className="text-[22px] font-bold text-slate-900 leading-none">
                  {loadingOverview ? '...' : card.val}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-5 lg:grid-cols-[1.8fr_1fr]">

        {/* Sales Overview (Composed Chart) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">
                {appliedFilters.range === 'daily' ? "Today's Sales Overview" :
                  appliedFilters.range === 'weekly' ? "Weekly Sales Overview" :
                    appliedFilters.range === 'monthly' ? "Monthly Sales Overview" :
                      appliedFilters.range === 'yearly' ? "Yearly Sales Overview" : "Sales Overview"}
              </h3>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] font-medium text-slate-500">
              {['daily', 'weekly', 'monthly', 'yearly', 'all_time'].map((p) => (
                <button
                  key={p}
                  className={`px-3 py-1.5 rounded-md transition-colors ${appliedFilters.range === p ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:text-slate-900'}`}
                  onClick={() => handleRangeChange(p)}
                >
                  {p === 'daily' ? 'Today' : p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : p === 'yearly' ? 'Year' : 'Total'}
                </button>
              ))}
            </div>
          </div>
          {loadingTrend ? (
            <StateMessage type="loading" message="Loading chart data..." />
          ) : isErrorTrend ? (
            <StateMessage type="error" message={getErrorMessage(trendError)} />
          ) : trendPoints.length === 0 ? (
            <StateMessage type="empty" message="No sales data available for this period." />
          ) : (
            <div className="h-[300px] w-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendPoints} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey={(d) => (d.label || d.date || '').split(' ')[0]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'K' : val >= 100000 ? (val / 100000).toFixed(1) + 'L' : val}`}
                    dx={-10}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={false}
                    hide
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}
                    formatter={(val: any, name: any) => [name === 'sales' ? money.format(Number(val)) : val, name === 'sales' ? 'Sales' : 'Invoices']}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="sales"
                    fill="url(#barColor)"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="invoice_count"
                    stroke="#a855f7"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#a855f7', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-4 flex items-center justify-center gap-6 text-[11px] font-medium text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-blue-500"></div>
                  Sales Amount (₹)
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                  Invoices Count
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sales by Payment Method (Donut Chart) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">Sales by Payment Method</h3>
            </div>
            <select value={appliedFilters.range} onChange={(e) => handleRangeChange(e.target.value)} className="text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-600 rounded px-2 py-1 outline-none">
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="yearly">This Year</option>
              <option value="all_time">Total</option>
            </select>
          </div>
          {loadingOverview ? (
            <StateMessage type="loading" message="Loading payment data..." />
          ) : paymentChartData.length === 0 ? (
            <StateMessage type="empty" message="Payment information unavailable." />
          ) : (
            <div className="flex h-[300px] items-center">
              <div className="h-full w-1/2 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {paymentChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={getPaymentColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => money.format(Number(val))}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[14px] font-bold text-slate-900">{money.format(totalPaymentAmount >= 100000 ? totalPaymentAmount : totalPaymentAmount)}</span>
                  <span className="text-[10px] text-slate-500">Total Sales</span>
                </div>
              </div>
              <div className="w-1/2 flex flex-col justify-center gap-3 pr-2">
                {paymentChartData.map((item: any, i: number) => (
                  <div key={i} className="flex flex-col gap-0.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getPaymentColor(item.name) }} />
                        <span className="font-medium text-slate-600 truncate max-w-[70px]">{item.name}</span>
                      </div>
                      <div className="text-slate-400">{Math.round((item.value / totalPaymentAmount) * 100)}%</div>
                      <div className="text-slate-900 font-semibold">{money.format(item.value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs & Table Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center">
            {['Sales Details', 'Top Selling Items', 'Customer Wise Sales', 'Branch Wise Sales'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                className={`border-b-2 px-4 py-3.5 text-[13px] font-semibold transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 rounded border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>

        <div className="p-0">
          {activeTab === 'Sales Details' && (
            <>
              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full min-w-[900px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Invoice No.</th>
                      <th className="px-4 py-3 font-semibold">Date & Time</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Items</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Payment Method</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingFeed ? (
                      <tr><td colSpan={9} className="py-12 text-center text-slate-500">Loading details...</td></tr>
                    ) : feedItems.length === 0 ? (
                      <tr><td colSpan={9} className="py-12 text-center text-slate-500">No invoices found for this period.</td></tr>
                    ) : (
                      feedItems.map((inv: any, i: number) => (
                        <tr key={i} className="group hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-500">{(page - 1) * itemsPerPage + i + 1}</td>
                          <td className="px-4 py-3 font-medium text-blue-600">INV-{inv.docNum || inv.saleId}</td>
                          <td className="px-4 py-3 text-slate-600">{inv.docDate}</td>
                          <td className="px-4 py-3 text-slate-900 font-medium">{inv.customerName || inv.customerCode || 'Walk-in'}</td>
                          <td className="px-4 py-3 text-slate-600">{inv.items?.length || 0}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{money.format(inv.total)}</td>
                          <td className="px-4 py-3 text-slate-600">{inv.paymentMethod || 'Unknown'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${inv.hasReturn ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                              }`}>
                              {inv.hasReturn ? 'Refunded' : 'Completed'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2 text-slate-400">
                              <button className="hover:text-blue-600 transition-colors"><Eye className="h-4 w-4" /></button>
                              <button className="hover:text-slate-600 transition-colors"><MoreVertical className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 p-4">
                <span className="text-[12px] text-slate-500">
                  Showing {Math.min((page - 1) * itemsPerPage + 1, totalFeedItems)} to {Math.min(page * itemsPerPage, totalFeedItems)} of {totalFeedItems} invoices
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 text-[12px] font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-7 w-7 rounded-md text-[12px] font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-2 py-1 text-[12px] font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Top Selling Items' && (
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                    <th className="px-4 py-3 font-semibold">Item Code</th>
                    <th className="px-4 py-3 font-semibold">Item Name</th>
                    <th className="px-4 py-3 font-semibold">Units Sold</th>
                    <th className="px-4 py-3 font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingProducts ? (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-500">Loading items...</td></tr>
                  ) : !topProducts?.length ? (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-500">No data found.</td></tr>
                  ) : (
                    topProducts.map((p: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500">{p.itemCode}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{p.itemName}</td>
                        <td className="px-4 py-3 text-slate-600">{p.quantity}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{money.format(p.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Customer Wise Sales' && (
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                    <th className="px-4 py-3 font-semibold">Customer Code</th>
                    <th className="px-4 py-3 font-semibold">Customer Name</th>
                    <th className="px-4 py-3 font-semibold">Invoice Count</th>
                    <th className="px-4 py-3 font-semibold">Total Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingCustomers ? (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-500">Loading customers...</td></tr>
                  ) : !topCustomers?.length ? (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-500">No data found.</td></tr>
                  ) : (
                    topCustomers.map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500">{c.customerCode}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{c.customerName || 'Walk-in'}</td>
                        <td className="px-4 py-3 text-slate-600">{c.invoiceCount}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{money.format(c.totalSales)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Branch Wise Sales' && (
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                    <th className="px-4 py-3 font-semibold">Branch</th>
                    <th className="px-4 py-3 font-semibold">Invoice Count</th>
                    <th className="px-4 py-3 font-semibold">Total Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingBranchComparison ? (
                    <tr><td colSpan={3} className="py-12 text-center text-slate-500">Loading branches...</td></tr>
                  ) : !branchComparison?.branches?.length ? (
                    <tr><td colSpan={3} className="py-12 text-center text-slate-500">No data found.</td></tr>
                  ) : (
                    branchComparison.branches.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{b.branchName || b.branchId}</td>
                        <td className="px-4 py-3 text-slate-600">{b.invoiceCount}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{money.format(b.totalSales)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
