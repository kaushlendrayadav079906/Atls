import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  RefreshCw,
  Download,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Clock,
  ArrowUpDown,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { financeApi, type CustomerAnalysisResponse } from '../../api/finance';
import { commonApi } from '../../api/common';
import { ReportDateRangePicker } from '../../components/ReportDateRangePicker';
import {
  type QuickFilter,
  type AuthoritativeDateFilterState,
} from '../../utils/date';

export const CustomerAnalysisPage: React.FC = () => {
  // Authoritative Date Filter State
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [dateRange, setDateRange] = useState<string>('all_time');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Filter & Sorting States
  const [branch, setBranch] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('sales');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
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

  // Fetch verified SAP Customer Analysis from backend
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
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
  const items = data?.items || data?.customers || [];
  const totalCount = data?.total_count ?? (items.length || 0);
  const totalPages = data?.total_pages ?? (Math.ceil(totalCount / pageSize) || 1);
  const startRecord = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(page * pageSize, totalCount);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
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
      a.download = `SAP_Customer_Analysis_${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/finance"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft size={16} className="text-slate-600" />
          </Link>
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold text-slate-900">
              Customer Analysis
            </h1>
            <p className="atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">
              Customer sales revenue ranking, billing volume, collection status, and outstanding receivables (SAP OCRD & OINV).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Shared Date Range Picker */}
          <ReportDateRangePicker
            quickFilter={quickFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onRangeChange={handleDateRangeChange}
          />

          <Link
            to="/customers"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-2xs transition"
          >
            <Users size={15} />
            <span>Customer Directory</span>
          </Link>

          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-[13px] font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Customers Analyzed</span>
              <Users size={18} className="text-blue-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : (summary?.total_customers_analyzed ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Active billing accounts in SAP
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Total Sales Revenue</span>
              <TrendingUp size={18} className="text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : formatINR(summary?.total_sales_revenue ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Gross invoiced sales in selected period
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Total Receivables Balance</span>
              <Clock size={18} className="text-rose-500" />
            </div>
            <h3 className="text-2xl font-black text-rose-600 mt-2">
              {isLoading ? '...' : formatINR(summary?.total_outstanding_receivables ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Live outstanding A/R balances
          </div>
        </div>
      </div>

      {/* Filter & Action Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by customer code or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9.5 pr-4 py-2 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Sort By Field */}
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
          </select>
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

        {/* Reset Filter Button */}
        {(search || branch || sortBy !== 'sales' || quickFilter !== '') && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-[13px] font-semibold transition cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        )}

        {/* Export CSV Button */}
        <button
          onClick={handleExportCSV}
          disabled={isExporting || totalCount === 0}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
        >
          <Download size={15} />
          <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>Failed to load customer analysis from SAP: {(error as any)?.message || 'Service Layer error'}</span>
          </div>
          <button onClick={() => refetch()} className="font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Customer Analysis Table */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Users size={20} className="text-blue-600" />
            <h2 className="atlas-card-title text-[16px] font-bold text-slate-900">
              Customer Sales & Receivables {isError ? '(Unavailable)' : `(${totalCount})`}
            </h2>
          </div>
          <div className="text-[12px] text-slate-400">
            Showing {startRecord}–{endRecord} of {totalCount}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] sm:text-[14px]">
            <thead className="border-b border-slate-100 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2.5">Customer Code</th>
                <th className="pb-2.5">Customer Name</th>
                <th
                  className="pb-2.5 text-center cursor-pointer hover:text-slate-800"
                  onClick={() => handleSort('invoices')}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Invoices</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th
                  className="pb-2.5 text-right cursor-pointer hover:text-slate-800"
                  onClick={() => handleSort('sales')}
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span>Sales Revenue</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="pb-2.5 text-right">Payments Received</th>
                <th
                  className="pb-2.5 text-right cursor-pointer hover:text-slate-800"
                  onClick={() => handleSort('receivables')}
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span>A/R Balance</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="pb-2.5 text-right">Last Trans Date</th>
                <th className="pb-2.5 pl-3 w-28 text-right">Revenue Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Analyzing customer transactions from SAP Business One...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((cust) => (
                  <tr key={cust.card_code} className="hover:bg-slate-50 transition">
                    <td className="py-3 font-mono text-[12.5px] font-semibold text-slate-600">
                      {cust.card_code}
                    </td>
                    <td className="py-3 font-semibold text-slate-900">{cust.card_name}</td>
                    <td className="py-3 text-center text-slate-600 font-medium">
                      {cust.invoice_count}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900">
                      {formatINR(cust.sales_revenue)}
                    </td>
                    <td className="py-3 text-right font-medium text-emerald-700">
                      {formatINR(cust.payments_received)}
                    </td>
                    <td className="py-3 text-right font-bold text-rose-600">
                      {formatINR(cust.outstanding_receivables)}
                    </td>
                    <td className="py-3 text-right text-slate-500 text-[12px] whitespace-nowrap">
                      {cust.last_transaction_date || '-'}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[12px] font-semibold text-slate-600 w-11">
                          {cust.sales_share_pct}%
                        </span>
                        <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, cust.sales_share_pct)}%` }}
                            className="bg-blue-600 h-full rounded-full"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    No customer records found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer Controls */}
        {!isError && totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 mt-4 gap-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-3 text-slate-500">
              <span>
                Showing <strong className="text-slate-700 font-semibold">{startRecord}–{endRecord}</strong> of{' '}
                <strong className="text-slate-700 font-semibold">{totalCount}</strong> customers
              </span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-slate-400">Per page:</span>
                <select
                  id="page-size-select"
                  data-testid="page-size-select"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[12px] text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[12.5px] mr-1">
                Page <strong className="text-slate-700 font-semibold">{page}</strong> of <strong className="text-slate-700 font-semibold">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1">
                {/* Previous Button */}
                <button
                  id="prev-page-btn"
                  data-testid="prev-page-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  title="Previous Page"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline text-[12px]">Previous</span>
                </button>

                {/* Page Number Buttons */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((pageNum) => {
                    if (totalPages <= 7) return true;
                    if (pageNum === 1 || pageNum === totalPages) return true;
                    if (Math.abs(pageNum - page) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | string)[]>((acc, pageNum, idx, arr) => {
                    if (idx > 0 && (pageNum as number) - (arr[idx - 1] as number) > 1) {
                      acc.push(`ellipsis-${idx}`);
                    }
                    acc.push(pageNum);
                    return acc;
                  }, [])
                  .map((item) => {
                    if (typeof item === 'string') {
                      return (
                        <span key={item} className="px-1 text-slate-400 select-none">
                          …
                        </span>
                      );
                    }
                    const pageNum = item as number;
                    const isActive = page === pageNum;
                    return (
                      <button
                        key={pageNum}
                        id={`page-btn-${pageNum}`}
                        data-testid={`page-btn-${pageNum}`}
                        onClick={() => setPage(pageNum)}
                        disabled={isLoading}
                        className={`w-8 h-8 rounded-lg font-semibold text-[13px] transition cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-2xs font-bold'
                            : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                {/* Next Button */}
                <button
                  id="next-page-btn"
                  data-testid="next-page-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  title="Next Page"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium cursor-pointer"
                >
                  <span className="hidden sm:inline text-[12px]">Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerAnalysisPage;
