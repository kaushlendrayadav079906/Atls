import { useQuery } from '@tanstack/react-query';
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
  CreditCard,
  CheckCircle2,
  Undo2,
  User,
  Power
} from 'lucide-react';
import { useState } from 'react';
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
  upi: '#22c55e',      // Green
  mobile: '#ec4899',   // Pink
  transfer: '#10b981', // Emerald
  credit: '#14b8a6',   // Teal
  other: '#64748b'     // Gray
};

const getMethodColor = (method: string) => {
  const m = method.toLowerCase();
  if (m.includes('card')) return METHOD_COLORS.card;
  if (m.includes('upi')) return METHOD_COLORS.upi;
  if (m.includes('mobile')) return METHOD_COLORS.mobile;
  if (m.includes('transfer') || m.includes('bank')) return METHOD_COLORS.transfer;
  if (m.includes('cash')) return METHOD_COLORS.cash;
  if (m.includes('credit')) return METHOD_COLORS.credit;
  return METHOD_COLORS.other;
};

// Mini bar chart SVG for KPIs
const MiniBarChart = ({ color }: { color: string }) => (
  <div className="flex items-end gap-1 h-6 opacity-30">
    <div className={`w-1.5 h-[40%] rounded-sm`} style={{ backgroundColor: color }}></div>
    <div className={`w-1.5 h-[70%] rounded-sm`} style={{ backgroundColor: color }}></div>
    <div className={`w-1.5 h-[50%] rounded-sm`} style={{ backgroundColor: color }}></div>
    <div className={`w-1.5 h-[100%] rounded-sm`} style={{ backgroundColor: color }}></div>
    <div className={`w-1.5 h-[80%] rounded-sm`} style={{ backgroundColor: color }}></div>
  </div>
);

