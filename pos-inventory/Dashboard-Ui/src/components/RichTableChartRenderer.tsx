import React, { useState } from 'react';
import {
  Table as TableIcon,
  BarChart3,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Calendar
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
} from '../types/ai';

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

  // Tab state: 'results' (table) or 'chart'
  const [activeTab, setActiveTab] = useState<'results' | 'chart'>('results');

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
          {rows.length > 0 && (
            <span className="rounded-full bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 text-[8.5px] font-bold text-indigo-700 shrink-0">
              {rows.length} {rows.length === 1 ? 'row' : 'rows'}
            </span>
          )}
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
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80 text-[10.5px]">
            {hasChartConfig && (
              <button
                type="button"
                onClick={() => setActiveTab('chart')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'results' || !hasChartConfig
                  ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon size={12} className={activeTab === 'results' ? 'text-indigo-600' : 'text-slate-400'} />
              <span>Results</span>
            </button>
          </div>

          {meta?.date_range && (
            <div className="flex items-center gap-1 text-[9.5px] text-slate-400 truncate">
              <Calendar size={11} className="shrink-0" />
              <span className="truncate">{meta.date_range}</span>
            </div>
          )}
        </div>

        {/* Applied Filters Metadata (matching reference screenshot layout) */}
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

        {/* ── 3. Content View (Results Table or Chart + Table) ─────────────── */}
        {rows.length === 0 ? (
          /* Empty State */
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center bg-slate-50/50 my-1">
            <Info className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
            <div className="text-[11.5px] font-bold text-slate-700">No data records found</div>
            <p className="text-[10px] text-slate-500 mt-0.5 max-w-[280px] mx-auto">
              There are no matching transactions or entries for the applied branch and date range.
            </p>
          </div>
        ) : activeTab === 'chart' && hasChartConfig ? (
          /* Chart View: Chart on top + Underlying Table below (Reference Design) */
          <div className="flex flex-col gap-2.5 my-1">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
              <div className="text-[10.5px] font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>{columns.find(c => c.key === (chart?.series?.[0] || 'sales'))?.label || 'Total Sales (₹)'}</span>
                <span className="text-[8.5px] text-slate-400 font-mono">Recharts Visual</span>
              </div>
              <ChartRenderer config={chart!} rows={rows} columns={columns} />
            </div>

            {/* Underlying Data Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs">
              <div className="overflow-x-auto max-h-[220px] scrollbar-thin">
                <table className="w-full text-left text-[10px] text-slate-700 whitespace-nowrap border-collapse">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200/80 text-[9px] font-bold text-slate-500 uppercase tracking-wider z-10">
                    <tr>
                      <th className="px-2.5 py-1.5 text-center w-8 text-slate-400 border-r border-slate-100 font-mono">#</th>
                      {columns.slice(0, 3).map((col) => {
                        const isNumeric = ['currency', 'number', 'percentage', 'delta'].includes(col.type);
                        return (
                          <th key={col.key} className={`px-2.5 py-1.5 ${isNumeric ? 'text-right' : 'text-left'}`}>
                            {col.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-2.5 py-1 text-center text-slate-400 font-mono text-[9px] border-r border-slate-100 bg-slate-50/30">
                          {rowIdx + 1}
                        </td>
                        {columns.slice(0, 3).map((col) => {
                          const cellVal = row[col.key];
                          const { text, className: cellClass } = formatCellValue(cellVal, col.type);
                          const isNumeric = ['currency', 'number', 'percentage', 'delta'].includes(col.type);
                          return (
                            <td key={col.key} className={`px-2.5 py-1 ${isNumeric ? 'text-right font-medium tabular-nums' : 'text-left'} ${cellClass || ''}`}>
                              {text}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Full Results Table View */
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs my-1">
            <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
              <table className="w-full text-left text-[10px] text-slate-700 whitespace-nowrap border-collapse">
                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200/80 text-[9px] font-bold text-slate-500 uppercase tracking-wider z-10">
                  <tr>
                    <th className="px-2.5 py-2 text-center w-8 text-slate-400 border-r border-slate-100 font-mono">
                      #
                    </th>
                    {columns.map((col) => {
                      const isNumeric = ['currency', 'number', 'percentage', 'delta'].includes(col.type);
                      return (
                        <th
                          key={col.key}
                          className={`px-3 py-2 ${isNumeric ? 'text-right' : 'text-left'}`}
                        >
                          {col.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="hover:bg-indigo-50/30 transition-colors"
                    >
                      <td className="px-2.5 py-1.5 text-center text-slate-400 font-mono text-[9px] border-r border-slate-100 bg-slate-50/30">
                        {rowIdx + 1}
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
                  ))}
                </tbody>
              </table>
            </div>
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

interface ChartRendererProps {
  config: TableChartConfig;
  rows: Array<Record<string, any>>;
  columns: TableColumn[];
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ config, rows, columns }) => {
  const { type, xKey, series } = config;

  // Determine if series has currency column
  const isCurrencySeries = (key: string) => {
    const col = columns.find((c) => c.key === key);
    return col?.type === 'currency';
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
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 9.5 }} />}
              {series.map((s, idx) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={CHART_PALETTE[idx % CHART_PALETTE.length]}
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
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 9.5 }} />}
              {series.map((s, idx) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={CHART_PALETTE[idx % CHART_PALETTE.length]}
                  fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                  fillOpacity={0.15}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );

    case 'pie': {
      const pieKey = series[0] || 'sales';
      return (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey={pieKey}
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

    case 'bar':
    default:
      return (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#64748b' }} tickFormatter={yAxisFormatter} />
              <RechartsTooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 9.5 }} />}
              {series.map((s, idx) => (
                <Bar
                  key={s}
                  dataKey={s}
                  fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
  }
};
