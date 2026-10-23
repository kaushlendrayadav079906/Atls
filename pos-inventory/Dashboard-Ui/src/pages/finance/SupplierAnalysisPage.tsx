import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  ArrowLeft,
  RefreshCw,
  Download,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ShoppingCart,
  Clock,
  ArrowUpDown,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { financeApi, type SupplierAnalysisResponse } from '../../api/finance';
import { commonApi } from '../../api/common';
import { ReportDateRangePicker } from '../../components/ReportDateRangePicker';
import {
  type QuickFilter,
  type AuthoritativeDateFilterState,
} from '../../utils/date';

export const SupplierAnalysisPage: React.FC = () => {
  // Authoritative Date Filter State
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [dateRange, setDateRange] = useState<string>('all_time');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Filter & Sorting States
  const [branch, setBranch] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('spend');
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

  // Fetch verified SAP Supplier Analysis from backend
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SupplierAnalysisResponse>({
    queryKey: ['supplier-analysis', dateRange, branch, dateFrom, dateTo, search, sortBy, sortOrder, page, pageSize],
    queryFn: async () => {
      return await financeApi.getSupplierAnalysis({
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

  const summary = data?.summary;
  const items = data?.items || [];
  const totalCount = data?.total_count || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleResetFilters = () => {
    setQuickFilter('');
    setDateRange('all_time');
    setDateFrom('');
    setDateTo('');
    setBranch('');
    setSearch('');
    setSortBy('spend');
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
        module: 'supplier_analysis',
        range: dateRange,
        branch: branch || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        search: search.trim() || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAP_Supplier_Analysis_${new Date().toISOString().substring(0, 10)}.csv`;
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
              Supplier Analysis
            </h1>
            <p className="atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">
              Vendor procurement spend, invoice volume, disbursement history, and outstanding payables liabilities (SAP OCRD & OPCH).
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
            to="/finance/purchase-invoices"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-2xs transition"
          >
            <ShoppingCart size={15} />
            <span>Purchase Invoices</span>
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
              <span>Vendors Analyzed</span>
              <Truck size={18} className="text-amber-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : (summary?.total_suppliers_analyzed ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Active vendor accounts in SAP
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Total Purchase Spend</span>
              <ShoppingCart size={18} className="text-indigo-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : formatINR(summary?.total_purchase_spend ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Gross procurement spend in period
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Outstanding Payables</span>
              <Clock size={18} className="text-rose-500" />
            </div>
            <h3 className="text-2xl font-black text-rose-600 mt-2">
              {isLoading ? '...' : formatINR(summary?.total_outstanding_payables ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Live outstanding A/P vendor balances
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
            placeholder="Search by supplier code or name..."
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
            <option value="spend">Sort by Spend</option>
            <option value="payables">Sort by Payables</option>
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
        {(search || branch || sortBy !== 'spend' || quickFilter !== '') && (
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
            <span>Failed to load supplier analysis from SAP: {(error as any)?.message || 'Service Layer error'}</span>
          </div>
          <button onClick={() => refetch()} className="font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Supplier Analysis Table */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Truck size={20} className="text-amber-500" />
            <h2 className="atlas-card-title text-[16px] font-bold text-slate-900">
              Supplier Spend & Payables Liabilities ({totalCount})
            </h2>
          </div>
          <div className="text-[12px] text-slate-400">
            Showing {items.length > 0 ? (page - 1) * pageSize + 1 : 0} -{' '}
            {Math.min(page * pageSize, totalCount)} of {totalCount}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] sm:text-[14px]">
            <thead className="border-b border-slate-100 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2.5">Supplier Code</th>
                <th className="pb-2.5">Supplier Name</th>
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
                  onClick={() => handleSort('spend')}
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span>Purchase Spend</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="pb-2.5 text-right">Disbursements</th>
                <th
                  className="pb-2.5 text-right cursor-pointer hover:text-slate-800"
                  onClick={() => handleSort('payables')}
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span>A/P Balance</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="pb-2.5 text-right">Last Purchase Date</th>
                <th className="pb-2.5 pl-3 w-28 text-right">Spend Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Analyzing supplier purchasing from SAP Business One...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((sup) => (
                  <tr key={sup.card_code} className="hover:bg-slate-50 transition">
                    <td className="py-3 font-mono text-[12.5px] font-semibold text-slate-600">
                      {sup.card_code}
                    </td>
                    <td className="py-3 font-semibold text-slate-900">{sup.card_name}</td>
                    <td className="py-3 text-center text-slate-600 font-medium">
                      {sup.invoice_count}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900">
                      {formatINR(sup.purchase_spend)}
                    </td>
                    <td className="py-3 text-right font-medium text-emerald-700">
                      {formatINR(sup.disbursements)}
                    </td>
                    <td className="py-3 text-right font-bold text-rose-600">
                      {formatINR(sup.outstanding_payables)}
                    </td>
                    <td className="py-3 text-right text-slate-500 text-[12px] whitespace-nowrap">
                      {sup.last_purchase_date || '-'}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[12px] font-semibold text-slate-600 w-11">
                          {sup.spend_share_pct}%
                        </span>
                        <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, sup.spend_share_pct)}%` }}
                            className="bg-amber-500 h-full rounded-full"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    No supplier records found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
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

export default SupplierAnalysisPage;
