import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertCircle,
    Building2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    ListFilter,
    Loader2,
    Plus,
    RotateCcw,
    Search,
    ShieldAlert,
    Sparkles,
    Ticket,
    X,
    Eye,
    Calendar,
    ChevronDown,
} from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { returnsApi, type ApprovalRequestRow } from '../../api/returns';
import { useAuth } from '../../contexts/AuthContext';

const badgePalette: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 border border-amber-200',
  processing: 'bg-sky-50 text-slate-600 border border-slate-200',
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-200',
  failed: 'bg-red-50 text-red-700 border border-red-200',
  'outcome-unknown': 'bg-violet-50 text-violet-700 border border-violet-200',
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const safeText = (value?: string | number | null) =>
  value === undefined || value === null || value === '' ? '—' : String(value);

const normalizeStatus = (status?: string) => {
  const value = (status || '').toLowerCase();
  if (value.includes('pending')) return 'pending';
  if (value.includes('processing')) return 'processing';
  if (value.includes('approved') || value.includes('completed')) return 'completed';
  if (value.includes('reject')) return 'rejected';
  if (value.includes('fail')) return 'failed';
  if (value.includes('unknown')) return 'outcome-unknown';
  return value || 'pending';
};

const asItemsArray = (payload: Record<string, any> | undefined, field: string): any[] => {
  const value = payload?.[field];
  if (Array.isArray(value)) return value;
  return [];
};

const getRequestNumber = (request: ApprovalRequestRow) => {
  const raw = request.payload?.requestId || request.id;
  return (raw || 'RET-0000').toString().slice(0, 8).toUpperCase();
};

const getCustomerName = (request: ApprovalRequestRow) => {
  const payload = request.payload || {};
  return payload.customerName || payload.cardName || payload.cardCode || 'Customer';
};

const getInvoiceNumber = (request: ApprovalRequestRow) => {
  const payload = request.payload || {};
  const fromPayload = payload.originalDocNum ?? payload.docNum ?? request.original_doc_num;
  return safeText(fromPayload);
};

const getLineTotalFromItem = (item: any) => {
  if (typeof item?.lineTotal === 'number') return item.lineTotal;
  if (typeof item?.unitPrice === 'number' && typeof item?.quantity === 'number') {
    return item.unitPrice * item.quantity;
  }
  return 0;
};

const getRequestItems = (request: ApprovalRequestRow) => {
  const payload = request.payload || {};
  const items = asItemsArray(payload, 'items');
  if (items.length) return items;
  return asItemsArray(payload, 'returnItems');
};

