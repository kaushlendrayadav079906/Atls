import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { salesOrdersApi } from '../api/salesOrders';
import { useDebounce } from '../hooks/useDebounce';
import {
  FileText, Clock, CheckCircle2, XCircle, Search, Filter, RotateCcw, 
  MoreVertical, Download, Plus, Eye, Edit, ChevronLeft, ChevronRight,
  Calendar, ChevronDown
} from 'lucide-react';

export default function SalesOrdersPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  
  type QuickFilter = 'today' | 'week' | 'month' | 'year' | 'custom' | '';
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  
  const applyQuickFilter = (filter: QuickFilter) => {
    setQuickFilter(filter);
    setPage(1);
    
    if (!filter) {
      setDateFrom('');
      setDateTo('');
      setCustomFrom('');
      setCustomTo('');
      return;
    }
    
    if (filter === 'custom') {
      setDateFrom(customFrom);
      setDateTo(customTo);
      return;
    }
    
    const now = new Date();
    const to = new Date();
    let from = new Date(now);
    
    if (filter === 'today') {
      from = new Date(now);
    } else if (filter === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
      from = new Date(now.setDate(diff));
    } else if (filter === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'year') {
      from = new Date(now.getFullYear(), 0, 1);
    }
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    setDateFrom(`${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`);
    setDateTo(`${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`);
  };

  // Drawer states
  const [selectedDocEntry, setSelectedDocEntry] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'customer'>('overview');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.date-dropdown-container')) {
        setIsDateDropdownOpen(false);
      }
    };
    if (isDateDropdownOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isDateDropdownOpen]);

  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsDrawerOpen(false);
      };
      window.addEventListener('keydown', handleEsc);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
      };
    }
  }, [isDrawerOpen]);
  
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['sales-orders-summary', dateFrom, dateTo],
    queryFn: () => salesOrdersApi.getSummary({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
  });

  const { data: ordersData, isLoading: ordersLoading, isError } = useQuery({
    queryKey: ['sales-orders', page, limit, debouncedSearch, statusFilter, customerFilter, dateFrom, dateTo],
    queryFn: () => salesOrdersApi.getOrders({
      page,
      limit,
      search: debouncedSearch,
      status: statusFilter,
      customer: customerFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined
    })
  });

  const { data: detailData, isLoading: detailLoading, isError: detailError } = useQuery({
    queryKey: ['purchaseOrder', selectedDocEntry],
    queryFn: () => salesOrdersApi.getOrderDetail(selectedDocEntry!),
    enabled: !!selectedDocEntry && isDrawerOpen,
  });

  const handleReset = () => {
    setSearch('');
    setStatusFilter('');
    setCustomerFilter('');
    setQuickFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
  const fmtDate = (d: string | null) => {
    if (!d) return '-';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const getStatusStyle = (status: string | null, cancelled: string | null) => {
    if (cancelled === 'tYES') return 'bg-red-100 text-red-700';
    if (status === 'bost_Close') return 'bg-emerald-100 text-emerald-700';
    return 'bg-amber-100 text-amber-700';
  };

  const getStatusLabel = (status: string | null, cancelled: string | null) => {
    if (cancelled === 'tYES') return 'Cancelled';
    if (status === 'bost_Close') return 'Received';
    return 'Pending';
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Orders</h1>
          <p className="text-slate-500 mt-1">Manage and track customer purchase orders from SAP Business One.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative date-dropdown-container">
            <button 
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors font-medium text-sm"
            >
              <Calendar className="w-4 h-4 text-slate-500" />
              {quickFilter ? (
                quickFilter === 'today' ? 'Today' : 
                quickFilter === 'custom' ? 'Custom Range' :
                `This ${quickFilter.charAt(0).toUpperCase() + quickFilter.slice(1)}`
              ) : 'All Dates (Total)'}
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isDateDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 shadow-lg rounded-lg py-1 z-50">
                <button
                  onClick={() => { applyQuickFilter(''); setIsDateDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    quickFilter === '' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Dates (Total)
                </button>
                <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50">Quick Filters</div>
                {(['today', 'week', 'month', 'year'] as const).map(f => {
                  const label = f === 'today' ? 'Today' : `This ${f.charAt(0).toUpperCase() + f.slice(1)}`;
                  return (
                    <button
                      key={f}
                      onClick={() => { applyQuickFilter(f); setIsDateDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        quickFilter === f ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100 bg-slate-50 mt-1">Custom Range</div>
                <div className="p-3 flex flex-col gap-2">
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">From</label>
                    <input type="date" className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">To</label>
                    <input type="date" className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                  </div>
                  <button 
                    disabled={!customFrom || !customTo}
                    onClick={() => { applyQuickFilter('custom'); setIsDateDropdownOpen(false); }}
                    className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded font-medium text-sm transition-colors"
                  >
                    Apply Custom
                  </button>
                </div>
              </div>
            )}
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white">
            <MoreVertical className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors font-semibold text-sm">
            <Download className="w-4 h-4" />
            Import from Excel
          </button>
          <button 
            onClick={() => alert("Create Sales Order backend operation is not currently implemented.")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Sales Order
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-1">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-slate-500">Total Sales Orders</p>
            {summaryLoading ? <div className="h-8 w-16 bg-slate-100 animate-pulse rounded mt-1"></div> : (
              <h3 className="text-[28px] font-bold text-slate-900 leading-tight mt-1">{summary?.total_orders || 0}</h3>
            )}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0 mt-1">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-slate-500">Pending Orders</p>
            {summaryLoading ? <div className="h-8 w-16 bg-slate-100 animate-pulse rounded mt-1"></div> : (
              <h3 className="text-[28px] font-bold text-slate-900 leading-tight mt-1">{summary?.pending_orders || 0}</h3>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Awaiting delivery</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 mt-1">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-slate-500">Completed Orders</p>
            {summaryLoading ? <div className="h-8 w-16 bg-slate-100 animate-pulse rounded mt-1"></div> : (
              <h3 className="text-[28px] font-bold text-slate-900 leading-tight mt-1">{summary?.completed_orders || 0}</h3>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Delivered & Invoiced</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg shrink-0 mt-1">
            <XCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-slate-500">Cancelled Orders</p>
            {summaryLoading ? <div className="h-8 w-16 bg-slate-100 animate-pulse rounded mt-1"></div> : (
              <h3 className="text-[28px] font-bold text-slate-900 leading-tight mt-1">{summary?.cancelled_orders || 0}</h3>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Cancelled by user</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-slate-700 mb-1">Customer</label>
            <input 
               type="text" 
               className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500" 
               placeholder="All Customers" 
               value={customerFilter}
               onChange={(e) => setCustomerFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-slate-700 mb-1">Status</label>
            <select 
               className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-slate-700 mb-1">Buyer</label>
            <input type="text" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500" placeholder="All Buyers" disabled />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[12px] font-medium text-slate-700 mb-1">Branch</label>
            <input type="text" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-slate-50" placeholder="Authorized Branch Only" disabled />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-slate-700 mb-1">Warehouse</label>
            <input type="text" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none" placeholder="All Warehouses" disabled />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-slate-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                className="w-full text-sm border border-slate-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-blue-500" 
                placeholder="Search by PO number, customer..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
             <button onClick={() => setPage(1)} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
               <Filter className="w-4 h-4" />
               Apply Filters
             </button>
             <button onClick={handleReset} className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
               <RotateCcw className="w-4 h-4" />
               Reset
             </button>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
         <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
               <FileText className="w-5 h-5 text-blue-600" />
               <h2 className="text-lg font-bold text-slate-900">Sales Orders ({ordersData?.total || 0})</h2>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors">
               <Download className="w-4 h-4" />
               Export
            </button>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px]"><input type="checkbox" className="rounded border-slate-300" /></th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px]">#</th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px]">SO No.</th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px]">Order Date</th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px]">Customer Code</th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px]">Customer Name</th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px] text-right">Total Amount</th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px] text-center">Status</th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px]">Expected Date</th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px]">Created By</th>
                     <th className="px-4 py-3 font-semibold text-slate-500 text-[12px] text-center">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {ordersLoading ? (
                     <tr>
                        <td colSpan={11} className="py-12">
                           <div className="flex flex-col items-center justify-center gap-3">
                              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              <div className="text-slate-500 text-sm font-medium">Loading purchase orders...</div>
                           </div>
                        </td>
                     </tr>
                  ) : isError ? (
                     <tr>
                        <td colSpan={11} className="py-12 text-center text-red-500 font-medium">Unable to load purchase orders.</td>
                     </tr>
                  ) : ordersData?.items.length === 0 ? (
                     <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-500 font-medium">
                           No purchase orders found {quickFilter ? `for this ${quickFilter}` : ''}.
                        </td>
                     </tr>
                  ) : (
                     ordersData?.items.map((order, idx) => (
                        <tr key={order.doc_entry} className="hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-3"><input type="checkbox" className="rounded border-slate-300" /></td>
                           <td className="px-4 py-3 text-slate-500">{(page - 1) * limit + idx + 1}</td>
                           <td className="px-4 py-3 font-medium text-blue-600">{order.doc_num}</td>
                           <td className="px-4 py-3 text-slate-600">{fmtDate(order.doc_date)}</td>
                           <td className="px-4 py-3 text-slate-600">{order.card_code}</td>
                           <td className="px-4 py-3 font-medium text-slate-900">{order.card_name}</td>
                           <td className="px-4 py-3 font-bold text-slate-900 text-right">{fmt(order.doc_total)}</td>
                           <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${getStatusStyle(order.document_status, order.cancelled)}`}>
                                 {getStatusLabel(order.document_status, order.cancelled)}
                              </span>
                           </td>
                           <td className="px-4 py-3 text-slate-600">{fmtDate(order.doc_due_date)}</td>
                           <td className="px-4 py-3 text-slate-600">{order.sales_person_code || '-'}</td>
                           <td className="px-4 py-3">
                               <div className="flex items-center justify-center gap-2">
                                 <button onClick={() => { setSelectedDocEntry(order.doc_entry); setActiveTab('overview'); setIsDrawerOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button>
                                 <button title="Sales Order editing is not currently available" className="p-1 text-slate-400 hover:bg-slate-50 rounded cursor-not-allowed"><Edit className="w-4 h-4" /></button>
                                 <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded"><MoreVertical className="w-4 h-4" /></button>
                              </div>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>

         {/* Pagination */}
         <div className="flex items-center justify-between p-4 border-t border-slate-200 text-sm">
            <div className="text-slate-500 text-[13px]">
               Showing {ordersData?.items.length ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, ordersData?.total || 0)} of {ordersData?.total || 0} orders
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[13px]">Rows per page</span>
                  <select 
                     className="border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-700 bg-white"
                     value={limit}
                     onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  >
                     <option value={10}>10</option>
                     <option value={20}>20</option>
                     <option value={50}>50</option>
                  </select>
               </div>
               <div className="flex items-center gap-1">
                  <button 
                     disabled={page === 1}
                     onClick={() => setPage(p => p - 1)}
                     className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                     <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white font-medium text-[13px]">
                     {page}
                  </button>
                  <button 
                     disabled={page >= (ordersData?.total_pages || 1)}
                     onClick={() => setPage(p => p + 1)}
                     className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                     <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
         </div>
      </div>

      {/* Detail Modal Overlay */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/35 backdrop-blur-[3px] z-[100] flex items-center justify-center p-4 sm:p-6"
          onClick={() => setIsDrawerOpen(false)}
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
          `}</style>

          {/* Detail Modal */}
          <div 
            className="w-full max-w-[1100px] h-full max-h-[85vh] bg-white rounded-xl shadow-2xl z-[101] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'scaleIn 0.2s ease-out' }}
          >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-bold text-slate-900">Sales Order {detailData ? `#${detailData.doc_num}` : ''}</h2>
            {detailData && (
              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${getStatusStyle(detailData.document_status, detailData.cancelled)}`}>
                {getStatusLabel(detailData.document_status, detailData.cancelled)}
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 flex flex-col">
          {detailLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-slate-500 font-medium text-sm">Loading purchase order details...</div>
            </div>
          ) : detailError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="text-red-500 font-medium text-sm">Unable to load Sales Order details.</div>
              <button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['purchaseOrder', selectedDocEntry] })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : detailData ? (
            <>
              {/* Tabs */}
              <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-6">
                {(['overview', 'items', 'customer'] as const).map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-4 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === tab 
                        ? 'border-blue-600 text-blue-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Overview</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Customer</div>
                        <div className="text-[14px] font-medium text-slate-900">{detailData.card_name}</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Order Date</div>
                        <div className="text-[14px] font-medium text-slate-900">{fmtDate(detailData.doc_date)}</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Expected Date</div>
                        <div className="text-[14px] font-medium text-slate-900">{fmtDate(detailData.doc_due_date)}</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</div>
                        <div className="text-[14px] font-medium text-slate-900">{getStatusLabel(detailData.document_status, detailData.cancelled)}</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Amount</div>
                        <div className="text-[14px] font-bold text-blue-600">{fmt(detailData.doc_total)}</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Branch</div>
                        <div className="text-[14px] font-medium text-slate-900">{detailData.bpl_id || 'Not available'}</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Buyer</div>
                        <div className="text-[14px] font-medium text-slate-900">{detailData.agent_name || detailData.sales_person_code || 'Not available'}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Comments</div>
                        <div className="text-[14px] font-medium text-slate-900 whitespace-pre-wrap">{detailData.comments || 'No comments'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'items' && (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                       <h3 className="text-[14px] font-bold text-slate-800">Sales Order Lines</h3>
                       <span className="text-[12px] font-medium text-slate-500">{detailData.document_lines.length} Items</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">#</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">SO No</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Order Date</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Party Name</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Item Code</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Item Name</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider text-right">Rate</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider text-right">Ordered Qty</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider text-right text-emerald-600">Dispatch Qty</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider text-right text-amber-600">Balance Qty</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider text-right">Warehouse</th>
                            <th className="px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detailData.document_lines.map((line: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-slate-500 font-medium">{idx + 1}</td>
                              <td className="px-4 py-3 text-blue-600 font-medium">{detailData.doc_num}</td>
                              <td className="px-4 py-3 text-slate-600">{fmtDate(detailData.doc_date)}</td>
                              <td className="px-4 py-3 text-slate-900 truncate max-w-[150px]" title={detailData.card_name || ''}>{detailData.card_name}</td>
                              <td className="px-4 py-3 text-blue-600 font-medium">{line.item_code}</td>
                              <td className="px-4 py-3 text-slate-900 truncate max-w-[200px]" title={line.item_description}>{line.item_description}</td>
                              <td className="px-4 py-3 font-medium text-slate-900 text-right">{fmt(line.price)}</td>
                              <td className="px-4 py-3 font-bold text-slate-900 text-right">{line.quantity}</td>
                              <td className="px-4 py-3 font-bold text-emerald-600 text-right">{line.dispatch_qty}</td>
                              <td className="px-4 py-3 font-bold text-amber-600 text-right">{line.balance_qty}</td>
                              <td className="px-4 py-3 font-medium text-slate-600 text-right">{line.warehouse_code || '-'}</td>
                              <td className="px-4 py-3 font-bold text-slate-900 text-right">{fmt(line.line_total)}</td>
                            </tr>
                          ))}
                          {detailData.document_lines.length === 0 && (
                            <tr>
                               <td colSpan={12} className="py-8 text-center text-slate-500">No items found in this purchase order.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'customer' && (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Customer Information</h3>
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Customer Code</div>
                        <div className="text-[14px] font-medium text-blue-600">{detailData.card_code}</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Customer Name</div>
                        <div className="text-[14px] font-medium text-slate-900">{detailData.card_name}</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Contact Information</div>
                        <div className="text-[14px] font-medium text-slate-500">Not available</div>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Address</div>
                        <div className="text-[14px] font-medium text-slate-500">Not available</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
        </div>
      </div>
      )}
    </div>
  );
}
