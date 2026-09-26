import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UIEvent } from 'react';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import Loader from '../components/Loader';
import { useOperatorDashboard } from '../hooks/useOperatorDashboard';
import { useRecentSalesFeed } from '../hooks/useRecentSalesFeed';
import { handleError } from '../utils/errorHandler';
import { buildReceiptDocument, getReceiptLogoDataUrl, printReceiptInBrowser } from '../utils/receiptPrinter';
import type { DateRange, DashboardRecentSale } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const formatCurrency = (amount: number) => `Rs ${amount.toFixed(2)}`;

const formatSaleDate = (value?: string) => {
  if (!value) return '-';
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return value;
  return dateValue.toLocaleString();
};

const badgeClass: Record<string, string> = {
  cash: 'bg-emerald-100 text-emerald-800',
  card: 'bg-blue-100 text-blue-800',
  upi: 'bg-violet-100 text-violet-800',
  wallet: 'bg-amber-100 text-amber-800',
  unknown: 'bg-gray-100 text-gray-700',
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#6b7280'];

const RANGES: { label: string; value: DateRange }[] = [
  { label: 'Today', value: 'daily' },
  { label: 'This Week', value: 'weekly' },
  { label: 'This Month', value: 'monthly' },
  { label: 'This Year', value: 'yearly' },
  { label: 'All Time', value: 'all_time' },
];

const RANGE_LABELS: Record<DateRange, string> = {
  daily: "Today's",
  weekly: "This Week's",
  monthly: "This Month's",
  yearly: "This Year's",
  all_time: 'All-Time',
};

// --- Reusable SVG Icons ---
const Icons = {
  TrendingUp: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  Receipt: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  ShoppingCart: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Calculator: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
};

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}

const KpiCard = ({ title, value, subtitle, icon: Icon, colorClass, bgClass }: KpiCardProps) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
    <div className={`p-3 rounded-lg ${bgClass} ${colorClass}`}>
      <Icon />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  </div>
);