export const ReturnsApprovalsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [tab, setTab] = useState<'all' | 'pending' | 'completed' | 'rejected' | 'failed'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [branchId, setBranchId] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [status, setStatus] = useState('all');

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
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const getStartEndDate = (range: string) => {
    if (!range) return { start: undefined, end: undefined };
    if (range.includes('_to_')) {
      return { start: range.split('_to_')[0], end: range.split('_to_')[1] };
    }
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    let start = end;
    if (range === 'week') {
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 7);
      start = lastWeek.toISOString().split('T')[0];
    } else if (range === 'month') {
      const lastMonth = new Date(today);
      lastMonth.setMonth(today.getMonth() - 1);
      start = lastMonth.toISOString().split('T')[0];
    } else if (range === 'year') {
      const lastYear = new Date(today);
      lastYear.setFullYear(today.getFullYear() - 1);
      start = lastYear.toISOString().split('T')[0];
    }
    return { start, end };
  };

  const { data = { items: [], total: 0, counts: { all: 0, pending: 0, completed: 0, rejected: 0, failed: 0 } }, isLoading, isError, error, refetch } = useQuery<{items: ApprovalRequestRow[], total: number, counts: Record<string, number>}>({
    queryKey: ['returns-approvals', page, limit, branchId, dateRange, tab !== 'all' ? tab : status, debouncedSearch],
    queryFn: () => {
      const { start, end } = getStartEndDate(dateRange);
      return returnsApi.getApprovalQueue({
        page,
        limit,
        branch_id: branchId || undefined,
        start_date: start,
        end_date: end,
        status: tab !== 'all' ? tab : (status !== 'all' ? status : undefined),
        search: debouncedSearch || undefined,
      });
    },
    staleTime: 30_000,
  });

  const rows: ApprovalRequestRow[] = data.items;
  const totalCount = data.total;
  const totalCounts = data.counts;
  const totalPages = Math.ceil(totalCount / limit);

  const selectedRequest = rows.find((request) => request.id === selectedId) || rows[0] || null;

  const mutationConfig = {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['returns-approvals'] });
      setActionError(null);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'The request could not be processed.';
      setActionError(message);
    },
  };

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => returnsApi.approveRequest(requestId),
    ...mutationConfig,
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => returnsApi.rejectRequest(requestId),
    ...mutationConfig,
  });

  const canApprove = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'manager';

  const tabs = [
    { key: 'all', label: 'All Requests', count: totalCounts.all },
    { key: 'pending', label: 'Pending', count: totalCounts.pending },
    { key: 'completed', label: 'Approved', count: totalCounts.completed },
    { key: 'rejected', label: 'Rejected', count: totalCounts.rejected },
    { key: 'failed', label: 'My Approvals', count: totalCounts.failed },
  ] as const;

  const handleApprove = async (requestId: string) => {
    if (!canApprove) {
      setActionError('Approval actions require admin or manager access.');
      return;
    }
    await approveMutation.mutateAsync(requestId);
  };

  const handleReject = async (requestId: string) => {
    if (!canApprove) {
      setActionError('Approval actions require admin or manager access.');
      return;
    }
    await rejectMutation.mutateAsync(requestId);
  };

  const selectedItems = selectedRequest ? getRequestItems(selectedRequest) : [];
  const selectedAmount = selectedRequest ? Number(selectedRequest.amount || selectedItems.reduce((sum, item) => sum + getLineTotalFromItem(item), 0)) : 0;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Returns &amp; Approvals</h1>
            <p className="mt-1 text-sm text-slate-600">Manage return requests, review approvals, and track workflow status.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative date-dropdown-container z-50 hidden sm:block">
              <button 
                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors font-medium text-sm"
              >
                <Calendar className="w-4 h-4 text-slate-500" />
                {dateRange === '' ? 'All Dates (Total)' :
                 dateRange === 'today' ? 'Today' : 
                 dateRange.includes('_to_') ? 'Custom Range' :
                 `This ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isDateDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 shadow-lg rounded-lg py-1">
                  <button
                    onClick={() => { setDateRange(''); setPage(1); setIsDateDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      dateRange === '' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
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
                        onClick={() => { setDateRange(f); setPage(1); setIsDateDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          dateRange === f ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
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
                      onClick={() => { setDateRange(`${customFrom}_to_${customTo}`); setPage(1); setIsDateDropdownOpen(false); }}
                      className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded font-medium text-sm transition-colors"
                    >
                      Apply Custom
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <Search className="h-4 w-4" />
              Search requests
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-900/20 hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              New Return
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile title="Pending Requests" value={String(totalCounts.pending)} change="since yesterday" tone="cyan" icon={<Clock3 className="h-5 w-5" />} />
          <MetricTile title="Approved Today" value={String(totalCounts.completed)} change="processed" tone="green" icon={<Sparkles className="h-5 w-5" />} />
          <MetricTile title="Rejected Today" value={String(totalCounts.rejected)} change="requires review" tone="rose" icon={<X className="h-5 w-5" />} />
          <MetricTile title="Awaiting Review" value={String(totalCounts.failed)} change="needs attention" tone="violet" icon={<ShieldAlert className="h-5 w-5" />} />
        </div>

        <div className="flex flex-col gap-6">
          
          <div className="flex flex-col gap-4">


            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              
              {/* Tabs */}
              <div className="flex items-center overflow-x-auto border-b border-slate-200 px-2 bg-slate-50/50">
                {tabs.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => { setTab(item.key as any); setPage(1); }}
                    className={`flex items-center whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
                      tab === item.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {item.label}
                    {item.count > 0 && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                          tab === item.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Filter Bar */}
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 min-w-[160px]">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <select value={branchId} onChange={(e) => {setBranchId(e.target.value); setPage(1);}} className="bg-transparent outline-none w-full">
                      <option value="">All Branches</option>
                      <option value="WH-001">Main Branch (WH-001)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 min-w-[140px]">
                    <ListFilter className="h-4 w-4 text-slate-400" />
                    <select value={status} onChange={(e) => {setStatus(e.target.value); setTab('all'); setPage(1);}} className="bg-transparent outline-none w-full">
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="processing">Processing</option>
                      <option value="failed">Failed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm min-w-[200px]">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search request ID, invoice no, customer..."
                      className="w-full bg-transparent text-slate-700 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                  
                  <button type="button" className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition">
                    <ListFilter className="h-4 w-4" />
                    Filter
                  </button>

                  <button type="button" onClick={() => {setSearchTerm(''); setDateRange(''); setBranchId(''); setStatus('all'); setTab('all'); setPage(1);}} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                    Clear
                  </button>
                </div>
              </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Request ID</th>
                    <th className="px-4 py-3">Invoice No.</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-600">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                          Loading returns...
                        </div>
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="space-y-2 text-slate-700">
                          <p className="font-medium text-red-700">Unable to load return requests</p>
                          <p className="text-sm text-slate-600">{(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'The approval service is unavailable.'}</p>
                          <button type="button" onClick={() => refetch()} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">Retry</button>
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-600">
                        <div className="space-y-2">
                          <RotateCcw className="mx-auto h-8 w-8 text-blue-600" />
                          <p className="font-medium">No return requests found</p>
                          <p className="text-sm text-slate-500">Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((request, index) => {
                      const status = normalizeStatus(request.status);
                      const rowItems = getRequestItems(request);
                      const rowAmount = Number(request.amount || rowItems.reduce((sum, item) => sum + getLineTotalFromItem(item), 0));
                      const isSelected = selectedRequest?.id === request.id;

                      return (
                        <tr
                          key={request.id}
                          className={`cursor-pointer transition ${isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                          onClick={() => setSelectedId(request.id)}
                        >
                          <td className="px-4 py-3 text-sm text-slate-600">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">{getRequestNumber(request)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{getInvoiceNumber(request)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{getCustomerName(request)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{rowItems.length}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{request.reason || 'Return'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatMoney(rowAmount)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{request.created_at ? new Date(request.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgePalette[status] || badgePalette.pending}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedId(request.id);
                                setIsModalOpen(true);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              aria-label="Review request"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 gap-4">
              <div className="flex items-center gap-4">
                <span>Showing {Math.min((page - 1) * limit + 1, totalCount) || 0} to {Math.min(page * limit, totalCount)} of {totalCount} requests</span>
                <div className="flex items-center gap-2 border-l border-slate-300 pl-4">
                  <span>Entries per page:</span>
                  <input 
                    type="number" 
                    min={1} 
                    max={100} 
                    value={limit} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val > 0 && val <= 100) {
                        setLimit(val);
                        setPage(1);
                      }
                    }}
                    className="w-16 rounded border border-slate-300 px-2 py-1 text-center outline-none focus:border-blue-500"
                  />
                  <select 
                    value={limit} 
                    onChange={(e) => {setLimit(Number(e.target.value)); setPage(1);}}
                    className="rounded border border-slate-300 px-2 py-1 outline-none focus:border-blue-500"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-slate-200 bg-slate-100 p-1.5 text-slate-700 hover:bg-[#123d65] hover:text-white disabled:opacity-50 transition">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, i, arr) => (
                  <div key={p} className="flex items-center">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-slate-400">...</span>}
                    <button 
                      type="button" 
                      onClick={() => setPage(p)}
                      className={`h-7 min-w-[28px] rounded-md text-[13px] font-medium transition-colors ${p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                      {p}
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || totalPages === 0} className="rounded-md border border-slate-200 bg-slate-100 p-1.5 text-slate-700 hover:bg-[#123d65] hover:text-white disabled:opacity-50 transition">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          </div>

          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/35 p-4 sm:p-6 backdrop-blur-[3px]" onClick={() => setIsModalOpen(false)}>
              <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg w-full max-w-5xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                
            {selectedRequest ? (
              <>
                <div className="flex items-center justify-between gap-4 mt-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Return Request Details</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">{getRequestNumber(selectedRequest)}</h2>
                  </div>
                  <button type="button" onClick={() => navigate('/sales')} className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#123d65]">
                    View Invoice
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-100">
                      <Ticket className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{getRequestNumber(selectedRequest)}</div>
                      <div className="text-xs text-blue-600">Submitted on {selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${badgePalette[normalizeStatus(selectedRequest.status)] || badgePalette.pending}`}>
                    {normalizeStatus(selectedRequest.status)}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Invoice Information</h3>
                      <div className="mt-3 grid gap-3 text-sm text-slate-700">
                        <InfoRow label="Invoice No." value={getInvoiceNumber(selectedRequest)} />
                        <InfoRow label="Customer" value={getCustomerName(selectedRequest)} />
                        <InfoRow label="Payment Method" value={safeText(selectedRequest.payload?.paymentMethod || selectedRequest.payload?.payment_method || 'Cash')} />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Return Items</h3>
                      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-sky-800 text-left text-sm">
                          <thead className="bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                            <tr>
                              <th className="px-3 py-2">#</th>
                              <th className="px-3 py-2">Product</th>
                              <th className="px-3 py-2 text-center">Qty</th>
                              <th className="px-3 py-2 text-right">Price</th>
                              <th className="px-3 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sky-800 bg-slate-50">
                            {selectedItems.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3 py-4 text-center text-slate-600">No item data returned by the backend.</td>
                              </tr>
                            ) : (
                              selectedItems.map((item, index) => (
                                <tr key={`${item.itemCode || 'line'}-${index}`}>
                                  <td className="px-3 py-2 text-slate-600">{index + 1}</td>
                                  <td className="px-3 py-2 text-slate-800">{item.itemName || item.itemCode || 'Item'}</td>
                                  <td className="px-3 py-2 text-center text-slate-700">{item.quantity || 0}</td>
                                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(item.unitPrice || 0)}</td>
                                  <td className="px-3 py-2 text-right text-slate-800">{formatMoney(getLineTotalFromItem(item))}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Requested Amount</h3>
                        <span className="text-xl font-bold text-slate-900">{formatMoney(selectedAmount)}</span>
                      </div>
                      <div className="mt-3 text-sm text-slate-700">
                        <p className="mb-2 font-medium text-slate-600">Reason for Return</p>
                        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">{selectedRequest.reason || 'No reason was provided by the backend.'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Approval Workflow</h3>
                      <div className="mt-4 space-y-3 text-sm">
                        <WorkflowRow title="Request Submitted" time={selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} done />
                        <WorkflowRow title="Pending Review" time={canApprove ? 'Admin/Manager approval queue' : 'Access restricted'} done={normalizeStatus(selectedRequest.status) !== 'rejected' && normalizeStatus(selectedRequest.status) !== 'completed'} />
                        <WorkflowRow title="Approved / Rejected" time={selectedRequest.updated_at ? new Date(selectedRequest.updated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Awaiting decision'} done={['completed', 'rejected', 'failed'].includes(normalizeStatus(selectedRequest.status))} />
                      </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Reviewer Notes</h3>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {selectedRequest.payload?.reviewerComment || 'No reviewer comment was returned by the backend yet.'}
                      </div>
                    </div>

                    <div className="pt-2">
                      {actionError && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4" />
                            <span>{actionError}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          type="button"
                          disabled={!canApprove || approveMutation.isPending || normalizeStatus(selectedRequest.status) !== 'pending'}
                          onClick={() => handleApprove(selectedRequest.id)}
                          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 transition"
                        >
                          {approveMutation.isPending ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          disabled={!canApprove || rejectMutation.isPending || normalizeStatus(selectedRequest.status) !== 'pending'}
                          onClick={() => handleReject(selectedRequest.id)}
                          className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-rose-900/20 hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50 transition"
                        >
                          {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                        </button>
                      </div>

                      {!canApprove && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          Admin or Manager access is required to approve or reject return requests.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-600">
                Select a return request to review its details.
              </div>
            )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricTile = ({ title, value, change, tone, icon }: { title: string; value: string; change: string; tone: 'cyan' | 'green' | 'rose' | 'violet'; icon: ReactNode }) => {
  const palette: Record<string, string> = {
    cyan: 'bg-white text-cyan-700',
    green: 'bg-white text-emerald-700',
    rose: 'bg-[#3a1e2d] text-rose-700',
    violet: 'bg-violet-50 text-violet-700',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${palette[tone]}`}>{icon}</div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">Live</span>
        <span className="text-xs text-blue-600">{change}</span>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <span className="text-xs font-medium uppercase tracking-[0.14em] text-blue-600">{label}</span>
    <span className="max-w-[180px] text-right text-sm font-medium text-slate-800 break-words">{value}</span>
  </div>
);

const WorkflowRow = ({ title, time, done }: { title: string; time: string; done: boolean }) => (
  <div className="flex items-start gap-3">
    <div className={`relative mt-1 flex h-5 w-5 items-center justify-center rounded-full ${done ? 'bg-blue-500 text-white' : 'bg-sky-900 text-blue-600'}`}>
      <span className="h-2.5 w-2.5 rounded-full bg-current" />
    </div>
    <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-slate-800">{title}</div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-blue-600">{done ? 'Done' : 'Pending'}</span>
      </div>
      <div className="mt-1 text-xs text-blue-600">{time}</div>
    </div>
  </div>
);

export default ReturnsApprovalsPage;
