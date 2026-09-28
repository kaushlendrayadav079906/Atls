import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  CreditCard,
  CheckCircle2,
  
  FileText,
  
  Loader2,
  MoreVertical,
  Printer,
  
  Search,
  User,
  X
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

// Component for the Right Panel (Invoice Details)
const InvoiceDetailPanel = ({ id, onClose }: { id: number; onClose: () => void }) => {
  const { data: invoice, isLoading, isError } = useQuery({
    queryKey: ['saleDetail', id],
    queryFn: () => salesApi.getSaleDetail(id.toString()),
    enabled: !!id,
  });

  const [activeTab, setActiveTab] = useState<'items' | 'payments' | 'notes' | 'history'>('items');

  if (isLoading) {
    return (
      <div className="w-[450px] bg-[#071d34] border-l border-sky-900/60 flex flex-col h-full animate-pulse">
        <div className="p-5 border-b border-sky-900/60 flex items-center justify-between">
          <div className="h-6 w-32 bg-sky-800/40 rounded"></div>
          <div className="h-6 w-6 bg-sky-800/40 rounded"></div>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="h-20 bg-sky-800/40 rounded"></div>
          <div className="h-40 bg-sky-800/40 rounded"></div>
        </div>
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="w-[450px] bg-[#071d34] border-l border-sky-900/60 flex flex-col h-full items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <p className="text-red-400 font-medium">Failed to load invoice details.</p>
        <button onClick={onClose} className="mt-4 text-sky-400 hover:text-sky-300 underline text-sm">Close Panel</button>
      </div>
    );
  }

  const isPending = invoice.syncStatus !== 'synced';

  return (
    <div className="w-[450px] bg-[#071d34] border-l border-sky-900/60 flex flex-col h-full flex-shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sky-900/60 bg-[#0b2340]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          Invoice Details
        </h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-800/60 text-sky-300/80 hover:bg-[#112847] hover:text-white text-xs font-medium transition-colors">
            <Printer size={14} /> Print
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-800/60 text-sky-300/80 hover:bg-[#112847] hover:text-white text-xs font-medium transition-colors">
            <Download size={14} /> Download
          </button>
          <button onClick={onClose} className="p-1.5 text-sky-400/60 hover:text-white hover:bg-sky-900/40 rounded-lg ml-1">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sky-800/50 scrollbar-track-transparent">
        {/* Title Section */}
        <div className="p-5 flex items-start gap-4 border-b border-sky-900/40">
          <div className="h-12 w-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <FileText size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">{invoice.saleId}</h1>
              <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border", 
                isPending ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              )}>
                {isPending ? 'Pending' : 'Completed'}
              </span>
            </div>
            <p className="text-sm text-sky-300/60 mt-0.5">Sales Invoice</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-5 grid grid-cols-2 gap-y-4 gap-x-6 text-[13px] border-b border-sky-900/40">
          <div>
            <div className="text-sky-300/60 mb-1">Invoice Date</div>
            <div className="text-white font-medium flex items-center gap-1.5">
              {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              }) : '-'}
            </div>
          </div>
          <div>
            <div className="text-sky-300/60 mb-1">Payment Method</div>
            <div className="text-white font-medium flex items-center gap-1.5">
              <CreditCard size={14} className="text-sky-400" />
              Online (Razorpay)
            </div>
          </div>
          <div>
            <div className="text-sky-300/60 mb-1">Customer</div>
            <div className="text-white font-medium flex items-center gap-1.5">
              <User size={14} className="text-sky-400" />
              {invoice.customer || 'Walk-in Customer'}
            </div>
          </div>
          <div>
            <div className="text-sky-300/60 mb-1">Payment Status</div>
            <div>
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border", 
                isPending ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              )}>
                {isPending ? 'Pending' : 'Paid'}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sky-300/60 mb-1">Contact</div>
            <div className="text-white font-medium truncate">{invoice.customer || '-'}</div>
          </div>
          <div>
            <div className="text-sky-300/60 mb-1">Sales Person</div>
            <div className="text-white font-medium">Admin User</div>
          </div>
          <div>
            <div className="text-sky-300/60 mb-1">Branch</div>
            <div className="text-white font-medium truncate">Main Branch (WH-001)</div>
          </div>
          <div>
            <div className="text-sky-300/60 mb-1">Reference</div>
            <div className="text-white font-medium">-</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 border-b border-sky-900/60 flex gap-6">
          {['Items', 'Payments', 'Notes', 'History'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase() as any)}
              className={cn("pb-2 text-[13px] font-medium transition-colors relative", 
                activeTab === tab.toLowerCase() ? "text-blue-400" : "text-sky-300/60 hover:text-white")}
            >
              {tab}
              {activeTab === tab.toLowerCase() && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-500 rounded-t-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
            </button>
          ))}
        </div>

        {/* Items Table */}
        {activeTab === 'items' && (
          <div className="p-4">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-sky-300/60 border-b border-sky-900/40">
                  <th className="pb-2 font-medium w-8">#</th>
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium text-center">Qty</th>
                  <th className="pb-2 font-medium text-right">Price (₹)</th>
                  <th className="pb-2 font-medium text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {invoice.items?.map((item, idx) => (
                  <tr key={idx} className="border-b border-sky-900/20 last:border-0 hover:bg-[#0b2340]/50 transition-colors">
                    <td className="py-2.5 text-sky-400/60">{idx + 1}</td>
                    <td className="py-2.5 pr-2 font-medium flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-sky-900/40 flex items-center justify-center text-sky-300">
                        <User size={12} /> {/* Mock icon */}
                      </div>
                      <span className="truncate max-w-[120px]">{item.ItemDescription || item.ItemCode}</span>
                    </td>
                    <td className="py-2.5 text-center">{item.Quantity}</td>
                    <td className="py-2.5 text-right text-sky-300/80">{item.Price?.toFixed(2) || '0.00'}</td>
                    <td className="py-2.5 text-right font-medium">{item.LineTotal?.toFixed(2) || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Summary Footer */}
      <div className="p-5 border-t border-sky-900/60 bg-[#0b2340]">
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between text-sky-300/70">
            <span>Subtotal</span>
            <span>{fmt(invoice.total)}</span>
          </div>
          <div className="flex justify-between text-sky-300/70">
            <span>Discount</span>
            <span className="text-red-400">-{fmt(0)}</span>
          </div>
          <div className="flex justify-between text-sky-300/70">
            <span>Tax (12%)</span>
            <span>{fmt(100)}</span> {/* Mocking tax for visual match */}
          </div>
          <div className="flex justify-between items-center pt-3 mt-1 border-t border-sky-900/40">
            <span className="text-base font-bold text-white">Total</span>
            <span className="text-lg font-bold text-blue-400">{fmt(invoice.total)}</span>
          </div>
          <div className="flex justify-between text-sky-300/70 pt-1">
            <span>Amount Paid</span>
            <span>{fmt(0)}</span>
          </div>
          <div className="flex justify-between text-sky-300/70">
            <span>Balance Due</span>
            <span className="text-amber-400 font-medium">{fmt(invoice.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SalesList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [dateRange] = useState<SalesFeedParams['range']>('monthly');
  const [page, setPage] = useState(1);
  const limit = 10;
  const offset = (page - 1) * limit;

  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<DashboardRecentSalesPage>({
    queryKey: ['sales', dateRange, debouncedSearch, offset, limit],
    queryFn: () => salesApi.getSalesFeed({
      range: dateRange,
      search: debouncedSearch || undefined,
      limit,
      offset
    })
  });

  const totalPages = data?.total ? Math.ceil(data.total / limit) : 1;

  const getStatusBadge = (hasReturn: boolean, isPending: boolean = false) => {
    if (hasReturn) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-500/20 text-red-400 border border-red-500/30">Refunded</span>;
    }
    if (isPending) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Paid</span>;
  };

  return (
    <div className="flex h-[calc(100vh-60px)] -m-4 sm:-m-5 lg:-m-6 overflow-hidden bg-[#071d34]">
      
      {/* Main List Section */}
      <div className="flex-1 flex flex-col h-full p-4 sm:p-5 lg:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-sky-800/50 scrollbar-track-transparent">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Sales & Invoices</h1>
            <p className="text-sm text-sky-200/60 mt-1">View, search and manage all sales invoices</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-sky-300/60 hidden sm:block">Dashboard {'>'} Sales & Invoices</span>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0b2340] border border-sky-800/50 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
              <span className="text-xl font-bold">₹</span>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-sky-300/70 uppercase tracking-wider mb-1">Gross Sales <span className="lowercase font-normal opacity-70">(Selected Period)</span></div>
              <div className="text-xl font-bold text-white">₹1,24,560.50</div>
            </div>
            <div className="absolute right-4 top-4 text-right">
              <div className="flex items-center justify-end gap-1 text-emerald-400 text-xs font-bold">
                <ArrowUp size={12} /> +12.5%
              </div>
              <div className="text-[9px] text-sky-400/50 mt-0.5">vs. previous period</div>
            </div>
          </div>

          <div className="bg-[#0b2340] border border-sky-800/50 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="h-12 w-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
              <FileText size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-sky-300/70 uppercase tracking-wider mb-1">Total Invoices</div>
              <div className="text-xl font-bold text-white">156</div>
            </div>
            <div className="absolute right-4 top-4 text-right">
              <div className="flex items-center justify-end gap-1 text-emerald-400 text-xs font-bold">
                <ArrowUp size={12} /> +8.2%
              </div>
              <div className="text-[9px] text-sky-400/50 mt-0.5">vs. previous period</div>
            </div>
          </div>

          <div className="bg-[#0b2340] border border-sky-800/50 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-sky-300/70 uppercase tracking-wider mb-1">Paid Invoices</div>
              <div className="text-xl font-bold text-white flex items-baseline gap-1">138 <span className="text-xs text-sky-300/60 font-medium">(88.5%)</span></div>
            </div>
            <div className="absolute right-4 top-4 text-right">
              <div className="flex items-center justify-end gap-1 text-emerald-400 text-xs font-bold">
                <ArrowUp size={12} /> +10.4%
              </div>
              <div className="text-[9px] text-sky-400/50 mt-0.5">vs. previous period</div>
            </div>
          </div>

          <div className="bg-[#0b2340] border border-sky-800/50 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-sky-300/70 uppercase tracking-wider mb-1">Pending / Due</div>
              <div className="text-xl font-bold text-white flex items-baseline gap-1">18 <span className="text-xs text-sky-300/60 font-medium">(11.5%)</span></div>
            </div>
            <div className="absolute right-4 top-4 text-right">
              <div className="flex items-center justify-end gap-1 text-red-400 text-xs font-bold">
                <ArrowDown size={12} /> -3.1%
              </div>
              <div className="text-[9px] text-sky-400/50 mt-0.5">vs. previous period</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400/60" size={16} />
            <input 
              type="text" 
              placeholder="Search by invoice number or customer name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0b2340] border border-sky-800/60 rounded-lg pl-9 pr-4 py-2 text-[13px] text-white placeholder:text-sky-400/50 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="relative w-[200px]">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400/60" size={16} />
            <select className="w-full bg-[#0b2340] border border-sky-800/60 rounded-lg pl-9 pr-4 py-2 text-[13px] text-sky-100 appearance-none focus:outline-none focus:border-blue-500 transition-colors">
              <option>Nov 1, 2024 - Nov 30, 2024</option>
            </select>
          </div>
          <div className="relative w-[140px]">
            <select className="w-full bg-[#0b2340] border border-sky-800/60 rounded-lg px-4 py-2 text-[13px] text-sky-100 appearance-none focus:outline-none focus:border-blue-500 transition-colors">
              <option>All Status</option>
            </select>
          </div>
          <div className="relative w-[180px]">
            <select className="w-full bg-[#0b2340] border border-sky-800/60 rounded-lg px-4 py-2 text-[13px] text-sky-100 appearance-none focus:outline-none focus:border-blue-500 transition-colors">
              <option>All Payment Methods</option>
            </select>
          </div>
          <div className="relative w-[200px]">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400/60" size={16} />
            <select className="w-full bg-[#0b2340] border border-sky-800/60 rounded-lg pl-9 pr-4 py-2 text-[13px] text-sky-100 appearance-none focus:outline-none focus:border-blue-500 transition-colors">
              <option>Main Branch (WH-001)</option>
            </select>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">
            <Search size={14} /> Search
          </button>
          <button 
            onClick={() => { setSearchTerm(''); }}
            className="px-4 py-2 bg-[#0b2340] border border-sky-800/60 hover:bg-sky-900/40 text-sky-300 text-[13px] font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="bg-[#0b2340] rounded-xl border border-sky-800/50 overflow-hidden flex-1 flex flex-col min-h-[400px]">
          <div className="overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-sky-800/50 scrollbar-track-transparent">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-[#061a2f] border-b border-sky-900/60 text-sky-400/70 font-semibold sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-10 text-center"><input type="checkbox" className="rounded border-sky-800/60 bg-[#0b2340] text-blue-500" /></th>
                  <th className="px-4 py-3">Invoice No. <ArrowDown size={12} className="inline ml-1 opacity-50" /></th>
                  <th className="px-4 py-3">Date <ArrowDown size={12} className="inline ml-1 opacity-50" /></th>
                  <th className="px-4 py-3">Customer <ArrowDown size={12} className="inline ml-1 opacity-50" /></th>
                  <th className="px-4 py-3">Branch <ArrowDown size={12} className="inline ml-1 opacity-50" /></th>
                  <th className="px-4 py-3 text-right">Total (₹) <ArrowDown size={12} className="inline ml-1 opacity-50" /></th>
                  <th className="px-4 py-3 text-center">Payment Method</th>
                  <th className="px-4 py-3 text-center">Status <ArrowDown size={12} className="inline ml-1 opacity-50" /></th>
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
                ) : data?.items?.map((sale) => {
                  // Determine visual status purely based on ID for mockup demonstration, or use actual logic
                  let isPending = false;
                  if(sale.saleId && (sale.saleId.includes('41') || sale.saleId.includes('34'))) isPending = true;

                  const isSelected = selectedSaleId === sale.docEntry;

                  return (
                    <tr 
                      key={sale.docEntry} 
                      className={cn("hover:bg-[#112847] transition-colors cursor-pointer group", 
                        isSelected && "bg-[#112847] shadow-[inset_2px_0_0_#3b82f6]"
                      )}
                      onClick={() => setSelectedSaleId(sale.docEntry!)}
                    >
                      <td className="px-4 py-3 text-center"><input type="checkbox" className="rounded border-sky-800/60 bg-[#0b2340] text-blue-500" /></td>
                      <td className="px-4 py-3 font-medium text-blue-400 hover:underline">{sale.saleId}</td>
                      <td className="px-4 py-3 text-sky-100">{sale.docDate}</td>
                      <td className="px-4 py-3 text-sky-100">{sale.customerName || 'Walk-in'}</td>
                      <td className="px-4 py-3 text-sky-300/80">Main Branch</td>
                      <td className="px-4 py-3 text-right font-medium text-white">{fmt(sale.total)}</td>
                      <td className="px-4 py-3 text-center text-sky-300/80 capitalize">{sale.paymentMethod || 'Online (Razorpay)'}</td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(sale.hasReturn, isPending)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            className="px-2.5 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 border border-blue-500/30 rounded text-xs font-medium transition-colors"
                            onClick={(e) => { e.stopPropagation(); setSelectedSaleId(sale.docEntry!); }}
                          >
                            View
                          </button>
                          <button className="p-1 text-sky-400/60 hover:text-white transition-colors">
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-[#061a2f] border-t border-sky-900/60 p-3 flex items-center justify-between text-xs text-sky-400/60">
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
                <span className="px-1 text-sky-500/50">...</span>
                <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-sky-900/40 text-sky-300 font-medium">{totalPages}</button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded bg-[#0b2340] border border-sky-800/60 hover:bg-sky-900/40 disabled:opacity-50 transition-colors text-sky-300"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 relative">
                <select className="bg-[#0b2340] border border-sky-800/60 rounded px-2 py-1 pr-6 appearance-none focus:outline-none">
                  <option>10 / page</option>
                  <option>20 / page</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-400/60 pointer-events-none" size={12} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Right Details Panel */}
      {selectedSaleId !== null && (
        <InvoiceDetailPanel 
          id={selectedSaleId} 
          onClose={() => setSelectedSaleId(null)} 
        />
      )}

    </div>
  );
};

// Helper component for the dropdown arrow
function ChevronDown({className, size}: {className?: string, size?: number}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
  )
}