const Dashboard = () => {
  const [range, setRange] = useState<DateRange>('daily');
  const [salesSearch, setSalesSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();
  const { data, isLoading, error, forceRefresh, isRefetching } = useOperatorDashboard(range);
  const {
    data: salesFeed,
    isLoading: isSalesFeedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRecentSalesFeed({ range, search: debouncedSearch });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(salesSearch.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [salesSearch]);

  const feedItems = useMemo(
    () => salesFeed?.pages.flatMap((page) => page.items) ?? [],
    [salesFeed]
  );

  const handleSalesFeedScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (remaining < 80 && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  const handlePrint = async (sale: DashboardRecentSale) => {
    try {
      const saleId = sale.saleId || String(sale.docNum ?? sale.docEntry ?? 'N/A');
      const paymentType = (sale.paymentMethod || 'cash').toLowerCase();
      const logoSrc = await getReceiptLogoDataUrl();
      const receiptDocument = buildReceiptDocument({
        saleId,
        timestamp: formatSaleDate(sale.docDate),
        items: sale.items.map((item) => ({
          name: item.itemName || item.itemCode || 'Item',
          quantity: item.quantity,
          amount: item.lineTotal > 0 ? item.lineTotal : item.unitPrice * item.quantity,
          hsnCode: item.itemCode || 'N/A',
        })),
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        total: sale.total,
        paymentMethod: sale.paymentMethod || 'cash',
        paidAmount: paymentType === 'cash' ? sale.total : undefined,
        changeAmount: 0,
        customer: { name: sale.customerName || '' },
        logoSrc,
      });
      await printReceiptInBrowser(receiptDocument);
      toast.success('Receipt sent to printer');
    } catch (errorValue) {
      const message = handleError(errorValue, 'Receipt Print');
      toast.error(message);
    }
  };

  if (isLoading) {
    return <Loader message="Loading command center..." />;
  }

  if (error || !data) {
    return (
      <div className="h-full bg-gray-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard Sync Failed</h3>
          <p className="text-gray-500 mb-6 text-sm">{handleError(error, 'Dashboard')}</p>
          <button
            onClick={() => forceRefresh()}
            className="w-full py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const averageBillValue = data.billCount > 0 ? data.todayTotal / data.billCount : 0;
  const periodLabel = RANGE_LABELS[range];
  const returnTotals = (data.returnOrders ?? []).reduce(
    (acc, entry) => {
      const returnType = (entry.returnType || '').toLowerCase();
      if (returnType === 'exchange') acc.exchangeCount += 1;
      else acc.refundCount += 1;
      acc.totalRefundedAmount += entry.refundAmount || 0;
      return acc;
    },
    { refundCount: 0, exchangeCount: 0, totalRefundedAmount: 0 }
  );
  const totalReturnsCount = data.returnsCount;
  const returnRate = data.billCount > 0
    ? (totalReturnsCount / data.billCount) * 100
    : 0;

  // Chart data formatting
  const pieData = data.paymentBreakdown.map(p => ({
    name: p.method.toUpperCase(),
    value: p.total
  }));

  const barData = data.topSellingItems.slice(0, 5).map(item => ({
    name: item.itemName.length > 15 ? item.itemName.substring(0, 15) + '...' : item.itemName,
    Revenue: item.revenue,
    Quantity: item.quantity
  }));

  return (
    <div className="h-full bg-gray-50/50 p-4 sm:p-6 lg:p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Operations Command</h1>
            <p className="text-sm text-gray-500 mt-1">Real-time store performance and operational metrics.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-white shadow-sm border border-gray-200 rounded-lg p-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    range === r.value
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                forceRefresh();
                void queryClient.invalidateQueries({ queryKey: ['dashboard', 'operator', range] });
              }}
              className="inline-flex items-center justify-center w-9 h-9 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
              title="Refresh Dashboard"
            >
              <svg className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Executive KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard 
            title={`${periodLabel} Revenue`} 
            value={formatCurrency(data.todayTotal)}
            icon={Icons.TrendingUp}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50"
            subtitle={`${data.billCount} transactions processed`}
          />
          <KpiCard 
            title="Total Invoices" 
            value={data.billCount}
            icon={Icons.Receipt}
            colorClass="text-blue-600"
            bgClass="bg-blue-50"
            subtitle="Successful checkouts"
          />
          <KpiCard 
            title="Items Sold" 
            value={data.itemsSoldCount}
            icon={Icons.ShoppingCart}
            colorClass="text-indigo-600"
            bgClass="bg-indigo-50"
            subtitle="Total unit volume"
          />
          <KpiCard 
            title="Average Order Value" 
            value={formatCurrency(averageBillValue)}
            icon={Icons.Calculator}
            colorClass="text-amber-600"
            bgClass="bg-amber-50"
            subtitle="Per invoice average"
          />
        </div>

        {/* Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue by Product Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 lg:col-span-2 flex flex-col">
            <h2 className="text-base font-bold text-gray-900 mb-4">Top Selling Products (Revenue)</h2>
            <div className="flex-1 min-h-[250px]">
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">No sales data available.</div>
              )}
            </div>
          </div>

          {/* Payment Breakdown Pie */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
            <h2 className="text-base font-bold text-gray-900 mb-4">Payment Methods</h2>
            <div className="flex-1 min-h-[250px] relative">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    {/* @ts-expect-error recharts type mismatch */}
                    <Tooltip formatter={(value: string | number) => formatCurrency(Number(value))} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">No payment data available.</div>
              )}
            </div>
          </div>
        </div>

        {/* Operational & Customer Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance & Targets */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Personal Performance Targets</h2>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-semibold text-gray-700">Revenue Target</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(data.performance.achievedAmount)} <span className="text-gray-400 font-normal">/ {formatCurrency(data.performance.targetAmount)}</span></span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(data.performance.amountAchievementPercent, 100)}%` }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{data.performance.amountAchievementPercent.toFixed(1)}% achieved</p>
              </div>
              
              <div>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-semibold text-gray-700">Invoice Target</span>
                  <span className="text-sm font-bold text-gray-900">{data.performance.achievedBills} <span className="text-gray-400 font-normal">/ {data.performance.targetBills}</span></span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(data.performance.billsAchievementPercent, 100)}%` }}></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{data.performance.billsAchievementPercent.toFixed(1)}% achieved</p>
              </div>
            </div>

            {/* Customer Insights Mini-View */}
            {data.customerInsights && (
              <div className="mt-6 pt-5 border-t border-gray-100">
                 <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Icons.Users /> Customer Loyalty
                 </h3>
                 <div className="grid grid-cols-2 gap-3">
                   <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                     <p className="text-xs text-gray-500 font-medium">Repeat Rate</p>
                     <p className="text-lg font-bold text-gray-900">{data.customerInsights.repeatRate.toFixed(1)}%</p>
                   </div>
                   <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                     <p className="text-xs text-gray-500 font-medium">New Customers</p>
                     <p className="text-lg font-bold text-gray-900">{data.customerInsights.newCustomerCount}</p>
                   </div>
                 </div>
              </div>
            )}
          </div>

          {/* Returns & Health */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Returns & Health</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              <div className="p-3 bg-red-50 rounded-lg text-center">
                 <p className="text-2xl font-bold text-red-600">{returnRate.toFixed(1)}%</p>
                 <p className="text-xs font-medium text-red-800 uppercase mt-1">Return Rate</p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-center">
                 <p className="text-2xl font-bold text-gray-900">{returnTotals.refundCount}</p>
                 <p className="text-xs font-medium text-gray-500 uppercase mt-1">Refunds</p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-center">
                 <p className="text-2xl font-bold text-gray-900">{returnTotals.exchangeCount}</p>
                 <p className="text-xs font-medium text-gray-500 uppercase mt-1">Exchanges</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Top Reasons</h3>
              <div className="flex flex-wrap gap-2">
                {data.returnReasons.length === 0 ? (
                  <span className="text-sm text-gray-500">No return reasons captured.</span>
                ) : (
                  data.returnReasons.map((reason) => (
                    <span key={reason.reason} className="text-xs bg-gray-100 text-gray-700 font-medium rounded-full px-3 py-1 border border-gray-200">
                      {reason.reason} <span className="text-gray-400 ml-1">({reason.count})</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live Sales Feed */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50/50">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Transaction Feed
            </h2>
            <div className="relative w-full sm:w-64">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search transactions..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto" onScroll={handleSalesFeedScroll}>
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sale ID</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Status/Payment</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isSalesFeedLoading && feedItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading transactions...</td></tr>
                ) : feedItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No transactions found.</td></tr>
                ) : (
                  feedItems.map((sale) => {
                    const billLabel = sale.docNum ?? sale.docEntry ?? 'N/A';
                    const rowKey = String(sale.docEntry ?? sale.docNum ?? `${sale.docDate || ''}-${sale.total}`);
                    const badge = badgeClass[sale.paymentMethod?.toLowerCase() ?? 'unknown'] ?? badgeClass.unknown;
                    
                    return (
                      <tr key={rowKey} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-4 py-3 font-mono font-medium text-gray-900">#{billLabel}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatSaleDate(sale.docDate)}</td>
                        <td className="px-4 py-3">
                           <div className="font-medium text-gray-900 truncate max-w-[150px]" title={sale.customerName || 'Walk-in'}>
                             {sale.customerName || 'Walk-in'}
                           </div>
                           <div className="text-xs text-gray-400 truncate max-w-[150px]" title={sale.items.map(i => i.itemName).join(', ')}>
                             {sale.items.length} items
                           </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge}`}>
                              {(sale.paymentMethod || 'UNKNOWN').toUpperCase()}
                            </span>
                            {sale.hasReturn && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                RETURNED
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900 text-right">{formatCurrency(sale.total)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => void handlePrint(sale)}
                            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Print Receipt"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                {isFetchingNextPage && (
                  <tr><td colSpan={6} className="px-4 py-4 text-center text-xs text-gray-400">Loading more...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
