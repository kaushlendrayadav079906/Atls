import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
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
  Package2,  
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
      <div className="w-[450px] bg-slate-50 border-l border-slate-200 flex flex-col h-full animate-pulse">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="h-6 w-32 bg-slate-100 rounded"></div>
          <div className="h-6 w-6 bg-slate-100 rounded"></div>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="h-20 bg-slate-100 rounded"></div>
          <div className="h-40 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="w-[450px] bg-slate-50 border-l border-slate-200 flex flex-col h-full items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <p className="text-red-400 font-medium">Failed to load invoice details.</p>
        <button onClick={onClose} className="mt-4 text-blue-600 hover:text-blue-600 underline text-sm">Close Panel</button>
      </div>
    );
  }

  const isPending = invoice.syncStatus !== 'synced';

  return (
    <div className="w-[450px] bg-slate-50 border-l border-slate-200 flex flex-col h-full flex-shrink-0 shadow-lg z-10 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          Invoice Details
        </h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-xs font-medium transition-colors">
            <Printer size={14} /> Print
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-xs font-medium transition-colors">
            <Download size={14} /> Download
          </button>
          <button onClick={onClose} className="p-1.5 text-blue-600/60 hover:text-slate-800 hover:bg-slate-100 rounded-lg ml-1">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto ">
        {/* Title Section */}
        <div className="p-5 flex items-start gap-4 border-b border-slate-200">
          <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-200 shadow-sm">
            <FileText size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{invoice.saleId}</h1>
              <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border", 
                isPending ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
              )}>
                {isPending ? 'Pending' : 'Completed'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Sales Invoice</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-5 grid grid-cols-2 gap-y-4 gap-x-6 text-[13px] border-b border-slate-200">
          <div>
            <div className="text-slate-500 mb-1">Invoice Date</div>
            <div className="text-slate-900 font-medium flex items-center gap-1.5">
              {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              }) : '-'}
            </div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">Payment Method</div>
            <div className="text-slate-900 font-medium flex items-center gap-1.5">
              <CreditCard size={14} className="text-blue-600" />
              N/A
            </div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">Customer</div>
            <div className="text-slate-900 font-medium flex items-center gap-1.5">
              <User size={14} className="text-blue-600" />
              {invoice.customer || 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">Payment Status</div>
            <div>
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border", 
                isPending ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"
              )}>
                {isPending ? 'Pending' : 'Paid'}
              </span>
            </div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">Contact</div>
            <div className="text-slate-900 font-medium truncate">{invoice.customer || '-'}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">Sales Person</div>
            <div className="text-slate-900 font-medium">N/A</div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">Branch</div>
            <div className="text-slate-900 font-medium truncate">N/A</div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">Reference</div>
            <div className="text-slate-900 font-medium">-</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 border-b border-slate-200 flex gap-6">
          {['Items', 'Payments', 'Notes', 'History'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase() as any)}
              className={cn("pb-2 text-[13px] font-medium transition-colors relative", 
                activeTab === tab.toLowerCase() ? "text-blue-600" : "text-slate-500 hover:text-slate-800")}
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
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-medium w-8">#</th>
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium text-center">Qty</th>
                  <th className="pb-2 font-medium text-right">Price (₹)</th>
                  <th className="pb-2 font-medium text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {invoice.items?.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-200 last:border-0 hover:bg-white/50 transition-colors">
                    <td className="py-2.5 text-blue-600/60">{idx + 1}</td>
                    <td className="py-2.5 pr-2 font-medium flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-blue-600">
                        <Package2 size={12} />

                      </div>
                      <span className="truncate max-w-[120px]">{item.ItemDescription || item.ItemCode}</span>
                    </td>
                    <td className="py-2.5 text-center">{item.Quantity}</td>
                    <td className="py-2.5 text-right text-slate-500">{item.Price?.toFixed(2) || '0.00'}</td>
                    <td className="py-2.5 text-right font-medium">{item.LineTotal?.toFixed(2) || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Summary Footer */}
      <div className="p-5 border-t border-slate-200 bg-white">
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{fmt(invoice.total)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Discount</span>
            <span className="text-red-400">-{fmt(0)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Tax</span>
            <span>{fmt(0)}</span>
          </div>
          <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-200">
            <span className="text-base font-bold text-slate-900">Total</span>
            <span className="text-lg font-bold text-blue-600">{fmt(invoice.total)}</span>
          </div>
          <div className="flex justify-between text-slate-500 pt-1">
            <span>Amount Paid</span>
            <span>{fmt(0)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Balance Due</span>
            <span className="text-amber-700 font-medium">{fmt(invoice.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SalesList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [dateRange, setDateRange] = useState<SalesFeedParams['range']>('monthly');
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
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-600 border border-red-500/30">Refunded</span>;
    }
    if (isPending) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">Pending</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-600 border border-emerald-200">Paid</span>;
  };

  return (
    <div className="flex h-[calc(100vh-60px)] -m-4 sm:-m-5 lg:-m-6 overflow-hidden bg-slate-50">
      
      {/* Main List Section */}
      <div className="flex-1 flex flex-col h-full p-4 sm:p-5 lg:p-6 overflow-y-auto ">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales & Invoices</h1>
            <p className="text-sm text-slate-500 mt-1">View, search and manage all sales invoices</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:block">Dashboard {'>'} Sales & Invoices</span>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-200">
              <span className="text-xl font-bold">₹</span>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Gross Sales <span className="lowercase font-normal opacity-70">(Selected Period)</span></div>
              <div className="text-xl font-bold text-slate-900">{fmt(data?.grossSales || 0)}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-200">
              <FileText size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Invoices</div>
              <div className="text-xl font-bold text-slate-900">{data?.total || 0}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-200">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Paid Invoices</div>
              <div className="text-xl font-bold text-slate-900 flex items-baseline gap-1">{data?.paidInvoices || 0}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0 border border-amber-200">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Pending / Due</div>
              <div className="text-xl font-bold text-slate-900 flex items-baseline gap-1">{data?.pendingInvoices || 0}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600/60" size={16} />
            <input 
              type="text" 
              placeholder="Search by invoice number or customer name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-[13px] text-slate-900 placeholder:text-blue-600/50 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="relative w-[200px]">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600/60" size={16} />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as SalesFeedParams['range'])}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-[13px] text-slate-700 appearance-none focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="yearly">This Year</option>
              <option value="all_time">All Time</option>
            </select>
          </div>
          <div className="relative w-[140px]">
            <select className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-[13px] text-slate-700 appearance-none focus:outline-none focus:border-blue-500 transition-colors">
              <option value="">All Status</option>
            </select>
          </div>
          <div className="relative w-[180px]">
            <select className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-[13px] text-slate-700 appearance-none focus:outline-none focus:border-blue-500 transition-colors">
              <option value="">All Payment Methods</option>
            </select>
          </div>
          <div className="relative w-[200px]">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600/60" size={16} />
            <select className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-[13px] text-slate-700 appearance-none focus:outline-none focus:border-blue-500 transition-colors">
              <option value="">All Branches</option>
            </select>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">
            <Search size={14} /> Search
          </button>
          <button 
            onClick={() => { setSearchTerm(''); }}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-blue-600 text-[13px] font-medium rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[400px]">
          <div className="overflow-x-auto flex-1 ">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-white border-b border-slate-200 text-blue-600/70 font-semibold sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-10 text-center"><input type="checkbox" className="rounded border-slate-200 bg-white text-blue-500" /></th>
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
              <tbody className="divide-y divide-sky-900/40 text-slate-700">
                {isLoading ? (
                   <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                      <p className="mt-2 text-sm text-blue-600/60">Loading invoices...</p>
                    </td>
                  </tr>
                ) : data?.items?.map((sale) => {
                  const isPending = false; // Add real pending logic if added to API

                  const isSelected = selectedSaleId === sale.docEntry;

                  return (
                    <tr 
                      key={sale.docEntry} 
                      className={cn("hover:bg-slate-100 transition-colors cursor-pointer group", 
                        isSelected && "bg-slate-100 shadow-[inset_2px_0_0_#3b82f6]"
                      )}
                      onClick={() => setSelectedSaleId(sale.docEntry!)}
                    >
                      <td className="px-4 py-3 text-center"><input type="checkbox" className="rounded border-slate-200 bg-white text-blue-500" /></td>
                      <td className="px-4 py-3 font-medium text-blue-600 hover:underline">{sale.saleId}</td>
                      <td className="px-4 py-3 text-slate-700">{sale.docDate}</td>
                      <td className="px-4 py-3 text-slate-700">{sale.customerName || 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-500">N/A</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{fmt(sale.total)}</td>
                      <td className="px-4 py-3 text-center text-slate-500 capitalize">{sale.paymentMethod || 'N/A'}</td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(sale.hasReturn, isPending)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            className="px-2.5 py-1 bg-blue-600/20 text-blue-600 hover:bg-blue-600/40 border border-blue-200 rounded text-xs font-medium transition-colors"
                            onClick={(e) => { e.stopPropagation(); setSelectedSaleId(sale.docEntry!); }}
                          >
                            View
                          </button>
                          <button className="p-1 text-blue-600/60 hover:text-slate-900 transition-colors">
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
          <div className="bg-white border-t border-slate-200 p-3 flex items-center justify-between text-xs text-blue-600/60">
            <div>
              Showing {data?.total ? offset + 1 : 0} to {Math.min(offset + limit, data?.total || 0)} of {data?.total || 0} invoices
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition-colors text-blue-600"
                >
                  <ChevronLeft size={14} />
                </button>
                <button className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 text-white font-medium">1</button>
                <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-blue-600 font-medium">2</button>
                <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-blue-600 font-medium">3</button>
                <span className="px-1 text-slate-8000/50">...</span>
                <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-blue-600 font-medium">{totalPages}</button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition-colors text-blue-600"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 relative">
                <select className="bg-white border border-slate-200 rounded px-2 py-1 pr-6 appearance-none focus:outline-none">
                  <option>10 / page</option>
                  <option>20 / page</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600/60 pointer-events-none" size={12} />
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
