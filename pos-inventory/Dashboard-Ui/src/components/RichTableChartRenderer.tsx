import React, { useState } from 'react';
import {
  Table as TableIcon,
  BarChart3,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Calendar,
  Search,
  LayoutGrid,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Workflow,
  Sparkles,
  TrendingUp,
  LayoutDashboard,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import type {
  StructuredTableResponse,
  TableColumn,
  TableColumnType,
  TableChartConfig,
  TableChartSeriesItem,
  KPICardData,
} from '../types/ai';
import { BusinessFlowchartRenderer } from './BusinessFlowchartRenderer';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

export const formatCellValue = (val: any, type: TableColumnType): { text: string; className?: string } => {
  if (val === null || val === undefined || val === '') {
    return { text: '-' };
  }

  switch (type) {
    case 'currency': {
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num)) return { text: String(val) };
      return { text: inrFormatter.format(num) };
    }
    case 'number': {
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num)) return { text: String(val) };
      return { text: numberFormatter.format(num) };
    }
    case 'percentage': {
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num)) return { text: `${val}%` };
      return { text: `${num >= 0 ? '' : ''}${numberFormatter.format(num)}%` };
    }
    case 'delta': {
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(num)) return { text: String(val) };
      const formatted = numberFormatter.format(Math.abs(num));
      if (num > 0) {
        return { text: `+${formatted}`, className: 'text-emerald-600 font-semibold' };
      } else if (num < 0) {
        return { text: `-${formatted}`, className: 'text-rose-600 font-semibold' };
      }
      return { text: `0.00`, className: 'text-slate-500' };
    }
    case 'date': {
      if (typeof val === 'string' && val.includes('T')) {
        return { text: val.split('T')[0] };
      }
      return { text: String(val) };
    }
    case 'string':
    default:
      return { text: String(val) };
  }
};

