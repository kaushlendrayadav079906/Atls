import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import {
  useAtlasOverview,
  useAtlasSalesTrends,
  useAtlasInventorySummary,
  useAtlasBranchComparison,
  useAtlasReturnsSummary,
  useAtlasTopCustomers,
  useAtlasProductVelocity,
} from '../../hooks/useAtlas';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type DateRange = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';

const AtlasDashboard = () => {
  const { user } = useAppSelector((state) => state.auth);

  const [dateRange, setDateRange] = useState<DateRange>('monthly');
  // Manager is forced to use their assigned branch by the backend.
  // We don't expose a global branch selector to managers.
  const [selectedBranch, setSelectedBranch] = useState<string>(
    user?.role === 'admin' ? '' : (user?.branch_id || '')
  );

  const hasAccess = user?.role === 'admin' || user?.role === 'manager';
  
  const overviewQuery = useAtlasOverview(dateRange, undefined, undefined, selectedBranch || undefined);
  const trendsQuery = useAtlasSalesTrends(dateRange, undefined, undefined, selectedBranch || undefined);
  
  const inventoryEnabled = !!selectedBranch && hasAccess;
  const inventoryQuery = useAtlasInventorySummary(selectedBranch || undefined, inventoryEnabled);

  const branchCompEnabled = user?.role === 'admin' && hasAccess;
  const branchCompQuery = useAtlasBranchComparison(dateRange, undefined, undefined, branchCompEnabled);

  const returnsQuery = useAtlasReturnsSummary(dateRange, undefined, undefined, selectedBranch || undefined);
  const topCustomersQuery = useAtlasTopCustomers(dateRange, undefined, undefined, selectedBranch || undefined);
  const productVelocityQuery = useAtlasProductVelocity(dateRange, undefined, undefined, selectedBranch || undefined);

  // Only admins and managers can access Atlas
  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateRange(e.target.value as DateRange);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Atlas Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Executive overview of operational data and SAP integrated metrics.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={handleRangeChange}
            className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-900"
            aria-label="Date Range"
          >
            <option value="daily">Today</option>
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
            <option value="yearly">This Year</option>
            <option value="all_time">All Time</option>
          </select>
          
          {user?.role === 'admin' && (
            <input
              type="text"
              placeholder="Branch Code (Optional)"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-gray-900 w-48"
              aria-label="Branch Filter"
            />
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-slate-500 uppercase">Total Sales</h3>
          {overviewQuery.isLoading ? (
            <div className="h-8 bg-gray-100 animate-pulse rounded mt-2"></div>
          ) : (
            <p className="text-2xl font-bold text-slate-800 mt-1">
              ₹{overviewQuery.data?.totalSales?.toLocaleString() || 0}
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-slate-500 uppercase">Invoices</h3>
          {overviewQuery.isLoading ? (
            <div className="h-8 bg-gray-100 animate-pulse rounded mt-2"></div>
          ) : (
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {overviewQuery.data?.invoiceCount || 0}
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-slate-500 uppercase">Average Order Value</h3>
          {overviewQuery.isLoading ? (
            <div className="h-8 bg-gray-100 animate-pulse rounded mt-2"></div>
          ) : (
            <p className="text-2xl font-bold text-slate-800 mt-1">
              ₹{overviewQuery.data?.averageOrderValue?.toLocaleString() || 0}
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-slate-500 uppercase">SAP Credit Notes</h3>
          {returnsQuery.isLoading ? (
            <div className="h-8 bg-gray-100 animate-pulse rounded mt-2"></div>
          ) : (
            <div>
              <p className="text-2xl font-bold text-red-600 mt-1">
                ₹{returnsQuery.data?.sapCreditNotesTotal?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {returnsQuery.data?.sapCreditNotesCount || 0} Refunds / Pending Approvals: {returnsQuery.data?.pendingApprovalsCount || 0}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trends Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Sales Trend</h3>
          <div className="h-72">
            {trendsQuery.isLoading ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>
            ) : trendsQuery.isError ? (
              <div className="w-full h-full flex items-center justify-center text-red-400">Could not fetch trends.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsQuery.data?.trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '5 5' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="total" 
                    stroke="#111827" 
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: '#111827', stroke: '#fff', strokeWidth: 2 }}
                    name="Revenue" 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Branch Comparison (Admins Only) or Payment Split (Managers) */}
        {user?.role === 'admin' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Branch Comparison</h3>
            <div className="h-72">
              {branchCompQuery.isLoading ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400">Loading...</div>
              ) : branchCompQuery.isError ? (
                <div className="w-full h-full flex items-center justify-center text-red-400">Could not fetch branches.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchCompQuery.data?.branches || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="branchName" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#4B5563', fontSize: 12 }} 
                      width={100}
                    />
                    <Tooltip cursor={{ fill: '#F3F4F6' }} />
                    <Bar dataKey="total" fill="#111827" radius={[0, 4, 4, 0]} barSize={24} name="Total Sales" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Payment Methods</h3>
            <div className="h-72 flex items-center justify-center">
              {overviewQuery.isLoading ? (
                 <div className="text-gray-400">Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overviewQuery.data?.paymentBreakdown || []} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="method" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#F3F4F6' }} />
                    <Bar dataKey="total" fill="#111827" radius={[4, 4, 0, 0]} barSize={32} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Inventory Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Inventory Snapshot</h3>
        {!inventoryEnabled ? (
          <div className="text-sm text-slate-500 py-8 text-center bg-gray-50 rounded-lg">
            Please enter a branch code to view inventory snapshot.
          </div>
        ) : inventoryQuery.isLoading ? (
          <div className="text-sm text-slate-500 py-8 text-center bg-gray-50 rounded-lg animate-pulse">
            Loading stock from SAP...
          </div>
        ) : inventoryQuery.isError ? (
          <div className="text-sm text-red-500 py-8 text-center bg-red-50 rounded-lg">
            Failed to fetch inventory from SAP.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3 text-right">In Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(inventoryQuery.data?.items || []).slice(0, 10).map((item) => (
                  <tr key={item.itemCode} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.itemCode}</td>
                    <td className="px-4 py-3 text-slate-500">{item.itemName}</td>
                    <td className="px-4 py-3 text-right text-slate-800">
                      {item.inStock}
                    </td>
                  </tr>
                ))}
                {(inventoryQuery.data?.items?.length || 0) > 10 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-center text-xs text-gray-400">
                      Showing top 10 items.
                    </td>
                  </tr>
                )}
                {(inventoryQuery.data?.items?.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      No items found in this branch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Customers & Product Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Top Customers</h2>
          {topCustomersQuery.isLoading ? (
            <div className="h-48 flex items-center justify-center"><div className="animate-pulse text-gray-400">Loading...</div></div>
          ) : topCustomersQuery.isError ? (
            <div className="h-48 flex items-center justify-center text-red-500">Failed to load top customers</div>
          ) : topCustomersQuery.data && topCustomersQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2 text-right">Invoices</th>
                    <th className="px-4 py-2 text-right">Gross Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomersQuery.data.map((c) => (
                    <tr key={c.customerCode} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-slate-800">{c.customerName || c.customerCode}</td>
                      <td className="px-4 py-2 text-right">{c.invoiceCount}</td>
                      <td className="px-4 py-2 text-right">${c.totalSales.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500">No customers found</div>
          )}
        </div>

        {/* Product Velocity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Product Velocity</h2>
          {productVelocityQuery.isLoading ? (
            <div className="h-48 flex items-center justify-center"><div className="animate-pulse text-gray-400">Loading...</div></div>
          ) : productVelocityQuery.isError ? (
            <div className="h-48 flex items-center justify-center text-red-500">Failed to load product velocity</div>
          ) : productVelocityQuery.data && productVelocityQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2 text-right">Qty Sold</th>
                    <th className="px-4 py-2 text-right">Gross Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {productVelocityQuery.data.map((p) => (
                    <tr key={p.itemCode} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-slate-800">{p.itemName || p.itemCode}</td>
                      <td className="px-4 py-2 text-right">{p.quantitySold.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">${p.salesAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500">No products found</div>
          )}
        </div>
      </div>

    </div>
  );
};

export default AtlasDashboard;
