import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  TrendingUp,
  CreditCard,
  Receipt,
  Download,
  Eye,
  Search,
  RotateCcw,
  RefreshCcw,
  Warehouse,
  User,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  X,
  Printer,
  FileSpreadsheet,
  PieChart as PieChartIcon,
  CheckCircle2,
  ArrowUpRight,
  ArrowUpDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import {
  invoicesReportApi,
  type InvoiceOverview,
  type InvoiceListItem,
  type InvoiceDetailResponse,
  type InvoiceFilterParams,
} from '../../api/endpoints';
import { commonApi } from '../../api/common';
import { ReportDateRangePicker } from '../../components/ReportDateRangePicker';
import {
  type QuickFilter,
  type DashboardPeriod,
  type AuthoritativeDateFilterState,
} from '../../utils/date';
import { useDebounce } from '../../hooks/useDebounce';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtDec = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTrendLabel(val: any): string {
  if (!val) return '';
  const s = String(val);
  if (s.length === 10) {
    const parts = s.split('-');
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${parts[2]} ${MONTH_NAMES[mIdx] || parts[1]}`;
  }
  if (s.length === 7) {
    const parts = s.split('-');
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${MONTH_NAMES[mIdx] || parts[1]} '${parts[0].slice(2)}`;
  }
  return s;
}

const STATUS_COLORS: Record<string, string> = {
  Paid: '#10b981',        // Emerald
  'Partially Paid': '#f59e0b', // Amber
  Unpaid: '#ef4444',      // Red
  Cancelled: '#94a3b8',   // Slate
};

