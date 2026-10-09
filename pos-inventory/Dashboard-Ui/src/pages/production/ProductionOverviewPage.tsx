import React, { useState, useMemo, useEffect } from 'react';
import { getLocalISODate } from '../../utils/date';
import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingDown,
  BarChart2,
  Package,
 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Legend
} from 'recharts';
import {
  getProductionSummary,
  getStatusDistribution,
  getDateWiseProduction,
  getProductionOrders,
  getWarehouseSummary,
  getItemWiseProduction,
} from '../../api/production';
import { useAuth } from '../../contexts/AuthContext';

const PIE_COLORS = {
  'Planned': '#3b82f6', // blue
  'Released': '#eab308', // yellow
  'Closed': '#22c55e', // green
  'Cancelled': '#ef4444', // red
  'default': '#94a3b8' // slate
};

type DateRange = 'today' | 'week' | 'month' | 'year' | 'total';

export const ProductionOverviewPage = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('total');

  // Use user's branch for the branch filter
  const branchId = user?.branch_id || '';

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

  const queryFilters = { date_from, date_to, warehouse: branchId };

  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(5);
  

  useEffect(() => {
    setOrdersPage(1);
  }, [dateRange, branchId]);

  // Queries
  const { data: summary, isLoading: loadingSummary, isError: errorSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['production', 'summary', branchId, date_from, date_to],
    queryFn: () => getProductionSummary(queryFilters),
    enabled: dateRange === 'total' || (!!date_from && !!date_to),
  });

  const { data: statusDist, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['production', 'status-distribution', branchId, date_from, date_to],
    queryFn: () => getStatusDistribution(queryFilters),
    enabled: dateRange === 'total' || (!!date_from && !!date_to),
  });

  const { data: trendData, isLoading: loadingTrend, refetch: refetchTrend } = useQuery({
    queryKey: ['production', 'date-wise', branchId, date_from, date_to],
    queryFn: () => getDateWiseProduction({ ...queryFilters, granularity: 'daily' }),
    enabled: dateRange === 'total' || (!!date_from && !!date_to),
  });

  const { data: recentOrders, isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['production', 'orders', branchId, date_from, date_to, ordersPage, ordersPageSize],
    queryFn: () => getProductionOrders({ ...queryFilters, page: ordersPage, page_size: ordersPageSize }),
    enabled: dateRange === 'total' || (!!date_from && !!date_to),
  });

  const { data: warehouseData, isLoading: loadingWarehouse, refetch: refetchWarehouse } = useQuery({
    queryKey: ['production', 'warehouses', branchId, date_from, date_to],
    queryFn: () => getWarehouseSummary(queryFilters),
    enabled: dateRange === 'total' || (!!date_from && !!date_to),
  });

  const { data: topItems, isLoading: loadingItems, refetch: refetchItems } = useQuery({
    queryKey: ['production', 'item-wise', branchId, date_from, date_to],
    queryFn: () => getItemWiseProduction(queryFilters),
    enabled: dateRange === 'total' || (!!date_from && !!date_to),
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchStatus();
    refetchTrend();
    refetchOrders();
    refetchWarehouse();
    refetchItems();
  };

  console.log("PRODUCTION SUMMARY", { data: summary, isLoading: loadingSummary, isError: errorSummary });
  console.log("PRODUCTION ORDERS", { data: recentOrders, isLoading: loadingOrders });
  console.log("PRODUCTION STATUS", { data: statusDist, isLoading: loadingStatus });
  console.log("PRODUCTION TREND", { data: trendData, isLoading: loadingTrend });
  console.log("PRODUCTION WAREHOUSE", { data: warehouseData, isLoading: loadingWarehouse });
  console.log("PRODUCTION ITEMS", { data: topItems, isLoading: loadingItems });


  return (
    <div className="flex flex-col gap-6 text-slate-900 pb-10">
      {/* HEADER */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-slate-900">Production Overview</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">Monitor and manage your production orders, output, rejections and performance.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Branch indicator */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700">
            <Factory size={16} />
            {branchId ? `Branch: ${branchId}` : 'All Branches'}
          </div>

          {/* Date Selector */}
          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden text-[13px] font-medium">
            {(['today', 'week', 'month', 'year', 'total'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
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

      {errorSummary ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
          <span>Unable to load production summary.</span>
          <button onClick={handleRefresh} className="px-4 py-2 bg-white text-red-600 text-sm rounded-lg border border-red-200 shadow-sm font-medium">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Production"
              value={summary?.total_production ?? 0}
              loading={loadingSummary}
              icon={<Factory className="text-blue-500" size={24} />}
              bgColor="bg-blue-50"
            />
            <KpiCard
              title="Pending Production"
              value={summary?.pending_production ?? 0}
              loading={loadingSummary}
              icon={<Clock className="text-orange-500" size={24} />}
              bgColor="bg-orange-50"
            />
            <KpiCard
              title="Total Rejection"
              value={summary?.total_rejection ?? 0}
              loading={loadingSummary}
              icon={<TrendingDown className="text-red-500" size={24} />}
              bgColor="bg-red-50"
              suffix={`(${summary?.rejection_percentage ?? 0}%)`}
            />
            <KpiCard
              title="Production Efficiency"
              value={summary?.production_efficiency === null ? 'N/A' : (summary?.production_efficiency ?? 0)}
              loading={loadingSummary}
              icon={<BarChart2 className="text-purple-500" size={24} />}
              bgColor="bg-purple-50"
              tooltip="Production efficiency is not currently provided because no approved business formula is defined."
            />
            <KpiCard
              title="Planned Orders"
              value={summary?.planned_orders ?? 0}
              loading={loadingSummary}
              icon={<AlertTriangle className="text-amber-500" size={24} />}
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

          {/* GRAPHS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Graph 1: Production Trend */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col relative">
              <div className="mb-4">
                <h2 className="text-base font-semibold">Production Trend</h2>
                <p className="text-[13px] text-slate-500 mt-0.5">Planned vs Produced vs Rejected Quantity</p>
              </div>
              <div className="flex-1 min-h-[300px]">
                {loadingTrend ? (
                  <Skeleton className="w-full h-full rounded-md" />
                ) : (trendData?.length || 0) > 0 ? (
                  <div className="w-full h-full relative">
                    {trendData?.length === 1 && (
                      <div className="absolute top-0 right-4 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                        Trend needs multiple dates. Showing single point.
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fill: '#64748b' }} 
                          dy={10} 
                          tickFormatter={(val) => {
                            const d = new Date(val);
                            if (isNaN(d.getTime())) return val;
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
                          }}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <RechartsTooltip
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelFormatter={(label) => {
                            const d = new Date(label as string);
                            if (isNaN(d.getTime())) return label;
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                          }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Line type="monotone" dataKey="planned_qty" name="Planned Qty" stroke="#94a3b8" strokeWidth={2} dot={{ fill: '#94a3b8', r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="produced_qty" name="Produced Qty" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="rejected_qty" name="Rejected Qty" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No trend data found for the selected period</div>
                )}
              </div>
            </div>

            {/* Graph 2: Status Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
              <div className="mb-6">
                <h2 className="text-base font-semibold">Production Order Status</h2>
                <p className="text-[13px] text-slate-500 mt-0.5">Distribution of production orders by status</p>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                {loadingStatus ? (
                  <div className="space-y-4 w-full">
                    <Skeleton className="w-full h-8 rounded-full" />
                    <Skeleton className="w-full h-6 rounded" />
                    <Skeleton className="w-full h-6 rounded" />
                    <Skeleton className="w-full h-6 rounded" />
                  </div>
                ) : (statusDist?.length || 0) > 0 ? (
                  <div className="w-full">
                    {/* Stacked Bar */}
                    <div className="h-6 w-full flex rounded-sm overflow-hidden mb-8">
                      {statusDist?.map(entry => {
                        const total = statusDist.reduce((acc, curr) => acc + curr.count, 0) || 1;
                        return (
                          <div 
                            key={entry.status} 
                            style={{ 
                              width: `${(entry.count / total) * 100}%`,
                              backgroundColor: PIE_COLORS[entry.status as keyof typeof PIE_COLORS] || PIE_COLORS.default
                            }} 
                            className="h-full"
                            title={`${entry.label}: ${entry.count}`}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Status List */}
                    <div className="flex flex-col gap-4">
                      {statusDist?.map(entry => {
                        const total = statusDist.reduce((acc, curr) => acc + curr.count, 0) || 1;
                        const percentage = ((entry.count / total) * 100).toFixed(1);
                        const color = PIE_COLORS[entry.status as keyof typeof PIE_COLORS] || PIE_COLORS.default;
                        
                        return (
                          <div key={entry.status} className="flex items-center text-[13px]">
                            <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: color }} />
                            <div className="flex-1 font-semibold text-slate-800">{entry.label}</div>
                            <div className="w-10 text-right font-bold text-slate-800">{entry.count}</div>
                            <div className="w-14 text-right text-slate-600">{percentage}%</div>
                            <div className="w-20 ml-4 h-2.5 bg-slate-100 rounded-sm overflow-hidden hidden sm:block">
                               <div className="h-full rounded-sm" style={{ width: `${percentage}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">No status data found for the selected period</div>
                )}
              </div>
            </div>
          </div>

          {/* TABLES ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Recent Orders */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-base font-semibold">Recent Production Orders</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-5 py-3">Order No.</th>
                      <th className="px-5 py-3">Item</th>
                      <th className="px-5 py-3 text-right">Planned</th>
                      <th className="px-5 py-3 text-right">Produced</th>
                      <th className="px-5 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingOrders ? (
                      [1, 2, 3].map(i => (
                        <tr key={i}>
                          <td className="px-5 py-3" colSpan={5}><Skeleton className="h-4 w-full" /></td>
                        </tr>
                      ))
                    ) : recentOrders?.items?.length ? (
                      recentOrders.items.slice(recentOrders.items.length > ordersPageSize ? (ordersPage - 1) * ordersPageSize : 0, recentOrders.items.length > ordersPageSize ? ordersPage * ordersPageSize : ordersPageSize).map((order, index) => (
                        <tr key={`${order.production_order_no}-${index}`} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-medium text-blue-600">#{order.production_order_no}</td>
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-800">{order.item_code}</div>
                            <div className="text-xs text-slate-500 max-w-[200px] truncate" title={order.item_name || ''}>{order.item_name}</div>
                          </td>
                          <td className="px-5 py-3 text-right">{order.planned_qty}</td>
                          <td className="px-5 py-3 text-right font-medium">{order.produced_qty}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${order.status === 'Closed' ? 'bg-green-100 text-green-700' :
                                order.status === 'Released' ? 'bg-yellow-100 text-yellow-700' :
                                  order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-slate-100 text-slate-700'
                              }`}>
                              {order.status || 'Unknown'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-slate-400">No recent orders</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Show</span>
                  <select 
                    value={ordersPageSize}
                    onChange={(e) => {
                      setOrdersPageSize(Number(e.target.value));
                      setOrdersPage(1);
                    }}
                    className="border border-slate-200 rounded px-2 py-1 text-sm bg-white text-slate-700 outline-none focus:border-blue-500"
                  >
                    {[5, 10, 20, 50].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span className="text-sm text-slate-500">entries</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                    disabled={ordersPage === 1}
                    className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="px-4 py-1.5 text-sm font-medium text-slate-700">
                    Page {ordersPage} of {recentOrders?.total_pages || 1}
                  </div>
                  <button
                    onClick={() => setOrdersPage(p => Math.min(recentOrders?.total_pages || 1, p + 1))}
                    disabled={ordersPage >= (recentOrders?.total_pages || 1)}
                    className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Production by Warehouse */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-base font-semibold">Production by Warehouse</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-5 py-3">Warehouse</th>
                      <th className="px-5 py-3 text-right">Planned</th>
                      <th className="px-5 py-3 text-right">Produced</th>
                      <th className="px-5 py-3 text-right">Pending</th>
                      <th className="px-5 py-3 text-right">Prod %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingWarehouse ? (
                      [1, 2].map(i => (
                        <tr key={i}>
                          <td className="px-5 py-3" colSpan={5}><Skeleton className="h-4 w-full" /></td>
                        </tr>
                      ))
                    ) : warehouseData?.length ? (
                      warehouseData.map(wh => (
                        <tr key={wh.warehouse} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-medium text-slate-800">{wh.warehouse}</td>
                          <td className="px-5 py-3 text-right">{wh.planned_qty}</td>
                          <td className="px-5 py-3 text-right font-medium text-blue-600">{wh.produced_qty}</td>
                          <td className="px-5 py-3 text-right text-orange-600">{wh.pending_qty}</td>
                          <td className="px-5 py-3 text-right text-slate-500">{wh.production_percentage}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-slate-400">No warehouse data</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Produced Items */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden lg:col-span-2">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-base font-semibold">Top Produced Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-5 py-3 w-16">Rank</th>
                      <th className="px-5 py-3">Item</th>
                      <th className="px-5 py-3 text-right">Produced Qty</th>
                      <th className="px-5 py-3 text-right">Production %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingItems ? (
                      [1, 2, 3].map(i => (
                        <tr key={i}>
                          <td className="px-5 py-3" colSpan={4}><Skeleton className="h-4 w-full" /></td>
                        </tr>
                      ))
                    ) : topItems?.length ? (
                      topItems.slice(0, 5).map((item, index) => (
                        <tr key={item.item_code} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 text-slate-400 font-medium">#{index + 1}</td>
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-800">{item.item_code}</div>
                            <div className="text-xs text-slate-500 max-w-[300px] truncate" title={item.item_name || ''}>{item.item_name}</div>
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-slate-900">{item.produced_qty}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-500 w-10">{item.production_percentage}%</span>
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min(item.production_percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-slate-400">No item data</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
};

const KpiCard = ({ title, value, icon, bgColor, suffix, loading, tooltip }: {
  title: string, value: string | number, icon: React.ReactNode, bgColor: string, suffix?: string, loading?: boolean, tooltip?: string
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${bgColor} shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-500 truncate" title={tooltip}>{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <h3 className="text-2xl font-bold text-slate-900 truncate">
              {value}
            </h3>
          )}
          {suffix && !loading && (
            <span className="text-sm font-medium text-slate-500">{suffix}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className || ''}`} />
);
