import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    AlertCircle, ArrowRight, Bell, Check, ChevronDown, CircleHelp, Clock3,
    PackageSearch, RefreshCcw, ShoppingBag, ShoppingCart, Sparkles,
    TrendingUp, TriangleAlert, Users, MessageSquarePlus, Package, FileText
} from 'lucide-react';
import { atlasApi, dashboardApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';


const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export const Dashboard = () => {
  const { user } = useAuth();
  

  const [period, setPeriod] = useState<string>('daily');
  const [branchId, setBranchId] = useState<string>(user?.branch_id || '');

  const { data: summary, isLoading: loadingSummary, isError: errorSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['atlasOverview', branchId, period],
    queryFn: () => atlasApi.getOverview(branchId, period),
  });

  const { data: recentSales, isLoading: loadingSales, refetch: refetchSales } = useQuery({
    queryKey: ['recentSales', branchId, period],
    queryFn: () => atlasApi.getRecentSalesFeed({ range: period, branch: branchId, limit: 10 }),
  });

  const { data: alerts, isLoading: loadingAlerts, isError: errorAlerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['dashboardAlerts', branchId],
    queryFn: () => dashboardApi.getAlerts(), // assuming backend filters by branch inside
  });

  const { data: topProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['topProducts', branchId, period],
    queryFn: () => atlasApi.getTopProducts(branchId, period),
  });

  const { data: trendData, isLoading: loadingTrend, isError: errorTrend, refetch: refetchTrend } = useQuery({
    queryKey: ['salesTrend', branchId, period],
    queryFn: () => atlasApi.getSalesTrend(branchId, period),
  });

  const { data: inventoryRisk, isLoading: loadingRisk, isError: errorRisk, refetch: refetchRisk } = useQuery({
    queryKey: ['inventoryRisk', branchId],
    queryFn: () => dashboardApi.getInventoryRisk(),
  });
  
  const { data: sapHealth } = useQuery({
    queryKey: ['sapHealth'],
    queryFn: async () => {
        try {
            const res = await fetch('/api/v1/health');
            const data = await res.json();
            return data.sap_connected;
        } catch {
            return false;
        }
    },
    refetchInterval: 30000,
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchSales();
    refetchAlerts();
    refetchProducts();
    refetchTrend();
    refetchRisk();
  };

  const trendPoints = trendData?.trend ?? [];
  
  

  const pendingApprovals = (alerts ?? []).filter((item: any) => item.status === 'Pending').length;
  const lowStockCount = inventoryRisk?.length ?? 0;

  const statCards = [
    {
      title: 'Sales ' + (period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : period === 'monthly' ? 'This Month' : period === 'yearly' ? 'This Year' : 'Total'),
      highlight: loadingSummary ? '...' : errorSummary ? 'ERR' : '',
      value: loadingSummary ? 'Loading...' : errorSummary ? 'Error' : (summary?.totalSales !== undefined ? money.format(summary.totalSales) : '₹0.00'),
      meta: '',
      icon: ShoppingCart,
      accent: 'from-emerald-500 to-emerald-300',
      tint: 'bg-emerald-500/20 text-emerald-700',
    },
    {
      title: 'Completed Bills',
      highlight: loadingSummary ? '...' : errorSummary ? 'ERR' : '',
      value: loadingSummary ? 'Loading...' : errorSummary ? 'Error' : `${summary?.invoiceCount ?? 0}`,
      meta: '',
      icon: Check,
      accent: 'from-blue-500 to-sky-300',
      tint: 'bg-blue-100 text-blue-300',
    },
    {
      title: 'Active Shift',
      highlight: 'OPEN',
      value: user?.name || 'Unknown User',
      meta: user?.role || 'Operator',
      icon: Clock3,
      accent: 'from-violet-500 to-violet-300',
      tint: 'bg-emerald-500/20 text-emerald-600 border border-emerald-200',
    },
    {
      title: 'Low-stock Items',
      highlight: loadingRisk ? '...' : errorRisk ? 'ERR' : '',
      value: loadingRisk ? 'Loading...' : errorRisk ? 'Error' : `${lowStockCount}`,
      meta: 'Requires attention',
      icon: TriangleAlert,
      accent: 'from-amber-500 to-orange-300',
      tint: 'bg-red-100 text-red-600',
    },
    {
      title: 'Pending Approvals',
      highlight: loadingAlerts ? '...' : errorAlerts ? 'ERR' : '',
      value: loadingAlerts ? 'Loading...' : errorAlerts ? 'Error' : `${pendingApprovals}`,
      meta: 'Current',
      icon: Bell,
      accent: 'from-rose-500 to-pink-300',
      tint: 'bg-emerald-500/20 text-emerald-600',
    },
  ];

  const alertRows = (alerts ?? []).slice(0, 4);
  const recentSalesData = recentSales?.items ?? [];

  return (
    <div className="flex flex-col gap-5 text-slate-900">
      {/* ROW 1: Heading and Filters */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-slate-900">Retail Operations Dashboard</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">Real-time overview of your business operations</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium transition ${sapHealth ? 'text-emerald-600' : 'text-red-600'}`}>
             <div className={`h-2 w-2 rounded-full ${sapHealth ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
             {sapHealth ? 'SAP Connected' : 'SAP Disconnected'}
          </div>

          <select 
            value={branchId} 
            onChange={(e) => setBranchId(e.target.value)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 outline-none"
          >
            {user?.role === 'admin' && <option value="">All Branches</option>}
            <option value={user?.branch_id || ''}>{user?.store_name || user?.branch_id || 'Branch (Unknown)'}</option>
          </select>

          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 outline-none"
          >
            <option value="daily">TODAY</option>
            <option value="weekly">WEEK</option>
            <option value="monthly">MONTH</option>
            <option value="yearly">YEAR</option>
            <option value="all_time">TOTAL</option>
          </select>

          <button onClick={handleRefresh} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-medium text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500">
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ROW 2: Main Content Layout */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        
        {/* LEFT COLUMN */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {statCards.map(({ title, value, highlight, meta, icon: Icon, accent, tint }, i) => (
              <div key={title} className="flex flex-col justify-between rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${accent}`}>
                    <Icon className="h-4 w-4 text-slate-900" />
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tint}`}>
                      {highlight}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-[12px] font-medium text-slate-500">{title}</div>
                  <div className="mt-0.5 text-[22px] font-bold tracking-tight text-slate-900">{value}</div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                  {i === 3 ? <TriangleAlert className="h-3.5 w-3.5 text-amber-500" /> : i === 4 ? <FileText className="h-3.5 w-3.5 text-sky-400" /> : <ShoppingBag className="h-3.5 w-3.5 text-sky-400" />}
                  <span>{meta || `${parseInt(value) || 0} completed bills`}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            {/* Sales Overview */}
            <div className="rounded-[16px] border border-slate-200 bg-white p-4">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Sales Overview</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] font-medium text-slate-500">
                  {['daily', 'weekly', 'monthly', 'yearly', 'all_time'].map((p) => (
                    <button 
                      key={p} 
                      className={`px-3 py-1.5 rounded-md transition-colors ${period === p ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'hover:text-slate-900'}`}
                      onClick={() => setPeriod(p)}
                    >
                      {p === 'daily' ? 'Today' : p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : p === 'yearly' ? 'Year' : 'Total'}
                    </button>
                  ))}
                </div>
              </div>

              {loadingTrend ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-slate-500">Loading chart...</div>
              ) : errorTrend ? (
                <StateMessage type="error" message="Failed to load trend" />
              ) : (trendPoints.length === 0 ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-slate-500">No sales data for this period</div>
              ) : (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey={(d) => (d.label || d.date || '').split(' ')[0]} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }} 
                        dy={10} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(0) + 'K' : value}`}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`₹${value.toFixed(2)}`, 'Sales']}
                        labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="sales" 
                        stroke="#0ea5e9" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorSales)" 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }}
                        dot={trendPoints.length === 1 ? { r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' } : false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
              <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5 font-medium"><span className="h-1 w-4 rounded-full bg-sky-500" /> Current Period</span>
              </div>
            </div>

            {/* Orders Overview */}
            <div className="rounded-[16px] border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Orders Overview</span>
                </div>
              </div>
              
              {loadingTrend ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-slate-500">Loading orders...</div>
              ) : errorTrend ? (
                <StateMessage type="error" message="Failed to load orders" />
              ) : (trendPoints.length === 0 ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-slate-500">No orders for this period</div>
              ) : (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey={(d) => (d.label || d.date || '').split(' ')[0]} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }} 
                        dy={10} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        allowDecimals={false}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [value, 'Orders']}
                        labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar 
                        dataKey="invoice_count" 
                        fill="url(#colorOrders)" 
                        radius={[4, 4, 0, 0]} 
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </div>

 {/* Tables */}
          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-[16px] border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Recent Sales</span>
                </div>
                <Link to="/sales" className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-blue-600">
                  View all <ChevronDown className="h-3 w-3 -rotate-90" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[12px]">
                  <thead className="border-b border-slate-200 text-[10px] font-medium text-slate-500">
                    <tr>
                      <th className="pb-2">Invoice</th>
                      <th className="pb-2">Customer</th>
                      <th className="pb-2">Amount</th>
                      <th className="pb-2">Payment Method</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-800/30 text-slate-700">
                    {loadingSales ? (
                      <tr><td colSpan={6} className="py-4 text-center">Loading...</td></tr>
                    ) : recentSalesData.slice(0, 6).map((sale: any, i: number) => (
                      <tr key={i} className="hover:bg-sky-800/20">
                        <td className="py-2.5 font-medium text-sky-400">{sale.docNum ? `INV-${sale.docNum}` : (sale.saleId || 'Unknown')}</td>
                        <td className="py-2.5">{sale.customerName || 'Walk-in Customer'}</td>
                        <td className="py-2.5 font-semibold text-slate-900">{money.format(sale.total || 0)}</td>
                        <td className="py-2.5 text-slate-500">{sale.paymentMethod || 'Unavailable'}</td>
                        <td className="py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${sale.hasReturn ? 'bg-red-100 text-red-600' : 'bg-emerald-500/20 text-emerald-600'}`}>
                            {sale.hasReturn ? 'Refunded' : 'Completed'}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-500">{sale.docDate || 'Unknown'}</td>
                      </tr>
                    ))}
                    {!loadingSales && recentSalesData.length === 0 && (
                      <tr><td colSpan={6} className="py-4 text-center text-slate-500">No recent sales found for this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[16px] border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PackageSearch className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">Top Products</span>
                </div>
                <Link to="/products" className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-blue-600">
                  View all <ChevronDown className="h-3 w-3 -rotate-90" />
                </Link>
              </div>
              <table className="min-w-full text-left text-[12px]">
                <thead className="border-b border-slate-200 text-[10px] font-medium text-slate-500">
                  <tr>
                    <th className="pb-2 w-8">#</th>
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-right">Units Sold</th>
                    <th className="pb-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-800/30 text-slate-700">
                  {(topProducts || []).slice(0, 5).map((prod: any, idx: number) => (
                    <tr key={idx} className="hover:bg-sky-800/20">
                      <td className="py-2.5 font-medium text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-slate-500">
                          <Package className="h-3 w-3" />
                        </div>
                        {prod.itemName}
                      </td>
                      <td className="py-2.5 text-right">{prod.quantitySold}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-900">{money.format(prod.salesAmount || 0)}</td>
                    </tr>
                  ))}
                  {(!topProducts || topProducts.length === 0) && (
                      <tr><td colSpan={4} className="py-4 text-center text-slate-500">No product data for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk and Quick Actions */}
          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-[16px] border border-slate-200 bg-white p-4 opacity-75">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-400" />
                  <span className="text-[14px] font-semibold">AI Risk Analysis Summary</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-200 bg-slate-50">
                  <span className="text-[20px] font-bold text-slate-900">N/A</span>
                </div>
                <div className="mr-4">
                  <div className="text-[11px] text-slate-500">Overall Risk Score</div>
                  <div className="text-[13px] font-semibold text-sky-400">Not Available</div>
                </div>
                <div className="grid flex-1 grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-[16px] font-bold text-slate-900">-</div>
                    <div className="mt-1 text-[10px] leading-tight text-slate-500">Inventory Risks</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-[16px] font-bold text-slate-900">-</div>
                    <div className="mt-1 text-[10px] leading-tight text-slate-500">Sales Anomalies</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-[16px] font-bold text-slate-900">-</div>
                    <div className="mt-1 text-[10px] leading-tight text-slate-500">Integration Issue</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[16px] border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-400" />
                <span className="text-[14px] font-semibold">Quick Actions</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <Link to="/pos" className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 hover:bg-sky-800/40">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                    <span className="text-center text-[9px] leading-tight text-slate-500">New Sale</span>
                </Link>
                <Link to="/products" className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 hover:bg-sky-800/40">
                    <PackageSearch className="h-4 w-4 text-blue-600" />
                    <span className="text-center text-[9px] leading-tight text-slate-500">Add Product</span>
                </Link>
                <Link to="/reports/sales" className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 hover:bg-sky-800/40">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-center text-[9px] leading-tight text-slate-500">Report</span>
                </Link>
                <Link to="/returns" className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 hover:bg-sky-800/40">
                    <Check className="h-4 w-4 text-blue-600" />
                    <span className="text-center text-[9px] leading-tight text-slate-500">Approvals</span>
                </Link>
                <button className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 hover:bg-sky-800/40">
                    <CircleHelp className="h-4 w-4 text-blue-600" />
                    <span className="text-center text-[9px] leading-tight text-slate-500">More</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT SIDEBAR (AI & Alerts) */}
        <div className="flex w-full flex-col gap-5 xl:w-[280px]">
          
          <div className="rounded-[16px] border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-400" />
                <span className="text-[14px] font-semibold">AI Assistant</span>
              </div>
              <button className="flex items-center gap-1 rounded border border-blue-600/50 bg-blue-600/20 px-2 py-1 text-[10px] font-medium text-blue-600">
                <MessageSquarePlus className="h-3 w-3" /> New Chat
              </button>
            </div>
            <div className="mb-4 flex items-start gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                <Sparkles className="h-3 w-3" />
              </div>
              <div className="rounded-xl rounded-tl-sm bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                <span className="font-semibold text-slate-900">Hello! I'm your Atls AI Assistant.</span><br/>
                <span className="text-slate-500">I can help you with:</span>
                <ul className="mt-1 list-inside list-disc text-slate-500">
                  <li>Check sales, inventory, customers</li>
                  <li>Generate reports (PDF)</li>
                  <li>Analyze business risks</li>
                  <li>Find data from SAP system</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <input type="text" placeholder="Ask anything about your business..." className="flex-1 bg-transparent px-2 text-[11px] text-slate-900 outline-none placeholder:text-slate-500" />
              <button className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white">
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="rounded-[16px] border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-400" />
                <span className="text-[14px] font-semibold">Alerts & Approvals</span>
              </div>
              <Link to="/returns" className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-blue-600">
                View all <ChevronDown className="h-3 w-3 -rotate-90" />
              </Link>
            </div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-medium">
              <button className="rounded bg-blue-600 px-2 py-1 text-white">All ({(alerts || []).length})</button>
              <button className="rounded px-2 py-1 text-slate-500 hover:text-slate-900">Approvals</button>
            </div>
            <div className="flex flex-col gap-2">
              {alertRows.map((alert: any, i: number) => (
                <div key={i} className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${alert.status === 'Pending' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-100 text-blue-400'}`}>
                    {alert.status === 'Pending' ? <TriangleAlert className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <div className="truncate text-[11px] font-semibold text-slate-900">{alert.request_type || 'Notification'}</div>
                      <div className="text-[9px] text-slate-500 whitespace-nowrap">{new Date(alert.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-slate-500">{alert.reason || 'Attention required'}</div>
                    {alert.status === 'Pending' && (
                      <div className="mt-1.5 inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-500">
                        Pending
                      </div>
                    )}
                    {alert.status === 'Approved' && (
                      <div className="mt-1 flex items-center justify-between">
                        <div className="text-[10px] text-slate-500">Approved</div>
                        <div className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600">SAP Confirmed</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {alertRows.length === 0 && (
                  <div className="text-center text-[11px] text-slate-500 mt-4">No active alerts or approvals.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const StateMessage = ({ type, message }: { type: 'error' | 'empty'; message: string }) => (
  <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 px-4 text-center">
    {type === 'error' ? <AlertCircle className="h-8 w-8 text-red-400" /> : <PackageSearch className="h-8 w-8 text-slate-500" />}
    <div className={type === 'error' ? 'text-red-300' : 'text-slate-500'}>{message}</div>
  </div>
);
