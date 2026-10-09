import React, { useState, useMemo, useEffect } from 'react';
import { getLocalISODate } from '../../utils/date';
import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  RefreshCcw,
  CheckCircle,
  Clock,
  Package,
  Search,
  Filter,
  TrendingDown,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, Cell, LabelList, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Legend
} from 'recharts';
import { getItemWiseProduction } from '../../api/production';
import { useAuth } from '../../contexts/AuthContext';

type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';

export const ProductionItemWisePage = () => {
  const { user } = useAuth();

  // States
  const [dateRange, setDateRange] = useState<DateRange>('total');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortBy, setSortBy] = useState<'produced_qty' | 'planned_qty' | 'pending_qty' | 'rejected_qty' | 'production_percentage' | 'rejection_percentage'>('produced_qty');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const branchId = user?.branch_id || '';

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const { date_from, date_to } = useMemo(() => {
    if (dateRange === 'total') return { date_from: undefined, date_to: undefined };
    const today = new Date();
    let from = '';
    let to = '';
    if (dateRange === 'today') {
      from = getLocalISODate(today);
      to = from;
    } else if (dateRange === 'week') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      from = getLocalISODate(startOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      to = getLocalISODate(endOfWeek);
    } else if (dateRange === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      from = getLocalISODate(startOfMonth);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      to = getLocalISODate(endOfMonth);
    } else if (dateRange === 'year') {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      from = getLocalISODate(startOfYear);
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      to = getLocalISODate(endOfYear);
    }
    return { date_from: from, date_to: to };
  }, [dateRange]);

  // Handle filter changes (reset page)
  const handleDateChange = (range: any) => {
    setDateRange(range);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setWarehouseFilter('');
    setDateRange('today');
    undefined;
    undefined;
    setPage(1);
  };

  const queryFilters = {
    date_from,
    date_to,
    warehouse: warehouseFilter || branchId, // Use explicit warehouse filter if set, otherwise branch default
    search: debouncedSearch || undefined,
  };

  // Queries
  const { data: itemsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['production', 'item-wise', queryFilters],
    queryFn: () => getItemWiseProduction(queryFilters),
    enabled: dateRange === 'total' || (!!date_from && !!date_to),
  });

  const handleRefresh = () => {
    refetch();
  };

  // Compute Data
  const sortedItems = useMemo(() => {
    if (!itemsData) return [];
    const sorted = [...itemsData].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [itemsData, sortBy, sortOrder]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, page, pageSize]);

  const totalPages = Math.ceil(sortedItems.length / pageSize);

  // Aggregates for KPI
  const kpiData = useMemo(() => {
    if (!itemsData) return { totalItems: 0, planned: 0, produced: 0, pending: 0, rejected: 0 };
    return itemsData.reduce((acc, item) => ({
      totalItems: acc.totalItems + 1,
      planned: acc.planned + item.planned_qty,
      produced: acc.produced + item.produced_qty,
      pending: acc.pending + item.pending_qty,
      rejected: acc.rejected + item.rejected_qty,
    }), { totalItems: 0, planned: 0, produced: 0, pending: 0, rejected: 0 });
  }, [itemsData]);

  // Graph Data
  const topProduced = useMemo(() => {
    if (!itemsData) return [];
    return [...itemsData]
      .sort((a, b) => b.produced_qty - a.produced_qty)
      .slice(0, 10);
  }, [itemsData]);

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
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-slate-900">Item-wise Production</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">Analyze planned, produced, pending and rejected quantities by item.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700">
            <Factory size={16} />
            {branchId ? `Branch: ${branchId}` : 'All Branches'}
          </div>

          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden text-[13px] font-medium">
            {(['today', 'week', 'month', 'year', 'total'] as const).map((r) => (
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
          <span>Unable to load item-wise production data.</span>
          <button onClick={handleRefresh} className="px-4 py-2 bg-white text-red-600 text-sm rounded-lg border border-red-200 shadow-sm font-medium">
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <KpiCard
            title="Total Items"
            value={kpiData.totalItems}
            loading={isLoading}
            icon={<Package className="text-blue-500" size={24} />}
            bgColor="bg-blue-50"
          />
          <KpiCard
            title="Total Planned Qty"
            value={kpiData.planned}
            loading={isLoading}
            icon={<Clock className="text-amber-500" size={24} />}
            bgColor="bg-amber-50"
          />
          <KpiCard
            title="Total Produced Qty"
            value={kpiData.produced}
            loading={isLoading}
            icon={<CheckCircle className="text-emerald-500" size={24} />}
            bgColor="bg-emerald-50"
          />
          <KpiCard
            title="Total Pending Qty"
            value={kpiData.pending}
            loading={isLoading}
            icon={<AlertTriangle className="text-orange-500" size={24} />}
            bgColor="bg-orange-50"
          />
          <KpiCard
            title="Total Rejected Qty"
            value={kpiData.rejected}
            loading={isLoading}
            icon={<TrendingDown className="text-red-500" size={24} />}
            bgColor="bg-red-50"
          />
        </div>
      )}

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search Item Code or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <input
          type="text"
          placeholder="Warehouse filter..."
          value={warehouseFilter}
          onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        {/* Graph 1: Top Produced Items (Area Chart) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-[#0ea5e9]" size={22} />
              <h2 className="text-[17px] font-bold text-slate-800">Top Produced Items</h2>
            </div>
            <div className="flex bg-slate-50/80 rounded-lg border border-slate-100 overflow-hidden text-[13px] font-medium p-1">
              {(['today', 'week', 'month', 'year', 'total'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => handleDateChange(r)}
                  className={`px-4 py-1.5 rounded-md transition-all ${dateRange === r ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[350px]">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : topProduced.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProduced} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="item_code" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(value) => value >= 1000 ? `${value / 1000}K` : value}
                  />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any, name: any, props: any) => {
                      const itemName = props.payload.item_name ? ` (${props.payload.item_name})` : '';
                      return [value, `${name}${itemName}`];
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="produced_qty" name="Produced Quantity" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {topProduced.map((_, index) => {
                      const colors = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#6366f1', '#10b981', '#f43f5e', '#84cc16', '#0ea5e9'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No graph data</div>
            )}
          </div>
        </div>

        {/* Graph 2: Planned vs Produced */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Planned vs Produced by Item</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Comparison of planned and produced quantity for each item</p>
          </div>
          <div className="flex-1 min-h-[350px]">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : topProduced.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProduced} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" type="category" dataKey="item_code" width={80} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />

                  {/* Custom Right Y-Axis for Production % */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    type="category"
                    dataKey="item_code"
                    width={110}
                    tickLine={false}
                    axisLine={false}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      const item = topProduced.find(d => d.item_code === payload.value);
                      if (!item) return null;
                      const pct = item.planned_qty ? (item.produced_qty / item.planned_qty) * 100 : null;
                      const formattedPct = pct !== null ? `${pct.toFixed(1)}%` : 'N/A';

                      // If it's the very first tick, we can render a column header above it (a bit hacky but works)
                      const isFirst = topProduced[0]?.item_code === payload.value;

                      return (
                        <g transform={`translate(${x},${y})`}>
                          {isFirst && <text x={85} y={-30} textAnchor="end" fill="#64748b" fontSize={11} fontWeight={600}>Production %</text>}
                          <text x={45} y={0} dy={4} textAnchor="end" fill="#64748b" fontSize={11} fontWeight={500}>{formattedPct}</text>
                          {pct !== null && <rect x={55} y={-4} width={40} height={8} fill="#f1f5f9" rx={4} />}
                          {pct !== null && <rect x={55} y={-4} width={Math.min(pct, 100) * 0.4} height={8} fill="#22c55e" rx={4} />}
                        </g>
                      );
                    }}
                  />

                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any, name: any) => {
                      if (name === 'Planned Qty') return [value, `Planned Qty`];
                      if (name === 'Produced Qty') return [value, `Produced Qty`];
                      return [value, name];
                    }}
                    labelFormatter={(label: any) => {
                      const item = topProduced.find(d => d.item_code === label);
                      return item?.item_name ? `${label} - ${item.item_name}` : label;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', top: -30, right: 0 }} verticalAlign="top" align="right" iconType="circle" />
                  <Bar yAxisId="left" dataKey="planned_qty" name="Planned Qty" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={12}>
                    <LabelList dataKey="planned_qty" position="right" fill="#64748b" fontSize={11} />
                  </Bar>
                  <Bar yAxisId="left" dataKey="produced_qty" name="Produced Qty" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12}>
                    <LabelList dataKey="produced_qty" position="right" fill="#1e293b" fontSize={11} fontWeight={500} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No graph data</div>
            )}
          </div>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[1200px]">
            <thead className="bg-slate-50 text-slate-500 font-medium select-none">
              <tr>
                <th className="px-5 py-3 w-16">#</th>
                <th className="px-5 py-3">Item</th>
                <SortableHeader label="Planned" field="planned_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Produced" field="produced_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Pending" field="pending_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Rejected" field="rejected_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Prod %" field="production_percentage" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Rej %" field="rejection_percentage" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <th className="px-5 py-3 text-center">Warehouse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4" colSpan={9}><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-red-500">
                    <AlertTriangle size={32} className="mx-auto mb-3 text-red-400" />
                    Unable to load item-wise production data. Please try again.
                  </td>
                </tr>
              ) : paginatedItems.length > 0 ? (
                paginatedItems.map((item, idx) => (
                  <tr key={item.item_code} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 text-slate-400 font-medium">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{item.item_code}</div>
                      <div className="text-xs text-slate-500 max-w-[250px] truncate" title={item.item_name || ''}>{item.item_name}</div>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-600">{item.planned_qty}</td>
                    <td className="px-5 py-4 text-right font-medium text-blue-600">{item.produced_qty}</td>
                    <td className="px-5 py-4 text-right font-medium text-orange-600">{item.pending_qty}</td>
                    <td className="px-5 py-4 text-right font-medium text-red-600">{item.rejected_qty}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500 w-10">{item.production_percentage}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(item.production_percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${item.rejection_percentage > 5 ? 'bg-red-100 text-red-700' : 'text-slate-500'}`}>
                        {item.rejection_percentage}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center text-slate-600">
                      {item.warehouse || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center text-slate-500">
                    <Filter size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium text-slate-700 mb-1">No item-wise production data found</p>
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
              Showing <span className="font-medium text-slate-700">{((page - 1) * pageSize) + 1}</span> to <span className="font-medium text-slate-700">{Math.min(page * pageSize, sortedItems.length)}</span> of <span className="font-medium text-slate-700">{sortedItems.length}</span> items
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
