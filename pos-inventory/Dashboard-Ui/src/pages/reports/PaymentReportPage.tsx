import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
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
  Power,
  X,
  Printer,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Layers,
  Activity,
  BarChart3,
} from 'lucide-react';
import {
  paymentsReportApi,
  type PaymentFilterParams,
} from '../../api/endpoints';
import { commonApi } from '../../api/common';
import { useAuth } from '../../contexts/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  getDateScopeLabel,
  type QuickFilter,
  type DashboardPeriod,
  type AuthoritativeDateFilterState,
} from '../../utils/date';
import { ReportDateRangePicker } from '../../components/ReportDateRangePicker';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency & Date Formatters ────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const fmtDec = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);


const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTrendLabel(val: string): string {
  if (!val) return '';
  if (val.length === 10) {
    const parts = val.split('-');
    const mIdx = parseInt(parts[1], 10) - 1;
    const mStr = MONTH_NAMES[mIdx] || parts[1];
    return `${parts[2]} ${mStr} '${parts[0].slice(2)}`;
  }
  if (val.length === 7) {
    const parts = val.split('-');
    const mIdx = parseInt(parts[1], 10) - 1;
    const mStr = MONTH_NAMES[mIdx] || parts[1];
    return `${mStr} '${parts[0].slice(2)}`;
  }
  return val;
}

function formatTrendTooltipLabel(label: any): string {
  if (typeof label === 'string') {
    if (label.length === 10) {
      const parts = label.split('-');
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parts[2]} ${MONTH_NAMES[mIdx] || parts[1]} ${parts[0]}`;
    }
    if (label.length === 7) {
      const parts = label.split('-');
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${MONTH_NAMES[mIdx] || parts[1]} ${parts[0]}`;
    }
  }
  return `Period: ${label}`;
}

const TrendCustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  const isMulti = payload.length > 1;
  return (
    <div className="bg-slate-900/95 text-white backdrop-blur-md rounded-xl p-3.5 shadow-xl border border-slate-700/60 min-w-[210px] text-xs">
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-700/70 font-semibold text-slate-200">
        <Calendar className="w-3.5 h-3.5 text-blue-400" />
        <span>{formatTrendTooltipLabel(label)}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Total Collection:
          </span>
          <span className="font-bold text-white text-[13px]">{fmtDec(data?.amount || 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Payments Count:
          </span>
          <span className="font-semibold text-emerald-300">{data?.count || 0} txn</span>
        </div>
        {isMulti && (
          <div className="pt-2 mt-2 border-t border-slate-800 text-[11px] space-y-1">
            {payload.map((entry: any, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}:
                </span>
                <span className="font-medium text-white">{fmt(entry.value)}</span>
              </div>
            ))}
          </div>
        )}
        {!isMulti && (data?.cashAmount > 0 || data?.transferAmount > 0 || data?.cardAmount > 0) && (
          <div className="pt-2 mt-2 border-t border-slate-800 text-[11px] space-y-1 text-slate-300">
            {data?.cashAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-emerald-400">Cash:</span>
                <span className="font-medium">{fmt(data.cashAmount)}</span>
              </div>
            )}
            {data?.transferAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-blue-400">Bank Transfer:</span>
                <span className="font-medium">{fmt(data.transferAmount)}</span>
              </div>
            )}
            {data?.cardAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-purple-400">Card:</span>
                <span className="font-medium">{fmt(data.cardAmount)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


// ── State Message Component ───────────────────────────────────────────────────

const StateMessage = ({
  type,
  message,
  onRetry,
}: {
  type: 'error' | 'empty' | 'loading';
  message: string;
  onRetry?: () => void;
}) => (
  <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 px-4 text-center">
    {type === 'error' ? (
      <AlertCircle className="h-8 w-8 text-rose-500" />
    ) : type === 'loading' ? (
      <Loader2 className="h-8 w-8 text-[#0052cc] animate-spin" />
    ) : (
      <FileText className="h-8 w-8 text-slate-300" />
    )}
    <div className={type === 'error' ? 'text-rose-600 text-sm font-medium' : 'text-slate-500 text-sm'}>
      {message}
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-2 text-xs font-semibold text-[#0052cc] hover:text-blue-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
      >
        <RefreshCcw size={12} /> Retry
      </button>
    )}
  </div>
);

// ── Method Colors & Visuals ───────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  cash: '#3b82f6',     // Blue
  transfer: '#10b981', // Emerald
  card: '#a855f7',     // Purple
  check: '#f59e0b',    // Amber
  upi: '#06b6d4',      // Cyan
  other: '#64748b',    // Slate
};

const getMethodColor = (method: string) => {
  const m = (method || '').toLowerCase();
  if (m.includes('transfer') || m.includes('bank')) return METHOD_COLORS.transfer;
  if (m.includes('card') || m.includes('credit') || m.includes('debit')) return METHOD_COLORS.card;
  if (m.includes('check') || m.includes('cheque')) return METHOD_COLORS.check;
  if (m.includes('upi') || m.includes('digital') || m.includes('paytm')) return METHOD_COLORS.upi;
  if (m.includes('cash')) return METHOD_COLORS.cash;
  return METHOD_COLORS.other;
};

// ── Mini Sparkline for KPIs ───────────────────────────────────────────────────

const MiniBarChart = ({ color }: { color: string }) => (
  <div className="flex items-end gap-1 h-6 opacity-35">
    <div className="w-1.5 h-[35%] rounded-sm" style={{ backgroundColor: color }} />
    <div className="w-1.5 h-[65%] rounded-sm" style={{ backgroundColor: color }} />
    <div className="w-1.5 h-[45%] rounded-sm" style={{ backgroundColor: color }} />
    <div className="w-1.5 h-[100%] rounded-sm" style={{ backgroundColor: color }} />
    <div className="w-1.5 h-[80%] rounded-sm" style={{ backgroundColor: color }} />
  </div>
);

// ── Payment Detail Modal ──────────────────────────────────────────────────────

interface PaymentDetailModalProps {
  docEntry: number;
  onClose: () => void;
}

const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({ docEntry, onClose }) => {
  const { data: detail, isLoading, isError, refetch } = useQuery({
    queryKey: ['payment-detail', docEntry],
    queryFn: () => paymentsReportApi.getPaymentDetail(docEntry),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-[#0052cc] rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                SAP Incoming Payment #{detail?.docNum || docEntry}
              </h3>
              <p className="text-xs text-slate-500">Internal SAP DocEntry: {docEntry}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-[#0052cc] animate-spin" />
              <p className="text-sm text-slate-500">Loading SAP payment details...</p>
            </div>
          ) : isError || !detail ? (
            <StateMessage type="error" message="Failed to load payment details from SAP." onRetry={refetch} />
          ) : (
            <>
              {/* Top Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Received</div>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">{fmt(detail.totalAmount)}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{detail.docCurrency}</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Posting Date</div>
                  <div className="text-base font-bold text-slate-800 mt-1">
                    {detail.docDate ? new Date(detail.docDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">SAP System Date</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</div>
                  <div className="mt-1">
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border',
                        detail.cancelled
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      )}
                    >
                      {detail.cancelled ? 'Cancelled' : 'Cleared / Completed'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Branch: {detail.branchName || detail.branchId || 'Default'}
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Customer (Business Partner)</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-bold text-slate-800">{detail.cardName || 'Walk-in Customer'}</div>
                    <div className="text-xs font-mono text-slate-500">SAP CardCode: {detail.cardCode}</div>
                  </div>
                  {detail.journalRemarks && (
                    <div className="text-right text-xs text-slate-500 max-w-[240px] truncate" title={detail.journalRemarks}>
                      {detail.journalRemarks}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Means Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Means Breakdown</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100">
                    <div className="text-[11px] font-medium text-blue-600">Cash Amount</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{fmtDec(detail.cashSum)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                    <div className="text-[11px] font-medium text-emerald-600">Bank Transfer</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{fmtDec(detail.transferSum)}</div>
                    {detail.transferReference && (
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">Ref: {detail.transferReference}</div>
                    )}
                  </div>
                  <div className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-100">
                    <div className="text-[11px] font-medium text-purple-600">Credit / Debit Card</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{fmtDec(detail.cardSum)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-100">
                    <div className="text-[11px] font-medium text-amber-600">Cheques</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{fmtDec(detail.checkSum)}</div>
                  </div>
                </div>
              </div>

              {/* Linked Invoices */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Linked Sales Invoices ({detail.linkedInvoices?.length || 0})</span>
                  {detail.linkedInvoices?.length === 0 && (
                    <span className="text-[11px] font-medium text-slate-500 lowercase">(payment on account)</span>
                  )}
                </div>
                {detail.linkedInvoices && detail.linkedInvoices.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-3.5 py-2.5">Invoice #</th>
                          <th className="px-3.5 py-2.5">Date</th>
                          <th className="px-3.5 py-2.5 text-right">Invoice Total</th>
                          <th className="px-3.5 py-2.5 text-right">Sum Applied</th>
                          <th className="px-3.5 py-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {detail.linkedInvoices.map((inv, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3.5 py-2 font-bold text-[#0052cc]">
                              INV-{inv.docNum || inv.docEntry}
                            </td>
                            <td className="px-3.5 py-2 text-slate-500">
                              {inv.invoiceDate ? inv.invoiceDate.substring(0, 10) : '-'}
                            </td>
                            <td className="px-3.5 py-2 text-right font-medium">
                              {inv.invoiceTotal !== null && inv.invoiceTotal !== undefined ? fmtDec(inv.invoiceTotal) : '-'}
                            </td>
                            <td className="px-3.5 py-2 text-right font-bold text-emerald-700">
                              {fmtDec(inv.sumApplied)}
                            </td>
                            <td className="px-3.5 py-2 text-center">
                              <span
                                className={cn(
                                  'inline-block px-2 py-0.5 text-[10px] font-semibold rounded',
                                  inv.invoiceStatus === 'bost_Close'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                )}
                              >
                                {inv.invoiceStatus === 'bost_Close' ? 'Paid / Closed' : 'Open'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                    This transaction was posted as a Payment on Account without specific invoice line allocations.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Payment Report Page Component ────────────────────────────────────────

export const PaymentReportPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'administrator';

  // Navigation Tabs
  const tabs = ['Payment Overview', 'Method Analysis', 'Daily/Monthly Trend', 'Customer Payments'];
  const [activeTab, setActiveTab] = useState('Payment Overview');

  // Search input
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Active (applied) filters
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [dateRange, setDateRange] = useState<DashboardPeriod>('all_time');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>(undefined);
  const [paymentStatus, setPaymentStatus] = useState<string | undefined>(undefined);
  const [customer, setCustomer] = useState<string | undefined>(undefined);

  // Pending filters (staged in UI until Apply is clicked)
  const [pendingFilters, setPendingFilters] = useState({
    branchId: undefined as string | undefined,
    paymentMethod: undefined as string | undefined,
    paymentStatus: undefined as string | undefined,
    customer: undefined as string | undefined,
  });

  const handleDateRangeChange = (filterState: AuthoritativeDateFilterState) => {
    setQuickFilter(filterState.quickFilter);
    setDateRange(filterState.period);
    setDateFrom(filterState.dateFrom);
    setDateTo(filterState.dateTo);
    setPage(1);
    setSelectedDocEntries(new Set());
  };

  // Table pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const offset = (page - 1) * pageSize;

  // Selected row checkboxes
  const [selectedDocEntries, setSelectedDocEntries] = useState<Set<number>>(new Set());

  // Modal state
  const [detailDocEntry, setDetailDocEntry] = useState<number | null>(null);

  // Trend granularity state
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  // Historical trend graph UI view mode ('area' | 'bar' | 'dual')
  const [trendChartType, setTrendChartType] = useState<'area' | 'bar' | 'dual'>('area');

  // Export dropdown state
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch verified SAP filter options (customers, branches, warehouses)
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: commonApi.getFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

  // Query parameter payload
  const queryParams: PaymentFilterParams = useMemo(() => {
    const p: PaymentFilterParams = {
      range: dateRange,
      branch: branchId || undefined,
      payment_method: paymentMethod || undefined,
      payment_status: paymentStatus || undefined,
      customer: customer || undefined,
    };
    if (dateRange !== 'all_time') {
      if (dateFrom) p.from_date = dateFrom;
      if (dateTo) p.to_date = dateTo;
    }
    return p;
  }, [dateRange, dateFrom, dateTo, branchId, paymentMethod, paymentStatus, customer]);

  // 1. Overview KPIs Query
  const {
    data: overview,
    isLoading: loadingOverview,
    isError: errorOverview,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['payments-overview', queryParams],
    queryFn: () => paymentsReportApi.getOverview(queryParams),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  // 2. Distribution Query (only needed for Payment Overview tab)
  const {
    data: distribution,
    isLoading: loadingDist,
    isError: errorDist,
    refetch: refetchDist,
  } = useQuery({
    queryKey: ['payments-distribution', queryParams],
    queryFn: () => paymentsReportApi.getDistribution(queryParams),
    enabled: activeTab === 'Payment Overview',
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  // 3. Trend Query (needed for Payment Overview and Daily/Monthly Trend tabs)
  const {
    data: trend,
    isLoading: loadingTrend,
    isError: errorTrend,
    refetch: refetchTrend,
  } = useQuery({
    queryKey: ['payments-trend', queryParams, trendGranularity],
    queryFn: () => paymentsReportApi.getTrend({ ...queryParams, granularity: trendGranularity }),
    enabled: activeTab === 'Payment Overview' || activeTab === 'Daily/Monthly Trend',
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  // Trend statistics computation for high-level executive cards
  const trendStats = useMemo(() => {
    if (!trend || trend.length === 0) {
      return { totalAmount: 0, totalCount: 0, peakAmount: 0, peakDate: '', avgAmount: 0 };
    }
    const totalAmount = trend.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalCount = trend.reduce((sum, item) => sum + (item.count || 0), 0);
    let peak = trend[0];
    for (const item of trend) {
      if ((item.amount || 0) > (peak.amount || 0)) {
        peak = item;
      }
    }
    const avgAmount = trend.length > 0 ? totalAmount / trend.length : 0;
    return {
      totalAmount,
      totalCount,
      peakAmount: peak?.amount || 0,
      peakDate: peak?.label || '',
      avgAmount,
    };
  }, [trend]);

  // 4. Transactions Table Query (only needed for Payment Overview tab)
  const {
    data: transactionsData,
    isLoading: loadingTrans,
    isError: errorTrans,
    refetch: refetchTrans,
  } = useQuery({
    queryKey: [
      'payments-transactions',
      queryParams,
      debouncedSearch,
      offset,
      pageSize,
    ],
    queryFn: () =>
      paymentsReportApi.getTransactions({
        ...queryParams,
        search: debouncedSearch || undefined,
        offset,
        limit: pageSize,
      }),
    enabled: activeTab === 'Payment Overview',
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  // 5. Customer Payments Query (for tab 4)
  const {
    data: customerPayments,
    isLoading: loadingCustomers,
    isError: errorCustomers,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ['payments-customers', queryParams],
    queryFn: () => paymentsReportApi.getCustomerPayments(queryParams),
    enabled: activeTab === 'Customer Payments',
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  // 6. Method Analysis Query (for tab 2)
  const {
    data: methodAnalysis,
    isLoading: loadingMethods,
    isError: errorMethods,
    refetch: refetchMethods,
  } = useQuery({
    queryKey: ['payments-methods', queryParams],
    queryFn: () => paymentsReportApi.getMethodAnalysis(queryParams),
    enabled: activeTab === 'Method Analysis',
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  // Handle Apply Filters
  // Handle Apply Filters
  const applyFilters = () => {
    setBranchId(pendingFilters.branchId);
    setPaymentMethod(pendingFilters.paymentMethod);
    setPaymentStatus(pendingFilters.paymentStatus);
    setCustomer(pendingFilters.customer);
    setPage(1);
    setSelectedDocEntries(new Set());
  };

  // Handle Reset Filters
  const resetFilters = () => {
    const defaults = {
      branchId: undefined,
      paymentMethod: undefined,
      paymentStatus: undefined,
      customer: undefined,
    };
    setPendingFilters(defaults);
    setBranchId(defaults.branchId);
    setPaymentMethod(defaults.paymentMethod);
    setPaymentStatus(defaults.paymentStatus);
    setCustomer(defaults.customer);
    
    // Reset date range to All Dates (Total)
    setQuickFilter('');
    setDateRange('all_time');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
    setPage(1);
    setSelectedDocEntries(new Set());
  };

  // Handle Export Actions
  const handleExport = async (format: 'csv' | 'json' | 'print') => {
    setExportOpen(false);
    if (format === 'print') {
      window.print();
      return;
    }
    try {
      if (format === 'csv') {
        const blob = await paymentsReportApi.exportTransactions({
          ...queryParams,
          search: debouncedSearch || undefined,
          format: 'csv',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `atlas_payment_report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else if (format === 'json') {
        const res = await paymentsReportApi.getTransactions({
          ...queryParams,
          search: debouncedSearch || undefined,
          limit: 1000,
          offset: 0,
        });
        const blob = new Blob([JSON.stringify(res.items, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `atlas_payments_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. Please check your network and retry.');
    }
  };

  // Select all toggle
  const toggleSelectAll = () => {
    if (!transactionsData?.items) return;
    if (selectedDocEntries.size === transactionsData.items.length) {
      setSelectedDocEntries(new Set());
    } else {
      setSelectedDocEntries(new Set(transactionsData.items.map((t) => t.docEntry)));
    }
  };

  const toggleSelectRow = (docEntry: number) => {
    setSelectedDocEntries((prev) => {
      const next = new Set(prev);
      if (next.has(docEntry)) next.delete(docEntry);
      else next.add(docEntry);
      return next;
    });
  };

  // KPI card configs
  const kpis = [
    {
      title: 'Total Payments',
      val: overview ? fmt(overview.totalPayments) : '₹0',
      subtext: overview ? `${overview.paymentCount} payments` : '',
      icon: Wallet,
      color: '#3b82f6',
      bg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Paid Invoices',
      val: overview ? `${overview.paidInvoices}` : '0',
      subtext: 'Distinct settled invoices',
      icon: FileText,
      color: '#10b981',
      bg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Pending Payments',
      val: overview ? fmt(overview.pendingPayments) : '₹0',
      subtext: overview?.pendingPaymentsCount ? `${overview.pendingPaymentsCount} open invoices` : 'Open balance',
      icon: Power,
      color: '#ef4444',
      bg: 'bg-rose-50 text-rose-600',
    },
    {
      title: 'Refunds Issued',
      val: overview ? fmt(overview.refundsAmount || 0) : '₹0',
      subtext: overview?.refundsCount ? `${overview.refundsCount} credit memos` : 'A/R credit memos',
      isNegative: true,
      icon: Undo2,
      color: '#10b981',
      bg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Avg. Payment Value',
      val: overview ? fmt(overview.averagePaymentValue) : '₹0',
      subtext: 'Per payment record',
      icon: TrendingUp,
      color: '#a855f7',
      bg: 'bg-purple-50 text-purple-600',
    },
  ];

  // Pie chart formatting
  const pieData = useMemo(() => {
    if (!distribution) return [];
    const formatted = distribution.map((d) => ({
      name: d.method.charAt(0).toUpperCase() + d.method.slice(1),
      value: d.total,
      count: d.count,
      percentage: d.percentage,
      color: getMethodColor(d.method),
    }));
    return formatted.sort((a, b) => b.value - a.value);
  }, [distribution]);

  const totalDistributionAmount = useMemo(
    () => pieData.reduce((acc, curr) => acc + curr.value, 0),
    [pieData]
  );

  return (
    <div className="w-full min-w-0 space-y-6 font-sans">
      {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-xs">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900">
                Payment Report
              </h1>
              <p className="mt-1 atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">
                View and analyze live SAP Business One payment collections, payment methods, and settlements.
              </p>
            </div>
          </div>

          {/* Top Position Right Side Controls */}
          <div className="flex items-center gap-2.5">
            {/* Date Range Dropdown Filter */}
            <ReportDateRangePicker
              quickFilter={quickFilter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onRangeChange={handleDateRangeChange}
            />

            {/* Export Dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setExportOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl bg-[#0052cc] px-4.5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
              </button>

              {exportOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-[#0052cc]" />
                    Export as JSON
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => handleExport('print')}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    Print Report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-0">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-5 py-3 text-[14px] font-semibold rounded-t-xl transition-all border cursor-pointer',
                activeTab === tab
                  ? 'bg-[#0052cc] text-white border-[#0052cc] shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 border-b-0 hover:bg-slate-50'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Main Card Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 rounded-tl-none -mt-6 relative z-10 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {kpis.map((card, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', card.bg)}>
                    <card.icon className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[12.5px] font-semibold text-slate-500 mb-0.5">{card.title}</p>
                    <div className="text-[22px] sm:text-[24px] font-extrabold text-slate-900 tracking-tight">
                      {loadingOverview ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                      ) : errorOverview ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-rose-500">Unavailable</span>
                          <button
                            onClick={() => refetchOverview()}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                            title="Retry loading KPIs"
                          >
                            <RefreshCcw size={11} />
                          </button>
                        </div>
                      ) : (
                        card.val
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between pt-1">
                  <div className="flex flex-col">
                    <span className="text-[11.5px] text-slate-400 font-medium">{card.subtext}</span>
                  </div>
                  <MiniBarChart color={card.color} />
                </div>
              </div>
            ))}
          </div>

          {/* Unified Filters Row */}
          <div className="bg-slate-50/75 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">

              {/* Branch Selector */}
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-slate-600">Branch</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <select
                    value={pendingFilters.branchId || ''}
                    onChange={(e) => setPendingFilters((p) => ({ ...p, branchId: e.target.value || undefined }))}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-[12.5px] text-slate-700 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] focus:outline-none"
                  >
                    {isAdmin ? (
                      <>
                        <option value="">All Branches</option>
                        {filterOptions?.branches?.map((b) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.name} (BPL {b.id})
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value={user?.branch_id || ''}>
                        {user?.store_name || 'My Branch'} ({user?.branch_id || 'SH'})
                      </option>
                    )}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-slate-600">Payment Method</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <select
                    value={pendingFilters.paymentMethod || ''}
                    onChange={(e) => setPendingFilters((p) => ({ ...p, paymentMethod: e.target.value || undefined }))}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-[12.5px] text-slate-700 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] focus:outline-none"
                  >
                    <option value="">All Methods</option>
                    <option value="transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="check">Bank Cheque</option>
                    <option value="upi">UPI / Digital</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Payment Status Selector */}
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-slate-600">Payment Status</label>
                <div className="relative">
                  <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <select
                    value={pendingFilters.paymentStatus || ''}
                    onChange={(e) => setPendingFilters((p) => ({ ...p, paymentStatus: e.target.value || undefined }))}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-[12.5px] text-slate-700 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="success">Success / Cleared</option>
                    <option value="partial">Partial Settlement</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Customer Selector */}
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-slate-600">Customer</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <select
                    value={pendingFilters.customer || ''}
                    onChange={(e) => setPendingFilters((p) => ({ ...p, customer: e.target.value || undefined }))}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-[12.5px] text-slate-700 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] focus:outline-none"
                  >
                    <option value="">All Customers</option>
                    {filterOptions?.customers?.slice(0, 50).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name || c.code}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={applyFilters}
                  className="flex-[2] rounded-lg bg-[#0052cc] px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Apply Filters
                </button>
                <button
                  onClick={resetFilters}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

          </div>

          {/* ────────────────────────────────────────────────────────────────────────
              TAB 1: Payment Overview
             ──────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'Payment Overview' && (
            <div className="space-y-6">
              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Method Distribution Chart */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15.5px] font-bold text-slate-800 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-[#0052cc]" />
                      Payment Method Distribution
                    </h3>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {dateRange === 'all_time' ? 'All Time' : getDateScopeLabel(quickFilter, dateFrom, dateTo)}
                    </span>
                  </div>

                  <div className="h-[260px] w-full flex items-center justify-center">
                    {loadingDist ? (
                      <StateMessage type="loading" message="Loading method distribution..." />
                    ) : errorDist ? (
                      <StateMessage type="error" message="Failed to load distribution data." onRetry={refetchDist} />
                    ) : pieData.length === 0 ? (
                      <StateMessage type="empty" message="No payment data available for the selected filters." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: any, name: any) => [
                              `${fmt(Number(value))} (${(
                                totalDistributionAmount > 0
                                  ? (Number(value) / totalDistributionAmount) * 100
                                  : 0
                              ).toFixed(1)}%)`,
                              name,
                            ]}
                            contentStyle={{
                              borderRadius: '8px',
                              fontSize: '12px',
                              border: 'none',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Distribution Legend */}
                  {pieData.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-xs text-slate-600 truncate">
                            {d.name}: <span className="font-semibold text-slate-800">{fmt(d.value)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Trend Chart */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15.5px] font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#0052cc]" />
                      Payment Trend
                    </h3>
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                      <button
                        onClick={() => setTrendGranularity('daily')}
                        className={cn(
                          'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer',
                          trendGranularity === 'daily' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                        )}
                      >
                        Daily
                      </button>
                      <button
                        onClick={() => setTrendGranularity('monthly')}
                        className={cn(
                          'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer',
                          trendGranularity === 'monthly' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                        )}
                      >
                        Monthly
                      </button>
                    </div>
                  </div>

                  <div className="h-[260px] w-full">
                    {loadingTrend ? (
                      <StateMessage type="loading" message="Loading trend data..." />
                    ) : errorTrend ? (
                      <StateMessage type="error" message="Failed to load payment trend." onRetry={refetchTrend} />
                    ) : !trend || trend.length === 0 ? (
                      <StateMessage type="empty" message="No payment trend records found for current filters." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <defs>
                            <linearGradient id="overviewTrendGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0284c7" stopOpacity={0.35} />
                              <stop offset="60%" stopColor="#0ea5e9" stopOpacity={0.08} />
                              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            dy={8}
                            tickFormatter={formatTrendLabel}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickFormatter={(val) => (val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`)}
                          />
                          <RechartsTooltip content={<TrendCustomTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="amount"
                            name="Payment Amount"
                            stroke="#0284c7"
                            strokeWidth={2.5}
                            fill="url(#overviewTrendGradient)"
                            dot={{ r: 3.5, stroke: '#0284c7', strokeWidth: 2, fill: '#ffffff' }}
                            activeDot={{ r: 5.5, stroke: '#0369a1', strokeWidth: 2, fill: '#ffffff' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#0052cc]" />
                    <h3 className="text-[15.5px] font-bold text-slate-800">Payment Transactions</h3>
                    {transactionsData && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-[#0052cc] font-semibold">
                        {transactionsData.total}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        type="text"
                        placeholder="Search invoice no, customer, doc no..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setPage(1);
                        }}
                        className="w-full sm:w-[320px] bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc]"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="px-3 py-3 text-center w-10">
                          <button onClick={toggleSelectAll} className="cursor-pointer">
                            {transactionsData &&
                            transactionsData.items.length > 0 &&
                            selectedDocEntries.size === transactionsData.items.length ? (
                              <CheckSquare className="w-4 h-4 text-[#0052cc]" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-2 py-3 w-8">#</th>
                        <th className="px-3.5 py-3">Invoice No</th>
                        <th className="px-3.5 py-3">Date & Time</th>
                        <th className="px-3.5 py-3">Customer</th>
                        <th className="px-3.5 py-3 text-right">Invoice Total</th>
                        <th className="px-3.5 py-3 text-right">Paid Amount</th>
                        <th className="px-3.5 py-3">Method</th>
                        <th className="px-3.5 py-3">Transaction ID</th>
                        <th className="px-3.5 py-3 text-center">Status</th>
                        <th className="px-3.5 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {loadingTrans ? (
                        <tr>
                          <td colSpan={11} className="py-16 text-center">
                            <Loader2 className="w-8 h-8 text-[#0052cc] animate-spin mx-auto" />
                            <p className="mt-2 text-xs text-slate-500">Loading SAP payment transactions...</p>
                          </td>
                        </tr>
                      ) : errorTrans ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center">
                            <StateMessage type="error" message="Failed to retrieve transactions from SAP." onRetry={refetchTrans} />
                          </td>
                        </tr>
                      ) : !transactionsData || transactionsData.items.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-slate-500">
                            No payment data available for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        transactionsData.items.map((txn, idx) => {
                          const rowIndex = offset + idx + 1;
                          const isSelected = selectedDocEntries.has(txn.docEntry);
                          return (
                            <tr
                              key={txn.docEntry || idx}
                              className={cn(
                                'hover:bg-slate-50/75 transition-colors',
                                isSelected && 'bg-blue-50/40'
                              )}
                            >
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => toggleSelectRow(txn.docEntry)}
                                  className="cursor-pointer"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-[#0052cc]" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-300" />
                                  )}
                                </button>
                              </td>
                              <td className="px-2 py-2.5 text-slate-400 font-mono">{rowIndex}</td>
                              <td className="px-3.5 py-2.5 font-bold text-[#0052cc]">
                                {txn.invoiceDocNum && txn.invoiceDocNum !== '-' ? (
                                  txn.invoiceDocNum === 'On Account' ? (
                                    <span className="text-slate-400 font-normal italic">On Account</span>
                                  ) : txn.linkedInvoices && txn.linkedInvoices.length > 1 ? (
                                    <div className="flex flex-col">
                                      <span>INV-{txn.invoiceDocNum}</span>
                                      <span className="text-[10.5px] text-blue-600 font-semibold">
                                        ({txn.linkedInvoices.length} invoices)
                                      </span>
                                    </div>
                                  ) : (
                                    <span>INV-{txn.invoiceDocNum}</span>
                                  )
                                ) : (
                                  <span className="text-slate-400 font-normal italic">-</span>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-600">
                                {txn.docDate ? txn.docDate.substring(0, 10) : '-'}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <div className="font-semibold text-slate-800">{txn.customerName || 'Unknown'}</div>
                                <div className="text-[10px] font-mono text-slate-400">{txn.customerCode}</div>
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-medium text-slate-600">
                                {txn.invoiceAmount !== null && txn.invoiceAmount !== undefined ? (
                                  <div className="flex flex-col items-end">
                                    <span>{fmtDec(txn.invoiceAmount)}</span>
                                    {txn.linkedInvoices && txn.linkedInvoices.length > 1 && (
                                      <span className="text-[9.5px] text-slate-400 font-normal">(combined total)</span>
                                    )}
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">
                                {fmtDec(txn.totalAmount)}
                              </td>
                              <td className="px-3.5 py-2.5">
                                <span
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize"
                                  style={{
                                    backgroundColor: `${getMethodColor(txn.paymentMethod)}15`,
                                    color: getMethodColor(txn.paymentMethod),
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: getMethodColor(txn.paymentMethod) }}
                                  />
                                  {txn.paymentMethod}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500">
                                {txn.transactionId || `SAP-${txn.docEntry}`}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                <span
                                  className={cn(
                                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border',
                                    txn.status === 'Cancelled'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : txn.status === 'Partial'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  )}
                                >
                                  {txn.status || 'Success'}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                <button
                                  onClick={() => setDetailDocEntry(txn.docEntry)}
                                  title="View SAP Details"
                                  className="p-1.5 text-[#0052cc] hover:bg-blue-50 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Pagination */}
                {transactionsData && transactionsData.total > 0 && (
                  <div className="bg-slate-50/50 border-t border-slate-200 p-3.5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-3">
                    <div className="flex items-center gap-2">
                      <span>
                        Showing <span className="font-semibold text-slate-800">{offset + 1}</span> to{' '}
                        <span className="font-semibold text-slate-800">
                          {Math.min(offset + pageSize, transactionsData.total)}
                        </span>{' '}
                        of <span className="font-semibold text-slate-800">{transactionsData.total}</span> payments
                      </span>
                      <span className="text-slate-300">|</span>
                      <label className="text-slate-500">Page Size:</label>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        className="border border-slate-200 rounded px-1.5 py-0.5 bg-white text-xs font-semibold focus:outline-none"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="px-2 font-semibold">
                        Page {page} of {Math.ceil(transactionsData.total / pageSize)}
                      </span>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={offset + pageSize >= transactionsData.total}
                        className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────────────
              TAB 2: Method Analysis
             ──────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'Method Analysis' && (
            <div className="space-y-6">
              {loadingMethods ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#0052cc] animate-spin" />
                  <p className="mt-2 text-xs text-slate-500">Loading payment method metrics...</p>
                </div>
              ) : errorMethods ? (
                <StateMessage type="error" message="Failed to load method analysis." onRetry={refetchMethods} />
              ) : !methodAnalysis || methodAnalysis.length === 0 ? (
                <StateMessage type="empty" message="No method analysis data found for the selected period." />
              ) : (
                <>
                  {/* Method Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {methodAnalysis.map((m) => (
                      <div
                        key={m.method}
                        className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2 border-l-4"
                        style={{ borderLeftColor: getMethodColor(m.method) }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {m.displayName}
                          </span>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${getMethodColor(m.method)}20`,
                              color: getMethodColor(m.method),
                            }}
                          >
                            {m.percentage}% Share
                          </span>
                        </div>
                        <div className="text-2xl font-extrabold text-slate-900">{fmt(m.totalAmount)}</div>
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                          <span>{m.transactionCount} transactions</span>
                          <span>Avg: {fmt(m.averageValue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Comparative Method Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-800">Payment Instrument Performance</h4>
                      <span className="text-xs text-slate-500">Live SAP Service Layer Data</span>
                    </div>
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-50/75 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Method Name</th>
                          <th className="px-4 py-3 text-right">Transactions</th>
                          <th className="px-4 py-3 text-right">Total Collected</th>
                          <th className="px-4 py-3 text-right">Share (%)</th>
                          <th className="px-4 py-3 text-right">Average Value</th>
                          <th className="px-4 py-3 text-right">Min Txn</th>
                          <th className="px-4 py-3 text-right">Max Txn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {methodAnalysis.map((m) => (
                          <tr key={m.method} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-semibold flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: getMethodColor(m.method) }}
                              />
                              {m.displayName}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{m.transactionCount}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{fmtDec(m.totalAmount)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-[#0052cc]">{m.percentage}%</td>
                            <td className="px-4 py-3 text-right">{fmtDec(m.averageValue)}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{fmtDec(m.minAmount)}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{fmtDec(m.maxAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────────────
              TAB 3: Daily/Monthly Trend
             ──────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'Daily/Monthly Trend' && (
            <div className="space-y-6">
              {/* Modern Historical Payment Trend Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-4.5 h-4.5 text-[#0052cc]" />
                      Historical Payment Trend
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Live SAP collection analytics, chronological intervals, and instrument breakdown.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Graph UI View Mode Switcher */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setTrendChartType('area')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                          trendChartType === 'area'
                            ? 'bg-white text-blue-700 shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                        title="Smooth Gradient Area Curve"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span>Area Trend</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTrendChartType('bar')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                          trendChartType === 'bar'
                            ? 'bg-white text-blue-700 shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                        title="Stacked Method Breakdown"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Method Stack</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTrendChartType('dual')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                          trendChartType === 'dual'
                            ? 'bg-white text-blue-700 shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                        title="Volume & Payment Count Combo"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Volume & Count</span>
                      </button>
                    </div>

                    {/* Time Granularity Switcher */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                      {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setTrendGranularity(g)}
                          className={cn(
                            'px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer',
                            trendGranularity === g
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Period Executive Summary Stats Bar */}
                {trend && trend.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/70 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                        ₹
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-500">Period Total Volume</div>
                        <div className="text-[15px] font-extrabold text-slate-900 truncate">{fmt(trendStats.totalAmount)}</div>
                      </div>
                    </div>

                    <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/70 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-500">Total Payments</div>
                        <div className="text-[15px] font-extrabold text-slate-900 truncate">{trendStats.totalCount} records</div>
                      </div>
                    </div>

                    <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/70 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-500">Peak Collection</div>
                        <div className="text-[15px] font-extrabold text-slate-900 truncate">
                          {fmt(trendStats.peakAmount)}
                          {trendStats.peakDate && (
                            <span className="text-[10.5px] text-slate-400 font-normal ml-1">
                              ({formatTrendLabel(trendStats.peakDate)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100/70 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
                        ~
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-500">Avg. Per Interval</div>
                        <div className="text-[15px] font-extrabold text-slate-900 truncate">{fmt(trendStats.avgAmount)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Graph UI Canvas */}
                <div className="h-[360px] w-full">
                  {loadingTrend && (!trend || (trend as any[]).length === 0) ? (
                    <StateMessage type="loading" message="Loading historical trend..." />
                  ) : errorTrend ? (
                    <StateMessage type="error" message="Failed to load historical trend." onRetry={refetchTrend} />
                  ) : !trend || (trend as any[]).length === 0 ? (
                    <StateMessage type="empty" message="No payment trend data for selected timeframe." />
                  ) : trendChartType === 'area' ? (
                    /* Graph UI 1: Modern Smooth Area Chart with Soft Blue/Indigo Gradient */
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trend} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="historicalTrendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                            <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.08} />
                            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          dy={8}
                          tickFormatter={formatTrendLabel}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickFormatter={(val) => (val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`)}
                        />
                        <RechartsTooltip content={<TrendCustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="amount"
                          name="Collection Volume"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          fill="url(#historicalTrendGradient)"
                          dot={{ r: 4, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
                          activeDot={{ r: 6.5, stroke: '#1d4ed8', strokeWidth: 2.5, fill: '#ffffff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : trendChartType === 'bar' ? (
                    /* Graph UI 2: Modern Stacked Method Bar Chart */
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trend} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          dy={8}
                          tickFormatter={formatTrendLabel}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickFormatter={(val) => (val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`)}
                        />
                        <RechartsTooltip content={<TrendCustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                        <Bar dataKey="cashAmount" name="Cash" stackId="methods" fill="#10b981" barSize={32} />
                        <Bar dataKey="transferAmount" name="Bank Transfer" stackId="methods" fill="#2563eb" barSize={32} />
                        <Bar dataKey="cardAmount" name="Card" stackId="methods" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    /* Graph UI 3: Dual Metric Volume & Payment Count Chart */
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={trend} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          dy={8}
                          tickFormatter={formatTrendLabel}
                        />
                        <YAxis
                          yAxisId="left"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickFormatter={(val) => (val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`)}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <RechartsTooltip content={<TrendCustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                        <Bar
                          yAxisId="left"
                          dataKey="amount"
                          name="Collection Volume"
                          fill="#3b82f6"
                          fillOpacity={0.85}
                          radius={[5, 5, 0, 0]}
                          barSize={26}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="count"
                          name="Payment Count"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
                          activeDot={{ r: 6 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Aggregated Period Table */}
              {trend && trend.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800">Time-Bucketed Collections Breakdown</h4>
                    <span className="text-xs text-slate-500 font-mono capitalize">{trendGranularity} Granularity</span>
                  </div>
                  <div className="overflow-x-auto max-h-[360px]">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-50/80 sticky top-0 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Period Label</th>
                          <th className="px-4 py-2.5 text-right">Transactions</th>
                          <th className="px-4 py-2.5 text-right">Total Amount</th>
                          <th className="px-4 py-2.5 text-right">Cash Share</th>
                          <th className="px-4 py-2.5 text-right">Bank Transfer Share</th>
                          <th className="px-4 py-2.5 text-right">Avg / Txn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {trend.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-bold text-slate-800">{t.label}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{t.count}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">{fmtDec(t.amount)}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{fmtDec(t.cashAmount || 0)}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{fmtDec(t.transferAmount || 0)}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">
                              {t.count > 0 ? fmtDec(t.amount / t.count) : '₹0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────────────
              TAB 4: Customer Payments
             ──────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'Customer Payments' && (
            <div className="space-y-6">
              {loadingCustomers ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#0052cc] animate-spin" />
                  <p className="mt-2 text-xs text-slate-500">Loading customer payment histories...</p>
                </div>
              ) : errorCustomers ? (
                <StateMessage type="error" message="Failed to load customer payment analytics." onRetry={refetchCustomers} />
              ) : !customerPayments || customerPayments.length === 0 ? (
                <StateMessage type="empty" message="No customer payments found for the selected filter." />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Customer Receipts & Settlements</h4>
                      <p className="text-xs text-slate-500">
                        Aggregated payment totals, preferred payment method, and settlement history.
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#0052cc]">
                      {customerPayments.length} Customers
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Customer Name</th>
                          <th className="px-4 py-3">CardCode</th>
                          <th className="px-4 py-3 text-right">Total Paid (INR)</th>
                          <th className="px-4 py-3 text-right">Transactions</th>
                          <th className="px-4 py-3">Preferred Method</th>
                          <th className="px-4 py-3">Last Payment</th>
                          <th className="px-4 py-3 text-right">Invoices Settled</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {customerPayments.map((c, idx) => (
                          <tr key={c.customerCode} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{c.customerName}</td>
                            <td className="px-4 py-3 font-mono text-slate-500">{c.customerCode}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-emerald-700">{fmtDec(c.totalAmount)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">{c.paymentCount}</td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold capitalize"
                                style={{
                                  backgroundColor: `${getMethodColor(c.preferredMethod)}15`,
                                  color: getMethodColor(c.preferredMethod),
                                }}
                              >
                                {c.preferredMethod}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{c.lastPaymentDate || '-'}</td>
                            <td className="px-4 py-3 text-right font-medium text-[#0052cc]">
                              {c.linkedInvoicesCount} invoices
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      {/* Payment Detail Modal */}
      {detailDocEntry !== null && (
        <PaymentDetailModal docEntry={detailDocEntry} onClose={() => setDetailDocEntry(null)} />
      )}
    </div>
  );
};