export const PaymentReportPage = () => {
  const [activeTab, setActiveTab] = useState('Payment Overview');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  
  // Filters
  const [dateRange, setDateRange] = useState('monthly');
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>(undefined);
  const [paymentStatus, setPaymentStatus] = useState<string | undefined>(undefined);
  
  // Pending Filters (For Apply)
  const [pendingFilters, setPendingFilters] = useState({
    dateRange: 'monthly',
    branchId: undefined as string | undefined,
    paymentMethod: undefined as string | undefined,
    paymentStatus: undefined as string | undefined
  });
  
  const [trendGranularity, setTrendGranularity] = useState('daily');

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const offset = (page - 1) * limit;

  const applyFilters = () => {
    setDateRange(pendingFilters.dateRange);
    setBranchId(pendingFilters.branchId);
    setPaymentMethod(pendingFilters.paymentMethod);
    setPaymentStatus(pendingFilters.paymentStatus);
    setPage(1);
  };

  const resetFilters = () => {
    const defaults = {
      dateRange: 'monthly',
      branchId: undefined,
      paymentMethod: undefined,
      paymentStatus: undefined
    };
    setPendingFilters(defaults);
    setDateRange(defaults.dateRange);
    setBranchId(defaults.branchId);
    setPaymentMethod(defaults.paymentMethod);
    setPaymentStatus(defaults.paymentStatus);
    setSearchTerm('');
    setPage(1);
  };

  const queryParams = {
    range: dateRange,
    branch: branchId,
    payment_method: paymentMethod
  };

  const { data: overview, isLoading: loadingOverview } = useQuery({
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
    queryKey: ['payments-trend', { ...queryParams, granularity: trendGranularity }],
    queryFn: () => paymentsReportApi.getTrend({ ...queryParams, granularity: trendGranularity }),
    retry: 1
  });

  const { data: transactionsData, isLoading: loadingTrans, isError: errorTrans, refetch: refetchTrans } = useQuery({
    queryKey: ['payments-transactions', { ...queryParams, search: debouncedSearch, offset, limit, status: paymentStatus }],
    queryFn: () => paymentsReportApi.getTransactions({ ...queryParams, search: debouncedSearch || undefined, offset, limit }),
    retry: 1
  });

  const kpis = [
    { title: 'Total Payments', val: overview ? fmt(overview.totalPayments) : '₹0', trend: '', icon: Wallet, color: '#3b82f6', bg: 'bg-blue-50 text-blue-600' },
    { title: 'Paid Invoices', val: overview ? `${overview.paymentCount}` : '0', trend: '', icon: FileText, color: '#10b981', bg: 'bg-emerald-50 text-emerald-600' },
    { title: 'Pending Payments', val: '₹0', trend: '', icon: Power, color: '#ef4444', bg: 'bg-red-50 text-red-600' },
    { title: 'Refunds Issued', val: overview ? fmt(overview.refundsAmount || 0) : '₹0', trend: '', isNegative: true, icon: Undo2, color: '#10b981', bg: 'bg-emerald-50 text-emerald-600' },
    { title: 'Avg. Payment Value', val: overview ? fmt(overview.averagePaymentValue) : '₹0', trend: '', icon: TrendingUp, color: '#a855f7', bg: 'bg-purple-50 text-purple-600' },
  ];

  const pieData = distribution?.map(d => ({
    name: d.method.charAt(0).toUpperCase() + d.method.slice(1),
    value: d.total,
    count: d.count,
    color: getMethodColor(d.method)
  })) || [];
  
  // Sort pie data so biggest is first
  pieData.sort((a, b) => b.value - a.value);

  const totalDistributionAmount = pieData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-[#f8fafc] font-sans overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
      
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payment Report</h1>
              <p className="mt-0.5 text-[13px] text-slate-500">View and analyze payment transactions, methods and collection details.</p>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-[#0052cc] px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {['Payment Overview', 'Method Analysis', 'Daily/Monthly Trend', 'Customer Payments'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn("px-5 py-2.5 text-[13px] font-medium rounded-t-lg transition-all border",
                activeTab === tab 
                  ? "bg-[#0052cc] text-white border-[#0052cc]" 
                  : "bg-white text-slate-600 border-slate-200 border-b-0 hover:bg-slate-50"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 rounded-tl-none -mt-7 relative z-10 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {kpis.map((card, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", card.bg)}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-slate-500 mb-0.5">{card.title}</p>
                    <div className="text-[20px] font-bold text-slate-900">
                      {loadingOverview ? <Loader2 className="h-4 w-4 animate-spin text-slate-300" /> : card.val}
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div className="flex flex-col">
                    {card.trend && (
                      <>
                        <span className={cn("text-[12px] font-semibold", card.isNegative ? "text-red-500" : "text-emerald-500")}>
                          {card.trend}
                        </span>
                        <span className="text-[10px] text-slate-400">vs. previous period</span>
                      </>
                    )}
                  </div>
                  <MiniBarChart color={card.color} />
                </div>
              </div>
            ))}
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-slate-700">Date Range</label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select 
                  value={pendingFilters.dateRange}
                  onChange={(e) => setPendingFilters(p => ({ ...p, dateRange: e.target.value }))}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-[12px] text-slate-700 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] focus:outline-none"
                >
                  <option value="daily">Nov 1, 2024 - Nov 30, 2024</option>
                  <option value="monthly">This Month</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-slate-700">Branch</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select 
                  value={pendingFilters.branchId || ''}
                  onChange={(e) => setPendingFilters(p => ({ ...p, branchId: e.target.value || undefined }))}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-[12px] text-slate-700 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] focus:outline-none"
                >
                  <option value="">Main Branch (WH-001)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-slate-700">Payment Method</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select 
                  value={pendingFilters.paymentMethod || ''}
                  onChange={(e) => setPendingFilters(p => ({ ...p, paymentMethod: e.target.value || undefined }))}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-[12px] text-slate-700 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] focus:outline-none"
                >
                  <option value="">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-slate-700">Payment Status</label>
              <div className="relative">
                <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select 
                  value={pendingFilters.paymentStatus || ''}
                  onChange={(e) => setPendingFilters(p => ({ ...p, paymentStatus: e.target.value || undefined }))}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-[12px] text-slate-700 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] focus:outline-none"
                >
                  <option value="">All Status</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-slate-700">Customer</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-[12px] text-slate-700 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] focus:outline-none">
                  <option value="">All Customers</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={applyFilters}
                className="flex-[2] rounded-lg bg-[#0052cc] px-4 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
              <button 
                onClick={resetFilters}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Method Distribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0052cc]" />
                Payment Method Distribution
              </h3>
              <div className="relative">
                <select className="appearance-none bg-transparent border border-slate-200 rounded-lg text-[12px] px-3 py-1.5 pr-8 outline-none focus:border-[#0052cc] text-slate-600">
                  <option>This Month</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            
            <div className="flex-1 mt-4">
              {loadingDist ? (
                <StateMessage type="empty" message="Loading data..." />
              ) : errorDist ? (
                <StateMessage type="error" message="Failed to load distribution" onRetry={refetchDist} />
              ) : !pieData.length ? (
                <StateMessage type="empty" message="No payment data available for the selected filters." />
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-8 h-full w-full px-4">
                  <div className="h-[200px] w-[200px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(val: any) => {
                            const percent = totalDistributionAmount > 0 ? ((Number(val) / totalDistributionAmount) * 100).toFixed(1) + '%' : '0%';
                            return [`${fmt(Number(val))} (${percent})`, 'Amount'];
                          }}
                          contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-[18px] font-bold text-slate-900">{fmt(totalDistributionAmount)}</div>
                      <div className="text-[11px] text-slate-500">Total Payments</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 flex-1">
                    {pieData.map((item, i) => {
                       const pct = totalDistributionAmount > 0 ? ((item.value / totalDistributionAmount) * 100).toFixed(1) + '%' : '0%';
                       return (
                        <div key={i} className="flex items-center text-[13px] w-full">
                          <div className="w-2.5 h-2.5 rounded-full mr-3 shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600 w-32 shrink-0">{item.name}</span>
                          <span className="text-slate-500 w-16 text-right shrink-0">{pct}</span>
                          <span className="text-slate-700 ml-auto text-right font-medium">{fmt(item.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trend Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#0052cc]" />
                Payment Trend
              </h3>
              <div className="relative">
                <select 
                  value={trendGranularity}
                  onChange={(e) => setTrendGranularity(e.target.value)}
                  className="appearance-none bg-transparent border border-slate-200 rounded-lg text-[12px] px-3 py-1.5 pr-8 outline-none focus:border-[#0052cc] text-slate-600"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
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
                  <ComposedChart data={trend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} 
                      tickFormatter={(val) => {
                        if(trendGranularity === 'daily' && val.length === 10) {
                          return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }
                        return val;
                      }}
                    />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `₹ ${(val/100000).toFixed(1)}L`} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: any, name: any) => [name === 'Payment Amount' ? fmt(value) : value, name]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} iconType="circle" />
                    <Bar yAxisId="left" dataKey="amount" name="Payment Amount" fill="#0ea5e9" radius={[2, 2, 0, 0]} barSize={12} />
                    <Line yAxisId="right" type="monotone" dataKey="count" name="Number of Payments" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#0052cc]" />
              Payment Transactions
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="text" 
                placeholder="Search by invoice no, customer name, payment method..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-[420px] bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#0052cc] focus:bg-white focus:ring-1 focus:ring-[#0052cc] transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-white border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-4 py-4 text-center w-10">
                    <input type="checkbox" className="rounded border-slate-300 text-[#0052cc] focus:ring-[#0052cc]" />
                  </th>
                  <th className="px-2 py-4 w-10">#</th>
                  <th className="px-4 py-4">Invoice No</th>
                  <th className="px-4 py-4">Date & Time</th>
                  <th className="px-4 py-4">Customer</th>
                  <th className="px-4 py-4 text-right">Invoice Amount</th>
                  <th className="px-4 py-4 text-right">Paid Amount</th>
                  <th className="px-4 py-4">Payment Method</th>
                  <th className="px-4 py-4">Transaction ID</th>
                  <th className="px-4 py-4 text-center">Status</th>
                  <th className="px-4 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {loadingTrans ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-16 text-center">
                      <Loader2 className="w-8 h-8 text-[#0052cc] animate-spin mx-auto" />
                      <p className="mt-3 text-sm text-slate-500">Loading payment data...</p>
                    </td>
                  </tr>
                ) : errorTrans ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-16 text-center text-red-500">
                      Payment data temporarily unavailable from SAP.
                      <button onClick={() => refetchTrans()} className="block mx-auto mt-2 text-[#0052cc] hover:underline">Retry</button>
                    </td>
                  </tr>
                ) : !transactionsData || transactionsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-16 text-center text-slate-500">
                      No payment data available for the selected filters.
                    </td>
                  </tr>
                ) : transactionsData.items.map((txn, idx) => {
                  const rowIndex = offset + idx + 1;
                  const isRefund = txn.status === 'Refunded';
                  const isPartial = txn.status === 'Partial';
                  const isFailed = txn.status === 'Failed';
                  
                  return (
                    <tr key={txn.docEntry || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 text-center">
                        <input type="checkbox" className="rounded border-slate-300 text-[#0052cc] focus:ring-[#0052cc]" />
                      </td>
                      <td className="px-2 py-3.5 text-slate-500">{rowIndex}</td>
                      <td className="px-4 py-3.5 font-medium text-[#0052cc]">{txn.invoiceDocNum ? `INV-${txn.invoiceDocNum}` : '-'}</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {txn.docDate.substring(0, 10)} {txn.docDate.substring(11, 16)}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">{txn.customerName || txn.customerCode || 'Unknown'}</td>
                      <td className="px-4 py-3.5 text-right text-slate-600">{fmt(txn.totalAmount)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-600">{fmt(txn.totalAmount)}</td>
                      <td className="px-4 py-3.5 text-slate-600 capitalize">{txn.paymentMethod}</td>
                      <td className="px-4 py-3.5 text-slate-500">{txn.transactionId || '-'}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded text-[11px] font-medium border",
                          isRefund ? "bg-purple-50 text-purple-700 border-purple-200" :
                          isFailed ? "bg-red-50 text-red-600 border-red-200" :
                          isPartial ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}>
                          {txn.status || 'Success'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-3 text-[#0052cc]">
                          <button className="hover:text-blue-800 transition-colors" title="View Details"><Eye size={16} /></button>
                          <button className="hover:text-blue-800 transition-colors" title="Download Receipt"><Download size={16} /></button>
                          <button className="hover:text-blue-800 transition-colors" title="More Actions"><MoreVertical size={16} /></button>
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
            <div className="bg-white border-t border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between text-[13px] text-slate-500 gap-4">
              <div>
                Showing {offset + 1} to {Math.min(offset + limit, transactionsData.total)} of {transactionsData.total.toLocaleString()} payments
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors text-slate-500"
                >
                  <ChevronLeft size={16} className="text-slate-400" />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, Math.ceil(transactionsData.total / limit)))].map((_, i) => (
                    <button 
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-md text-[13px] font-medium transition-colors",
                        page === i + 1 ? "bg-[#0052cc] text-white" : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                  {Math.ceil(transactionsData.total / limit) > 5 && (
                    <>
                      <span className="px-1 text-slate-400">...</span>
                      <button 
                        onClick={() => setPage(Math.ceil(transactionsData.total / limit))}
                        className={cn(
                          "w-7 h-7 flex items-center justify-center rounded-md text-[13px] font-medium transition-colors",
                          page === Math.ceil(transactionsData.total / limit) ? "bg-[#0052cc] text-white" : "hover:bg-slate-100 text-slate-600"
                        )}
                      >
                        {Math.ceil(transactionsData.total / limit)}
                      </button>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => setPage(p => p + 1)}
                  disabled={offset + limit >= transactionsData.total}
                  className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors text-slate-500"
                >
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