export const InvoiceReportPage: React.FC = () => {
  const navigate = useNavigate();

  // Navigation tab & Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'Invoice List' | 'Analytics'>('Invoice List');

  // Top header date range state (Dashboard style, default All Dates (Total))
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [dateRange, setDateRange] = useState<DashboardPeriod>('all_time');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Staged filter states (for the secondary filter panel)
  const [branch, setBranch] = useState<string>('');
  const [customer, setCustomer] = useState<string>('');
  const [invoiceStatus, setInvoiceStatus] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);

  // Applied secondary filters
  const [appliedFilters, setAppliedFilters] = useState({
    branch: '',
    customer: '',
    invoiceStatus: '',
    paymentStatus: '',
    paymentMethod: '',
  });

  // Table pagination & sorting
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('docDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const offset = (page - 1) * pageSize;

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Invoice Details Modal state
  const [selectedDocEntry, setSelectedDocEntry] = useState<number | null>(null);

  // Export dropdown state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch filter options dynamically from SAP (Branches, Customers, etc.)
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: commonApi.getFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

  // Handler for top-right Date Range picker
  const handleDateRangeChange = (filterState: AuthoritativeDateFilterState) => {
    setQuickFilter(filterState.quickFilter);
    setDateRange(filterState.period);
    setDateFrom(filterState.dateFrom);
    setDateTo(filterState.dateTo);
    setPage(1);
  };

  // Handler for secondary filters Apply
  const handleApplyFilters = () => {
    setAppliedFilters({
      branch,
      customer,
      invoiceStatus,
      paymentStatus,
      paymentMethod,
    });
    setPage(1);
  };

  // Handler for secondary filters Reset
  const handleResetFilters = useCallback(() => {
    setBranch('');
    setCustomer('');
    setInvoiceStatus('');
    setPaymentStatus('');
    setPaymentMethod('');
    setSearchTerm('');
    setAppliedFilters({
      branch: '',
      customer: '',
      invoiceStatus: '',
      paymentStatus: '',
      paymentMethod: '',
    });
    setPage(1);
  }, []);

  // Query parameters memo
  const queryParams: InvoiceFilterParams = useMemo(
    () => ({
      range: dateRange,
      from_date: dateFrom || undefined,
      to_date: dateTo || undefined,
      branch: appliedFilters.branch || undefined,
      customer: appliedFilters.customer || undefined,
      invoice_status: appliedFilters.invoiceStatus || undefined,
      payment_status: appliedFilters.paymentStatus || undefined,
      payment_method: appliedFilters.paymentMethod || undefined,
    }),
    [dateRange, dateFrom, dateTo, appliedFilters]
  );

  // 1. Fetch Verified KPI Overview from Backend
  const {
    data: overview,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useQuery<InvoiceOverview>({
    queryKey: ['invoices-overview', queryParams],
    queryFn: () => invoicesReportApi.getOverview(queryParams),
    staleTime: 60 * 1000,
  });

  // 2. Fetch Paginated Invoices List
  const {
    data: listData,
    isLoading: isListLoading,
    isError: isListError,
    error: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['invoices-list', queryParams, debouncedSearch, page, pageSize, sortBy, sortOrder],
    queryFn: () =>
      invoicesReportApi.getList({
        ...queryParams,
        search: debouncedSearch || undefined,
        limit: pageSize,
        offset,
        sort_by: sortBy,
        sort_order: sortOrder,
      }),
    staleTime: 30 * 1000,
  });

  // 3. Fetch Analytics for the Analytics Sub-tab
  const {
    data: analyticsData,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ['invoices-analytics', queryParams],
    queryFn: () => invoicesReportApi.getAnalytics(queryParams),
    enabled: activeSubTab === 'Analytics',
    staleTime: 60 * 1000,
  });

  // 4. Fetch Single Invoice Details when modal is open
  const { data: detailData, isLoading: isDetailLoading } = useQuery<InvoiceDetailResponse>({
    queryKey: ['invoice-detail', selectedDocEntry],
    queryFn: () => invoicesReportApi.getDetail(selectedDocEntry!),
    enabled: selectedDocEntry !== null,
    staleTime: 3 * 60 * 1000,
  });

  // Export handlers
  const handleExportCSV = async () => {
    setIsExporting(true);
    setIsExportOpen(false);
    try {
      const blob = await invoicesReportApi.exportInvoices({
        ...queryParams,
        search: debouncedSearch || undefined,
        format: 'csv',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atlas_invoices_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    setIsExportOpen(false);
    window.print();
  };

  // KPI card metrics
  const totalInvoices = overview?.totalInvoices ?? 0;
  const totalSales = overview?.totalSales ?? 0;
  const totalPaid = overview?.totalPaid ?? 0;
  const totalDue = overview?.totalDue ?? 0;
  const avgValue = overview?.avgInvoiceValue ?? 0;
  const paidPct = overview?.paidPercentage ?? 0;
  const duePct = overview?.duePercentage ?? 0;

  const kpis = [
    {
      title: 'TOTAL INVOICES',
      val: totalInvoices.toLocaleString('en-IN'),
      icon: FileText,
      pct: overview?.growth?.invoicesPct !== undefined
        ? `${overview.growth.invoicesPct >= 0 ? '+' : ''}${overview.growth.invoicesPct}% vs. prev.`
        : `${totalInvoices} records`,
      isUp: (overview?.growth?.invoicesPct ?? 0) >= 0,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'TOTAL SALES',
      val: fmt(totalSales),
      icon: TrendingUp,
      pct: overview?.growth?.salesPct !== undefined
        ? `${overview.growth.salesPct >= 0 ? '+' : ''}${overview.growth.salesPct}% vs. prev.`
        : 'Live SAP Gross',
      isUp: (overview?.growth?.salesPct ?? 0) >= 0,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'TOTAL PAID',
      val: fmt(totalPaid),
      icon: CreditCard,
      subtitle: `${paidPct}% collected`,
      isUp: true,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'TOTAL DUE',
      val: fmt(totalDue),
      icon: Receipt,
      subtitle: `${duePct}% pending`,
      isUp: false,
      iconBg: 'bg-rose-50 text-rose-600',
    },
    {
      title: 'AVG. INVOICE VALUE',
      val: fmt(avgValue),
      icon: PieChartIcon,
      pct: overview?.growth?.avgPct !== undefined
        ? `${overview.growth.avgPct >= 0 ? '+' : ''}${overview.growth.avgPct}% vs. prev.`
        : 'Per invoice',
      isUp: (overview?.growth?.avgPct ?? 0) >= 0,
      iconBg: 'bg-purple-50 text-purple-600',
    },
  ];

  const totalPages = Math.ceil((listData?.total || 0) / pageSize) || 1;

  return (
    <div className="flex flex-col min-h-full bg-slate-50 font-sans -m-4 sm:-m-5 lg:-m-6 p-4 sm:p-5 lg:p-6 overflow-y-auto">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900">
            Invoice Report
          </h1>
          <p className="mt-1 atlas-page-subtitle text-sm text-slate-500">
            View and analyze invoice details, payments and sales transactions from SAP Business One.
          </p>
        </div>

        {/* Top Position Right Side: Date Range Dropdown & Export Button */}
        <div className="flex items-center gap-2.5">
          <ReportDateRangePicker
            quickFilter={quickFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onRangeChange={handleDateRangeChange}
          />

          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportOpen(prev => !prev)}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5 z-50">
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Export CSV (.csv)
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  Export Excel (.xlsx)
                </button>
                <button
                  onClick={handlePrint}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  Print Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Navigation Tabs (Invoice Report | Payment Report | Summary & Analytics) ── */}
      <div className="flex items-center gap-1 mb-6 bg-slate-200/50 p-1.5 rounded-xl w-fit">
        {[
          { name: 'Invoice Report', path: '/reports/invoice' },
          { name: 'Payment Report', path: '/reports/payment' },
          { name: 'Summary & Analytics', path: '/reports/sales' },
        ].map(tab => (
          <button
            key={tab.name}
            onClick={() => {
              if (tab.name !== 'Invoice Report') navigate(tab.path);
            }}
            className={cn(
              'px-5 py-2.5 text-[14px] font-semibold rounded-lg transition-all cursor-pointer',
              tab.name === 'Invoice Report'
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            )}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {kpis.map((card, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_4px_15px_-3px_rgba(6,81,237,0.1)] transition-shadow flex flex-col justify-between gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {card.title}
                </p>
                <div className="text-[24px] sm:text-[26px] font-extrabold text-slate-900 tracking-tight">
                  {isOverviewLoading ? (
                    <span className="inline-block w-20 h-7 bg-slate-100 animate-pulse rounded" />
                  ) : isOverviewError ? (
                    <span className="text-slate-300">--</span>
                  ) : (
                    card.val
                  )}
                </div>
              </div>
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', card.iconBg)}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="text-[12px] flex items-center gap-1 font-semibold">
              {card.pct && (
                <span className={cn('inline-flex items-center gap-0.5', card.isUp ? 'text-emerald-600' : 'text-slate-500')}>
                  {card.isUp && <ArrowUpRight className="w-3.5 h-3.5" />}
                  {card.pct}
                </span>
              )}
              {card.subtitle && (
                <span className={cn(card.isUp ? 'text-emerald-600' : 'text-rose-600')}>
                  {card.subtitle}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Dynamic Filter Panel (Branch, Customer, Invoice Status, Payment Status, Payment Method, Search) ── */}
      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* 1. Branch Dropdown */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Branch</label>
            <div className="relative">
              <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={branch}
                onChange={e => setBranch(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8.5 pr-7 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Branches</option>
                {filterOptions?.branches?.map((b: any) => (
                  <option key={b.code || b.id} value={b.code || b.id}>
                    {b.name || b.code}
                  </option>
                )) || <option value="3">Main Branch (GZB)</option>}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 2. Customer Dropdown */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Customer</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8.5 pr-7 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 truncate"
              >
                <option value="">All Customers</option>
                {filterOptions?.customers?.map((c: any) => (
                  <option key={c.code || c.id} value={c.name || c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 3. Invoice Status Dropdown */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Invoice Status</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={invoiceStatus}
                onChange={e => setInvoiceStatus(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8.5 pr-7 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Statuses</option>
                <option value="closed">Closed / Cleared</option>
                <option value="open">Open / Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 4. Payment Status Dropdown */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Payment Status</label>
            <div className="relative">
              <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8.5 pr-7 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Payment Statuses</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="unpaid">Unpaid / Open</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 5. Payment Method Dropdown */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Payment Method</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8.5 pr-7 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI / Online</option>
                <option value="bank">Bank Transfer</option>
                <option value="check">Check</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* 6. Search Bar */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice # or customer"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8.5 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        {/* Filter Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            onClick={handleApplyFilters}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm cursor-pointer"
          >
            Apply Filters
          </button>
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* ── Sub-tabs Header: Invoice List / Analytics ────────────── */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200/80 pb-2">
        {(['Invoice List', 'Analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={cn(
              'px-4 py-2 text-xs sm:text-[13px] font-semibold rounded-lg transition-all relative cursor-pointer',
              activeSubTab === tab
                ? 'text-blue-700 bg-blue-50/70 font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
            )}
          >
            {tab}
            {activeSubTab === tab && (
              <span className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Invoice List ──────────────────────────────────── */}
      {activeSubTab === 'Invoice List' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-center w-10">#</th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-blue-600 transition-colors select-none"
                    onClick={() => toggleSort('invoiceNo')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Invoice No</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-blue-600 transition-colors select-none"
                    onClick={() => toggleSort('cardName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Customer</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-blue-600 transition-colors select-none"
                    onClick={() => toggleSort('docDate')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Date &amp; Time</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-blue-600 transition-colors select-none"
                    onClick={() => toggleSort('docTotal')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Amount</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Payment Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isListLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <Loader2 className="w-7 h-7 text-blue-500 animate-spin mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600">Loading live SAP invoices...</p>
                      <p className="text-xs text-slate-400 mt-1">Retrieving authoritative records from Service Layer</p>
                    </td>
                  </tr>
                ) : isListError ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center">
                      <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                      <p className="font-semibold text-slate-800">Invoice data unavailable</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {(listError as any)?.response?.data?.detail || 'Could not connect to SAP Service Layer'}
                      </p>
                      <button
                        onClick={() => {
                          refetchList();
                          refetchOverview();
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <RefreshCcw className="w-3.5 h-3.5" /> Retry Request
                      </button>
                    </td>
                  </tr>
                ) : !listData?.items?.length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-slate-500">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700">No invoices found for the selected filters</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try expanding the date range filter or resetting secondary filters above.
                      </p>
                      <button
                        onClick={handleResetFilters}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  listData.items.map((inv: InvoiceListItem, idx: number) => {
                    const rowIndex = offset + idx + 1;

                    // Invoice Status Badge
                    let invStatusBadge = (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Open
                      </span>
                    );
                    if (inv.invoiceStatus === 'Closed') {
                      invStatusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Closed
                        </span>
                      );
                    } else if (inv.invoiceStatus === 'Cancelled') {
                      invStatusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Cancelled
                        </span>
                      );
                    }

                    // Payment Status Badge
                    let payStatusBadge = (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Unpaid
                      </span>
                    );
                    if (inv.paymentStatus === 'Paid') {
                      payStatusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Paid
                        </span>
                      );
                    } else if (inv.paymentStatus === 'Partially Paid') {
                      payStatusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Partially Paid
                        </span>
                      );
                    } else if (inv.paymentStatus === 'Cancelled') {
                      payStatusBadge = (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                          Cancelled
                        </span>
                      );
                    }

                    return (
                      <tr
                        key={inv.docEntry}
                        onClick={() => setSelectedDocEntry(inv.docEntry)}
                        className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3 text-center text-[12px] font-medium text-slate-400">
                          {rowIndex}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold text-blue-600 group-hover:text-blue-700">
                          {inv.invoiceNo}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{inv.cardName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{inv.cardCode}</div>
                        </td>
                        <td className="px-4 py-3 text-[12px] font-medium text-slate-600">
                          <div>{inv.docDate}</div>
                          {inv.docTime && (
                            <div className="text-[11px] text-slate-400">{inv.docTime}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-slate-900 text-[13.5px]">
                          {fmt(inv.docTotal)}
                        </td>
                        <td className="px-4 py-3 text-[12.5px] font-medium text-slate-700">
                          {inv.paymentMethod}
                        </td>
                        <td className="px-4 py-3 text-center">{invStatusBadge}</td>
                        <td className="px-4 py-3 text-center">{payStatusBadge}</td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedDocEntry(inv.docEntry)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View SAP Invoice Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Table Pagination & Page Size ─────────────────────────── */}
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-slate-500">
              <span>
                Showing{' '}
                <span className="font-semibold text-slate-700">
                  {listData?.total ? offset + 1 : 0}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-700">
                  {Math.min(offset + pageSize, listData?.total || 0)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-700">
                  {listData?.total || 0}
                </span>{' '}
                invoices
              </span>

              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                <span className="text-slate-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 font-semibold focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isListLoading}
                className="flex items-center justify-center h-7 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors font-semibold cursor-pointer"
              >
                <ChevronLeft size={13} className="mr-0.5" /> Prev
              </button>
              <span className="font-semibold text-slate-600 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isListLoading}
                className="flex items-center justify-center h-7 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors font-semibold cursor-pointer"
              >
                Next <ChevronRight size={13} className="ml-0.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Analytics ─────────────────────────────────────── */}
      {activeSubTab === 'Analytics' && (
        <div className="space-y-6">
          {isAnalyticsLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Computing SAP Invoice Analytics...</p>
              <p className="text-xs text-slate-400 mt-1">Aggregating trends and distribution models</p>
            </div>
          ) : isAnalyticsError ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">Analytics unavailable</p>
              <p className="text-xs text-slate-500 mt-1">Could not fetch analytics data from SAP.</p>
              <button
                onClick={() => refetchAnalytics()}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : (
            <>
              {/* Row 1: Invoice Sales & Payments Trend */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                      Invoice Revenue &amp; Collection Trend
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chronological progression of invoiced sales vs. collected payments
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-blue-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Total Invoiced
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Total Paid
                    </span>
                  </div>
                </div>

                {analyticsData?.trend?.length ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analyticsData.trend}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="label"
                          tickFormatter={formatTrendLabel}
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          tickFormatter={v => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
                        />
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            fmt(Number(value || 0)),
                            name === 'totalSales' ? 'Total Invoiced' : 'Total Paid',
                          ]}
                          labelFormatter={(label: any) => formatTrendLabel(label)}
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderRadius: '10px',
                            color: '#fff',
                            fontSize: '12px',
                            border: 'none',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalSales"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorSales)"
                        />
                        <Area
                          type="monotone"
                          dataKey="totalPaid"
                          stroke="#10b981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorPaid)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                    No timeline activity in this date range
                  </div>
                )}
              </div>

              {/* Row 2: Distribution Donut & Top Customers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Payment Status Distribution Donut */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-1">
                    Payment Status Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Invoices partitioned by real SAP collection status
                  </p>

                  {analyticsData?.paymentStatusBreakdown?.length ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                      <div className="h-56 w-56 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.paymentStatusBreakdown}
                              dataKey="total"
                              nameKey="status"
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={3}
                            >
                              {analyticsData.paymentStatusBreakdown.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={STATUS_COLORS[entry.status] || '#94a3b8'}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(val: any) => fmt(Number(val || 0))}
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '11px',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-2.5 flex-1 w-full text-xs">
                        {analyticsData.paymentStatusBreakdown.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: STATUS_COLORS[item.status] || '#94a3b8' }}
                              />
                              <span className="font-semibold text-slate-700">{item.status}</span>
                              <span className="text-slate-400">({item.count})</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-900">{fmt(item.total)}</span>
                              <span className="ml-2 font-medium text-slate-500 text-[11px]">
                                {item.percentage}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                      No status records
                    </div>
                  )}
                </div>

                {/* Top Customers by Invoiced Value */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-1">
                    Top Customers by Sales
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Highest invoiced revenue contributors from SAP records
                  </p>

                  {analyticsData?.topCustomers?.length ? (
                    <div className="space-y-3">
                      {analyticsData.topCustomers.map((cust, idx) => {
                        const maxVal = analyticsData.topCustomers[0]?.totalSales || 1;
                        const pct = Math.round((cust.totalSales / maxVal) * 100);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">
                                {idx + 1}. {cust.cardName}
                              </span>
                              <span className="font-bold text-slate-900">{fmt(cust.totalSales)}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                              <div
                                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-[11px] text-slate-400 text-right">
                              {cust.invoicesCount} {cust.invoicesCount === 1 ? 'invoice' : 'invoices'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-slate-400 text-xs">
                      No customer invoice volume
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modal Dialog: Invoice Details ─────────────────────── */}
      {selectedDocEntry !== null && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setSelectedDocEntry(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    {detailData?.invoiceNo || `Invoice #${selectedDocEntry}`}
                  </h2>
                  {detailData?.invoiceStatus && (
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-bold',
                        detailData.invoiceStatus === 'Closed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : detailData.invoiceStatus === 'Cancelled'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      )}
                    >
                      {detailData.invoiceStatus}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  SAP DocEntry: {selectedDocEntry} • {detailData?.docDate || ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Print Invoice"
                >
                  <Printer className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => setSelectedDocEntry(null)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isDetailLoading ? (
                <div className="py-24 text-center">
                  <Loader2 className="w-7 h-7 text-blue-500 animate-spin mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Retrieving invoice lines from SAP...</p>
                </div>
              ) : !detailData ? (
                <div className="py-24 text-center text-slate-400">
                  Invoice details could not be found.
                </div>
              ) : (
                <>
                  {/* Customer & Branch Details Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Customer
                      </span>
                      <div className="font-bold text-slate-900 text-sm">{detailData.cardName}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{detailData.cardCode}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Branch &amp; Method
                      </span>
                      <div className="font-bold text-slate-900 text-sm">
                        {detailData.branchName || 'Main Branch'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Payment: {detailData.paymentMethod}
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                        Total Amount
                      </span>
                      <span className="text-xl font-extrabold text-blue-900">
                        {fmtDec(detailData.docTotal)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Paid to Date
                      </span>
                      <span className="text-sm font-bold text-emerald-700">
                        {fmtDec(detailData.paidToDate)}
                      </span>
                      {detailData.balanceDue > 0 && (
                        <div className="text-xs font-semibold text-rose-600 mt-0.5">
                          Due: {fmtDec(detailData.balanceDue)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
                      Document Lines ({detailData.lines?.length || 0})
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                          <tr>
                            <th className="px-3.5 py-2.5 w-8 text-center">#</th>
                            <th className="px-3.5 py-2.5">Item</th>
                            <th className="px-3.5 py-2.5 text-right">Qty</th>
                            <th className="px-3.5 py-2.5 text-right">Unit Price</th>
                            <th className="px-3.5 py-2.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detailData.lines?.map((line, lIdx) => (
                            <tr key={lIdx} className="hover:bg-slate-50/50">
                              <td className="px-3.5 py-2 text-center text-slate-400 font-medium">
                                {lIdx + 1}
                              </td>
                              <td className="px-3.5 py-2">
                                <div className="font-semibold text-slate-800">{line.itemDescription}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{line.itemCode}</div>
                              </td>
                              <td className="px-3.5 py-2 text-right font-medium text-slate-700">
                                {line.quantity}
                              </td>
                              <td className="px-3.5 py-2 text-right font-medium text-slate-700">
                                {fmt(line.unitPrice)}
                              </td>
                              <td className="px-3.5 py-2 text-right font-bold text-slate-900">
                                {fmt(line.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Comments or Remarks */}
                  {detailData.comments && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Remarks:</span> {detailData.comments}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedDocEntry(null)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
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

export default InvoiceReportPage;
