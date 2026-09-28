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
  Clock,
  RotateCcw,
  TrendingUp,
  Building2,
  CreditCard,
  User,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { useState } from 'react';
import { salesApi } from '../../api/sales';
import { useDebounce } from '../../hooks/useDebounce';
import type { DashboardRecentSalesPage, SalesFeedParams } from '../../types/sales';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

export const PaymentReportPage = () => {
  const [activeTab, setActiveTab] = useState('Payment Overview');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [dateRange] = useState<SalesFeedParams['range']>('monthly');
  const [page, setPage] = useState(1);
  const limit = 7;
  const offset = (page - 1) * limit;

  const { data, isLoading } = useQuery<DashboardRecentSalesPage>({
    queryKey: ['payment-report', dateRange, debouncedSearch, offset, limit],
    queryFn: () => salesApi.getSalesFeed({
      range: dateRange,
      search: debouncedSearch || undefined,
      limit,
      offset
    })
  });

  const totalPages = data?.total ? Math.ceil(data.total / limit) : 1;

  // KPIs matching screenshot 2
  const kpis = [
    { title: 'Total Payments', val: '₹ 11,92,300', icon: Wallet, pct: '+14.2%', isUp: true, color: 'text-blue-400', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { title: 'Paid Invoices', val: '1,156', icon: FileText, pct: '+12.5%', isUp: true, color: 'text-emerald-400', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { title: 'Pending Payments', val: '₹ 56,350', icon: Clock, pct: '+4.8%', isUp: false, color: 'text-red-400', bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { title: 'Refunds Issued', val: '₹ 12,450', icon: RotateCcw, pct: '-8.3%', isUp: false, color: 'text-emerald-400', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { title: 'Avg. Payment Value', val: '₹ 1,030', icon: TrendingUp, pct: '+6.1%', isUp: true, color: 'text-purple-400', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-[#071d34] text-slate-100 font-sans -m-4 sm:-m-5 lg:-m-6 p-4 sm:p-5 lg:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-sky-800/50 scrollbar-track-transparent">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Payment Report</h1>
          <p className="mt-1 text-[13px] text-sky-200/60">View and analyze payment transactions, methods and collection details.</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:bg-blue-500 transition-colors w-fit">
          <Download className="h-4 w-4" />
          Export
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-sky-900/40 pb-0">
        {['Payment Overview', 'Method Analysis', 'Daily/Monthly Trend', 'Customer Payments'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn("px-6 py-2 text-[13px] font-medium rounded-t-xl transition-colors border border-b-0",
              activeTab === tab 
                ? "bg-gradient-to-t from-blue-600/30 to-blue-600/10 text-white border-blue-500/40 shadow-[inset_0_2px_10px_rgba(59,130,246,0.2)]" 
                : "bg-transparent text-sky-200/60 border-transparent hover:text-white hover:bg-sky-900/20"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {kpis.map((card, i) => (
          <div key={i} className="rounded-xl border border-sky-800/60 bg-[#0b2340] p-4 flex flex-col justify-between">
            <div className="flex items-start gap-3 mb-2">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border", card.bg)}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-medium text-sky-200/70 mb-1">{card.title}</p>
                <div className="text-xl font-bold text-white">{card.val}</div>
              </div>
            </div>
            <div className="mt-1 text-[11px]">
              <span className={cn("font-bold", card.isUp ? 'text-emerald-400' : 'text-red-400')}>
                {card.pct}
              </span>
              <span className="text-sky-200/50 ml-1">vs. previous period</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sky-200/70">Date Range</label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60" />
              <select className="w-full appearance-none rounded-lg border border-sky-800/60 bg-[#0b2340] py-2 pl-9 pr-8 text-[13px] text-white focus:border-blue-500 focus:outline-none">
                <option>Nov 1, 2024 - Nov 30, 2024</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sky-200/70">Branch</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60" />
              <select className="w-full appearance-none rounded-lg border border-sky-800/60 bg-[#0b2340] py-2 pl-9 pr-8 text-[13px] text-white focus:border-blue-500 focus:outline-none">
                <option>Main Branch (WH-001)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sky-200/70">Payment Method</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60" />
              <select className="w-full appearance-none rounded-lg border border-sky-800/60 bg-[#0b2340] py-2 pl-9 pr-8 text-[13px] text-white focus:border-blue-500 focus:outline-none">
                <option>All Methods</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sky-200/70">Payment Status</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60" />
              <select className="w-full appearance-none rounded-lg border border-sky-800/60 bg-[#0b2340] py-2 pl-9 pr-8 text-[13px] text-white focus:border-blue-500 focus:outline-none">
                <option>All Status</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sky-200/70">Customer</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60" />
              <select className="w-full appearance-none rounded-lg border border-sky-800/60 bg-[#0b2340] py-2 pl-9 pr-8 text-[13px] text-white focus:border-blue-500 focus:outline-none">
                <option>All Customers</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <button className="rounded-lg bg-blue-600 px-6 py-2 text-[13px] font-semibold text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:bg-blue-500 transition-colors">
            Apply Filters
          </button>
          <button 
            onClick={() => { setSearchTerm(''); setPage(1); }}
            className="rounded-lg border border-sky-800/60 bg-[#0b2340] px-6 py-2 text-[13px] font-semibold text-sky-200 hover:bg-[#112847] transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        
        {/* Pie Chart Section (Mocked UI) */}
        <div className="rounded-xl border border-sky-800/60 bg-[#0b2340] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-sky-400" />
              Payment Method Distribution
            </h3>
            <div className="flex items-center gap-1 text-[11px] text-sky-200/60 bg-[#071d34] px-2 py-1 rounded border border-sky-800/40">
              This Month <ChevronDown size={12} />
            </div>
          </div>
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-32 h-32 rounded-full border-[12px] border-[#3b82f6] border-t-[#ec4899] border-r-[#10b981] border-b-[#f59e0b] flex items-center justify-center shrink-0">
              <div className="text-center">
                <div className="text-sm font-bold text-white">₹11,92,300</div>
                <div className="text-[10px] text-sky-200/60 mt-0.5">Total Payments</div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 text-[11px]">
              {[
                { name: 'Cash', color: 'bg-blue-500', pct: '28.5%', val: '₹ 3,40,200' },
                { name: 'Card (Visa)', color: 'bg-pink-500', pct: '34.7%', val: '₹ 4,13,600' },
                { name: 'Card (Mastercard)', color: 'bg-emerald-500', pct: '18.1%', val: '₹ 2,15,400' },
                { name: 'UPI', color: 'bg-amber-500', pct: '12.3%', val: '₹ 1,46,800' },
                { name: 'Mobile Pay', color: 'bg-purple-500', pct: '4.8%', val: '₹ 57,300' },
                { name: 'Other', color: 'bg-slate-400', pct: '1.6%', val: '₹ 19,000' }
              ].map(item => (
                <div key={item.name} className="flex items-center justify-between text-sky-100">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", item.color)} />
                    <span>{item.name}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-sky-200/60 w-10 text-right">{item.pct}</span>
                    <span className="font-medium text-white w-16 text-right">{item.val}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar/Line Chart Section (Mocked UI) */}
        <div className="rounded-xl border border-sky-800/60 bg-[#0b2340] p-4 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-400" />
              Payment Trend
            </h3>
            <div className="flex items-center gap-1 text-[11px] text-sky-200/60 bg-[#071d34] px-2 py-1 rounded border border-sky-800/40">
              Daily <ChevronDown size={12} />
            </div>
          </div>
          <div className="flex-1 relative border-b border-l border-sky-800/40 pt-2 pb-6 px-2">
            <div className="absolute -left-8 top-0 bottom-6 flex flex-col justify-between text-[10px] text-sky-200/40 py-2">
              <span>₹ 2.0L</span>
              <span>₹ 1.5L</span>
              <span>₹ 1.0L</span>
              <span>₹ 50K</span>
              <span>₹ 0</span>
            </div>
            <div className="flex items-end justify-between h-full gap-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="flex-1 bg-blue-500 hover:bg-blue-400 rounded-t-sm shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all relative group" style={{ height: `${Math.random() * 60 + 10}%` }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
              ))}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-6 flex items-center justify-between text-[9px] text-sky-200/40 px-2">
              <span>Nov 1</span>
              <span>Nov 5</span>
              <span>Nov 10</span>
              <span>Nov 15</span>
              <span>Nov 20</span>
              <span>Nov 25</span>
              <span>Nov 30</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-[10px] text-sky-200/60">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Payment Amount</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Number of Payments</div>
          </div>
        </div>

      </div>

      {/* Table Header Section */}
      <div className="bg-[#0b2340] rounded-xl border border-sky-800/50 overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-sky-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-400" />
            Payment Transactions
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400/60" size={14} />
            <input 
              type="text" 
              placeholder="Search by invoice no, customer name, payment method..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-[350px] bg-[#071d34] border border-sky-800/60 rounded-lg pl-9 pr-4 py-1.5 text-[12px] text-white placeholder:text-sky-400/50 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-sky-800/50 scrollbar-track-transparent flex-1">
          <table className="w-full text-left text-[12px] whitespace-nowrap">
            <thead className="bg-[#061a2f] border-b border-sky-900/60 text-sky-400/70 font-semibold">
              <tr>
                <th className="px-4 py-3 text-center w-10">#</th>
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Invoice Amount</th>
                <th className="px-4 py-3 text-right">Paid Amount</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Transaction ID</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-900/40 text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                    <p className="mt-2 text-sm text-sky-400/60">Loading transactions...</p>
                  </td>
                </tr>
              ) : data?.items?.map((sale, idx) => {
                const rowIndex = offset + idx + 1;
                
                // Determine partial payment logic for mock UI
                let status = 'Success';
                let pClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                let paidAmount = sale.total;
                
                if (sale.saleId?.includes('38')) {
                  status = 'Partial';
                  pClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                  paidAmount = 300.00;
                }

                return (
                  <tr key={sale.docEntry || idx} className="hover:bg-[#112847] transition-colors">
                    <td className="px-4 py-2.5 text-center font-bold text-white">{rowIndex}</td>
                    <td className="px-4 py-2.5 font-medium text-blue-400">{sale.saleId}</td>
                    <td className="px-4 py-2.5 text-sky-300/80">{sale.docDate}</td>
                    <td className="px-4 py-2.5 text-sky-100">{sale.customerName || 'Walk-in'}</td>
                    <td className="px-4 py-2.5 text-right text-sky-200/80">{fmt(sale.total)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-white">{fmt(paidAmount)}</td>
                    <td className="px-4 py-2.5 text-sky-300/80 capitalize">{sale.paymentMethod || 'Cash'}</td>
                    <td className="px-4 py-2.5 text-sky-400/50 font-mono">TXN{String(10012456 - idx)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border", pClass)}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button className="text-sky-400/80 hover:text-white transition-colors"><Eye size={16} /></button>
                        <button className="text-sky-400/80 hover:text-white transition-colors"><Download size={16} /></button>
                        <button className="text-sky-400/80 hover:text-white transition-colors"><MoreVertical size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-[#061a2f] border-t border-sky-900/60 p-3 flex items-center justify-between text-xs text-sky-400/60 mt-auto">
          <div>
            Showing {data?.total ? offset + 1 : 0} to {Math.min(offset + limit, data?.total || 0)} of {data?.total || 0} payments
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded bg-[#0b2340] border border-sky-800/60 hover:bg-sky-900/40 disabled:opacity-50 transition-colors text-sky-300"
              >
                <ChevronLeft size={14} />
              </button>
              <button className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 text-white font-medium">1</button>
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-sky-900/40 text-sky-300 font-medium">2</button>
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-sky-900/40 text-sky-300 font-medium">3</button>
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-sky-900/40 text-sky-300 font-medium">4</button>
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-sky-900/40 text-sky-300 font-medium">5</button>
              <span className="px-1 text-sky-500/50">...</span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded bg-[#0b2340] border border-sky-800/60 hover:bg-sky-900/40 disabled:opacity-50 transition-colors text-sky-300"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
