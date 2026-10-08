import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  RefreshCcw,
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  Target,
  Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Legend, AreaChart, Area
} from 'recharts';
import { getDateWiseProduction } from '../../api/production';
import { useAuth } from '../../contexts/AuthContext';

export const ProductionDateWisePage = () => {
  const { user } = useAuth();

  // States
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortBy, setSortBy] = useState<'date' | 'produced_qty' | 'planned_qty' | 'rejected_qty'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const branchId = user?.branch_id || '';

  const { date_from, date_to } = useMemo(() => {
    const today = new Date();
    let from = '';
    const to = today.toISOString().split('T')[0];

    if (dateRange === 'today') {
      from = to;
    } else if (dateRange === 'week') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      from = startOfWeek.toISOString().split('T')[0];
    } else if (dateRange === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      from = startOfMonth.toISOString().split('T')[0];
    } else if (dateRange === 'year') {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      from = startOfYear.toISOString().split('T')[0];
    } else if (dateRange === 'custom') {
      return { date_from: customFrom, date_to: customTo };
    }

    return { date_from: from, date_to: to };
  }, [dateRange, customFrom, customTo]);

  // Handle filter changes (reset page)
  const handleDateChange = (range: any) => {
    setDateRange(range);
    setPage(1);
  };

  const handleResetFilters = () => {
    setWarehouseFilter('');
    setDateRange('month');
    setCustomFrom('');
    setCustomTo('');
    setGranularity('daily');
    setPage(1);
  };

  const queryFilters = {
    date_from,
    date_to,
    warehouse: warehouseFilter || branchId,
    granularity,
  };

  // Queries
  const { data: dateData, isLoading, isError, refetch } = useQuery({
    queryKey: ['production', 'date-wise', queryFilters],
    queryFn: () => getDateWiseProduction(queryFilters),
    enabled: !!date_from && !!date_to,
  });

  const handleRefresh = () => {
    refetch();
  };

  // Process data
  const items = dateData || [];

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortBy, sortOrder]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, page, pageSize]);

  const totalPages = Math.ceil(sortedItems.length / pageSize);

  // KPIs
  const kpiData = useMemo(() => {
    if (!items.length) return { totalProduced: 0, totalRejected: 0, avgDaily: 0, bestDay: 'N/A' };

    const totalProduced = items.reduce((acc, curr) => acc + curr.produced_qty, 0);
    const totalRejected = items.reduce((acc, curr) => acc + curr.rejected_qty, 0);

    // Average Daily (if granularity is daily, it's total / items.length. If weekly, it's roughly total / days)
    // For simplicity, average per bucket.
    const avgDaily = totalProduced / items.length;

    const bestDayItem = [...items].sort((a, b) => b.produced_qty - a.produced_qty)[0];
    const bestDay = bestDayItem.produced_qty > 0 ? bestDayItem.date : 'N/A';

    return {
      totalProduced,
      totalRejected,
      avgDaily: Math.round(avgDaily * 100) / 100,
      bestDay
    };
  }, [items]);

  // Graph Data (Chronological for graphs)
  const chartData = useMemo(() => {
    return [...items].sort((a, b) => a.date.localeCompare(b.date));
  }, [items]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-900 pb-10 relative">

      {/* HEADER */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-slate-900">Date-wise Production</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">Analyze production output by date and selected period.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700">
            <Factory size={16} />
            {branchId ? `Branch: ${branchId}` : 'All Branches'}
          </div>

          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden text-[13px] font-medium">
            {(['today', 'week', 'month', 'year', 'custom'] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleDateChange(r)}
                className={`px-3 py-2 border-r border-slate-200 last:border-none transition-colors ${dateRange === r ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2 py-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                className="text-[13px] border-none outline-none text-slate-700 bg-transparent"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                className="text-[13px] border-none outline-none text-slate-700 bg-transparent"
              />
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition"
            title="Refresh Data"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      {isError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <span>Unable to load date-wise production data.</span>
          <button onClick={handleRefresh} className="px-4 py-2 bg-white text-red-600 text-sm rounded-lg border border-red-200 shadow-sm font-medium">
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            title="Total Production"
            value={kpiData.totalProduced}
            loading={isLoading}
            icon={<Target className="text-blue-500" size={24} />}
            bgColor="bg-blue-50"
          />
          <KpiCard
            title="Total Rejection"
            value={kpiData.totalRejected}
            loading={isLoading}
            icon={<AlertTriangle className="text-red-500" size={24} />}
            bgColor="bg-red-50"
          />
          <KpiCard
            title={`Average ${granularity.charAt(0).toUpperCase() + granularity.slice(1)} Production`}
            value={kpiData.avgDaily}
            loading={isLoading}
            icon={<TrendingUp className="text-green-500" size={24} />}
            bgColor="bg-green-50"
          />
          <KpiCard
            title="Best Production Period"
            value={kpiData.bestDay}
            loading={isLoading}
            icon={<CalendarDays className="text-purple-500" size={24} />}
            bgColor="bg-purple-50"
          />
        </div>
      )}

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Granularity:</label>
          <select
            value={granularity}
            onChange={(e) => { setGranularity(e.target.value as any); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <input
          type="text"
          placeholder="Warehouse filter..."
          value={warehouseFilter}
          onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />

        <button
          onClick={handleResetFilters}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
        >
          Reset Filters
        </button>
      </div>

      {/* GRAPHS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graph 1: Production Heatmap (represented as an Area Chart of production over time) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
          <h2 className="text-base font-semibold mb-4">Production Intensity (Produced Qty)</h2>
          <div className="flex-1 min-h-[300px]">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="produced_qty" name="Produced Qty" stroke="#3b82f6" fillOpacity={1} fill="url(#colorProd)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No production data</div>
            )}
          </div>
        </div>

        {/* Graph 2: Production by Date (Bar Chart) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
          <h2 className="text-base font-semibold mb-4">Production by Date</h2>
          <div className="flex-1 min-h-[300px]">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="planned_qty" name="Planned" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="produced_qty" name="Produced" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="rejected_qty" name="Rejected" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No production data</div>
            )}
          </div>
        </div>
      </div>

      {/* DATE-WISE TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-500 font-medium select-none">
              <tr>
                <th className="px-5 py-3 w-16">#</th>
                <SortableHeader label="Date" field="date" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} />
                <SortableHeader label="Planned Qty" field="planned_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Produced Qty" field="produced_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Rejected Qty" field="rejected_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Pending Qty" field="pending_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <th className="px-5 py-3 text-right">Production %</th>
                <th className="px-5 py-3 text-right">Rejection %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4" colSpan={8}><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-red-500">
                    <AlertTriangle size={32} className="mx-auto mb-3 text-red-400" />
                    Unable to load date-wise production data. Please try again.
                  </td>
                </tr>
              ) : paginatedItems.length > 0 ? (
                paginatedItems.map((item, idx) => (
                  <tr key={item.date} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 text-slate-400 font-medium">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-5 py-4 font-medium text-slate-800">{item.date}</td>
                    <td className="px-5 py-4 text-right text-slate-600">{item.planned_qty}</td>
                    <td className="px-5 py-4 text-right font-medium text-blue-600">{item.produced_qty}</td>
                    <td className="px-5 py-4 text-right font-medium text-red-600">{item.rejected_qty}</td>
                    <td className="px-5 py-4 text-right font-medium text-orange-600">{item.pending_qty}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-xs font-medium text-slate-600">{item.production_percentage}%</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-xs font-medium ${item.rejection_percentage > 5 ? 'text-red-600' : 'text-slate-500'}`}>
                        {item.rejection_percentage}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-500">
                    <Filter size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium text-slate-700 mb-1">No production data found</p>
                    <p className="text-sm">Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!isError && sortedItems.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{((page - 1) * pageSize) + 1}</span> to <span className="font-medium text-slate-700">{Math.min(page * pageSize, sortedItems.length)}</span> of <span className="font-medium text-slate-700">{sortedItems.length}</span> records
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-sm focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="px-4 py-1.5 text-sm font-medium text-slate-700">
                  Page {page} of {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

const SortableHeader = ({ label, field, currentSort, sortOrder, onClick, align = 'left' }: {
  label: string, field: string, currentSort: string, sortOrder: 'asc' | 'desc', onClick: (field: any) => void, align?: 'left' | 'center' | 'right'
}) => (
  <th
    className={`px-5 py-3 cursor-pointer hover:bg-slate-100 transition-colors ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
    onClick={() => onClick(field)}
  >
    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
      {label}
      {currentSort === field && (
        <span className="text-slate-400">
          {sortOrder === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </div>
  </th>
);

const KpiCard = ({ title, value, icon, bgColor, loading }: {
  title: string, value: string | number, icon: React.ReactNode, bgColor: string, loading?: boolean
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${bgColor} shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-500 truncate">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <h3 className="text-2xl font-bold text-slate-900 truncate">
              {value}
            </h3>
          )}
        </div>
      </div>
    </div>
  );
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className || ''}`} />
);
