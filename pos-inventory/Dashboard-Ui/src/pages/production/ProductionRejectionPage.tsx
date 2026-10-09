import React, { useState, useMemo, useEffect } from 'react';
import { getLocalISODate } from '../../utils/date';
import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  RefreshCcw,
  Search,
  Filter,
  TrendingDown,
  AlertTriangle,
  PackageX,
  Target,
  BarChart2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { getProductionRejection } from '../../api/production';
import { useAuth } from '../../contexts/AuthContext';

type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';

export const ProductionRejectionPage = () => {
  const { user } = useAuth();

  // States
  const [dateRange, setDateRange] = useState<DateRange>('total');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortBy, setSortBy] = useState<'produced_qty' | 'rejected_qty' | 'rejection_percentage'>('rejected_qty');
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
    warehouse: warehouseFilter || branchId,
    search: debouncedSearch || undefined,
  };

  // Queries
  const { data: rejectionData, isLoading, isError, refetch } = useQuery({
    queryKey: ['production', 'rejection', queryFilters],
    queryFn: () => getProductionRejection(queryFilters),
    enabled: dateRange === 'total' || (!!date_from && !!date_to),
  });

  const handleRefresh = () => {
    refetch();
  };

  // Compute Data for Table
  const items = rejectionData?.items || [];

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [items, sortBy, sortOrder]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, page, pageSize]);

  const totalPages = Math.ceil(sortedItems.length / pageSize);

  // Highest Rejection Item for KPI
  const highestRejectionItem = useMemo(() => {
    if (items.length === 0) return 'N/A';
    const highest = [...items].sort((a, b) => b.rejected_qty - a.rejected_qty)[0];
    return highest.rejected_qty > 0 ? highest.item_code : 'N/A';
  }, [items]);

  // Graph 1: Rejected Quantity by Item (Top 10)
  const topRejected = useMemo(() => {
    return [...items]
      .filter(i => i.rejected_qty > 0)
      .sort((a, b) => b.rejected_qty - a.rejected_qty)
      .slice(0, 10);
  }, [items]);

  // Graph 2: Rejection Percentage Donut Data
  const donutData = useMemo(() => {
    if (!rejectionData) return [];
    // Assuming total_rejected_qty is sum of all rejected, 
    // We need total produced to calculate Good vs Rejected
    // Actually, rejectionData provides rejection_percentage.
    const rejPct = rejectionData.rejection_percentage;
    const goodPct = Math.max(0, 100 - rejPct);
    return [
      { name: 'Accepted', value: goodPct, color: '#22c55e' }, // green
      { name: 'Rejected', value: rejPct, color: '#ef4444' }, // red
    ];
  }, [rejectionData]);

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
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-slate-900">Production Rejection</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">Analyze rejected production quantities and rejection percentages.</p>
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
          <span>Unable to load production rejection data.</span>
          <button onClick={handleRefresh} className="px-4 py-2 bg-white text-red-600 text-sm rounded-lg border border-red-200 shadow-sm font-medium">
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            title="Total Rejected Qty"
            value={rejectionData?.total_rejected_qty ?? 0}
            loading={isLoading}
            icon={<TrendingDown className="text-red-500" size={24} />}
            bgColor="bg-red-50"
          />
          <KpiCard
            title="Rejection %"
            value={`${rejectionData?.rejection_percentage ?? 0}%`}
            loading={isLoading}
            icon={<Target className="text-orange-500" size={24} />}
            bgColor="bg-orange-50"
          />
          <KpiCard
            title="Items With Rejection"
            value={rejectionData?.items_with_rejection ?? 0}
            loading={isLoading}
            icon={<PackageX className="text-purple-500" size={24} />}
            bgColor="bg-purple-50"
          />
          <KpiCard
            title="Highest Rejection Item"
            value={highestRejectionItem}
            loading={isLoading}
            icon={<BarChart2 className="text-blue-500" size={24} />}
            bgColor="bg-blue-50"
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph 1: Rejected Quantity by Item (Horizontal Bar) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col lg:col-span-2">
          <h2 className="text-base font-semibold mb-4">Rejected Quantity by Item (Top 10)</h2>
          <div className="flex-1 min-h-[300px]">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-md" />
            ) : topRejected.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRejected} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="item_code" width={80} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="rejected_qty" name="Rejected Qty" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No rejection data</div>
            )}
          </div>
        </div>

        {/* Graph 2: Rejection Percentage (Donut) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
          <h2 className="text-base font-semibold mb-4">Overall Rejection %</h2>
          <div className="flex-1 min-h-[300px] relative flex items-center justify-center">
            {isLoading ? (
              <Skeleton className="w-48 h-48 rounded-full" />
            ) : rejectionData ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={0}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: any) => [`${value}%`, '']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-slate-800">
                    {rejectionData.rejection_percentage}%
                  </span>
                  <span className="text-sm font-medium text-slate-500 mt-1">Rejected</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* REJECTION TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-500 font-medium select-none">
              <tr>
                <th className="px-5 py-3 w-16">#</th>
                <th className="px-5 py-3">Item</th>
                <SortableHeader label="Produced Qty" field="produced_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Rejected Qty" field="rejected_qty" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <SortableHeader label="Rejection %" field="rejection_percentage" currentSort={sortBy} sortOrder={sortOrder} onClick={handleSort} align="right" />
                <th className="px-5 py-3 text-center">Warehouse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4" colSpan={6}><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-red-500">
                    <AlertTriangle size={32} className="mx-auto mb-3 text-red-400" />
                    Unable to load production rejection data. Please try again.
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
                    <td className="px-5 py-4 text-right font-medium text-blue-600">{item.produced_qty}</td>
                    <td className="px-5 py-4 text-right font-medium text-red-600">{item.rejected_qty}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`text-xs font-medium w-10 ${item.rejection_percentage > 5 ? 'text-red-600' : 'text-slate-500'}`}>
                          {item.rejection_percentage}%
                        </span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.rejection_percentage > 5 ? 'bg-red-500' : 'bg-orange-400'}`}
                            style={{ width: `${Math.min(item.rejection_percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center text-slate-600">
                      {item.warehouse || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                    <Filter size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium text-slate-700 mb-1">No production rejection data found</p>
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
