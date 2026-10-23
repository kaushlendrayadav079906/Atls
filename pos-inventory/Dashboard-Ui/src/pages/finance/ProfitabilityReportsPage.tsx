import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Percent,
  Database,
  Download,
  AlertCircle,
  Info,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import { useQuery } from '@tanstack/react-query';
import { financeApi, type ProfitabilityResponse } from '../../api/finance';
import { commonApi } from '../../api/common';
import { ReportDateRangePicker } from '../../components/ReportDateRangePicker';
import {
  type QuickFilter,
  type AuthoritativeDateFilterState,
  getDateScopeLabel,
} from '../../utils/date';

export const ProfitabilityReportsPage: React.FC = () => {
  // Authoritative Date Filter State
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [dateRange, setDateRange] = useState<string>('all_time');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Filter States
  const [branch, setBranch] = useState<string>('');
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
  };

  // Fetch verified SAP Profitability from backend
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ProfitabilityResponse>({
    queryKey: ['profitability-reports', dateRange, branch, dateFrom, dateTo],
    queryFn: async () => {
      return await financeApi.getProfitabilityReport({
        range: dateRange,
        branch: branch || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
      });
    },
    staleTime: 60_000,
  });

  const summary = data?.summary || data?.kpis;
  const breakdown = data?.monthly_breakdown || data?.breakdown || [];
  const rangeLabel = getDateScopeLabel(quickFilter, dateFrom, dateTo);

  const formatINR = (val?: number) => {
    if (val === undefined || val === null) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const formatLakh = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(0)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
    return `₹${val}`;
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const blob = await financeApi.exportFinanceData({
        module: 'profitability',
        range: dateRange,
        branch: branch || undefined,
        from_date: dateFrom || undefined,
        to_date: dateTo || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAP_Profitability_Report_${new Date().toISOString().substring(0, 10)}.csv`;
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
              Profitability Reports
            </h1>
            <p className="atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">
              Net sales revenue, procurement cost basis, gross profit, and operating margin analytics from SAP Business One.
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

          {/* Branch Filter */}
          <div className="w-[180px]">
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
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

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={isExporting || breakdown.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download size={15} />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>

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

      {/* Accounting Standards Disclosure Note */}
      <div className="rounded-2xl border border-blue-200/90 bg-blue-50/70 p-4 shadow-3xs flex items-start gap-3">
        <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-[13px] text-blue-900 leading-relaxed">
          <span className="font-bold">Financial Accounting Basis: </span>
          {summary?.accounting_note ||
            'Operating Gross Profit is calculated from authorized SAP A/R Sales Invoices (OINV) less verified A/P Purchase Invoices (OPCH). Figures reflect transaction accounting basis for the selected period.'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Sales Revenue */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={22} />
            </div>
            <span className="text-[12px] font-bold text-slate-400">
              {summary?.sales_invoice_count ?? 0} Invoices
            </span>
          </div>
          <div className="mt-3.5">
            <div className="text-[13.5px] font-semibold text-slate-500">Net Sales Revenue</div>
            <div className="text-[25px] sm:text-[27px] font-black text-slate-900 mt-0.5">
              {isLoading ? '...' : formatINR(summary?.net_sales_revenue ?? 0)}
            </div>
            <div className="mt-1 text-[12px] text-slate-400">{rangeLabel}</div>
          </div>
        </div>

        {/* 2. Procurement Cost Basis */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Database size={22} />
            </div>
            <span className="text-[12px] font-bold text-slate-400">
              {summary?.purchase_invoice_count ?? 0} Invoices
            </span>
          </div>
          <div className="mt-3.5">
            <div className="text-[13.5px] font-semibold text-slate-500">Procurement / Cost Basis</div>
            <div className="text-[25px] sm:text-[27px] font-black text-slate-900 mt-0.5">
              {isLoading ? '...' : formatINR(summary?.procurement_cogs_basis ?? 0)}
            </div>
            <div className="mt-1 text-[12px] text-slate-400">Verified A/P purchases</div>
          </div>
        </div>

        {/* 3. Gross Profit */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <BarChart2 size={22} />
            </div>
            <span
              className={`text-[12px] font-bold ${
                (summary?.gross_profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {(summary?.gross_profit ?? 0) >= 0 ? 'Surplus' : 'Deficit'}
            </span>
          </div>
          <div className="mt-3.5">
            <div className="text-[13.5px] font-semibold text-slate-500">Gross Profit</div>
            <div
              className={`text-[25px] sm:text-[27px] font-black mt-0.5 ${
                (summary?.gross_profit ?? 0) >= 0 ? 'text-slate-900' : 'text-rose-600'
              }`}
            >
              {isLoading ? '...' : formatINR(summary?.gross_profit ?? 0)}
            </div>
            <div className="mt-1 text-[12px] text-slate-400">Net Sales - Cost Basis</div>
          </div>
        </div>

        {/* 4. Gross Margin % */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Percent size={22} />
            </div>
            <span className="text-[12px] font-bold text-slate-400">Margin Ratio</span>
          </div>
          <div className="mt-3.5">
            <div className="text-[13.5px] font-semibold text-slate-500">Gross Margin</div>
            <div className="text-[25px] sm:text-[27px] font-black text-slate-900 mt-0.5">
              {isLoading ? '...' : `${summary?.gross_margin_pct ?? 0}%`}
            </div>
            <div className="mt-1 text-[12px] text-slate-400">Profit / Revenue percentage</div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>Failed to load profitability metrics from SAP: {(error as any)?.message || 'Service Layer error'}</span>
          </div>
          <button onClick={() => refetch()} className="font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Profitability Trend Chart */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <BarChart2 size={20} className="text-indigo-600" />
            <h2 className="atlas-card-title text-[16px] font-bold text-slate-900">
              Monthly Revenue, Cost, and Gross Profit Trend
            </h2>
          </div>
        </div>

        <div className="h-72 w-full flex items-center justify-center">
          {breakdown.length === 0 ? (
            <div className="text-center text-slate-400 text-[13px]">
              {isLoading ? 'Calculating SAP profitability trends...' : 'No transaction records found for the selected period.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown} margin={{ top: 15, right: 15, left: 10, bottom: 5 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="period" stroke="#94A3B8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} tickFormatter={formatLakh} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    formatINR(Number(val)),
                    name === 'revenue'
                      ? 'Revenue'
                      : name === 'cost'
                      ? 'Cost Basis'
                      : 'Gross Profit',
                  ]}
                  contentStyle={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    borderColor: '#E2E8F0',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={20} name="Revenue" />
                <Bar dataKey="cost" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={20} name="Cost Basis" />
                <Bar dataKey="gross_profit" fill="#0284C7" radius={[4, 4, 0, 0]} maxBarSize={20} name="Gross Profit" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2.5 mb-4 pb-2.5 border-b border-slate-100">
          <FileSpreadsheet size={20} className="text-teal-600" />
          <h2 className="atlas-card-title text-[16px] font-bold text-slate-900">
            Monthly Profitability Breakdown
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] sm:text-[14px]">
            <thead className="border-b border-slate-100 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2.5">Period</th>
                <th className="pb-2.5 text-right">Net Sales Revenue</th>
                <th className="pb-2.5 text-right">Procurement Cost Basis</th>
                <th className="pb-2.5 text-right">Gross Profit</th>
                <th className="pb-2.5 text-right">Gross Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Compiling profitability metrics from SAP Business One...
                  </td>
                </tr>
              ) : breakdown.length > 0 ? (
                breakdown.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3 font-semibold text-slate-900">{row.period}</td>
                    <td className="py-3 text-right font-medium text-emerald-700">
                      {formatINR(row.revenue)}
                    </td>
                    <td className="py-3 text-right font-medium text-purple-700">
                      {formatINR(row.cost)}
                    </td>
                    <td
                      className={`py-3 text-right font-bold ${
                        row.gross_profit >= 0 ? 'text-slate-900' : 'text-rose-600'
                      }`}
                    >
                      {formatINR(row.gross_profit)}
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-700">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[12px] ${
                          row.margin_pct >= 20
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.margin_pct >= 0
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {row.margin_pct}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                    No monthly profitability data recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProfitabilityReportsPage;
