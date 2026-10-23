import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  ArrowLeft,
  RefreshCw,
  ShoppingCart,
  Download,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { financeApi, type PurchaseInvoicesResponse } from '../../api/finance';
import { commonApi } from '../../api/common';
import { ReportDateRangePicker } from '../../components/ReportDateRangePicker';
import {
  type QuickFilter,
  type AuthoritativeDateFilterState,
} from '../../utils/date';

export const PurchaseInvoicesPage: React.FC = () => {
  // Authoritative Date Filter State
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [dateRange, setDateRange] = useState<string>('all_time');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Applied Filters
  const [branch, setBranch] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
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

  // Fetch Purchase Invoices from SAP via backend
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PurchaseInvoicesResponse>({
    queryKey: ['purchase-invoices', dateRange, branch, dateFrom, dateTo, status, search, page, pageSize],
    queryFn: async () => {
      return await financeApi.getPurchaseInvoices({
        range: dateRange,
        branch: branch || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        status: status || undefined,
        search: search.trim() || undefined,
        page,
        page_size: pageSize,
      });
    },
    staleTime: 30_000,
  });

  const summary = data?.summary || data?.kpis;
  const items = data?.items || data?.invoices || data?.purchase_invoices || [];
  const totalCount = data?.total_count ?? (items.length || 0);
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleResetFilters = () => {
    setQuickFilter('');
    setDateRange('all_time');
    setDateFrom('');
    setDateTo('');
    setBranch('');
    setStatus('');
    setSearch('');
    setPage(1);
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const blob = await financeApi.exportFinanceData({
        module: 'purchase_invoices',
        range: dateRange,
        branch: branch || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
        search: search.trim() || undefined,
        status: status || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAP_Purchase_Invoices_${new Date().toISOString().substring(0, 10)}.csv`;
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
              Purchase Invoices
            </h1>
            <p className="atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">
              Verified A/P Vendor invoices and balances directly from SAP Business One (OPCH).
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
            to="/purchase-orders"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-2xs transition"
          >
            <ShoppingCart size={15} />
            <span>Purchase Orders</span>
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Total Invoices</span>
              <FileSpreadsheet size={18} className="text-blue-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : (summary?.total_invoices ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Status: {summary?.status_counts?.paid || 0} Paid, {summary?.status_counts?.unpaid || 0} Unpaid
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Total Purchases</span>
              <ShoppingCart size={18} className="text-indigo-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : formatINR(summary?.total_purchases ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Cumulative gross A/P billings
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Paid to Date</span>
              <CheckCircle2 size={18} className="text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {isLoading ? '...' : formatINR(summary?.total_paid ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Disbursed vendor payments
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 text-[12px] font-bold uppercase tracking-wider">
              <span>Outstanding Balance</span>
              <Clock size={18} className="text-rose-500" />
            </div>
            <h3 className="text-2xl font-black text-rose-600 mt-2">
              {isLoading ? '...' : formatINR(summary?.total_outstanding_balance ?? 0)}
            </h3>
          </div>
          <div className="text-[12px] text-slate-400 mt-2">
            Remaining payables liability
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
            placeholder="Search by invoice #, supplier code, or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9.5 pr-4 py-2 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Status Filter */}
        <div className="w-[160px]">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13.5px] text-slate-700 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Cancelled">Cancelled</option>
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
        {(search || status || branch || quickFilter !== '') && (
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
            <span>Failed to load purchase invoices from SAP: {(error as any)?.message || 'Service Layer error'}</span>
          </div>
          <button onClick={() => refetch()} className="font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Purchase Invoices Table */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={20} className="text-amber-500" />
            <h2 className="atlas-card-title text-[16px] font-bold text-slate-900">
              SAP A/P Purchase Invoices ({totalCount})
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
                <th className="pb-2.5">Invoice #</th>
                <th className="pb-2.5">Supplier</th>
                <th className="pb-2.5">Doc Date</th>
                <th className="pb-2.5">Due Date</th>
                <th className="pb-2.5 text-right">Total Amount</th>
                <th className="pb-2.5 text-right">Paid to Date</th>
                <th className="pb-2.5 text-right">Balance Due</th>
                <th className="pb-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Loading verified purchase invoices from SAP Business One...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((inv) => {
                  const isPaid = inv.payment_status === 'Paid';
                  const isPartial = inv.payment_status === 'Partially Paid';
                  const isCancelled = inv.payment_status === 'Cancelled';
                  return (
                    <tr key={inv.doc_entry} className="hover:bg-slate-50 transition">
                      <td className="py-3 font-mono text-[12.5px] font-bold text-blue-600">
                        PI-{inv.doc_num || inv.doc_entry}
                      </td>
                      <td className="py-3 font-semibold text-slate-900">
                        <div>{inv.card_name}</div>
                        <div className="text-[11.5px] font-mono text-slate-400 font-normal">
                          {inv.card_code}
                        </div>
                      </td>
                      <td className="py-3 text-slate-600 text-[12.5px] whitespace-nowrap">
                        {inv.doc_date || '-'}
                      </td>
                      <td className="py-3 text-slate-500 text-[12.5px] whitespace-nowrap">
                        {inv.doc_due_date || '-'}
                      </td>
                      <td className="py-3 text-right font-bold text-slate-900">
                        {formatINR(inv.doc_total)}
                      </td>
                      <td className="py-3 text-right font-medium text-emerald-700">
                        {formatINR(inv.paid_to_date)}
                      </td>
                      <td className="py-3 text-right font-bold text-rose-600">
                        {formatINR(inv.balance_due)}
                      </td>
                      <td className="py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${
                            isCancelled
                              ? 'bg-slate-100 text-slate-600'
                              : isPaid
                              ? 'bg-emerald-50 text-emerald-700'
                              : isPartial
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {inv.payment_status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    No purchase invoices found matching the selected filters.
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

export default PurchaseInvoicesPage;
