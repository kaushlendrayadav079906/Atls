import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  RotateCcw,
  Download,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Building2,
  Phone,
  Calendar,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { financeApi, type CustomerAnalysisResponse, type CustomerAnalysisItem } from '../../api/finance';
import { commonApi } from '../../api/common';
import { ReportDateRangePicker } from '../../components/ReportDateRangePicker';
import {
  type QuickFilter,
  type AuthoritativeDateFilterState,
} from '../../utils/date';

export const CustomerReportPage: React.FC = () => {
  // Authoritative Date Filter State
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [dateRange, setDateRange] = useState<string>('all_time');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Filtering & Pagination State
  const [branch, setBranch] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('sales');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Load SAP-backed authorized filter options (branches)
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => commonApi.getFilterOptions(),
    staleTime: 300_000,
  });

  const handleDateRangeChange = (filterState: AuthoritativeDateFilterState) => {
    setQuickFilter(filterState.quickFilter);
    setDateRange(filterState.period);
    setDateFrom(filterState.dateFrom);
    setDateTo(filterState.dateTo);
    setPage(1);
  };

  // Fetch verified SAP customer analysis data
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<CustomerAnalysisResponse>({
    queryKey: ['customer-analysis', dateRange, branch, dateFrom, dateTo, search, sortBy, sortOrder, page, pageSize],
    queryFn: async () => {
      return await financeApi.getCustomerAnalysis({
        range: dateRange,
        branch: branch || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        search: search.trim() || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize,
      });
    },
    staleTime: 30_000,
  });

  const summary = data?.summary || data?.kpis;
  const customers: CustomerAnalysisItem[] = data?.items || data?.customers || [];
  const totalCount = data?.total_count ?? (customers.length || 0);
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleResetFilters = () => {
    setQuickFilter('');
    setDateRange('all_time');
    setDateFrom('');
    setDateTo('');
    setBranch('');
    setSearch('');
    setSortBy('sales');
    setSortOrder('desc');
    setPage(1);
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const blob = await financeApi.exportFinanceData({
        module: 'customer_analysis',
        range: dateRange,
        branch: branch || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        search: search.trim() || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAP_Customer_Report_${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export customer report error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const formatINR = (val?: number) => {
    if (val === undefined || val === null) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-xs">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900">
              Customer Reports
            </h1>
            <p className="mt-1 atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">
              Verified customer sales volume, invoices, receipts, and receivables directly backed by SAP Business Partners (OCRD).
            </p>
          </div>
        </div>

        {/* Top Controls: Date Picker, Refresh & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <ReportDateRangePicker
            quickFilter={quickFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onRangeChange={handleDateRangeChange}
          />

          <button
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="flex items-center gap-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2.5 text-[13px] font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExporting || totalCount === 0 || isError}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-[13px] font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Active Customers</span>
              <Users size={18} className="text-blue-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : isError ? '—' : (summary?.total_customers_analyzed ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            {isError ? 'SAP data unavailable' : 'SAP Business Partners with activity'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Total Sales Revenue</span>
              <TrendingUp size={18} className="text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : isError ? '—' : formatINR(summary?.total_sales_revenue ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Net billings from non-cancelled A/R invoices
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Outstanding Receivables</span>
              <CreditCard size={18} className="text-rose-500" />
            </div>
            <h3 className="text-2xl font-black text-rose-600 mt-2">
              {isLoading ? '...' : isError ? '—' : formatINR(summary?.total_outstanding_receivables ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Open customer account balance in SAP
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Avg Spend / Customer</span>
              <Building2 size={18} className="text-indigo-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : isError ? '—' : (
                summary?.total_customers_analyzed
                  ? formatINR(Math.round((summary.total_sales_revenue || 0) / summary.total_customers_analyzed))
                  : '₹0'
              )}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Average customer spend in selected scope
          </div>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name or CardCode..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9.5 pr-4 py-2 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Branch Filter */}
        <div className="w-[180px]">
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13.5px] text-slate-700 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="">All Branches</option>
            {filterOptions?.branches?.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Field */}
        <div className="w-[180px]">
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13.5px] text-slate-700 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="sales">Sort by Sales Revenue</option>
            <option value="receivables">Sort by Receivables</option>
            <option value="invoices">Sort by Invoices Count</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="w-[130px]">
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13.5px] text-slate-700 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="desc">High to Low</option>
            <option value="asc">Low to High</option>
          </select>
        </div>

        {/* Reset Filters */}
        {(search || branch || quickFilter !== '' || sortBy !== 'sales' || sortOrder !== 'desc') && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-[13px] font-semibold transition cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* ── Customer Report Table ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Users size={20} className="text-blue-500" />
            <h2 className="atlas-card-title text-[16px] font-bold text-slate-900">
              Customer Sales & Receivables {isError ? '(Unavailable)' : `(${totalCount})`}
            </h2>
          </div>
          <div className="text-[12px] text-slate-400">
            {isError ? (
              <span className="text-rose-500 font-medium">Query Error</span>
            ) : customers.length > 0 ? (
              `Showing ${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, totalCount)} of ${totalCount}`
            ) : (
              '0 records'
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] sm:text-[14px]">
            <thead className="border-b border-slate-100 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2.5">Customer Code</th>
                <th className="pb-2.5">Customer Name</th>
                <th className="pb-2.5 text-right">Sales Revenue</th>
                <th className="pb-2.5 text-center">Invoices</th>
                <th className="pb-2.5 text-right">Payments Recv</th>
                <th className="pb-2.5 text-right">Receivables</th>
                <th className="pb-2.5 text-right">Sales Share</th>
                <th className="pb-2.5">Last Transaction</th>
                <th className="pb-2.5 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Loading verified customer data from SAP Business One...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-rose-600 text-sm">
                    <AlertCircle size={28} className="mx-auto mb-2 text-rose-500" />
                    <p className="font-semibold text-base">Unable to retrieve customer data from SAP Service Layer</p>
                    <p className="text-xs text-rose-500 mt-1 max-w-md mx-auto">
                      {(error as any)?.message || 'Service Layer communication failed.'}
                    </p>
                    <button
                      onClick={() => refetch()}
                      className="mt-3 px-4 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-semibold cursor-pointer transition"
                    >
                      Retry Query
                    </button>
                  </td>
                </tr>
              ) : customers.length > 0 ? (
                customers.map((c) => {
                  const receivables = Number(c.outstanding_receivables || 0);
                  const hasReceivables = receivables > 0;
                  return (
                    <tr key={c.card_code} className="hover:bg-slate-50 transition">
                      <td className="py-3 font-mono text-[12.5px] font-bold text-blue-600">
                        <Link
                          to={`/customers?search=${encodeURIComponent(c.card_code)}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          {c.card_code}
                        </Link>
                      </td>
                      <td className="py-3 font-semibold text-slate-900">
                        <div>{c.card_name}</div>
                        {(c as any).phone && (c as any).phone !== '-' && (
                          <div className="text-[11.5px] text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                            <Phone size={10} />
                            <span>{(c as any).phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right font-bold text-slate-900">
                        {formatINR(c.sales_revenue)}
                      </td>
                      <td className="py-3 text-center font-medium text-slate-600">
                        {c.invoice_count}
                      </td>
                      <td className="py-3 text-right font-medium text-emerald-700">
                        {formatINR(c.payments_received)}
                      </td>
                      <td className={`py-3 text-right font-bold ${hasReceivables ? 'text-rose-600' : 'text-slate-400'}`}>
                        {formatINR(receivables)}
                      </td>
                      <td className="py-3 text-right font-medium text-slate-600">
                        {c.sales_share_pct ? `${c.sales_share_pct}%` : '0.0%'}
                      </td>
                      <td className="py-3 text-slate-500 text-[12px] whitespace-nowrap">
                        {c.last_transaction_date && c.last_transaction_date !== '-' ? (
                          <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            <span>{c.last_transaction_date}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <Link
                          to={`/customers?search=${encodeURIComponent(c.card_code)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                        >
                          <span>Profile</span>
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                    No customer records found matching the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Controls ──────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4 text-[13px]">
            <div className="text-slate-500">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft size={16} className="text-slate-600" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = page <= 3 ? i + 1 : page + i - 2;
                if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                if (pageNum <= 0) pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg font-semibold transition cursor-pointer ${
                      page === pageNum
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight size={16} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerReportPage;
