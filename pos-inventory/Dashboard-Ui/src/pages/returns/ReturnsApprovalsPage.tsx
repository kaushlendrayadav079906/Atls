import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertCircle,
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
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
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
  const [tab, setTab] = useState<'all' | 'pending' | 'completed' | 'rejected' | 'failed'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: approvals = [], isLoading, isError, error, refetch } = useQuery<ApprovalRequestRow[]>({
    queryKey: ['returns-approvals'],
    queryFn: () => returnsApi.getApprovalQueue(),
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const normalized = approvals.map((request) => ({
      ...request,
      __status: normalizeStatus(request.status),
    }));

    const filtered = normalized.filter((request) => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      const haystack = [
        getRequestNumber(request),
        getCustomerName(request),
        safeText(request.original_doc_num),
        safeText(request.reason),
        safeText(request.branch_id),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });

    if (tab === 'all') return filtered;
    if (tab === 'pending') return filtered.filter((item) => item.__status === 'pending' || item.__status === 'processing');
    if (tab === 'completed') return filtered.filter((item) => item.__status === 'completed' || item.__status === 'approved');
    if (tab === 'rejected') return filtered.filter((item) => item.__status === 'rejected');
    return filtered.filter((item) => item.__status === 'failed' || item.__status === 'outcome-unknown');
  }, [approvals, searchTerm, tab]);

  const selectedRequest = rows.find((request) => request.id === selectedId) || rows[0] || null;

  const totalCounts = useMemo(() => ({
    all: approvals.length,
    pending: approvals.filter((item) => normalizeStatus(item.status) === 'pending' || normalizeStatus(item.status) === 'processing').length,
    completed: approvals.filter((item) => normalizeStatus(item.status) === 'completed' || normalizeStatus(item.status) === 'approved').length,
    rejected: approvals.filter((item) => normalizeStatus(item.status) === 'rejected').length,
    failed: approvals.filter((item) => normalizeStatus(item.status) === 'failed' || normalizeStatus(item.status) === 'outcome-unknown').length,
  }), [approvals]);

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

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const tabs = [
    { key: 'all', label: 'All Requests', count: totalCounts.all },
    { key: 'pending', label: 'Pending', count: totalCounts.pending },
    { key: 'completed', label: 'Approved', count: totalCounts.completed },
    { key: 'rejected', label: 'Rejected', count: totalCounts.rejected },
    { key: 'failed', label: 'My Approvals', count: totalCounts.failed },
  ] as const;

  const handleApprove = async (requestId: string) => {
    if (!isAdmin) {
      setActionError('Approval actions require admin access.');
      return;
    }
    await approveMutation.mutateAsync(requestId);
  };

  const handleReject = async (requestId: string) => {
    if (!isAdmin) {
      setActionError('Approval actions require admin access.');
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.85fr)_minmax(360px,0.8fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2">
                  <Search className="h-4 w-4 text-blue-600" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search request, customer, invoice..."
                    className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-500 outline-none"
                  />
                </div>
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  <ListFilter className="h-4 w-4" />
                  Filter
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {tabs.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      tab === item.key
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
                        : 'bg-transparent text-slate-600 hover:bg-[#123d65]'
                    }`}
                  >
                    {item.label} {item.count > 0 ? `(${item.count})` : ''}
                  </button>
                ))}
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
                              }}
                              className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-700 hover:bg-[#123d65]"
                              aria-label="Review request"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span>Showing {rows.length} requests</span>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-md border border-slate-200 bg-slate-100 p-2 text-slate-700 hover:bg-[#123d65] disabled:opacity-50" disabled>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-md border border-slate-200 bg-slate-100 p-2 text-slate-700 hover:bg-[#123d65] disabled:opacity-50" disabled>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {selectedRequest ? (
              <>
                <div className="flex items-center justify-between gap-4">
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

                <div className="mt-5 space-y-4">
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

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Approval Workflow</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <WorkflowRow title="Request Submitted" time={selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} done />
                      <WorkflowRow title="Pending Review" time={isAdmin ? 'Admin approval queue' : 'Access restricted'} done={normalizeStatus(selectedRequest.status) !== 'rejected' && normalizeStatus(selectedRequest.status) !== 'completed'} />
                      <WorkflowRow title="Approved / Rejected" time={selectedRequest.updated_at ? new Date(selectedRequest.updated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Awaiting decision'} done={['completed', 'rejected', 'failed'].includes(normalizeStatus(selectedRequest.status))} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Reviewer Notes</h3>
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      {selectedRequest.payload?.reviewerComment || 'No reviewer comment was returned by the backend yet.'}
                    </div>
                  </div>
                </div>

                {actionError && (
                  <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <span>{actionError}</span>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    disabled={!isAdmin || approveMutation.isPending || normalizeStatus(selectedRequest.status) !== 'pending'}
                    onClick={() => handleApprove(selectedRequest.id)}
                    className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    disabled={!isAdmin || rejectMutation.isPending || normalizeStatus(selectedRequest.status) !== 'pending'}
                    onClick={() => handleReject(selectedRequest.id)}
                    className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-rose-900/20 hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>

                {!isAdmin && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Admin access is required to approve or reject return requests.
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-600">
                Select a return request to review its details.
              </div>
            )}
          </aside>
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
