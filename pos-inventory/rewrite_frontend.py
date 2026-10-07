import os

tsx_code = """import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MoreVertical,
  Search,
  Wallet,
  FileText,
  TrendingUp,
  Building2,
  Loader2,
  AlertCircle,
  RefreshCcw,
  Users,
  CreditCard,
  CheckCircle2,
  Undo2
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { paymentsReportApi } from '../../api/endpoints';
import { useDebounce } from '../../hooks/useDebounce';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const StateMessage = ({ type, message, onRetry }: { type: 'error' | 'empty'; message: string; onRetry?: () => void }) => (
  <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 px-4 text-center">
    {type === 'error' ? <AlertCircle className="h-8 w-8 text-red-400" /> : <FileText className="h-8 w-8 text-slate-300" />}
    <div className={type === 'error' ? 'text-red-500 text-sm' : 'text-slate-500 text-sm'}>{message}</div>
    {onRetry && (
      <button onClick={onRetry} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
        <RefreshCcw size={12} /> Retry
      </button>
    )}
  </div>
);

const METHOD_COLORS: Record<string, string> = {
  cash: '#3b82f6',     // Blue
  card: '#a855f7',     // Purple
  upi: '#f97316',      // Orange
  transfer: '#10b981', // Green
  credit: '#14b8a6',   // Teal
  other: '#64748b'     // Gray
};

const getMethodColor = (method: string) => {
  const m = method.toLowerCase();
  if (m.includes('card')) return METHOD_COLORS.card;
  if (m.includes('upi')) return METHOD_COLORS.upi;
  if (m.includes('transfer') || m.includes('bank')) return METHOD_COLORS.transfer;
  if (m.includes('cash')) return METHOD_COLORS.cash;
  if (m.includes('credit')) return METHOD_COLORS.credit;
  return METHOD_COLORS.other;
};

export const PaymentReportPage = () => {
  const [activeTab, setActiveTab] = useState('Payment Overview');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  
  // Filters
  const [dateRange, setDateRange] = useState('monthly');
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>(undefined);
  const [paymentStatus, setPaymentStatus] = useState<string | undefined>(undefined);
  const [customer, setCustomer] = useState<string | undefined>(undefined);
  
  // Pending Filters (For Apply)
  const [pendingFilters, setPendingFilters] = useState({
    dateRange: 'monthly',
    branchId: undefined as string | undefined,
    paymentMethod: undefined as string | undefined,
    paymentStatus: undefined as string | undefined,
    customer: undefined as string | undefined
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const offset = (page - 1) * limit;

  const applyFilters = () => {
    setDateRange(pendingFilters.dateRange);
    setBranchId(pendingFilters.branchId);
    setPaymentMethod(pendingFilters.paymentMethod);
    setPaymentStatus(pendingFilters.paymentStatus);
    setCustomer(pendingFilters.customer);
    setPage(1);
  };

  const resetFilters = () => {
    const defaults = {
      dateRange: 'monthly',
      branchId: undefined,
      paymentMethod: undefined,
      paymentStatus: undefined,
      customer: undefined
    };
    setPendingFilters(defaults);
    setDateRange(defaults.dateRange);
    setBranchId(defaults.branchId);
    setPaymentMethod(defaults.paymentMethod);
    setPaymentStatus(defaults.paymentStatus);
    setCustomer(defaults.customer);
    setSearchTerm('');
    setPage(1);
  };

  const queryParams = {
    range: dateRange,
    branch: branchId,
    payment_method: paymentMethod,
    customer: customer
  };

  const { data: overview, isLoading: loadingOverview, isError: errorOverview, refetch: refetchOverview } = useQuery({
    queryKey: ['payments-overview', queryParams],
    queryFn: () => paymentsReportApi.getOverview(queryParams),
    retry: 1
  });

  const { data: distribution, isLoading: loadingDist, isError: errorDist, refetch: refetchDist } = useQuery({
    queryKey: ['payments-distribution', queryParams],
    queryFn: () => paymentsReportApi.getDistribution(queryParams),
    retry: 1
  });

  const { data: trend, isLoading: loadingTrend, isError: errorTrend, refetch: refetchTrend } = useQuery({
    queryKey: ['payments-trend', queryParams],
    queryFn: () => paymentsReportApi.getTrend(queryParams),
    retry: 1
  });

  const { data: transactionsData, isLoading: loadingTrans, isError: errorTrans, refetch: refetchTrans } = useQuery({
    queryKey: ['payments-transactions', { ...queryParams, search: debouncedSearch, offset, limit, status: paymentStatus }],
    queryFn: () => paymentsReportApi.getTransactions({ ...queryParams, search: debouncedSearch || undefined, offset, limit }),
    retry: 1
  });

  const refetchAll = () => {
    refetchOverview();
    refetchDist();
    refetchTrend();
    refetchTrans();
  };

  const kpis = [
    { title: 'Total Payments', val: overview ? fmt(overview.totalPayments) : '₹0', icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-100' },
    { title: 'Paid Invoices', val: overview ? `${overview.paymentCount}` : '0', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { title: 'Pending Payments', val: '₹0', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100' }, // SAP IncomingPayments doesn't track pending directly here unless queried from invoices
    { title: 'Refunds Issued', val: overview ? fmt(overview.refundsAmount || 0) : '₹0', icon: Undo2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { title: 'Avg. Payment Value', val: overview ? fmt(overview.averagePaymentValue) : '₹0', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100' },
  ];

  const pieData = distribution?.map(d => ({
    name: d.method.charAt(0).toUpperCase() + d.method.slice(1),
    value: d.total,
    count: d.count,
    color: getMethodColor(d.method)
  })) || [];

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-[#f8fafc] font-sans -m-4 sm:-m-5 lg:-m-6 p-4 sm:p-5 lg:p-6 overflow-y-auto">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Report</h1>
          <p className="mt-1 text-[13px] text-slate-500">View and analyze payment transactions, methods and collection details.</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white shadow-[0_4px_12px_rgba(37,99,235,0.2)] hover:bg-blue-700 transition-colors">
          <Download className="h-4 w-4" />
          Export
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200">
        {['Payment Overview', 'Method Analysis', 'Daily/Monthly Trend', 'Customer Payments'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn("px-5 py-2.5 text-[13px] font-medium rounded-t-lg transition-all border-b-2",
              activeTab === tab 
                ? "bg-blue-50/50 text-blue-700 border-blue-600" 
                : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {kpis.map((card, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-start gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", card.bg, card.color)}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1">{card.title}</p>
                <div className="text-lg font-bold text-slate-900">
                  {loadingOverview ? <Loader2 className="h-4 w-4 animate-spin text-slate-300" /> : card.val}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Row */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Date Range</label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select 
                value={pendingFilters.dateRange}
                onChange={(e) => setPendingFilters(p => ({ ...p, dateRange: e.target.value }))}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-[12px] text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="daily">Today</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
                <option value="yearly">This Year</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Branch</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select 
                value={pendingFilters.branchId || ''}
                onChange={(e) => setPendingFilters(p => ({ ...p, branchId: e.target.value || undefined }))}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-[12px] text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Branches</option>
                <option value="WH-001">Main Branch (WH-001)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Payment Method</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select 
                value={pendingFilters.paymentMethod || ''}
                onChange={(e) => setPendingFilters(p => ({ ...p, paymentMethod: e.target.value || undefined }))}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-[12px] text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="transfer">Bank Transfer</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-500">Payment Status</label>
            <div className="relative">
              <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select 
                value={pendingFilters.paymentStatus || ''}
                onChange={(e) => setPendingFilters(p => ({ ...p, paymentStatus: e.target.value || undefined }))}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-[12px] text-slate-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Status</option>
                <option value="Success">Success</option>
                <option value="Refunded">Refunded</option>
                <option value="Failed">Failed</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={applyFilters}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
            <button 
              onClick={resetFilters}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Method Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Payment Method Distribution
            </h3>
          </div>
          
          <div className="flex-1 min-h-[220px]">
            {loadingDist ? (
              <StateMessage type="empty" message="Loading data..." />
            ) : errorDist ? (
              <StateMessage type="error" message="Failed to load distribution" onRetry={refetchDist} />
            ) : !pieData.length ? (
              <StateMessage type="empty" message="No payment data available for the selected filters." />
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-full w-full">
                <div className="h-[180px] w-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(val: number) => fmt(val)}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2.5">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-[12px]">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600 font-medium min-w-[70px]">{item.name}</span>
                      <span className="text-slate-900 font-semibold">{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trend Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Payment Trend
            </h3>
            <div className="relative">
              <select className="appearance-none bg-slate-50 border border-slate-200 rounded text-xs px-2 py-1 pr-6 outline-none focus:border-blue-400">
                <option>{dateRange === 'daily' ? 'Hourly' : 'Daily'}</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
          
          <div className="flex-1 min-h-[220px]">
            {loadingTrend ? (
              <StateMessage type="empty" message="Loading trend..." />
            ) : errorTrend ? (
              <StateMessage type="error" message="Failed to load trend" onRetry={refetchTrend} />
            ) : !trend || trend.length === 0 ? (
              <StateMessage type="empty" message="No trend data available." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 10, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dx={-10} tickFormatter={(val) => `₹${val/1000}k`} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: any, name: string) => [name === 'Payment Amount' ? fmt(value) : value, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="amount" name="Payment Amount" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Line yAxisId="right" type="monotone" dataKey="count" name="Number of Payments" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            Payment Transactions
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search by invoice no, customer name, transaction ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-[400px] bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-[12px] text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-[12px] whitespace-nowrap">
            <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-5 py-3.5 text-center w-12">#</th>
                <th className="px-5 py-3.5">Invoice No</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5 text-right">Invoice Amount</th>
                <th className="px-5 py-3.5 text-right">Paid Amount</th>
                <th className="px-5 py-3.5">Payment Method</th>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loadingTrans ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                    <p className="mt-3 text-sm text-slate-500">Loading payment data...</p>
                  </td>
                </tr>
              ) : errorTrans ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-red-500">
                    Payment data temporarily unavailable from SAP.
                    <button onClick={() => refetchTrans()} className="block mx-auto mt-2 text-blue-600 hover:underline">Retry</button>
                  </td>
                </tr>
              ) : !transactionsData || transactionsData.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-slate-500">
                    No payment data available for the selected filters.
                  </td>
                </tr>
              ) : transactionsData.items.map((txn, idx) => {
                const rowIndex = offset + idx + 1;
                const isRefund = txn.status === 'Refunded';
                
                return (
                  <tr key={txn.docEntry || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3 text-center text-slate-500">{rowIndex}</td>
                    <td className="px-5 py-3 font-medium text-blue-600">{txn.invoiceDocNum ? `INV-${txn.invoiceDocNum}` : '-'}</td>
                    <td className="px-5 py-3 text-slate-500">{txn.docDate.substring(0, 10)}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{txn.customerName || txn.customerCode || 'Unknown'}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{fmt(txn.totalAmount)}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">{fmt(txn.totalAmount)}</td>
                    <td className="px-5 py-3 text-slate-600 capitalize">{txn.paymentMethod}</td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-[11px]">{txn.transactionId || '-'}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border",
                        isRefund ? "bg-amber-50 text-amber-700 border-amber-200" :
                        txn.status === 'Failed' ? "bg-red-50 text-red-600 border-red-200" :
                        "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}>
                        {txn.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-3 text-slate-400">
                        <button className="hover:text-blue-600 transition-colors" title="View Details"><Eye size={16} /></button>
                        <button className="hover:text-blue-600 transition-colors" title="Download Receipt"><Download size={16} /></button>
                        <button className="hover:text-slate-700 transition-colors" title="More Actions"><MoreVertical size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {transactionsData && transactionsData.total > 0 && (
          <div className="bg-slate-50/50 border-t border-slate-200 p-3.5 flex items-center justify-between text-[12px] text-slate-500">
            <div>
              Showing {offset + 1} to {Math.min(offset + limit, transactionsData.total)} of {transactionsData.total} payments
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="mr-1">Rows per page:</span>
                <select 
                  value={limit} 
                  onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="bg-transparent border border-slate-300 rounded px-1 py-0.5 outline-none focus:border-blue-500"
                >
                  {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-50 transition-colors text-slate-700"
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="px-2 font-medium text-slate-700">{page}</div>
                <button 
                  onClick={() => setPage(p => p + 1)}
                  disabled={offset + limit >= transactionsData.total}
                  className="p-1.5 rounded border border-slate-200 hover:bg-white disabled:opacity-50 transition-colors text-slate-700"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
"""

with open('Dashboard-Ui/src/pages/reports/PaymentReportPage.tsx', 'w', encoding='utf-8') as f:
    f.write(tsx_code)

