import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getAdminBranches, getAdminDashboard } from '../../services/api';
import type { Branch, DateRange } from '../../types';

const RANGES: { label: string; value: DateRange }[] = [
  { label: 'Today', value: 'daily' },
  { label: 'This Week', value: 'weekly' },
  { label: 'This Month', value: 'monthly' },
  { label: 'This Year', value: 'yearly' },
  { label: 'All Time', value: 'all_time' },
];

function formatCurrency(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const PAYMENT_COLORS = ['#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8', '#be185d', '#9d174d'];

const AdminDashboard = () => {
  const [range, setRange] = useState<DateRange>('monthly');
  const [branchId, setBranchId] = useState<string>('all');
  const forceRefreshRef = useRef(false);

  const branchesQuery = useQuery({
    queryKey: ['admin-branches'],
    queryFn: getAdminBranches,
    staleTime: 300_000,
    retry: 1,
  });

  const branches: Branch[] = branchesQuery.data ?? [];
  const selectedBranch = branchId === 'all' ? undefined : branchId;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard', range, branchId],
    queryFn: () => {
      const force = forceRefreshRef.current;
      forceRefreshRef.current = false;
      return getAdminDashboard(range, selectedBranch, force);
    },
    staleTime: 60_000,
    retry: 2,
  });


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-card admin-card-body flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-gray-500 text-sm">Performance overview, branch health, and revenue insights</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Range Selector */}
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm flex-wrap">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  range === r.value
                    ? 'bg-pink-500 text-white shadow'
                    : 'text-gray-600 hover:bg-pink-50 hover:text-pink-600'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="admin-branch-filter" className="text-sm text-gray-500">Branch</label>
            <select
              id="admin-branch-filter"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              disabled={branchesQuery.isLoading}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-300"
            >
              <option value="all">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              forceRefreshRef.current = true;
              void refetch();
            }}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-pink-50 text-pink-700 rounded-lg hover:bg-pink-100 transition-colors disabled:opacity-60"
          >
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div className="admin-card admin-card-body flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-14 h-14 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-700 font-semibold text-lg mb-1">Failed to load dashboard data</p>
          <p className="text-gray-500 text-sm mb-5">Could not connect to SAP. Check your network or SAP service.</p>
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="admin-btn-primary"
          >
            {isFetching ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="admin-kpi-card">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-pink-600 mt-1">
                {formatCurrency(data.totalRevenue)}
              </p>
            </div>
            <div className="admin-kpi-card">
              <p className="text-sm text-gray-500">Total Bills</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {data.billCount.toLocaleString()}
              </p>
            </div>
            <div className="admin-kpi-card">
              <p className="text-sm text-gray-500">Items Sold</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {data.itemsSoldCount.toLocaleString()}
              </p>
            </div>
            <div className="admin-kpi-card">
              <p className="text-sm text-gray-500">Average Bill Value</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {formatCurrency(data.averageBillValue)}
              </p>
            </div>
            <div className="admin-kpi-card">
              <p className="text-sm text-gray-500">Active Branches</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{data.activeBranches.toLocaleString()}</p>
            </div>
            <div className="admin-kpi-card">
              <p className="text-sm text-gray-500">Active Users</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{data.activeUsers.toLocaleString()}</p>
            </div>
            <div className="admin-kpi-card">
              <p className="text-sm text-gray-500">Revenue Growth</p>
              <p className={`text-2xl font-bold mt-1 ${data.growthPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(data.growthPercent)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Prev: {formatCurrency(data.previousRevenue)}</p>
            </div>
            <div className="admin-kpi-card">
              <p className="text-sm text-gray-500">Top Branch</p>
              <p className="text-base font-bold text-gray-800 mt-1 truncate">
                {data.topBranch?.branchName ?? 'N/A'}
              </p>
              <p className="text-xs text-pink-600 mt-1 font-semibold">
                {data.topBranch ? formatCurrency(data.topBranch.total) : 'No data'}
              </p>
            </div>
          </div>

        {/* Returns & Exchange Analytics */}
          {((data.totalReturns ?? 0) > 0 || (data.totalRefundedAmount ?? 0) > 0) && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800 px-1">Returns & Exchange Analytics</h2>

              {/* Returns KPI Cards */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="admin-kpi-card border-l-4 border-l-orange-400">
                  <p className="text-sm text-gray-500">Total Returns</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">{(data.totalReturns ?? 0).toLocaleString()}</p>
                  <div className="flex gap-2 mt-1 text-xs">
                    <span className="text-blue-600 font-medium">{data.refundCount ?? 0} refunds</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-amber-600 font-medium">{data.exchangeCount ?? 0} exchanges</span>
                  </div>
                </div>
                <div className="admin-kpi-card border-l-4 border-l-red-400">
                  <p className="text-sm text-gray-500">Return Rate</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{(data.returnRate ?? 0).toFixed(1)}%</p>
                  <p className="text-xs text-gray-400 mt-1">of total bills</p>
                </div>
                <div className="admin-kpi-card border-l-4 border-l-purple-400">
                  <p className="text-sm text-gray-500">Total Refunded</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{formatCurrency(data.totalRefundedAmount ?? 0)}</p>
                </div>
                <div className="admin-kpi-card border-l-4 border-l-teal-400">
                  <p className="text-sm text-gray-500">Net Revenue</p>
                  <p className="text-2xl font-bold text-teal-600 mt-1">{formatCurrency(data.netRevenueAfterReturns ?? data.totalRevenue)}</p>
                  <p className="text-xs text-gray-400 mt-1">after returns</p>
                </div>
              </div>

              {/* Top Return Reasons */}
              {(data.topReturnReasons ?? []).length > 0 && (
                <div className="admin-card admin-card-body">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Return Reasons</h3>
                  <div className="space-y-2">
                    {(data.topReturnReasons ?? []).map((r) => {
                      const maxCount = Math.max(...(data.topReturnReasons ?? []).map((x) => x.count));
                      const pct = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
                      return (
                        <div key={r.reason} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-700 truncate">{r.reason}</span>
                              <span className="text-xs font-semibold text-gray-500 ml-2">{r.count}×</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-400 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trend + Payment Split */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="admin-card admin-card-body xl:col-span-2">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Sales Trend</h2>
              {data.trend.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">No data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v: number) =>
                        v >= 1_00_000
                          ? `₹${(v / 1_00_000).toFixed(1)}L`
                          : v >= 1_000
                          ? `₹${(v / 1_000).toFixed(0)}k`
                          : `₹${v}`
                      }
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(toNumber(value)), 'Revenue']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#ec4899"
                      strokeWidth={2}
                      fill="url(#colorTotal)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="admin-card admin-card-body">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Payment Mix</h2>
              {data.paymentSplit.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-16">No payment data</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.paymentSplit}
                      dataKey="total"
                      nameKey="method"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {data.paymentSplit.map((entry, idx) => (
                        <Cell key={entry.method} fill={PAYMENT_COLORS[idx % PAYMENT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(toNumber(value))} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top products + Branch performance */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="admin-card admin-card-body">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Top Products by Quantity</h2>
              {data.topProducts.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">No product data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={data.topProducts.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="itemName"
                      width={130}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) =>
                        String(name) === 'quantity'
                          ? [`${toNumber(value)} units`, 'Quantity']
                          : [formatCurrency(toNumber(value)), 'Revenue']
                      }
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="quantity" fill="#ec4899" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="admin-card overflow-hidden">
              <div className="admin-card-header">
                <h2 className="text-base font-semibold text-gray-800">Branch Performance Snapshot</h2>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th>Branch</th>
                      <th>Bills</th>
                      <th className="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.branchBreakdown.length === 0 ? (
                      <tr>
                        <td className="px-6 py-6 text-gray-400" colSpan={3}>No branch data available</td>
                      </tr>
                    ) : (
                      data.branchBreakdown.slice(0, 8).map((branch) => (
                        <tr key={branch.branchId}>
                          <td className="font-medium text-gray-800">{branch.branchName}</td>
                          <td>{branch.billCount.toLocaleString()}</td>
                          <td className="text-right font-semibold text-pink-600">{formatCurrency(branch.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="admin-card overflow-hidden">
            <div className="admin-card-header">
              <h2 className="text-base font-semibold text-gray-800">Top Performers</h2>
              <p className="text-xs text-gray-400">Ranked by sales amount</p>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th>#</th>
                    <th>Employee Code</th>
                    <th className="text-right">Bills</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topEmployees.length === 0 ? (
                    <tr>
                      <td className="px-6 py-6 text-gray-400" colSpan={4}>No employee sales data available</td>
                    </tr>
                  ) : (
                    data.topEmployees.map((employee, index) => (
                      <tr key={`${employee.employeeCode}-${index}`}>
                        <td className="text-gray-400">{index + 1}</td>
                        <td className="text-gray-700 font-mono text-xs">{employee.employeeCode}</td>
                        <td className=" text-gray-700">{employee.billCount.toLocaleString()}</td>
                        <td className=" font-semibold text-pink-600">
                          {formatCurrency(employee.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Products Table */}
          {data.topProducts.length > 0 && (
            <div className="admin-card overflow-hidden">
              <div className="admin-card-header">
                <h2 className="text-base font-semibold text-gray-800">Top Products Detail</h2>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th>#</th>
                      <th>Item Code</th>
                      <th>Product</th>
                      <th className="text-right">Qty Sold</th>
                      <th className="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.topProducts.map((p, i) => (
                      <tr key={p.itemCode} className="hover:bg-gray-50/70">
                        <td className="text-gray-400">{i + 1}</td>
                        <td className="text-gray-500 font-mono text-xs">{p.itemCode}</td>
                        <td className="font-medium text-gray-800">{p.itemName}</td>
                        <td className=" text-gray-700">{p.quantity.toLocaleString()}</td>
                        <td className=" font-semibold text-pink-600">
                          {formatCurrency(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {data?.customerInsights && (
        <div className="admin-card admin-card-body">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Insights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="admin-kpi-card border-l-4 border-l-pink-400">
              <p className="text-sm text-gray-500">Repeat Customers</p>
              <p className="text-2xl font-bold text-pink-600 mt-1">{data.customerInsights.repeatCustomerCount}</p>
              <p className="text-xs text-gray-400 mt-1">{data.customerInsights.repeatRate.toFixed(1)}% repeat rate</p>
            </div>
            <div className="admin-kpi-card border-l-4 border-l-blue-400">
              <p className="text-sm text-gray-500">New Customers</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{data.customerInsights.newCustomerCount}</p>
            </div>
            <div className="admin-kpi-card border-l-4 border-l-green-400">
              <p className="text-sm text-gray-500">Total CLV</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(data.customerInsights.totalCLV)}</p>
            </div>
          </div>

          {data.customerInsights.topCustomers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Customers</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                      <th className="text-left py-1.5">Customer</th>
                      <th className="text-right py-1.5">Total Spend</th>
                      <th className="text-right py-1.5">Bills</th>
                      <th className="text-right py-1.5">Avg. Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.customerInsights.topCustomers.slice(0, 5).map((c) => (
                      <tr key={c.cardCode}>
                        <td className="py-1.5 text-gray-800">{c.cardName || c.cardCode}</td>
                        <td className="py-1.5 text-right font-semibold text-pink-600">{formatCurrency(c.totalSpend)}</td>
                        <td className="py-1.5 text-right text-gray-600">{c.billCount}</td>
                        <td className="py-1.5 text-right text-gray-600">{formatCurrency(c.averageOrderValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
