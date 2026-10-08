import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  Search,
  Eye,
  Filter,
} from 'lucide-react';
import { getProductionSummary, getProductionOrders } from '../../api/production';
import { useAuth } from '../../contexts/AuthContext';
import { ProductionOrderDetailModal } from './ProductionOrderDetailModal';

export const ProductionOrdersPage = () => {
  const { user } = useAuth();

  // States
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [viewOrderId, setViewOrderId] = useState<number | null>(null);

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
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setPriorityFilter('');
    setDateRange('today');
    setCustomFrom('');
    setCustomTo('');
    setPage(1);
  };

  const queryFilters = {
    date_from,
    date_to,
    warehouse: branchId,
  };

  const tableFilters = {
    ...queryFilters,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    production_type: typeFilter || undefined,
    priority: priorityFilter ? parseInt(priorityFilter, 10) : undefined,
    page,
    page_size: pageSize,
  };

  // Queries
  const { data: summary, isLoading: loadingSummary, isError: errorSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['production', 'summary', branchId, date_from, date_to],
    queryFn: () => getProductionSummary(queryFilters),
    enabled: !!date_from && !!date_to,
  });

  const { data: ordersData, isLoading: loadingOrders, isError: errorOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['production', 'orders', tableFilters],
    queryFn: () => getProductionOrders(tableFilters),
    enabled: !!date_from && !!date_to,
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchOrders();
  };

  return (
    <div className="flex flex-col gap-6 text-slate-900 pb-10 relative">

      {/* HEADER */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-slate-900">Production Orders</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">View, filter and manage production orders with detailed production status.</p>
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
      {errorSummary ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <span>Unable to load production summary.</span>
          <button onClick={handleRefresh} className="px-4 py-2 bg-white text-red-600 text-sm rounded-lg border border-red-200 shadow-sm font-medium">
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <KpiCard
            title="Total Orders"
            value={(summary?.open_orders || 0) + (summary?.released_orders || 0) + (summary?.completed_orders || 0) + (summary?.cancelled_orders || 0)}
            loading={loadingSummary}
            icon={<Factory className="text-blue-500" size={24} />}
            bgColor="bg-blue-50"
          />
          <KpiCard
            title="Planned Orders"
            value={summary?.open_orders ?? 0}
            loading={loadingSummary}
            icon={<Clock className="text-amber-500" size={24} />}
            bgColor="bg-amber-50"
          />
          <KpiCard
            title="Released Orders"
            value={summary?.released_orders ?? 0}
            loading={loadingSummary}
            icon={<Package className="text-sky-500" size={24} />}
            bgColor="bg-sky-50"
          />
          <KpiCard
            title="Completed Orders"
            value={summary?.completed_orders ?? 0}
            loading={loadingSummary}
            icon={<CheckCircle className="text-emerald-500" size={24} />}
            bgColor="bg-emerald-50"
          />
          <KpiCard
            title="Cancelled Orders"
            value={summary?.cancelled_orders ?? 0}
            loading={loadingSummary}
            icon={<XCircle className="text-rose-500" size={24} />}
            bgColor="bg-rose-50"
          />
        </div>
      )}

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search Order No, Item Code or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="Planned">Planned</option>
          <option value="Released">Released</option>
          <option value="Closed">Closed</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="Standard">Standard</option>
          <option value="Special">Special</option>
          <option value="Disassembly">Disassembly</option>
        </select>

        <button
          onClick={handleResetFilters}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
        >
          Reset Filters
        </button>
      </div>

      {/* ORDERS TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[1200px]">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-5 py-3">Order No.</th>
                <th className="px-5 py-3">Item</th>
                <th className="px-5 py-3">Order Date</th>
                <th className="px-5 py-3 text-right">Planned</th>
                <th className="px-5 py-3 text-right">Produced</th>
                <th className="px-5 py-3 text-right text-orange-600">Pending</th>
                <th className="px-5 py-3 text-right">Prod %</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingOrders ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4" colSpan={9}><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : errorOrders ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-red-500">
                    <AlertTriangle size={32} className="mx-auto mb-3 text-red-400" />
                    Unable to load production orders. Please try again.
                  </td>
                </tr>
              ) : ordersData?.items?.length ? (
                ordersData.items.map(order => (
                  <tr key={order.production_order_no} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-blue-600">#{order.production_order_no}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{order.item_code}</div>
                      <div className="text-xs text-slate-500 max-w-[250px] truncate" title={order.item_name || ''}>{order.item_name}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{order.posting_date || '-'}</td>
                    <td className="px-5 py-4 text-right">{order.planned_qty}</td>
                    <td className="px-5 py-4 text-right font-medium text-blue-600">{order.produced_qty}</td>
                    <td className="px-5 py-4 text-right font-medium text-orange-600">{order.pending_qty}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500 w-10">{order.production_percentage}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(order.production_percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${order.status === 'Closed' ? 'bg-green-100 text-green-700' :
                          order.status === 'Released' ? 'bg-yellow-100 text-yellow-700' :
                            order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                        }`}>
                        {order.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => setViewOrderId(order.production_order_no)}
                        className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center text-slate-500">
                    <Filter size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium text-slate-700 mb-1">No production orders found</p>
                    <p className="text-sm">Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!errorOrders && ordersData && ordersData.total_pages > 0 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{((page - 1) * pageSize) + 1}</span> to <span className="font-medium text-slate-700">{Math.min(page * pageSize, ordersData.total)}</span> of <span className="font-medium text-slate-700">{ordersData.total}</span> orders
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
                  Page {page} of {ordersData.total_pages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(ordersData.total_pages, p + 1))}
                  disabled={page >= ordersData.total_pages}
                  className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {viewOrderId !== null && (
        <ProductionOrderDetailModal
          productionOrderNo={viewOrderId}
          onClose={() => setViewOrderId(null)}
        />
      )}
    </div>
  );
};

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
