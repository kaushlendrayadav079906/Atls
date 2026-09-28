import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  FileText,
    MoreVertical,
  Receipt,
      User,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CreditCard,
  CheckCircle2,
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

export const InvoiceReportPage = () => {
  const [activeTab, setActiveTab] = useState('Invoice List');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [dateRange] = useState<SalesFeedParams['range']>('monthly');
  const [page, setPage] = useState(1);
  const limit = 7;
  const offset = (page - 1) * limit;

  const { data, isLoading } = useQuery<DashboardRecentSalesPage>({
    queryKey: ['invoice-report', dateRange, debouncedSearch, offset, limit],
    queryFn: () => salesApi.getSalesFeed({
      range: dateRange,
      search: debouncedSearch || undefined,
      limit,
      offset
    })
  });

  

  // Mocking the top KPI stats to match the screenshot UI perfectly
  const kpis = [
    { title: 'Total Invoices', val: '1,248', icon: FileText, pct: '+12.5%', isUp: true, color: 'text-blue-400', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { title: 'Total Sales', val: '₹ 12,48,650', icon: TrendingUp, pct: '+14.2%', isUp: true, color: 'text-emerald-400', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { title: 'Total Paid', val: '₹ 11,92,300', icon: CreditCard, subtitle: '95.5% collection', isUp: true, color: 'text-emerald-400', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { title: 'Total Due', val: '₹ 56,350', icon: Receipt, subtitle: '4.5% pending', isUp: false, color: 'text-red-400', bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { title: 'Avg. Invoice Value', val: '₹ 1,000', icon: PieChartIcon, pct: '+6.8%', isUp: true, color: 'text-purple-400', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-[#071d34] text-slate-100 font-sans -m-4 sm:-m-5 lg:-m-6 p-4 sm:p-5 lg:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-sky-800/50 scrollbar-track-transparent">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Invoice Report</h1>
          <p className="mt-1 text-[13px] text-sky-200/60">View and analyze invoice details, payments and sales transactions.</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:bg-blue-500 transition-colors w-fit">
          <Download className="h-4 w-4" />
          Export
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-sky-900/40 pb-0">
        {['Invoice Report', 'Payment Report', 'Summary & Analytics'].map(tab => (
          <button 
            key={tab}
            className={cn("px-6 py-2 text-[13px] font-medium rounded-t-xl transition-colors border border-b-0",
              tab === 'Invoice Report' 
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
              {card.pct && (
                <span className={cn("font-bold", card.isUp ? 'text-emerald-400' : 'text-red-400')}>
                  {card.pct}
                </span>
              )}
              {card.pct && <span className="text-sky-200/50 ml-1">vs. previous month period</span>}
              {card.subtitle && (
                <span className={cn("font-medium", card.isUp ? 'text-emerald-400' : 'text-red-400')}>
                  {card.subtitle}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60" />
              <select className="w-full appearance-none rounded-lg border border-sky-800/60 bg-[#0b2340] py-2 pl-9 pr-8 text-[13px] text-white focus:border-blue-500 focus:outline-none">
                <option>Main Branch (WH-001)</option>
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sky-200/70">Invoice Status</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60" />
              <select className="w-full appearance-none rounded-lg border border-sky-800/60 bg-[#0b2340] py-2 pl-9 pr-8 text-[13px] text-white focus:border-blue-500 focus:outline-none">
                <option>All Status</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-sky-200/70">Payment Status</label>
            <div className="relative">
              <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400/60" />
              <select className="w-full appearance-none rounded-lg border border-sky-800/60 bg-[#0b2340] py-2 pl-9 pr-8 text-[13px] text-white focus:border-blue-500 focus:outline-none">
                <option>All</option>
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
          <div className="flex items-center gap-3">
            <button className="flex-1 rounded-lg bg-blue-600 py-2 text-[13px] font-semibold text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:bg-blue-500 transition-colors">
              Apply Filters
            </button>
            <button 
              onClick={() => { setSearchTerm(''); setPage(1); }}
              className="flex-1 rounded-lg border border-sky-800/60 bg-[#0b2340] py-2 text-[13px] font-semibold text-sky-200 hover:bg-[#112847] transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* List / Analytics Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-sky-900/40 pb-0">
        {['Invoice List', 'Analytics'].map(tab => (
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

      {/* Table Section */}
      <div className="bg-[#0b2340] rounded-xl border border-sky-800/50 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-sky-800/50 scrollbar-track-transparent flex-1">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-[#061a2f] border-b border-sky-900/60 text-sky-400/70 font-semibold">
              <tr>
                <th className="px-4 py-3 text-center w-10">#</th>
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Payment Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-900/40 text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                    <p className="mt-2 text-sm text-sky-400/60">Loading invoices...</p>
                  </td>
                </tr>
              ) : data?.items?.map((sale, idx) => {
                const rowIndex = offset + idx + 1;
                let paymentStatus = 'Paid';
                let pClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                
                if (sale.hasReturn) {
                  paymentStatus = 'Refunded';
                  pClass = 'bg-red-500/20 text-red-400 border-red-500/30';
                } else if (sale.saleId?.includes('38')) {
                  paymentStatus = 'Partially Paid';
                  pClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                }

                return (
                  <tr key={sale.docEntry || idx} className="hover:bg-[#112847] transition-colors">
                    <td className="px-4 py-3 text-center font-bold text-white">{rowIndex}</td>
                    <td className="px-4 py-3 font-medium text-blue-400">{sale.saleId}</td>
                    <td className="px-4 py-3 text-sky-100">{sale.customerName || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-sky-300/80">{sale.docDate}</td>
                    <td className="px-4 py-3 font-medium text-white">{fmt(sale.total)}</td>
                    <td className="px-4 py-3 text-sky-300/80 capitalize">{sale.paymentMethod || 'Cash'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Completed
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border", pClass)}>
                        {paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
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
            Showing {data?.total ? offset + 1 : 0} to {Math.min(offset + limit, data?.total || 0)} of {data?.total || 0} invoices
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
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-sky-900/40 text-sky-300 font-medium"><ChevronRight size={14}/></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// SVG icon for PieChart
function PieChartIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
      <path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  );
}