const CHART_PALETTE = ['#4f46e5', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

interface RichTableChartRendererProps {
  data: StructuredTableResponse;
  className?: string;
}

export const RichTableChartRenderer: React.FC<RichTableChartRendererProps> = ({
  data,
  className = '',
}) => {
  if (!data) return null;

  const {
    title,
    summary,
    columns = [],
    rows = [],
    filters,
    chart,
    meta,
    error,
  } = data;

  const hasChartConfig = Boolean(
    chart &&
    chart.type &&
    chart.xKey &&
    Array.isArray(chart.series) &&
    chart.series.length > 0 &&
    rows.length > 0
  );

  const getChartTitle = () => {
    if (chart?.title) return chart.title;
    if (chart?.series && chart.series.length > 0) {
      const s0 = chart.series[0];
      const key = typeof s0 === 'string' ? s0 : s0.dataKey;
      const col = columns.find((c) => c.key === key);
      return col?.label || (typeof s0 === 'object' && s0.name ? s0.name : key);
    }
    return 'Analytical Visual';
  };

  const hasFlowchart = Boolean(
    data.flowchart &&
    Array.isArray(data.flowchart.nodes) &&
    data.flowchart.nodes.length > 0
  );

  const hasOverview = Boolean(
    summary ||
    (data.insights && data.insights.length > 0) ||
    (data.kpis && data.kpis.length > 0) ||
    rows.length > 0
  );

  // Tab state: 'overview' | 'chart' | 'results' | 'flowchart' | 'both'
  const determineInitialTab = (): 'overview' | 'chart' | 'results' | 'flowchart' | 'both' => {
    if (chart?.defaultView) return chart.defaultView;
    if (data.flowchart && (!rows || rows.length === 0)) return 'flowchart';
    if (hasChartConfig && rows.length > 0) return 'both';
    if (hasFlowchart && (!rows || rows.length === 0)) return 'flowchart';
    return 'results';
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'chart' | 'results' | 'flowchart' | 'both'>(determineInitialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting & Pagination State
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;
  const [copied, setCopied] = useState<boolean>(false);

  const filteredRows = searchQuery.trim()
    ? rows.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : rows;

  const sortedRows = React.useMemo(() => {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const numA = typeof valA === 'number' ? valA : parseFloat(valA);
      const numB = typeof valB === 'number' ? valB : parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredRows, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (colKey: string) => {
    if (sortKey === colKey) {
      if (sortOrder === 'desc') setSortOrder('asc');
      else {
        setSortKey(null);
        setSortOrder('desc');
      }
    } else {
      setSortKey(colKey);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleCopyCsv = () => {
    try {
      const headerLine = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
      const rowLines = sortedRows.map(r => columns.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','));
      const csv = [headerLine, ...rowLines].join('\n');
      navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy CSV', err);
    }
  };

  // Error State Rendering
  if (error || meta?.error) {
    const errorMsg = error || meta?.error || 'An error occurred while generating this report.';
    return (
      <div className={`rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-rose-900 shadow-2xs mt-2 ${className}`}>
        <div className="flex items-center gap-2 font-bold text-[11px] text-rose-800 mb-1">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{title || 'Report Query Error'}</span>
        </div>
        <p className="text-[10px] text-rose-700 leading-relaxed">{errorMsg}</p>
      </div>
    );
  }

  // Applied Filter Items
  const filterEntries: Array<{ label: string; value: string }> = [];
  if (filters) {
    if (filters.period) {
      filterEntries.push({ label: 'Date Period', value: filters.period });
    }
    if (filters.dateFrom && filters.dateTo) {
      filterEntries.push({ label: 'Date Range', value: `${filters.dateFrom} to ${filters.dateTo}` });
    }
    if (filters.branch) {
      filterEntries.push({ label: 'Branch / Site', value: filters.branch });
    }
    if (filters.groupBy && filters.groupBy.length > 0) {
      filterEntries.push({
        label: 'Grouping',
        value: filters.groupBy.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(', '),
      });
    }
    if (filters.additional && typeof filters.additional === 'object') {
      Object.entries(filters.additional).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          filterEntries.push({ label: k.charAt(0).toUpperCase() + k.slice(1), value: String(v) });
        }
      });
    }
  }

  // Auto-calculated KPIs if data.kpis not provided
  const derivedKpis: KPICardData[] = React.useMemo(() => {
    if (data.kpis && Array.isArray(data.kpis) && data.kpis.length > 0) {
      return data.kpis;
    }

    const kpiList: KPICardData[] = [];
    if (rows.length > 0) {
      // 1. Total Records
      kpiList.push({
        label: 'Total Records',
        value: numberFormatter.format(rows.length),
        subtext: meta?.is_partial ? 'Capped at query limit' : 'Full dataset analyzed'
      });

      // 2. Look for primary currency column
      const currCol = columns.find(c => c.type === 'currency');
      if (currCol) {
        const total = rows.reduce((acc, r) => acc + (parseFloat(r[currCol.key]) || 0), 0);
        kpiList.push({
          label: `Total ${currCol.label}`,
          value: inrFormatter.format(total),
          subtext: `Sum of ${rows.length} entries`
        });
      }

      // 3. Look for primary numeric column
      const numCol = columns.find(c => c.type === 'number' && c.key !== 'id');
      if (numCol) {
        const totalNum = rows.reduce((acc, r) => acc + (parseFloat(r[numCol.key]) || 0), 0);
        kpiList.push({
          label: `Total ${numCol.label}`,
          value: numberFormatter.format(totalNum),
          subtext: `Aggregate ${numCol.label.toLowerCase()}`
        });
      }

      // 4. Look for percentage or delta column
      const pctCol = columns.find(c => c.type === 'percentage' || c.type === 'delta');
      if (pctCol && rows.length > 0) {
        const val = parseFloat(rows[0][pctCol.key]) || 0;
        kpiList.push({
          label: pctCol.label,
          value: `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`,
          isPositive: val >= 0,
          subtext: 'Current benchmark'
        });
      }
    }
    return kpiList;
  }, [data.kpis, rows, columns, meta]);

  const renderKpiSection = () => {
    if (!derivedKpis || derivedKpis.length === 0) return null;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {derivedKpis.map((kpi, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-3xs hover:border-indigo-200 transition-all"
          >
            <div className="text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              {kpi.label}
            </div>
            <div className="text-[14px] font-bold text-slate-900 tracking-tight mt-0.5">
              {kpi.value}
            </div>
            {kpi.subtext && (
              <div className={`text-[8.5px] mt-0.5 truncate ${
                kpi.isPositive === true ? 'text-emerald-600 font-semibold' :
                kpi.isPositive === false ? 'text-rose-600 font-semibold' :
                'text-slate-400'
              }`}>
                {kpi.subtext}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderInsightsSection = () => {
    if (!data.insights || data.insights.length === 0) return null;
    return (
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 shadow-3xs">
        <div className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <TrendingUp size={11} className="text-indigo-600" />
          <span>Business Insights & Evidence</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {data.insights.map((ins, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[10px] text-slate-700 leading-relaxed bg-white rounded-lg p-2 border border-slate-100 shadow-3xs">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-[8.5px] font-bold mt-0.5">
                {idx + 1}
              </span>
              <span className="flex-1">{ins}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOverview = () => (
    <div className="flex flex-col gap-3 my-1">
      {/* 1. Direct Summary Banner */}
      {summary && (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-white p-3 text-[10.5px] text-slate-700 leading-relaxed shadow-3xs">
          <div className="flex items-center gap-1.5 font-bold text-indigo-950 mb-1 text-[11px]">
            <Sparkles size={12} className="text-indigo-600" />
            <span>Executive Business Summary</span>
          </div>
          <p>{summary}</p>
        </div>
      )}

      {/* 2. KPI Metrics Grid */}
      {renderKpiSection()}

      {/* 3. Business Insights List */}
      {renderInsightsSection()}

      {/* 4. Verified Process Flowchart Callout if present */}
      {hasFlowchart && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-purple-50/70 to-indigo-50/70 border border-purple-200/80 p-2.5 text-purple-900">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-3xs">
              <Workflow size={12} />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold truncate">
                {data.flowchart?.title || 'Verified Process Flowchart Available'}
              </div>
              <div className="text-[9px] text-purple-700/80 truncate">
                {data.flowchart?.nodes?.length || 0} process steps mapped to SAP backend workflows
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('flowchart')}
            className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-white hover:bg-purple-50 border border-purple-200 px-2.5 py-1 text-[9.5px] font-bold text-purple-700 shadow-3xs transition cursor-pointer"
          >
            <span>View Flowchart</span>
            <ChevronRight size={11} />
          </button>
        </div>
      )}
    </div>
  );

  const renderTable = (tableRows: Array<Record<string, any>>) => (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs my-1">
      <div className="overflow-x-auto max-h-[320px] scrollbar-thin">
        <table className="w-full text-left text-[10px] text-slate-700 whitespace-nowrap border-collapse">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200/80 text-[9px] font-bold text-slate-500 uppercase tracking-wider z-10">
            <tr>
              <th className="px-2.5 py-2 text-center w-8 text-slate-400 border-r border-slate-100 font-mono">
                #
              </th>
              {columns.map((col) => {
                const isNumeric = ['currency', 'number', 'percentage', 'delta'].includes(col.type);
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-2 cursor-pointer hover:bg-indigo-50/60 transition-colors select-none ${
                      isNumeric ? 'text-right' : 'text-left'
                    }`}
                    title={`Click to sort by ${col.label}`}
                  >
                    <div className={`inline-flex items-center gap-1 ${isNumeric ? 'justify-end w-full' : ''}`}>
                      <span>{col.label}</span>
                      {isSorted ? (
                        sortOrder === 'asc' ? (
                          <ChevronUp size={11} className="text-indigo-600 shrink-0" />
                        ) : (
                          <ChevronDown size={11} className="text-indigo-600 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="text-slate-300 opacity-60 hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {tableRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-4 text-center text-slate-400 text-[10px]">
                  No matching records found.
                </td>
              </tr>
            ) : (
              tableRows.map((row, rowIdx) => {
                const globalIndex = (currentPage - 1) * pageSize + rowIdx + 1;
                return (
                  <tr
                    key={rowIdx}
                    className="hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-2.5 py-1.5 text-center text-slate-400 font-mono text-[9px] border-r border-slate-100 bg-slate-50/30">
                      {globalIndex}
                    </td>
                    {columns.map((col) => {
                      const cellVal = row[col.key];
                      const { text, className: cellClass } = formatCellValue(cellVal, col.type);
                      const isNumeric = ['currency', 'number', 'percentage', 'delta'].includes(col.type);

                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-1.5 ${
                            isNumeric ? 'text-right font-medium tabular-nums' : 'text-left'
                          } ${cellClass || ''}`}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {sortedRows.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50/70 text-[9.5px] text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Showing {sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length} entries
            </span>
            {sortKey && (
              <span className="text-[9px] text-indigo-600 font-medium">
                (sorted by {columns.find(c => c.key === sortKey)?.label || sortKey} {sortOrder === 'asc' ? '▲' : '▼'})
              </span>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-3xs inline-flex items-center gap-0.5"
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft size={11} />
                <span>Prev</span>
              </button>
              <span className="font-semibold text-slate-700 px-1">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-3xs inline-flex items-center gap-0.5"
                title="Next page"
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight size={11} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`rounded-2xl border border-indigo-100/90 bg-white shadow-2xs overflow-hidden mt-2.5 transition-all text-slate-800 ${className}`}>
      {/* ── 1. Header with Title & Summary ───────────────────────────────── */}
      <div className="border-b border-indigo-50/80 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-purple-50/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
              <FileSpreadsheet size={13} />
            </div>
            <h4 className="text-[12px] font-bold text-slate-900 tracking-tight truncate">
              {title || 'Analytical Report'}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {rows.length > 0 && (
              <button
                type="button"
                onClick={handleCopyCsv}
                className="inline-flex items-center gap-1 rounded-full bg-white/90 hover:bg-white border border-indigo-200/80 px-2 py-0.5 text-[8.5px] font-semibold text-indigo-700 shadow-3xs transition cursor-pointer"
                title="Copy table data as CSV"
              >
                {copied ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} className="text-indigo-500" />}
                <span>{copied ? 'Copied' : 'Export'}</span>
              </button>
            )}
            {rows.length > 0 && (
              <span className="rounded-full bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 text-[8.5px] font-bold text-indigo-700 shrink-0">
                {rows.length} {rows.length === 1 ? 'row' : 'rows'}
              </span>
            )}
          </div>
        </div>

        {summary && (
          <p className="mt-1 text-[10.5px] text-slate-600 leading-relaxed">
            {summary}
          </p>
        )}
      </div>

      {/* ── 2. Tab Navigation & Applied Filters ───────────────────────────── */}
      <div className="p-3 bg-white">
        {/* Tab Switcher */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80 text-[10.5px] flex-wrap gap-0.5">
            {hasOverview && (
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard size={12} className={activeTab === 'overview' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>Overview</span>
              </button>
            )}
            {hasChartConfig && (
              <button
                type="button"
                onClick={() => setActiveTab('chart')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  activeTab === 'chart'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 size={12} className={activeTab === 'chart' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>Chart</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon size={12} className={activeTab === 'results' ? 'text-indigo-600' : 'text-slate-400'} />
              <span>Results</span>
            </button>
            {hasFlowchart && (
              <button
                type="button"
                onClick={() => setActiveTab('flowchart')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  activeTab === 'flowchart'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Workflow size={12} className={activeTab === 'flowchart' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>Flowchart</span>
              </button>
            )}
            {hasChartConfig && rows.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('both')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  activeTab === 'both'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid size={12} className={activeTab === 'both' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>Both</span>
              </button>
            )}
          </div>

          {meta?.date_range && (
            <div className="flex items-center gap-1 text-[9.5px] text-slate-400 truncate">
              <Calendar size={11} className="shrink-0" />
              <span className="truncate">{meta.date_range}</span>
            </div>
          )}
        </div>

        {/* Applied Filters Metadata */}
        {filterEntries.length > 0 && (
          <div className="mb-2.5 rounded-xl bg-slate-50/80 border border-slate-100 p-2 text-[10px] text-slate-600">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
              {filterEntries.map((f, idx) => (
                <div key={idx} className="flex items-baseline gap-1.5 text-[9.5px] leading-tight">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span className="text-slate-500">{f.label}:</span>
                  <span className="font-semibold text-slate-800">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Input for Result Tables */}
        {rows.length > 3 && (activeTab === 'results' || activeTab === 'both') && (
          <div className="mb-2.5 relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Filter ${rows.length} rows...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1 text-[10px] bg-slate-50/80 border border-slate-200/70 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>
        )}

        {/* ── 3. Content View (Overview, Chart, Results, Flowchart, or Both) ── */}
        {activeTab === 'overview' ? (
          renderOverview()
        ) : activeTab === 'flowchart' && hasFlowchart ? (
          <BusinessFlowchartRenderer data={data.flowchart!} />
        ) : rows.length === 0 ? (
          /* Empty State */
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center bg-slate-50/50 my-1">
            <Info className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
            <div className="text-[11.5px] font-bold text-slate-700">No data records found</div>
            <p className="text-[10px] text-slate-500 mt-0.5 max-w-[280px] mx-auto">
              There are no matching transactions or entries for the applied branch and date range.
            </p>
          </div>
        ) : activeTab === 'chart' && hasChartConfig ? (
          /* Chart Only View: KPIs + Chart + Grounded Insights */
          <div className="flex flex-col gap-2.5 my-1">
            {renderKpiSection()}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
              <div className="text-[10.5px] font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>{getChartTitle()}</span>
                <span className="text-[8.5px] text-slate-400 font-mono">Interactive Graph</span>
              </div>
              <ChartRenderer config={chart!} rows={rows} columns={columns} />
            </div>
            {renderInsightsSection()}
          </div>
        ) : activeTab === 'both' && hasChartConfig ? (
          /* Both View: KPIs + Chart on top + Full Result Table underneath + Insights */
          <div className="flex flex-col gap-2.5 my-1">
            {renderKpiSection()}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
              <div className="text-[10.5px] font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>{getChartTitle()}</span>
                <span className="text-[8.5px] text-slate-400 font-mono">Interactive Graph</span>
              </div>
              <ChartRenderer config={chart!} rows={rows} columns={columns} />
            </div>
            {renderTable(paginatedRows)}
            {renderInsightsSection()}
          </div>
        ) : (
          /* Results Only View: Table + Insights */
          <div className="flex flex-col gap-2.5 my-1">
            {renderTable(paginatedRows)}
            {renderInsightsSection()}
          </div>
        )}

        {/* ── 4. Metadata Warnings ─────────────────────────────────────────── */}
        {meta?.is_partial && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50/90 p-2 text-[9px] text-amber-800 border border-amber-200/80">
            <AlertCircle className="h-3 w-3 text-amber-600 shrink-0" />
            <span>Partial results: Capped at row query limit.</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface SeriesResolved {
  dataKey: string;
  name: string;
  color: string;
}

interface ChartRendererProps {
  config: TableChartConfig;
  rows: Array<Record<string, any>>;
  columns: TableColumn[];
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ config, rows, columns }) => {
  const { type, xKey, series } = config;

  const resolvedSeries: SeriesResolved[] = React.useMemo(() => {
    return (series || []).map((s, idx) => {
      if (typeof s === 'string') {
        const col = columns.find(c => c.key === s);
        return {
          dataKey: s,
          name: col?.label || s,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        };
      }
      const item = s as TableChartSeriesItem;
      const col = columns.find(c => c.key === item.dataKey);
      return {
        dataKey: item.dataKey,
        name: item.name || col?.label || item.dataKey,
        color: item.color || CHART_PALETTE[idx % CHART_PALETTE.length],
      };
    });
  }, [series, columns]);

  // Determine if series has currency column
  const isCurrencySeries = (keyOrName: string) => {
    const col = columns.find((c) => c.key === keyOrName || c.label === keyOrName);
    if (col) return col.type === 'currency';
    const match = resolvedSeries.find((s) => s.dataKey === keyOrName || s.name === keyOrName);
    if (match) {
      const matchCol = columns.find((c) => c.key === match.dataKey);
      if (matchCol) return matchCol.type === 'currency';
    }
    const lower = keyOrName.toLowerCase();
    return lower.includes('sales') || lower.includes('amount') || lower.includes('revenue') || lower.includes('total') || lower.includes('purchases') || lower.includes('bill');
  };

  const tooltipFormatter = (value: any, name: any) => {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return [value, name];
    if (isCurrencySeries(String(name))) {
      return [inrFormatter.format(num), name];
    }
    return [numberFormatter.format(num), name];
  };

  const yAxisFormatter = (v: any) => {
    if (typeof v !== 'number') return v;
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
    return String(v);
  };

  switch (type) {
    case 'line':
      return (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#64748b' }} tickFormatter={yAxisFormatter} />
              <RechartsTooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: 9.5 }} />}
              {resolvedSeries.map((s) => (
                <Line
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );

    case 'area':
      return (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#64748b' }} tickFormatter={yAxisFormatter} />
              <RechartsTooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: 9.5 }} />}
              {resolvedSeries.map((s) => (
                <Area
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.15}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );

    case 'pie': {
      const primaryKey = resolvedSeries[0]?.dataKey || 'sales';
      return (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey={primaryKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={65}
                innerRadius={30}
                paddingAngle={2}
              >
                {rows.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    case 'horizontal_bar':
      return (
        <div className="h-[210px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={rows} margin={{ top: 10, right: 15, left: 25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={yAxisFormatter} tick={{ fontSize: 8.5, fill: '#64748b' }} />
              <YAxis type="category" dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} width={80} />
              <RechartsTooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: 9.5 }} />}
              {resolvedSeries.map((s) => (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color}
                  radius={[0, 3, 3, 0]}
                  maxBarSize={22}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case 'bar':
    default: {
      if ((config as any).layout === 'vertical') {
        return (
          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={rows} margin={{ top: 10, right: 15, left: 25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={yAxisFormatter} tick={{ fontSize: 8.5, fill: '#64748b' }} />
                <YAxis type="category" dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} width={80} />
                <RechartsTooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: 9.5 }} />}
                {resolvedSeries.map((s) => (
                  <Bar
                    key={s.dataKey}
                    dataKey={s.dataKey}
                    name={s.name}
                    fill={s.color}
                    radius={[0, 3, 3, 0]}
                    maxBarSize={22}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      return (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#64748b' }} tickFormatter={yAxisFormatter} />
              <RechartsTooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              {resolvedSeries.length > 1 && <Legend wrapperStyle={{ fontSize: 9.5 }} />}
              {resolvedSeries.map((s) => (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
  }
};
