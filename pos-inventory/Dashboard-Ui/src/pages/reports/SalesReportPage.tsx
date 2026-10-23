import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download, FileText, RotateCcw, TrendingUp, Warehouse,
  AlertCircle, ShoppingBag, Users, Box, CreditCard, BarChart2, Filter, Eye, X
} from 'lucide-react';
import { atlasApi } from '../../api/endpoints';
import { commonApi } from '../../api/common';
import { ReportDateRangePicker } from '../../components/ReportDateRangePicker';
import {
  resolveDashboardDateRange,
  type QuickFilter,
  type DashboardPeriod,
  type AuthoritativeDateFilterState,
} from '../../utils/date';
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

export const SalesReportPage = () => {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [, setRange] = useState<DashboardPeriod>('all_time');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [branchId, setBranchId] = useState<string>('');
  const [customer, setCustomer] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [reportView, setReportView] = useState<string>('Summary');
  const [groupBy, setGroupBy] = useState<string>('Date (Monthly)');

  const [appliedFilters, setAppliedFilters] = useState({
    range: 'all_time' as DashboardPeriod,
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
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const itemsPerPage = 8;

  const { data: trendData, isLoading: loadingTrend, isError: isErrorTrend, error: trendError } = useQuery({
    queryKey: ['salesTrend', appliedFilters],
    queryFn: () => atlasApi.getSalesTrend(
      appliedFilters.branchId,
      appliedFilters.range,
      appliedFilters.customer,
      appliedFilters.category,
      appliedFilters.paymentMethod,
      appliedFilters.fromDate || undefined,
      appliedFilters.toDate || undefined,
      appliedFilters.groupBy
    ),
    retry: 1,
  });

  const { data: overviewData, isLoading: loadingOverview } = useQuery({
    queryKey: ['salesOverview', appliedFilters],
    queryFn: () => atlasApi.getOverview(
      appliedFilters.branchId,
      appliedFilters.range,
      appliedFilters.customer,
      appliedFilters.category,
      appliedFilters.paymentMethod,
      appliedFilters.fromDate || undefined,
      appliedFilters.toDate || undefined
    ),
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
    queryFn: () => atlasApi.getTopProducts(
      appliedFilters.branchId,
      appliedFilters.range,
      appliedFilters.customer,
      appliedFilters.category,
      appliedFilters.paymentMethod,
      appliedFilters.fromDate || undefined,
      appliedFilters.toDate || undefined
    ),
    retry: 1,
  });

  const { data: topCustomers, isLoading: loadingCustomers } = useQuery({
    queryKey: ['topCustomers', appliedFilters],
    queryFn: () => atlasApi.getTopCustomers(
      appliedFilters.branchId,
      appliedFilters.range,
      appliedFilters.customer,
      appliedFilters.category,
      appliedFilters.paymentMethod,
      appliedFilters.fromDate || undefined,
      appliedFilters.toDate || undefined
    ),
    retry: 1,
  });

  const { data: branchComparison, isLoading: loadingBranchComparison } = useQuery({
    queryKey: ['branchComparison', appliedFilters],
    queryFn: () => atlasApi.getBranchComparison(
      appliedFilters.range,
      appliedFilters.fromDate || undefined,
      appliedFilters.toDate || undefined
    ),
    retry: 1,
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: commonApi.getFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

  const handleDateRangeChange = (filterState: AuthoritativeDateFilterState) => {
    setQuickFilter(filterState.quickFilter);
    setRange(filterState.period);
    setFromDate(filterState.dateFrom);
    setToDate(filterState.dateTo);
    setAppliedFilters(prev => ({
      ...prev,
      range: filterState.period,
      fromDate: filterState.dateFrom,
      toDate: filterState.dateTo
    }));
    setPage(1);
  };

  const handleRangeChange = (newPeriod: string) => {
    const qf: QuickFilter =
      newPeriod === 'daily'
        ? 'today'
        : newPeriod === 'weekly'
        ? 'week'
        : newPeriod === 'monthly'
        ? 'month'
        : newPeriod === 'yearly'
        ? 'year'
        : '';
    const resolved = resolveDashboardDateRange(qf);
    handleDateRangeChange(resolved);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(prev => ({
      ...prev,
      branchId: branchId || undefined,
      customer,
      category,
      paymentMethod,
      groupBy
    }));
    setPage(1);

    if (groupBy === 'Customer') {
      setActiveTab('Customer Wise Sales');
    } else if (groupBy === 'Product') {
      setActiveTab('Top Selling Items');
    } else if (groupBy === 'Branch') {
      setActiveTab('Branch Wise Sales');
    }
  };

  const handleReset = useCallback(() => {
    setBranchId('');
    setCustomer('');
    setCategory('');
    setPaymentMethod('');
    setReportView('Summary');
    setGroupBy('Date (Monthly)');
    setPage(1);
    const resolved = resolveDashboardDateRange(''); // 'all_time'
    setQuickFilter(resolved.quickFilter);
    setRange(resolved.period);
    setFromDate(resolved.dateFrom);
    setToDate(resolved.dateTo);
    setAppliedFilters({
      range: 'all_time',
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
    const n = (name || '').toLowerCase();
    if (n.includes('cash')) return '#3b82f6';
    if (n.includes('transfer') || n.includes('bank')) return '#10b981';
    if (n.includes('credit') || n.includes('account')) return '#6366f1';
    if (n.includes('card')) return '#a855f7';
    if (n.includes('upi') || n.includes('wallet')) return '#f59e0b';
    if (n.includes('check') || n.includes('cheque')) return '#06b6d4';
    return '#94a3b8';
  };

  const paymentChartData = paymentBreakdown.map((item: any) => ({
    name: item.method,
    value: Number(item.total) || 0,
    count: item.billCount || item.count || 0
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
    const headers = ['#', 'Invoice No.', 'Date', 'Customer', 'Items Count', 'Amount', 'Payment Method', 'Status'];
    const rows = feedItems.map((r: any, i: number) => [
      i + 1,
      r.docNum ? `INV-${r.docNum}` : (r.saleId || `SAP-${r.docEntry}`),
      r.docDate || '',
      `"${(r.customerName || r.customerCode || 'Walk-in').replace(/"/g, '""')}"`,
      r.items?.length || 0,
      r.total,
      r.paymentMethod || 'Unknown',
      r.hasReturn ? 'Refunded' : 'Completed',
    ]);
    const csv = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${appliedFilters.range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadActiveTab = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `sales-report-${appliedFilters.range}`;

    if (activeTab === 'Sales Details') {
      filename = `sales-details-${appliedFilters.range}`;
      headers = ['#', 'Invoice No.', 'Date', 'Customer', 'Items Count', 'Amount', 'Payment Method', 'Status'];
      rows = feedItems.map((r: any, i: number) => [
        i + 1,
        r.docNum ? `INV-${r.docNum}` : (r.saleId || `SAP-${r.docEntry}`),
        r.docDate || '',
        `"${(r.customerName || r.customerCode || 'Walk-in').replace(/"/g, '""')}"`,
        r.items?.length || 0,
        r.total,
        r.paymentMethod || 'Unknown',
        r.hasReturn ? 'Refunded' : 'Completed',
      ]);
    } else if (activeTab === 'Top Selling Items') {
      filename = `top-selling-items-${appliedFilters.range}`;
      headers = ['Item Code', 'Item Name', 'Units Sold', 'Revenue'];
      rows = (topProducts || []).map((p: any) => [
        p.itemCode,
        `"${(p.itemName || p.itemCode).replace(/"/g, '""')}"`,
        p.quantitySold ?? p.quantity ?? 0,
        p.salesAmount ?? p.revenue ?? 0,
      ]);
    } else if (activeTab === 'Customer Wise Sales') {
      filename = `customer-wise-sales-${appliedFilters.range}`;
      headers = ['Customer Code', 'Customer Name', 'Invoice Count', 'Total Sales'];
      rows = (topCustomers || []).map((c: any) => [
        c.customerCode,
        `"${(c.customerName || 'Walk-in').replace(/"/g, '""')}"`,
        c.invoiceCount,
        c.totalSales,
      ]);
    } else if (activeTab === 'Branch Wise Sales') {
      filename = `branch-wise-sales-${appliedFilters.range}`;
      headers = ['Branch', 'Invoice Count', 'Total Sales'];
      rows = (branchComparison?.branches || []).map((b: any) => [
        `"${(b.branchName || b.branchId).replace(/"/g, '""')}"`,
        b.invoiceCount ?? b.billCount ?? 0,
        b.totalSales ?? b.total ?? 0,
      ]);
    }

    if (!rows.length) return;
    const csv = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900">Sales Report</h1>
            <p className="mt-1 atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">View and export sales summary, items, and customer wise reports.</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Top Position Right Side Date Range Dropdown */}
          <ReportDateRangePicker
            quickFilter={quickFilter}
            dateFrom={fromDate}
            dateTo={toDate}
            onRangeChange={handleDateRangeChange}
          />
          <button
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
            disabled={loadingFeed || feedItems.length === 0}
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            Quick Export
          </button>
        </div>
      </div>

      {/* Filters (Cleaned up, SAP-backed Dynamic Dropdowns) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Branch</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <Warehouse className="h-3.5 w-3.5 text-blue-600" />
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="flex-1 bg-transparent outline-none">
                <option value="">All Branches</option>
                {filterOptions?.branches?.map((b: any) => (
                  <option key={b.code || b.id} value={b.code || b.id}>
                    {b.name || b.code}
                  </option>
                )) || (
                  <option value="B1">Main Branch (WH-001)</option>
                )}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Customer</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <select value={customer} onChange={(e) => setCustomer(e.target.value)} className="flex-1 bg-transparent outline-none">
                <option value="">All Customers</option>
                {filterOptions?.customers?.map((c: any) => (
                  <option key={c.code || c.id} value={c.code || c.id}>
                    {c.name ? `${c.name} (${c.code})` : c.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Product Category</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <Box className="h-3.5 w-3.5 text-blue-600" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 bg-transparent outline-none">
                <option value="">All Categories</option>
                {filterOptions?.categories?.map((cat: any) => (
                  <option key={cat.code || cat.id} value={cat.name || cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Payment Method</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900">
              <CreditCard className="h-3.5 w-3.5 text-blue-600" />
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="flex-1 bg-transparent outline-none">
                <option value="">All Payment Methods</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit / On Account">Credit / On Account</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="Check">Check</option>
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
              </select>
            </div>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 md:col-span-1 lg:col-span-2">
            <button
              onClick={handleApplyFilters}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors cursor-pointer"
            >
              Apply Filters
            </button>
            <button
              onClick={handleReset}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 text-[12px] font-semibold text-slate-600 hover:bg-white transition-colors cursor-pointer"
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
          { title: 'Total Customers', val: overviewData ? `${overviewData.totalCustomers ?? 0}` : '0', color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
          { title: 'Avg. Order Value', val: overviewData ? money.format(overviewData.averageOrderValue) : '₹0.00', color: 'text-amber-500', bg: 'bg-amber-50', icon: ShoppingBag },
        ].map((card, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-[13px] sm:text-[13.5px] font-semibold text-slate-500 mb-1">{card.title}</p>
              <div className="flex items-end gap-2">
                <span className="text-[25px] sm:text-[27px] font-extrabold text-slate-900 leading-none">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h3 className="text-[16px] sm:text-[17px] font-bold text-slate-900">
                {appliedFilters.range === 'daily' ? "Today's Sales Overview" :
                  appliedFilters.range === 'weekly' ? "Weekly Sales Overview" :
                    appliedFilters.range === 'monthly' ? "Monthly Sales Overview" :
                      appliedFilters.range === 'yearly' ? "Yearly Sales Overview" : "Sales Overview"}
              </h3>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-[12px] font-semibold text-slate-600">
              {['daily', 'weekly', 'monthly', 'yearly', 'all_time'].map((p) => (
                <button
                  key={p}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${appliedFilters.range === p ? 'bg-blue-600 text-white font-bold shadow-sm' : 'hover:text-slate-900'}`}
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
            <select value={appliedFilters.range} onChange={(e) => handleRangeChange(e.target.value)} className="text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-600 rounded px-2 py-1 outline-none cursor-pointer">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                  <span className="text-[14px] font-bold text-slate-900">{money.format(totalPaymentAmount)}</span>
                  <span className="text-[10px] text-slate-500">Total Sales</span>
                </div>
              </div>
              <div className="w-1/2 flex flex-col justify-center gap-3 pr-2">
                {paymentChartData.map((item: any, i: number) => (
                  <div key={i} className="flex flex-col gap-0.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getPaymentColor(item.name) }} />
                        <span className="font-medium text-slate-600 truncate max-w-[80px]" title={item.name}>{item.name}</span>
                      </div>
                      <div className="text-slate-400 shrink-0 ml-1">{Math.round((item.value / (totalPaymentAmount || 1)) * 100)}%</div>
                      <div className="text-slate-900 font-semibold shrink-0 ml-1">{money.format(item.value)}</div>
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
                className={`border-b-2 px-5 py-4 text-[14px] font-semibold transition-colors cursor-pointer ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            onClick={handleDownloadActiveTab}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>

        <div className="p-0">
          {activeTab === 'Sales Details' && (
            <>
              <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full min-w-[900px] text-left text-[13.5px] sm:text-[14px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/70">
                      <th className="px-4 py-3.5">#</th>
                      <th className="px-4 py-3.5">Invoice No.</th>
                      <th className="px-4 py-3.5">Date & Time</th>
                      <th className="px-4 py-3.5">Customer</th>
                      <th className="px-4 py-3.5">Items</th>
                      <th className="px-4 py-3.5">Amount</th>
                      <th className="px-4 py-3.5">Payment Method</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingFeed ? (
                      <tr><td colSpan={9} className="py-12 text-center text-slate-500 text-sm">Loading details...</td></tr>
                    ) : feedItems.length === 0 ? (
                      <tr><td colSpan={9} className="py-12 text-center text-slate-500 text-sm">No invoices found for this period.</td></tr>
                    ) : (
                      feedItems.map((inv: any, i: number) => (
                        <tr key={i} className="group hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-400 text-[12.5px]">{(page - 1) * itemsPerPage + i + 1}</td>
                          <td className="px-4 py-3 font-semibold text-blue-600">INV-{inv.docNum || inv.saleId}</td>
                          <td className="px-4 py-3 text-slate-600 text-[13px]">{inv.docDate}</td>
                          <td className="px-4 py-3 text-slate-900 font-semibold">{inv.customerName || inv.customerCode || 'Walk-in'}</td>
                          <td className="px-4 py-3 text-slate-600">{inv.items?.length || 0}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{money.format(inv.total)}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[12px] font-medium bg-slate-100 text-slate-800">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getPaymentColor(inv.paymentMethod) }}></span>
                              {inv.paymentMethod || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-bold ${inv.hasReturn ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                              {inv.hasReturn ? 'Refunded' : 'Completed'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2 text-slate-400">
                              <button
                                onClick={() => setSelectedInvoice(inv)}
                                title="View Details"
                                className="hover:text-blue-600 transition-colors p-1 cursor-pointer"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 p-4">
                <span className="text-[13px] text-slate-500">
                  Showing {Math.min((page - 1) * itemsPerPage + 1, totalFeedItems)} to {Math.min(page * itemsPerPage, totalFeedItems)} of {totalFeedItems} invoices
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1 text-[13px] font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-8 w-8 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-2.5 py-1 text-[13px] font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
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
                        <td className="px-4 py-3 text-slate-500 font-mono text-[12px]">{p.itemCode}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{p.itemName}</td>
                        <td className="px-4 py-3 text-slate-600 font-semibold">{p.quantitySold ?? p.quantity ?? 0}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{money.format(p.salesAmount ?? p.revenue ?? 0)}</td>
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
                        <td className="px-4 py-3 text-slate-500 font-mono text-[12px]">{c.customerCode}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{c.customerName || 'Walk-in'}</td>
                        <td className="px-4 py-3 text-slate-600 font-semibold">{c.invoiceCount}</td>
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
                        <td className="px-4 py-3 text-slate-600 font-semibold">{b.invoiceCount ?? b.billCount ?? 0}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{money.format(b.totalSales ?? b.total ?? 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Invoice Details — INV-{selectedInvoice.docNum || selectedInvoice.docEntry}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  SAP Document Entry #{selectedInvoice.docEntry} • {selectedInvoice.docDate}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-xl p-3 text-xs">
              <div>
                <span className="text-slate-400 block">Customer</span>
                <span className="font-semibold text-slate-900 truncate block">
                  {selectedInvoice.customerName || selectedInvoice.customerCode || 'Walk-in'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Customer Code</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {selectedInvoice.customerCode || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment Method</span>
                <span className="font-semibold text-slate-900">
                  {selectedInvoice.paymentMethod || 'Cash'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Status</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  selectedInvoice.hasReturn ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {selectedInvoice.hasReturn ? 'Refunded' : 'Completed'}
                </span>
              </div>
            </div>

            <div className="mt-4 max-h-[220px] overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                    selectedInvoice.items.map((line: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className="font-medium text-slate-900 block">{line.itemName || line.itemCode}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{line.itemCode}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">{line.quantity}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{money.format(line.price || 0)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          {money.format(line.total || (line.quantity * (line.price || 0)))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No line item details attached to header.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>{money.format(selectedInvoice.subtotal || selectedInvoice.total)}</span>
              </div>
              {selectedInvoice.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span>-{money.format(selectedInvoice.discount)}</span>
                </div>
              )}
              {selectedInvoice.gst > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Tax (GST):</span>
                  <span>{money.format(selectedInvoice.gst)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="text-blue-600">{money.format(selectedInvoice.total)}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
