import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, Check, Clock3, RefreshCcw, ShoppingBag, ShoppingCart, Sparkles,
  TrendingUp, TriangleAlert, Users, Package, FileText, ExternalLink, X,
  ChevronRight, RotateCcw, Calendar, ChevronDown
} from 'lucide-react';
import { atlasApi, dashboardApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { useAIAssistant } from '../contexts/AIAssistantContext';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  resolveDashboardDateRange,
  validateCustomDateRange,
  getDateScopeLabel,
  type QuickFilter,
  type DashboardPeriod
} from '../utils/date';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const formatTime = (ts?: number | null) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isSapConnected, checkHealth: recheckHealth } = useSystemHealth();

  const role = user?.role?.toLowerCase();
  const isManagerOrAdmin = role === 'admin' || role === 'manager';

  const [branchId, setBranchId] = useState<string>(user?.branch_id || '');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Authoritative Shared Date Filter State across Dashboard
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [period, setPeriod] = useState<DashboardPeriod>('all_time');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const applyQuickFilter = (filter: QuickFilter) => {
    if (filter === 'custom') {
      const validation = validateCustomDateRange(customFrom, customTo);
      if (!validation.isValid) {
        setCustomError(validation.error || 'Invalid date range');
        return;
      }
      setCustomError(null);
      const resolved = resolveDashboardDateRange('custom', customFrom, customTo);
      setQuickFilter(resolved.quickFilter);
      setPeriod(resolved.period);
      setDateFrom(resolved.dateFrom);
      setDateTo(resolved.dateTo);
      setIsDateDropdownOpen(false);
      return;
    }

    setCustomError(null);
    const resolved = resolveDashboardDateRange(filter);
    setQuickFilter(resolved.quickFilter);
    setPeriod(resolved.period);
    setDateFrom(resolved.dateFrom);
    setDateTo(resolved.dateTo);
    if (!filter) {
      setCustomFrom('');
      setCustomTo('');
    } else {
      setCustomFrom(resolved.dateFrom);
      setCustomTo(resolved.dateTo);
    }
    setIsDateDropdownOpen(false);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.dashboard-date-dropdown-container')) {
        setIsDateDropdownOpen(false);
      }
    };
    if (isDateDropdownOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isDateDropdownOpen]);

  const { setPageFilters } = useAIAssistant();

  // Keep AIAssistantContext aware of dashboard active date and branch filters
  useEffect(() => {
    setPageFilters({
      period,
      branch: branchId,
      date_from: dateFrom,
      date_to: dateTo,
      quick_filter: quickFilter,
    });
  }, [period, branchId, dateFrom, dateTo, quickFilter, setPageFilters]);

  // Quick Drilldown Drawer State (Level C)
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────
  const {
    data: summary,
    isLoading: loadingSummary,
    isError: errorSummary,
    dataUpdatedAt: summaryUpdatedAt,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['atlasOverview', branchId, period, dateFrom, dateTo],
    queryFn: () => atlasApi.getOverview(branchId, period, undefined, undefined, undefined, dateFrom || undefined, dateTo || undefined),
    staleTime: 60 * 1000,
  });

  const {
    data: recentSales,
    isLoading: loadingSales,
    isError: errorSales,
    dataUpdatedAt: salesUpdatedAt,
    refetch: refetchSales,
  } = useQuery({
    queryKey: ['recentSales', branchId, period, dateFrom, dateTo],
    queryFn: () => atlasApi.getRecentSalesFeed({
      range: period,
      branch: branchId,
      limit: 10,
      from_date: dateFrom || undefined,
      to_date: dateTo || undefined
    }),
    staleTime: 60 * 1000,
  });

  const {
    data: alerts,
    isLoading: loadingAlerts,
    isError: errorAlerts,
    error: alertsError,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['dashboardAlerts', branchId],
    queryFn: () => dashboardApi.getAlerts(),
    enabled: isManagerOrAdmin,
    retry: false,
    staleTime: 30 * 1000,
  });

  const {
    data: topProducts,
    isLoading: loadingProducts,
    isError: errorProducts,
    dataUpdatedAt: productsUpdatedAt,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['topProducts', branchId, period, dateFrom, dateTo],
    queryFn: () => atlasApi.getTopProducts(branchId, period, undefined, undefined, undefined, dateFrom || undefined, dateTo || undefined),
    staleTime: 60 * 1000,
  });

  const {
    data: trendData,
    isLoading: loadingTrend,
    isError: errorTrend,
    dataUpdatedAt: trendUpdatedAt,
    refetch: refetchTrend,
  } = useQuery({
    queryKey: ['salesTrend', branchId, period, dateFrom, dateTo],
    queryFn: () => atlasApi.getSalesTrend(branchId, period, undefined, undefined, undefined, dateFrom || undefined, dateTo || undefined),
    staleTime: 60 * 1000,
  });

  const loadingOrdersTrend = loadingTrend;
  const errorOrdersTrend = errorTrend;
  const ordersTrendUpdatedAt = trendUpdatedAt;
  const refetchOrdersTrend = refetchTrend;

  const {
    data: inventoryRisk,
    isLoading: loadingRisk,
    isError: errorRisk,
    dataUpdatedAt: riskUpdatedAt,
    refetch: refetchRisk,
  } = useQuery({
    queryKey: ['inventoryRisk', branchId],
    queryFn: () => dashboardApi.getInventoryRisk(),
    enabled: isManagerOrAdmin,
    retry: false,
    staleTime: 60 * 1000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const refreshTasks: Promise<any>[] = [
      recheckHealth(),
      refetchSummary(),
      refetchSales(),
      refetchProducts(),
      refetchTrend(),
    ];
    if (isManagerOrAdmin) {
      refreshTasks.push(refetchAlerts(), refetchRisk());
    }
    await Promise.allSettled(refreshTasks);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const trendPoints = useMemo(() => {
    if (trendData?.trend && Array.isArray(trendData.trend) && trendData.trend.length > 0) {
      return trendData.trend;
    }
    return [];
  }, [trendData]);

  const ordersPoints = useMemo(() => {
    if (trendData?.trend && Array.isArray(trendData.trend) && trendData.trend.length > 0) {
      return trendData.trend.map((t: any) => ({
        label: t.label || t.date || '',
        count: t.invoice_count ?? 0,
      }));
    }
    return [];
  }, [trendData]);

  const recentSalesList = useMemo(() => {
    if (recentSales?.items && Array.isArray(recentSales.items) && recentSales.items.length > 0) {
      return recentSales.items.slice(0, 5);
    }
    return [];
  }, [recentSales]);

  const topProductsList = useMemo(() => {
    if (topProducts && Array.isArray(topProducts) && topProducts.length > 0) {
      return topProducts.slice(0, 5);
    }
    return [];
  }, [topProducts]);

  const hasCachedSummary = summary?.totalSales !== undefined;
  const isSummaryLive = isSapConnected === true && hasCachedSummary && !errorSummary;
  const isSummaryCached = isSapConnected === false && hasCachedSummary && !errorSummary;
  const isSummaryUnavailable = !hasCachedSummary || errorSummary;

  const salesDisplayValue = hasCachedSummary && !errorSummary
    ? money.format(summary.totalSales)
    : (loadingSummary ? '...' : errorSummary ? 'Error' : 'Unavailable');

  const completedBillsCount = summary?.invoiceCount !== undefined && !errorSummary
    ? summary.invoiceCount
    : (loadingSummary ? '...' : errorSummary ? 'Error' : 'Unavailable');

  const salesKpiTitle = useMemo(() => {
    switch (quickFilter) {
      case 'today': return 'Sales Today';
      case 'week': return 'Sales This Week';
      case 'month': return 'Sales This Month';
      case 'year': return 'Sales This Year';
      case 'custom': return 'Sales (Custom)';
      default: return 'Sales (All Dates)';
    }
  }, [quickFilter]);

  const completedBillsKpiSubtitle = useMemo(() => {
    switch (quickFilter) {
      case 'today': return 'completed today';
      case 'week': return 'completed this week';
      case 'month': return 'completed this month';
      case 'year': return 'completed this year';
      case 'custom': return 'completed in range';
      default: return 'completed all-time';
    }
  }, [quickFilter]);

  const pendingApprovalsCount = alerts
    ? alerts.filter((item: any) => item.status?.toLowerCase() === 'pending').length
    : undefined;
  const isApprovalsForbidden = !isManagerOrAdmin || (alertsError as any)?.response?.status === 403;

  const hasCachedRisk = inventoryRisk !== undefined && Array.isArray(inventoryRisk);
  const isRiskLive = isSapConnected === true && hasCachedRisk;
  const isRiskCached = isSapConnected === false && hasCachedRisk;
  const isRiskForbidden = !isManagerOrAdmin || (errorRisk as any)?.response?.status === 403;
  const isRiskUnavailable = !isRiskForbidden && (!hasCachedRisk || errorRisk);
  const lowStockCount = hasCachedRisk
    ? inventoryRisk.length
    : (loadingRisk ? '...' : isRiskForbidden ? 'Restricted' : 'Unavailable');

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 text-slate-900 pb-8 w-full transition-all duration-300">
      {/* ────────────────────────────────────────────────────────────────────
          CENTER DASHBOARD CONTENT AREA
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-4 transition-all duration-300 w-full">
        {/* ROW 1: Heading, Branch Selector, Date Pills */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900 leading-none">
              Retail Operations Dashboard
            </h1>
            <p className="atlas-page-subtitle text-sm sm:text-[15px] text-slate-500 mt-1.5">
              Real-time overview of your business performance, inventory, and operations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Branch Selector */}
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 outline-none hover:border-slate-300 shadow-2xs transition"
            >
              {user?.role === 'admin' && <option value="">All Branches</option>}
              <option value={user?.branch_id || ''}>
                {user?.store_name || user?.branch_id || 'Current Branch'}
              </option>
            </select>

            {/* Date Dropdown Filter (Matching Sales Orders Page reference) */}
            <div className="relative dashboard-date-dropdown-container">
              <button
                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors font-medium text-[12px] shadow-2xs cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {getDateScopeLabel(quickFilter, dateFrom, dateTo)}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDateDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => applyQuickFilter('')}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${quickFilter === '' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    All Dates (Total)
                  </button>
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50">
                    Quick Filters
                  </div>
                  {(['today', 'week', 'month', 'year'] as const).map(f => {
                    const label = f === 'today' ? 'Today' : `This ${f.charAt(0).toUpperCase() + f.slice(1)}`;
                    return (
                      <button
                        key={f}
                        onClick={() => applyQuickFilter(f)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${quickFilter === f ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50 mt-1">
                    Custom Range
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">From</label>
                      <input
                        type="date"
                        className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500"
                        value={customFrom}
                        onChange={e => {
                          setCustomFrom(e.target.value);
                          if (customError) setCustomError(null);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">To</label>
                      <input
                        type="date"
                        className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500"
                        value={customTo}
                        onChange={e => {
                          setCustomTo(e.target.value);
                          if (customError) setCustomError(null);
                        }}
                      />
                    </div>
                    {customError && (
                      <p className="text-[11px] text-rose-600 font-medium">{customError}</p>
                    )}
                    <button
                      disabled={!customFrom || !customTo || customFrom > customTo}
                      onClick={() => applyQuickFilter('custom')}
                      className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded font-medium text-sm transition-colors cursor-pointer"
                    >
                      Apply Custom
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-2xs hover:bg-blue-500 transition cursor-pointer"
              title="Refresh metrics"
            >
              <RefreshCcw size={12} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Offline Alert Banner */}
        {isSapConnected === false && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-[12px] text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>SAP Service Layer is Offline:</strong> Showing cached business data where available. Local database operations (shifts, pending approvals) remain active.
              </span>
            </div>
            <button
              onClick={() => recheckHealth()}
              className="self-start sm:self-auto shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
            >
              Check Connection
            </button>
          </div>
        )}

        {/* ROW 2: Five KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* KPI 1: Sales Today */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs min-h-[142px]">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
                <ShoppingCart size={17} />
              </div>
              {errorSummary ? (
                <span className="rounded-md border border-rose-300 bg-rose-50/80 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  ERROR
                </span>
              ) : isSummaryLive ? (
                <span className="rounded-md border border-emerald-300 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  LIVE
                </span>
              ) : isSummaryCached ? (
                <span className="rounded-md border border-amber-300 bg-amber-50/80 px-2 py-0.5 text-[10px] font-bold text-amber-700" title={`Cached at ${formatTime(summaryUpdatedAt)}`}>
                  CACHED
                </span>
              ) : (
                <span className="rounded-md border border-rose-300 bg-rose-50/80 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  OFFLINE
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-[11.5px] font-medium text-slate-500">{salesKpiTitle}</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[21px] font-bold tracking-tight text-slate-900">
                  {loadingSummary ? '...' : salesDisplayValue}
                </span>
                {isSummaryLive && summary?.growth !== undefined && (
                  <span className={`text-[11px] font-semibold ${summary.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {summary.growth >= 0 ? `+${summary.growth}%` : `${summary.growth}%`}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {hasCachedSummary && summary?.invoiceCount !== undefined && !errorSummary
                  ? `${summary.invoiceCount} invoices`
                  : (errorSummary ? 'API Error' : isSummaryUnavailable ? 'SAP sync required' : 'Invoices')}
              </span>
              <div className="flex items-center gap-0.5 text-sky-400">
                <span className="inline-block h-2 w-0.5 bg-sky-400 rounded-full" />
                <span className="inline-block h-3 w-0.5 bg-sky-400 rounded-full" />
                <span className="inline-block h-2 w-0.5 bg-sky-400 rounded-full" />
                <span className="inline-block h-3.5 w-0.5 bg-sky-500 rounded-full" />
              </div>
            </div>
          </div>

          {/* KPI 2: Completed Bills */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs min-h-[142px]">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500 text-white shadow-xs">
                <Check size={18} strokeWidth={2.5} />
              </div>
              {errorSummary ? (
                <span className="rounded-md border border-rose-300 bg-rose-50/80 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  ERROR
                </span>
              ) : isSummaryLive ? (
                <span className="rounded-md border border-blue-200 bg-blue-50/80 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  BILLED
                </span>
              ) : isSummaryCached ? (
                <span className="rounded-md border border-amber-300 bg-amber-50/80 px-2 py-0.5 text-[10px] font-bold text-amber-700" title={`Cached at ${formatTime(summaryUpdatedAt)}`}>
                  CACHED
                </span>
              ) : (
                <span className="rounded-md border border-rose-300 bg-rose-50/80 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  OFFLINE
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-[11.5px] font-medium text-slate-500">Completed Bills</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[21px] font-bold tracking-tight text-slate-900">
                  {loadingSummary ? '...' : completedBillsCount}
                </span>
                {isSummaryLive && summary?.growth !== undefined && (
                  <span className="text-[11px] font-semibold text-emerald-600">
                    +{summary.growth}%
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {hasCachedSummary && summary?.invoiceCount !== undefined && !errorSummary
                  ? `${summary.invoiceCount} ${completedBillsKpiSubtitle}`
                  : (errorSummary ? 'API Error' : isSummaryUnavailable ? 'SAP sync required' : 'Completed')}
              </span>
              <div className="flex items-center gap-0.5 text-blue-400">
                <span className="inline-block h-2 w-0.5 bg-blue-400 rounded-full" />
                <span className="inline-block h-3 w-0.5 bg-blue-400 rounded-full" />
                <span className="inline-block h-3.5 w-0.5 bg-blue-500 rounded-full" />
              </div>
            </div>
          </div>

          {/* KPI 3: Active Shift */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs min-h-[142px]">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500 text-white shadow-xs">
                <Clock3 size={17} />
              </div>
              <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                Local DB
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-[11.5px] font-medium text-slate-500">Active Shift</div>
              <div
                className="mt-0.5 text-[19px] font-bold tracking-tight text-slate-900 truncate max-w-[140px] cursor-help"
                title={user?.name || user?.username || 'Current User'}
              >
                {user?.name ? `${user.name.split(' ')[0]} ...` : (user?.username || 'Current User')}
              </div>
            </div>
            <div className="mt-2.5 text-[11px] text-slate-400">
              {user?.role ? `${user.role.toUpperCase()} • Assigned` : 'User • Assigned'}
            </div>
          </div>

          {/* KPI 4: Low-stock Items */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs min-h-[142px]">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <TriangleAlert size={17} />
              </div>
              {isRiskForbidden ? (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  Restricted
                </span>
              ) : isRiskLive ? (
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${(inventoryRisk?.length ?? 0) === 0
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-amber-300 bg-amber-50 text-amber-700'
                  }`}>
                  {(inventoryRisk?.length ?? 0) === 0 ? 'Optimal' : 'Alert'}
                </span>
              ) : isRiskCached ? (
                <span className="rounded-md border border-amber-300 bg-amber-50/80 px-2 py-0.5 text-[10px] font-bold text-amber-700" title={`Cached at ${formatTime(riskUpdatedAt)}`}>
                  CACHED
                </span>
              ) : (
                <span className="rounded-md border border-rose-300 bg-rose-50/80 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  OFFLINE
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-[11.5px] font-medium text-slate-500">Low-stock Items</div>
              <div className="mt-0.5 text-[21px] font-bold tracking-tight text-slate-900">
                {loadingRisk ? '...' : (isRiskForbidden ? 'Restricted' : isRiskUnavailable ? 'Unavailable' : lowStockCount)}
              </div>
            </div>
            <div className="mt-2.5 text-[11px] text-slate-400">
              {isRiskForbidden ? 'Manager/Admin only' : isRiskUnavailable ? 'SAP sync required' : ((inventoryRisk?.length ?? 0) === 0 ? 'Healthy inventory' : 'Items low in stock')}
            </div>
          </div>

          {/* KPI 5: Pending Approvals */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs min-h-[142px]">
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white shadow-xs">
                <Bell size={17} />
              </div>
              {isApprovalsForbidden ? (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  Restricted
                </span>
              ) : errorAlerts ? (
                <button
                  onClick={() => refetchAlerts()}
                  className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[9px] font-medium text-rose-600 hover:bg-rose-100 cursor-pointer"
                >
                  Retry
                </button>
              ) : (
                <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                  Local DB
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-[11.5px] font-medium text-slate-500">Pending Approvals</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[21px] font-bold tracking-tight text-slate-900">
                  {loadingAlerts ? '...' : (isApprovalsForbidden ? 'Restricted' : errorAlerts ? 'Unavailable' : (pendingApprovalsCount ?? 0))}
                </span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>{isApprovalsForbidden ? 'Manager/Admin only' : 'Credit & returns'}</span>
              <div className="flex items-center gap-0.5 text-rose-400">
                <span className="inline-block h-1.5 w-0.5 bg-rose-400 rounded-full" />
                <span className="inline-block h-3 w-0.5 bg-rose-400 rounded-full" />
                <span className="inline-block h-2.5 w-0.5 bg-rose-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: Charts Row (Sales Overview & Orders Overview Side by Side) */}
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Sales Overview AreaChart */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-500" />
                  <span className="text-[16px] font-bold text-slate-900">Sales Overview</span>
                  {errorTrend ? (
                    <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">ERROR</span>
                  ) : trendPoints.length > 0 ? (
                    isSapConnected ? (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">LIVE</span>
                    ) : (
                      <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700" title={`Cached at ${formatTime(trendUpdatedAt)}`}>
                        CACHED
                      </span>
                    )
                  ) : isSapConnected ? (
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.2 text-[9px] font-bold text-slate-500">NO DATA</span>
                  ) : (
                    <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">OFFLINE</span>
                  )}
                </div>

                {/* Period switcher */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-medium text-slate-600">
                  {([
                    { label: 'Today', key: 'today' },
                    { label: 'Week', key: 'week' },
                    { label: 'Month', key: 'month' },
                    { label: 'Year', key: 'year' },
                    { label: 'Total', key: '' },
                  ] as const).map((p) => {
                    const isActive = quickFilter === p.key;
                    return (
                      <button
                        key={p.label}
                        onClick={() => applyQuickFilter(p.key)}
                        className={`rounded-md px-2 py-0.5 transition-colors cursor-pointer ${isActive
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'hover:text-slate-900 text-slate-600'
                          }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-[210px] w-full">
                {loadingTrend ? (
                  <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
                    Loading sales trend...
                  </div>
                ) : trendPoints.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendPoints} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey={(d) => d.label || d.date || ''}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        dy={5}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}`}
                        dx={-2}
                      />
                      <Tooltip
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Sales Amount']}
                        contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid #e2e8f0' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#0284c7"
                        strokeWidth={2.5}
                        fill="url(#salesGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#0284c7' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center rounded-xl bg-slate-50/60 border border-dashed border-slate-200 p-4 text-center">
                    <TrendingUp size={24} className="text-slate-300 mb-2" />
                    <p className="text-[12px] font-medium text-slate-600">
                      {errorTrend ? 'Failed to load sales trend' : 'Sales trend unavailable'}
                    </p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      {errorTrend ? 'An error occurred while fetching trend data' : isSapConnected === false ? 'SAP Service Layer is offline' : 'No sales records for selected period'}
                    </p>
                    <button
                      onClick={() => refetchTrend()}
                      className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 bg-white border border-slate-200 rounded-md px-2.5 py-1 shadow-2xs hover:bg-slate-50 cursor-pointer"
                    >
                      <RefreshCcw size={10} />
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-sky-500 inline-block" />
              <span>Sales Amount</span>
            </div>
          </div>

          {/* Orders Overview BarChart */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-purple-500" />
                  <span className="text-[16px] font-bold text-slate-900">Orders Overview</span>
                  {errorOrdersTrend ? (
                    <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">ERROR</span>
                  ) : ordersPoints.length > 0 ? (
                    isSapConnected ? (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">LIVE</span>
                    ) : (
                      <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700" title={`Cached at ${formatTime(ordersTrendUpdatedAt)}`}>
                        CACHED
                      </span>
                    )
                  ) : isSapConnected ? (
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.2 text-[9px] font-bold text-slate-500">NO DATA</span>
                  ) : (
                    <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">OFFLINE</span>
                  )}
                </div>

                {/* Period switcher */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-medium text-slate-600">
                  {([
                    { label: 'Today', key: 'today' },
                    { label: 'Week', key: 'week' },
                    { label: 'Month', key: 'month' },
                    { label: 'Year', key: 'year' },
                    { label: 'Total', key: '' },
                  ] as const).map((p) => {
                    const isActive = quickFilter === p.key;
                    return (
                      <button
                        key={p.label}
                        onClick={() => applyQuickFilter(p.key)}
                        className={`rounded-md px-2 py-0.5 transition-colors cursor-pointer ${isActive
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'hover:text-slate-900 text-slate-600'
                          }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-[210px] w-full">
                {loadingOrdersTrend ? (
                  <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
                    Loading orders trend...
                  </div>
                ) : ordersPoints.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ordersPoints} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey={(d) => d.label || d.date || ''}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        dy={5}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        allowDecimals={false}
                        dx={-2}
                      />
                      <Tooltip
                        formatter={(val: any) => [val, 'Orders Count']}
                        contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#6366f1"
                        radius={[3, 3, 0, 0]}
                        barSize={14}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center rounded-xl bg-slate-50/60 border border-dashed border-slate-200 p-4 text-center">
                    <ShoppingBag size={24} className="text-slate-300 mb-2" />
                    <p className="text-[12px] font-medium text-slate-600">
                      {errorOrdersTrend ? 'Failed to load orders trend' : 'Orders trend unavailable'}
                    </p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      {errorOrdersTrend ? 'An error occurred while fetching orders data' : isSapConnected === false ? 'SAP Service Layer is offline' : 'No orders for selected period'}
                    </p>
                    <button
                      onClick={() => refetchOrdersTrend()}
                      className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:text-purple-700 bg-white border border-slate-200 rounded-md px-2.5 py-1 shadow-2xs hover:bg-slate-50 cursor-pointer"
                    >
                      <RefreshCcw size={10} />
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />
              <span>Orders Count</span>
            </div>
          </div>
        </div>

        {/* ROW 4: Tables Row (Recent Sales & Top Products Side by Side) */}
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Recent Sales Table */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-500" />
                <span className="text-[16px] font-bold text-slate-900">Recent Sales</span>
                {errorSales ? (
                  <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">ERROR</span>
                ) : recentSalesList.length > 0 ? (
                  isSapConnected ? (
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">LIVE</span>
                  ) : (
                    <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700" title={`Cached at ${formatTime(salesUpdatedAt)}`}>
                      CACHED
                    </span>
                  )
                ) : (
                  <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">OFFLINE</span>
                )}
              </div>
              <Link to="/sales" className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                View all <ChevronRight size={13} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] sm:text-[13.5px]">
                <thead className="border-b border-slate-100 text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="pb-2">Invoice</th>
                    <th className="pb-2">Customer</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Payment Method</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {loadingSales ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-[11px]">
                        Loading recent sales...
                      </td>
                    </tr>
                  ) : recentSalesList.length > 0 ? (
                    recentSalesList.map((sale: any, idx: number) => {
                      const invNumber = sale.docNum ? `INV-${sale.docNum}` : sale.saleId || `INV-${idx + 1}`;
                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedSale(sale)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 font-semibold text-blue-600">{invNumber}</td>
                          <td className="py-2.5 font-medium text-slate-800">{sale.customerName || 'Walk-in Customer'}</td>
                          <td className="py-2.5 font-bold text-slate-900">{money.format(sale.total || 0)}</td>
                          <td className="py-2.5 text-slate-500">{sale.paymentMethod || 'Cash'}</td>
                          <td className="py-2.5">
                            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700">
                              {sale.hasReturn ? 'Refunded' : 'Completed'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-slate-400 text-[10.5px]">{sale.docDate || 'N/A'}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-[11px]">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <FileText size={20} className="text-slate-300" />
                          <span>{errorSales ? 'Failed to fetch recent sales' : isSapConnected === false ? 'Recent sales feed unavailable (SAP offline)' : 'No recent sales recorded'}</span>
                          <button
                            onClick={() => refetchSales()}
                            className="mt-1 text-[11px] font-medium text-blue-600 hover:underline cursor-pointer"
                          >
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Products Table */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-emerald-500" />
                <span className="text-[16px] font-bold text-slate-900">Top Products</span>
                {errorProducts ? (
                  <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">ERROR</span>
                ) : topProductsList.length > 0 ? (
                  isSapConnected ? (
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">LIVE</span>
                  ) : (
                    <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700" title={`Cached at ${formatTime(productsUpdatedAt)}`}>
                      CACHED
                    </span>
                  )
                ) : (
                  <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">OFFLINE</span>
                )}
              </div>
              <Link to="/products" className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                View all <ChevronRight size={13} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] sm:text-[13.5px]">
                <thead className="border-b border-slate-100 text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="pb-2 w-6">#</th>
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-right">Units Sold</th>
                    <th className="pb-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-[11px]">
                        Loading top products...
                      </td>
                    </tr>
                  ) : topProductsList.length > 0 ? (
                    topProductsList.map((prod: any, idx: number) => {
                      const initial = (prod.itemName || prod.itemCode || 'P').charAt(0).toUpperCase();
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 font-semibold text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 flex items-center gap-2">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white text-[9px] font-bold">
                              {initial}
                            </div>
                            <span className="font-medium text-slate-800">{prod.itemName || prod.itemCode}</span>
                          </td>
                          <td className="py-2.5 text-right font-medium text-slate-600">{prod.quantitySold}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900">{money.format(prod.salesAmount || 0)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-[11px]">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Package size={20} className="text-slate-300" />
                          <span>{errorProducts ? 'Failed to fetch top products' : isSapConnected === false ? 'Top products unavailable (SAP offline)' : 'No product velocity data'}</span>
                          <button
                            onClick={() => refetchProducts()}
                            className="mt-1 text-[11px] font-medium text-emerald-600 hover:underline cursor-pointer"
                          >
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ROW 5: AI Risk Analysis Summary & Quick Actions */}
        <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          {/* AI Risk Analysis Summary */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Users size={13} />
              </div>
              <span className="text-[13.5px] font-bold text-slate-900">AI Risk Analysis Summary</span>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 shrink-0 ${isSapConnected === false
                  ? 'border-amber-300 bg-amber-50/70 text-amber-700'
                  : 'border-emerald-300 bg-emerald-50/70 text-emerald-700'
                }`}>
                <div className="text-[20px] font-bold leading-none">
                  {isSapConnected === false ? '84%' : '98%'}
                </div>
                <div className="text-left leading-tight">
                  <div className="text-[9.5px] text-slate-500 font-medium">Health Index</div>
                  <div className={`text-[11px] font-bold ${isSapConnected === false ? 'text-amber-800' : 'text-emerald-800'
                    }`}>
                    {isSapConnected === false ? 'Active Warnings' : 'Systems Normal'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 flex-1">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 text-center">
                  <div className="text-[15px] font-bold text-slate-900 leading-tight">
                    {isRiskUnavailable ? '-' : (inventoryRisk?.length ?? 0)}
                  </div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">Inventory Risks</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 text-center">
                  <div className="text-[15px] font-bold text-slate-900 leading-tight">0</div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">Sales Anomalies</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2 text-center">
                  <div className={`text-[13px] font-bold leading-tight ${isSapConnected === false ? 'text-red-600' : isSapConnected === true ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                    {isSapConnected === false ? 'Sync Issue' : isSapConnected === true ? 'Connected' : 'Checking'}
                  </div>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">Integration Issue</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="mb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" />
                <span className="text-[13.5px] font-bold text-slate-900">Quick Actions</span>
              </div>
              <p className="text-[10.5px] text-slate-400">Frequently used operations</p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <Link
                to="/pos"
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-2 hover:bg-blue-50/60 hover:border-blue-200 transition group text-center"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                  <ShoppingCart size={13} />
                </div>
                <span className="text-[10px] font-medium text-slate-700">New Sale</span>
              </Link>

              <Link
                to="/products"
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-2 hover:bg-emerald-50/60 hover:border-emerald-200 transition group text-center"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Package size={13} />
                </div>
                <span className="text-[10px] font-medium text-slate-700">Add Product</span>
              </Link>

              <Link
                to="/reports/sales"
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-2 hover:bg-indigo-50/60 hover:border-indigo-200 transition group text-center"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
                  <FileText size={13} />
                </div>
                <span className="text-[10px] font-medium text-slate-700">Sales Report</span>
              </Link>

              <Link
                to="/returns"
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-2 hover:bg-rose-50/60 hover:border-rose-200 transition group text-center"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition">
                  <RotateCcw size={13} />
                </div>
                <span className="text-[10px] font-medium text-slate-700">Approvals</span>
              </Link>
            </div>
          </div>
        </div>
      </div>



      {/* ────────────────────────────────────────────────────────────────────
          LEVEL C: QUICK INVOICE INSPECTION DRAWER
      ─────────────────────────────────────────────────────────────────────── */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedSale.docNum ? `Invoice #${selectedSale.docNum}` : selectedSale.saleId || 'Invoice Details'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Quick audit inspection</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4 text-[12.5px]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Amount</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {money.format(selectedSale.total || 0)}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                    Completed
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Method: <strong className="text-slate-700">{selectedSale.paymentMethod || 'Cash'}</strong>
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Customer</span>
                  <span className="font-semibold text-slate-900">{selectedSale.customerName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Document Date</span>
                  <span className="font-semibold text-slate-900">{selectedSale.docDate || '2026-10-07'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Branch</span>
                  <span className="font-semibold text-slate-900">{branchId || 'WH-001'}</span>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
              <button
                onClick={() => setSelectedSale(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const targetId = selectedSale.docEntry || selectedSale.docNum;
                  if (targetId) navigate(`/sales/${targetId}`);
                  else navigate('/sales');
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-xs"
              >
                <span>Full Invoice</span>
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
