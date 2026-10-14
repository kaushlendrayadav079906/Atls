import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Minimize2,
  X,
  RefreshCw,
  Search,
  Download,
  ShieldCheck,
  Lock,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  Truck,
  Building,
  BarChart2,
  Table as TableIcon,
  LayoutGrid,
  ChevronRight,
  ChevronLeft,
  History,
  Settings,
  AlertCircle,
  ExternalLink,
  Check,
  Eye,
  LineChart as LineChartIcon,
  Sun,
  Moon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  financeApi,
  type FinanceOverviewResponse,
  type FinanceRecordDetails,
  type RecordSubmissionResponse,
  type AuditLogEntry,
  type FinanceAdminSettings,
} from '../../api/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemHealth } from '../../hooks/useSystemHealth';
import { AIChatRenderer } from '../AIChatRenderer';
import { FormattedMessage } from '../FormattedMessage';

export interface FinanceAIWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  chatMessages: Array<{
    role: 'assistant' | 'user';
    content: string;
    structured_data?: any;
    isCardDemo?: boolean;
  }>;
  onSendMessage: (msg: string) => Promise<void>;
  chatLoading: boolean;
  range: string;
  setRange: (r: any) => void;
  branch: string;
  setBranch?: (b: string) => void;
  overviewData: FinanceOverviewResponse | null;
  overviewLoading: boolean;
  onRefreshOverview: () => Promise<void>;
}

type ExplorerCategory =
  | 'overview'
  | 'purchase_invoices'
  | 'incoming_payments'
  | 'outgoing_payments'
  | 'customers'
  | 'suppliers'
  | 'receivables_payables'
  | 'profitability'
  | 'audit_log'
  | 'admin_settings';

type CenterViewMode = 'both' | 'chart' | 'table';

export const FinanceAIWorkspace: React.FC<FinanceAIWorkspaceProps> = ({
  isOpen,
  onClose,
  onMinimize,
  chatMessages,
  onSendMessage,
  chatLoading,
  range,
  setRange,
  branch,
  setBranch,
  overviewData,
  overviewLoading,
  onRefreshOverview,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSapConnected } = useSystemHealth();

  // Theme State: Defaults to 'light' (clean white background) as requested.
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('atlas_finance_workspace_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const isDark = theme === 'dark';

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('atlas_finance_workspace_theme', next);
      return next;
    });
  };

  // Role resolution
  const userRole = (user?.role || 'user').toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'administrator';
  const isFinanceManager = userRole === 'manager' || userRole === 'accountant';
  const canEdit = isAdmin || isFinanceManager;

  // Layout states
  const [selectedCategory, setSelectedCategory] = useState<ExplorerCategory>('overview');
  const [explorerSearch, setExplorerSearch] = useState('');
  const [centerViewMode, setCenterViewMode] = useState<CenterViewMode>('both');
  const [tableSearch, setTableSearch] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const pageSize = 8;

  // Chat local state
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Right Drawer: Record Details & Editing
  const [selectedRecord, setSelectedRecord] = useState<{
    entity_type: string;
    record_id: string;
    doc_num?: string;
  } | null>(null);
  const [recordDetails, setRecordDetails] = useState<FinanceRecordDetails | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [submittingToSap, setSubmittingToSap] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<RecordSubmissionResponse | null>(null);

  // Audit log & admin settings for center display when selected
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [adminSettings, setAdminSettings] = useState<FinanceAdminSettings | null>(null);
  const [centerExtraLoading, setCenterExtraLoading] = useState(false);

  // Auto scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  // Listen for custom events dispatched by AIChatRenderer (e.g. Inspect record from chat)
  useEffect(() => {
    const handleOpenRecord = (e: any) => {
      const { entity_type, record_id, doc_num, proposed_updates } = e.detail || {};
      if (entity_type && record_id) {
        setSelectedRecord({ entity_type, record_id, doc_num });
        if (proposed_updates) {
          setEditedValues(proposed_updates);
        }
      }
    };
    window.addEventListener('atls-open-finance-record', handleOpenRecord);
    return () => window.removeEventListener('atls-open-finance-record', handleOpenRecord);
  }, []);

  // Fetch record details whenever selectedRecord changes
  useEffect(() => {
    if (!selectedRecord) {
      setRecordDetails(null);
      setEditedValues({});
      setSubmissionResult(null);
      return;
    }

    const fetchDetails = async () => {
      setRecordLoading(true);
      setRecordError(null);
      setSubmissionResult(null);
      try {
        const details = await financeApi.getRecordDetails({
          entity_type: selectedRecord.entity_type,
          record_id: selectedRecord.record_id,
        });
        setRecordDetails(details);
        // Initialize editedValues with current values of editable fields
        const initialEdits: Record<string, any> = {};
        if (details.editable_fields) {
          Object.entries(details.editable_fields).forEach(([key, f]) => {
            initialEdits[key] = f.current_value ?? '';
          });
        }
        setEditedValues(prev => ({ ...initialEdits, ...prev }));
      } catch (err: any) {
        console.error('Failed to load record details:', err);
        setRecordError(err?.response?.data?.detail || 'Failed to fetch record from SAP.');
      } finally {
        setRecordLoading(false);
      }
    };

    fetchDetails();
  }, [selectedRecord]);

  // Load audit logs or admin settings when center tab switches
  useEffect(() => {
    if (selectedCategory === 'audit_log') {
      setCenterExtraLoading(true);
      financeApi.getAuditLog({ limit: 50 })
        .then(res => setAuditEntries(res.entries || []))
        .catch(err => console.error(err))
        .finally(() => setCenterExtraLoading(false));
    } else if (selectedCategory === 'admin_settings') {
      setCenterExtraLoading(true);
      financeApi.getAdminSettings()
        .then(res => setAdminSettings(res))
        .catch(err => console.error(err))
        .finally(() => setCenterExtraLoading(false));
    }
  }, [selectedCategory]);

  // Currency helper
  const formatINR = (val?: number) => {
    if (val === undefined || val === null) return '₹0';
    return '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  // Chat send handler with cancellation support
  const handleSend = async (customPrompt?: string) => {
    const text = (customPrompt || chatInput).trim();
    if (!text || chatLoading) return;
    if (!customPrompt) setChatInput('');

    const controller = new AbortController();
    setAbortController(controller);
    try {
      await onSendMessage(text);
    } finally {
      setAbortController(null);
    }
  };

  const handleCancelChat = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  // Submit to SAP
  const handleSubmitToSap = async () => {
    if (!selectedRecord || !recordDetails) return;
    setSubmittingToSap(true);
    try {
      const res = await financeApi.submitUpdate({
        entity_type: selectedRecord.entity_type,
        record_id: selectedRecord.record_id,
        updates: editedValues,
        confirm: true,
      });
      setSubmissionResult(res);
      setReviewModalOpen(false);
      // Refresh Finance Overview in background
      await onRefreshOverview();
      // Reload updated record details
      const refreshedDetails = await financeApi.getRecordDetails({
        entity_type: selectedRecord.entity_type,
        record_id: selectedRecord.record_id,
      });
      setRecordDetails(refreshedDetails);
    } catch (err: any) {
      setSubmissionResult({
        success: false,
        message: err?.response?.data?.detail || err.message || 'Failed to submit update to SAP.',
        diff: [],
      });
    } finally {
      setSubmittingToSap(false);
    }
  };

  // Export center table to CSV
  const handleExportCSV = () => {
    if (!overviewData) return;
    let headers: string[] = [];
    let rows: any[] = [];
    const filename = `atlas_finance_${selectedCategory}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (selectedCategory === 'overview') {
      headers = ['DocEntry', 'RefNo', 'Date', 'Amount', 'Status'];
      rows = (overviewData.tables?.recent_payments?.incoming || []).map(r => [
        r.docEntry, `"${(r.refNo || '').replace(/"/g, '""')}"`, r.date, r.amount, `"${(r.status || '').replace(/"/g, '""')}"`
      ]);
    } else if (selectedCategory === 'customers') {
      headers = ['Rank', 'CustomerCode', 'CustomerName', 'TotalRevenue'];
      rows = (overviewData.tables?.top_customers || []).map((c, i) => [
        i + 1, c.customerCode, `"${(c.customerName || '').replace(/"/g, '""')}"`, c.netSales
      ]);
    } else if (selectedCategory === 'suppliers') {
      headers = ['Rank', 'SupplierCode', 'SupplierName', 'TotalPurchases'];
      rows = (overviewData.tables?.top_suppliers || []).map((s, i) => [
        i + 1, s.supplierCode, `"${(s.supplierName || '').replace(/"/g, '""')}"`, s.netPurchases
      ]);
    } else {
      headers = ['ID', 'Date', 'Party', 'Amount', 'Status'];
      rows = (overviewData.tables?.recent_payments?.incoming || []).map(p => [
        p.docEntry, p.date, `"${(p.customer || p.supplier || '').replace(/"/g, '""')}"`, p.amount, p.status
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export center data to JSON
  const handleExportJSON = () => {
    if (!overviewData) return;
    const jsonStr = JSON.stringify(overviewData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atlas_finance_export_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Explorer menu definitions with permission checks
  const explorerItems = [
    { id: 'overview' as ExplorerCategory, label: 'Finance Overview', icon: LayoutGrid, count: null, permitted: true, route: '/finance' },
    { id: 'purchase_invoices' as ExplorerCategory, label: 'Purchase Invoices', icon: DollarSign, count: overviewData?.tables?.recent_payments?.outgoing?.length || null, permitted: true, route: '/finance/purchase-invoices' },
    { id: 'incoming_payments' as ExplorerCategory, label: 'Incoming Payments', icon: ArrowDownToLine, count: overviewData?.tables?.recent_payments?.incoming?.length || null, permitted: true, route: '/finance/incoming-payments' },
    { id: 'outgoing_payments' as ExplorerCategory, label: 'Outgoing Payments', icon: ArrowUpFromLine, count: overviewData?.tables?.recent_payments?.outgoing?.length || null, permitted: true, route: '/finance/outgoing-payments' },
    { id: 'customers' as ExplorerCategory, label: 'Customer Analysis', icon: Users, count: overviewData?.tables?.top_customers?.length || null, permitted: true, route: '/finance/customer-analysis' },
    { id: 'suppliers' as ExplorerCategory, label: 'Supplier Analysis', icon: Truck, count: overviewData?.tables?.top_suppliers?.length || null, permitted: true, route: '/finance/supplier-analysis' },
    { id: 'receivables_payables' as ExplorerCategory, label: 'Receivables & Payables', icon: BarChart2, count: null, permitted: true, route: '/finance' },
    { id: 'profitability' as ExplorerCategory, label: 'Profitability Reports', icon: TrendingUp, count: null, permitted: true, route: '/finance/profitability-reports' },
    { id: 'audit_log' as ExplorerCategory, label: 'Audit Log & History', icon: History, count: auditEntries.length || null, permitted: isAdmin || isFinanceManager, route: '/finance' },
    { id: 'admin_settings' as ExplorerCategory, label: 'Admin Settings', icon: Settings, count: null, permitted: isAdmin, route: '/finance' },
  ];

  const filteredExplorerItems = explorerItems.filter(item => {
    if (!item.permitted) return false;
    if (!explorerSearch) return true;
    return item.label.toLowerCase().includes(explorerSearch.toLowerCase());
  });

  // Suggested Prompts
  const suggestedPrompts = [
    'Show revenue for the past six months',
    'Compare sales and purchases',
    'Which customer purchases the most?',
    'Show incoming payments this month',
    'Show unpaid invoices',
    'Inspect draft invoice INV-329',
    'Show permitted editable fields',
    'Submit approved changes to SAP',
  ];

  // Table rows computation based on selectedCategory
  const currentTableData = useMemo(() => {
    if (!overviewData) return [];
    if (selectedCategory === 'customers') {
      return (overviewData.tables?.top_customers || []).map((c) => ({
        id: c.customerCode,
        doc_num: c.customerCode,
        title: c.customerName,
        date: 'Active',
        status: 'Active',
        amount: c.netSales,
        type: 'customer',
        editable: canEdit,
      }));
    }
    if (selectedCategory === 'suppliers') {
      return (overviewData.tables?.top_suppliers || []).map((s) => ({
        id: s.supplierCode,
        doc_num: s.supplierCode,
        title: s.supplierName,
        date: 'Active',
        status: 'Active',
        amount: s.netPurchases,
        type: 'supplier',
        editable: canEdit,
      }));
    }
    if (selectedCategory === 'outgoing_payments') {
      return (overviewData.tables?.recent_payments?.outgoing || []).map(p => ({
        id: String(p.docEntry),
        doc_num: p.refNo || String(p.docEntry),
        title: p.supplier || p.customer || 'Vendor Settlement',
        date: p.date,
        status: p.status || 'Paid',
        amount: p.amount,
        type: 'outgoing_payment',
        editable: false,
      }));
    }
    // Default incoming payments / sales invoices
    return (overviewData.tables?.recent_payments?.incoming || []).map(p => ({
      id: String(p.docEntry),
      doc_num: p.refNo || String(p.docEntry),
      title: p.customer || 'Customer Payment',
      date: p.date,
      status: p.status || 'Open',
      amount: p.amount,
      type: 'invoice',
      editable: canEdit,
    }));
  }, [overviewData, selectedCategory, canEdit]);

  // Filter & paginate table rows
  const filteredTableRows = useMemo(() => {
    return currentTableData.filter(row => {
      if (!tableSearch) return true;
      const q = tableSearch.toLowerCase();
      return (
        String(row.doc_num).toLowerCase().includes(q) ||
        String(row.title).toLowerCase().includes(q) ||
        String(row.status).toLowerCase().includes(q)
      );
    });
  }, [currentTableData, tableSearch]);

  const totalPages = Math.ceil(filteredTableRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return filteredTableRows.slice(start, start + pageSize);
  }, [filteredTableRows, tablePage]);

  // Chart data
  const trendData = overviewData?.charts?.sales_vs_purchases || [];
  const paymentTrendData = overviewData?.charts?.payments_trend || [];
  const kpis = overviewData?.kpis;

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col font-sans antialiased overflow-hidden select-none transition-colors duration-200 ${
        isDark ? 'bg-[#070B18] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          FLOATING SIDE DOCK ICON TO CHANGE WORKSPACE BACKGROUND COLOR
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center">
        <button
          id="finance-theme-side-toggle"
          onClick={toggleTheme}
          title={isDark ? 'Click to change to White background' : 'Click to change to Dark Blue background'}
          className={`group relative flex items-center gap-2 p-3 rounded-2xl shadow-2xl transition-all duration-300 cursor-pointer border ${
            isDark
              ? 'bg-[#111C38] hover:bg-slate-800 text-amber-300 border-slate-700 hover:scale-105 shadow-blue-950/70'
              : 'bg-white hover:bg-slate-50 text-indigo-600 border-slate-200 hover:scale-105 shadow-slate-300/80'
          }`}
        >
          {isDark ? (
            <Sun size={20} className="text-amber-400" />
          ) : (
            <Moon size={20} className="text-indigo-600" />
          )}
          <div className="hidden group-hover:flex flex-col text-left transition-all duration-200 pr-1">
            <span className={`text-[11px] font-black leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isDark ? 'White Mode' : 'Dark Blue'}
            </span>
            <span className={`text-[9px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Change Background
            </span>
          </div>
          {/* Subtle status ping */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          TOP WORKSPACE BAR
      ─────────────────────────────────────────────────────────────────────── */}
      <header
        className={`h-14 px-5 flex items-center justify-between shrink-0 z-20 transition-colors duration-200 ${
          isDark
            ? 'border-b border-slate-800/90 bg-[#0B132B]/95 text-white'
            : 'border-b border-slate-200 bg-white/95 text-slate-900 shadow-2xs'
        }`}
      >
        {/* Left Branding & Mode */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[14px] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ATLAS Finance AI Workspace
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border ${
                  isAdmin
                    ? isDark
                      ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                      : 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
                    : isFinanceManager
                    ? isDark
                      ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                      : 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
                    : isDark
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {isAdmin ? 'ADMIN CONTROL' : isFinanceManager ? 'FINANCE MANAGER' : 'READ-ONLY ACCESS'}
              </span>
            </div>
            <div className={`text-[9.5px] flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>SAP Business One Service Layer Interface</span>
              <span>•</span>
              <span className="text-emerald-500 flex items-center gap-1 font-mono font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isSapConnected ? 'Live Connected' : 'Mock/Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Global Controls & Scope */}
        <div className="flex items-center gap-2.5">
          {/* Quick Date Range */}
          <div
            className={`flex items-center rounded-xl p-0.5 text-[11px] ${
              isDark ? 'bg-[#111C38] border border-slate-800' : 'bg-slate-100 border border-slate-200'
            }`}
          >
            {['monthly', 'yearly', 'all_time'].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-lg font-bold capitalize transition cursor-pointer ${
                  range === r
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'all_time' ? 'All Time' : r}
              </button>
            ))}
          </div>

          {/* Branch Pill */}
          <div
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] ${
              isDark ? 'bg-[#111C38] border border-slate-800 text-slate-300' : 'bg-slate-100 border border-slate-200 text-slate-700'
            }`}
          >
            <Building size={13} className="text-blue-500" />
            <span className="font-semibold">{branch || 'Main Branch (SH)'}</span>
            {setBranch && (
              <button
                onClick={() => setBranch(branch === 'SH' ? 'All Branches' : 'SH')}
                className={`text-[9px] hover:underline ml-1 font-bold ${
                  isDark ? 'text-cyan-400' : 'text-blue-600'
                }`}
              >
                Switch
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefreshOverview}
            disabled={overviewLoading}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'bg-[#111C38] hover:bg-slate-800 border border-slate-800 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700'
            }`}
            title="Refresh Finance Overview from SAP"
          >
            <RefreshCw size={13} className={`text-cyan-500 ${overviewLoading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          {/* Header Theme Toggle Button */}
          <button
            id="finance-theme-header-toggle"
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-[#111C38] hover:bg-slate-800 border-slate-700 text-amber-300 hover:text-amber-200'
                : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
            }`}
            title={isDark ? 'Switch to White background' : 'Switch to Dark Blue background'}
          >
            {isDark ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} className="text-indigo-600" />}
            <span>{isDark ? 'White Mode' : 'Dark Blue'}</span>
          </button>
        </div>

        {/* Right Controls: Minimize & Close */}
        <div className={`flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <button
            onClick={onMinimize}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDark ? 'hover:text-white hover:bg-slate-800' : 'hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Exit Full-screen (Return to Normal Panel)"
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDark ? 'hover:text-rose-400 hover:bg-slate-800' : 'hover:text-rose-600 hover:bg-rose-50'
            }`}
            title="Close Assistant"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────────
          MAIN 4-COLUMN WORKSPACE CONTAINER
      ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ══════════════════════════════════════════════════════════════════════
            COLUMN 1: AI ASSISTANT (LEFT ~360px)
        ══════════════════════════════════════════════════════════════════════ */}
        <section
          className={`w-[360px] 2xl:w-[390px] flex flex-col shrink-0 transition-colors duration-200 ${
            isDark ? 'border-r border-slate-800/90 bg-[#090F20]' : 'border-r border-slate-200 bg-white'
          }`}
        >
          {/* Column Header */}
          <div
            className={`px-4 py-3 flex items-center justify-between border-b ${
              isDark ? 'border-slate-800/80 bg-[#090F20]' : 'border-slate-200 bg-slate-50/70'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} className={isDark ? 'text-cyan-400' : 'text-indigo-600'} />
              <span
                className={`text-[12px] font-black uppercase tracking-wider ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                Finance AI Dialogue
              </span>
            </div>
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                isDark
                  ? 'text-cyan-400/80 bg-cyan-950/40 border-cyan-800/50'
                  : 'text-indigo-700 bg-indigo-50 border-indigo-200 font-bold'
              }`}
            >
              Gemini 3.8 Flash
            </span>
          </div>

          {/* Chat Messages List */}
          <div
            ref={chatScrollRef}
            className={`flex-1 overflow-y-auto p-3.5 space-y-3.5 text-[11.5px] ${
              isDark ? 'bg-[#090F20]' : 'bg-slate-50/30'
            }`}
          >
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {m.role === 'user' ? (
                  <div className="rounded-2xl rounded-tr-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-2 max-w-[88%] shadow-md leading-relaxed font-medium">
                    {m.content}
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl rounded-tl-xs p-3 max-w-[95%] shadow-xs leading-relaxed ${
                      isDark
                        ? 'bg-[#111C38] border border-slate-700/60 text-slate-200'
                        : 'bg-white border border-slate-200/90 text-slate-800 shadow-2xs'
                    }`}
                  >
                    <FormattedMessage content={m.content} />
                    {m.structured_data && (
                      <div className="mt-2 text-slate-900">
                        <AIChatRenderer structuredData={m.structured_data} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div
                className={`flex items-center gap-2 p-2.5 rounded-xl text-[11px] border ${
                  isDark
                    ? 'bg-[#111C38] border-blue-500/30 text-blue-300'
                    : 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                }`}
              >
                <RefreshCw size={13} className="animate-spin text-blue-600" />
                <span>Processing financial request & querying SAP...</span>
                {abortController && (
                  <button
                    onClick={handleCancelChat}
                    className="ml-auto text-[9px] text-rose-500 hover:text-rose-600 underline font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Suggested Prompts Pills */}
          <div
            className={`p-2 border-t ${
              isDark ? 'border-slate-800/80 bg-[#0B132B]/60' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div
              className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 px-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Suggested Financial Queries
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {suggestedPrompts.slice(0, 4).map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  disabled={chatLoading}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[10px] font-medium transition cursor-pointer shrink-0 disabled:opacity-50 border ${
                    isDark
                      ? 'bg-[#111C38] hover:bg-slate-800 border-slate-700/60 text-slate-300'
                      : 'bg-white hover:bg-blue-50 border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-200 shadow-2xs'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <div className={`p-3 border-t ${isDark ? 'border-slate-800 bg-[#0B132B]' : 'border-slate-200 bg-white'}`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 transition ${
                isDark
                  ? 'bg-[#111C38] border-slate-700/80 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/40'
                  : 'bg-slate-50 border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20'
              }`}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about revenue, payments, draft edits..."
                disabled={chatLoading}
                className={`flex-1 bg-transparent text-[11.5px] focus:outline-none ${
                  isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="p-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs transition cursor-pointer disabled:opacity-40"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            COLUMN 2: FINANCE DATA EXPLORER (MIDDLE-LEFT ~260px)
        ══════════════════════════════════════════════════════════════════════ */}
        <aside
          className={`w-[260px] flex flex-col shrink-0 transition-colors duration-200 ${
            isDark ? 'border-r border-slate-800/90 bg-[#0B132B]' : 'border-r border-slate-200 bg-slate-50/70'
          }`}
        >
          {/* Explorer Search */}
          <div className={`p-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div
              className={`text-[10px] font-black uppercase tracking-wider mb-2 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Finance Data Explorer
            </div>
            <div
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                isDark ? 'bg-[#111C38] border-slate-700/70' : 'bg-white border-slate-200 shadow-2xs'
              }`}
            >
              <Search size={13} className="text-slate-400" />
              <input
                type="text"
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                placeholder="Filter reports & fields..."
                className={`w-full bg-transparent text-[11px] focus:outline-none ${
                  isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Explorer Categories List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredExplorerItems.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedCategory === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedCategory(item.id);
                    setTablePage(1);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11.5px] font-medium transition cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-blue-600/20 text-cyan-300 border border-blue-500/40 shadow-xs'
                        : 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-2xs'
                      : isDark
                      ? 'text-slate-300 hover:bg-[#111C38] hover:text-white'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      size={14}
                      className={
                        isSelected
                          ? isDark ? 'text-cyan-400' : 'text-blue-600'
                          : isDark ? 'text-slate-400' : 'text-slate-400'
                      }
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== null && (
                    <span
                      className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded-full ${
                        isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Quick Navigation Links */}
          <div className={`p-3 border-t ${isDark ? 'border-slate-800/80 bg-[#090F20]' : 'border-slate-200 bg-white'}`}>
            <div
              className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Direct Module Link
            </div>
            <button
              onClick={() => {
                const target = explorerItems.find((i) => i.id === selectedCategory)?.route || '/finance';
                navigate(target);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                isDark
                  ? 'bg-[#111C38] hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
              }`}
            >
              <span>Open in Standard Page</span>
              <ExternalLink size={11} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            </button>
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════════════════════
            COLUMN 3: ANALYTICS AND RESULTS (CENTER flex-1)
        ══════════════════════════════════════════════════════════════════════ */}
        <main
          className={`flex-1 flex flex-col overflow-y-auto transition-colors duration-200 ${
            isDark ? 'bg-[#090E1D]' : 'bg-slate-100/70'
          }`}
        >
          {/* Center Top Toolbar */}
          <div
            className={`p-4 border-b flex items-center justify-between shrink-0 sticky top-0 z-10 backdrop-blur-md transition-colors duration-200 ${
              isDark ? 'border-slate-800 bg-[#0B132B]/90' : 'border-slate-200 bg-white/95 shadow-2xs'
            }`}
          >
            <div>
              <h2
                className={`text-[15px] font-black tracking-tight flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {explorerItems.find((i) => i.id === selectedCategory)?.label || 'Finance Analytics'}
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isDark
                      ? 'bg-blue-950 text-cyan-400 border-blue-800'
                      : 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
                  }`}
                >
                  {range.toUpperCase()}
                </span>
              </h2>
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Verified figures extracted directly from SAP Business One Service Layer
              </div>
            </div>

            {/* View Mode & Export Actions */}
            <div className="flex items-center gap-2">
              {/* View Mode Toggles */}
              <div
                className={`flex items-center rounded-xl p-0.5 text-[11px] ${
                  isDark ? 'bg-[#111C38] border border-slate-800' : 'bg-slate-100 border border-slate-200'
                }`}
              >
                <button
                  onClick={() => setCenterViewMode('chart')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    centerViewMode === 'chart'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LineChartIcon size={13} />
                  <span>Chart</span>
                </button>
                <button
                  onClick={() => setCenterViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    centerViewMode === 'table'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TableIcon size={13} />
                  <span>Results</span>
                </button>
                <button
                  onClick={() => setCenterViewMode('both')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    centerViewMode === 'both'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid size={13} />
                  <span>Both</span>
                </button>
              </div>

              {/* Export Buttons */}
              <button
                onClick={handleExportCSV}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                  isDark
                    ? 'bg-[#111C38] hover:bg-slate-800 text-slate-300 border-slate-700/80'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                }`}
                title="Export Results to CSV"
              >
                <Download size={13} className={isDark ? 'text-cyan-400' : 'text-blue-600'} />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportJSON}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                  isDark
                    ? 'bg-[#111C38] hover:bg-slate-800 text-slate-300 border-slate-700/80'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                }`}
                title="Export Results to JSON"
              >
                <FileText size={13} className={isDark ? 'text-blue-400' : 'text-indigo-600'} />
                <span>JSON</span>
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5 flex-1">
            {/* KPI Cards Strip */}
            {kpis && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* Net Sales */}
                <div
                  className={`rounded-2xl p-3.5 shadow-xs border ${
                    isDark ? 'bg-[#111C38] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Net Sales
                  </div>
                  <div
                    className={`text-[18px] font-black mt-1 ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}
                  >
                    {formatINR(kpis.total_sales?.value)}
                  </div>
                  <div
                    className={`text-[9px] mt-0.5 flex items-center gap-1 font-semibold ${
                      isDark ? 'text-emerald-400/80' : 'text-emerald-600'
                    }`}
                  >
                    <TrendingUp size={10} /> Live Invoiced
                  </div>
                </div>

                {/* Purchases */}
                <div
                  className={`rounded-2xl p-3.5 shadow-xs border ${
                    isDark ? 'bg-[#111C38] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Purchases
                  </div>
                  <div
                    className={`text-[18px] font-black mt-1 ${
                      isDark ? 'text-blue-400' : 'text-blue-600'
                    }`}
                  >
                    {formatINR(kpis.total_purchases?.value)}
                  </div>
                  <div className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Supplier AP
                  </div>
                </div>

                {/* Incoming Payments */}
                <div
                  className={`rounded-2xl p-3.5 shadow-xs border ${
                    isDark ? 'bg-[#111C38] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Incoming
                  </div>
                  <div
                    className={`text-[18px] font-black mt-1 ${
                      isDark ? 'text-cyan-400' : 'text-cyan-600'
                    }`}
                  >
                    {formatINR(kpis.incoming_payments?.value)}
                  </div>
                  <div className={`text-[9px] mt-0.5 ${isDark ? 'text-cyan-400/80' : 'text-cyan-600'}`}>
                    Bank & Cash Inflow
                  </div>
                </div>

                {/* Outgoing Payments */}
                <div
                  className={`rounded-2xl p-3.5 shadow-xs border ${
                    isDark ? 'bg-[#111C38] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Outgoing
                  </div>
                  <div
                    className={`text-[18px] font-black mt-1 ${
                      isDark ? 'text-amber-400' : 'text-amber-600'
                    }`}
                  >
                    {formatINR(kpis.outgoing_payments?.value)}
                  </div>
                  <div className={`text-[9px] mt-0.5 ${isDark ? 'text-amber-400/80' : 'text-amber-600'}`}>
                    Supplier Settlements
                  </div>
                </div>

                {/* Accounts Receivable */}
                <div
                  className={`rounded-2xl p-3.5 shadow-xs border ${
                    isDark ? 'bg-[#111C38] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Receivables
                  </div>
                  <div
                    className={`text-[18px] font-black mt-1 ${
                      isDark ? 'text-rose-400' : 'text-rose-600'
                    }`}
                  >
                    {formatINR(kpis.accounts_receivable?.value)}
                  </div>
                  <div className={`text-[9px] mt-0.5 ${isDark ? 'text-rose-400/80' : 'text-rose-600'}`}>
                    Pending AR
                  </div>
                </div>

                {/* Gross Margin */}
                <div
                  className={`rounded-2xl p-3.5 shadow-xs border ${
                    isDark ? 'bg-[#111C38] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Gross Profit
                  </div>
                  <div
                    className={`text-[18px] font-black mt-1 ${
                      isDark ? 'text-purple-400' : 'text-purple-600'
                    }`}
                  >
                    {formatINR(kpis.gross_profit?.value)}
                  </div>
                  <div className={`text-[9px] mt-0.5 ${isDark ? 'text-purple-400/80' : 'text-purple-600 font-semibold'}`}>
                    Margin: {kpis.gross_margin?.value || 0}%
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Charts Area */}
            {(centerViewMode === 'chart' || centerViewMode === 'both') && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Chart 1: Sales vs Purchases Trend */}
                <div
                  className={`rounded-2xl p-4 shadow-sm border ${
                    isDark ? 'bg-[#111C38] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart2 size={15} className="text-cyan-500" />
                      <span className={`text-[12.5px] font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Sales vs Purchases Trend
                      </span>
                    </div>
                    <span className={`text-[9.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Monthly SAP Comparison
                    </span>
                  </div>
                  <div className="h-64 w-full">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="purchGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#E2E8F0'} />
                          <XAxis dataKey="date" stroke="#64748B" fontSize={10} />
                          <YAxis stroke="#64748B" fontSize={10} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDark ? '#0B132B' : '#FFFFFF',
                              borderColor: isDark ? '#334155' : '#E2E8F0',
                              color: isDark ? '#F8FAFC' : '#0F172A',
                              borderRadius: 8,
                              fontSize: 11,
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            }}
                            formatter={(val: any) => formatINR(Number(val))}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="sales" name="Sales" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                          <Area type="monotone" dataKey="purchases" name="Purchases" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#purchGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                        No trend data available for current range
                      </div>
                    )}
                  </div>
                </div>

                {/* Chart 2: Payments Trend or Top Customers */}
                <div
                  className={`rounded-2xl p-4 shadow-sm border ${
                    isDark ? 'bg-[#111C38] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={15} className="text-emerald-500" />
                      <span className={`text-[12.5px] font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Payment Collections & Outflows
                      </span>
                    </div>
                    <span className={`text-[9.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Cash Flow Balance
                    </span>
                  </div>
                  <div className="h-64 w-full">
                    {paymentTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={paymentTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E293B' : '#E2E8F0'} />
                          <XAxis dataKey="date" stroke="#64748B" fontSize={10} />
                          <YAxis stroke="#64748B" fontSize={10} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDark ? '#0B132B' : '#FFFFFF',
                              borderColor: isDark ? '#334155' : '#E2E8F0',
                              color: isDark ? '#F8FAFC' : '#0F172A',
                              borderRadius: 8,
                              fontSize: 11,
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            }}
                            formatter={(val: any) => formatINR(Number(val))}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="incoming" name="Incoming" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="outgoing" name="Outgoing" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                        No payment trends available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Special View: Audit Log if selected */}
            {selectedCategory === 'audit_log' && (
              <div
                className={`rounded-2xl p-4 shadow-sm border ${
                  isDark ? 'bg-[#111C38] border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[13px] font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <History size={15} className="text-cyan-500" />
                    Finance Operations Audit Log ({auditEntries.length} logged entries)
                  </span>
                  <span className="text-[9.5px] font-mono text-slate-400">Immutable Server-Side Log</span>
                </div>
                {centerExtraLoading ? (
                  <div className="p-8 flex items-center justify-center text-blue-500 gap-2">
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Loading audit records...</span>
                  </div>
                ) : (
                  <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <table className="w-full text-left text-[11px]">
                      <thead
                        className={`font-semibold border-b ${
                          isDark ? 'bg-[#0B132B] text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        <tr>
                          <th className="p-2.5">Timestamp</th>
                          <th className="p-2.5">User</th>
                          <th className="p-2.5">Role</th>
                          <th className="p-2.5">Entity</th>
                          <th className="p-2.5">Record ID</th>
                          <th className="p-2.5">Action</th>
                          <th className="p-2.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        {auditEntries.map((e, idx) => (
                          <tr key={idx} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                            <td className="p-2.5 font-mono text-slate-400">{e.timestamp?.replace('T', ' ').slice(0, 19)}</td>
                            <td className={`p-2.5 font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{e.username || e.user_id}</td>
                            <td className="p-2.5 text-slate-400 capitalize">{e.role}</td>
                            <td className="p-2.5 capitalize text-blue-600 font-semibold">{e.entity_type?.replace('_', ' ')}</td>
                            <td className="p-2.5 font-mono text-slate-400">{e.record_id}</td>
                            <td className={`p-2.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{e.action}</td>
                            <td className="p-2.5 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  e.status === 'success'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {e.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {auditEntries.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-slate-400">
                              No audit events logged yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Special View: Admin Settings if selected */}
            {selectedCategory === 'admin_settings' && adminSettings && (
              <div
                className={`rounded-2xl p-5 shadow-sm space-y-4 border ${
                  isDark ? 'bg-[#111C38] border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <span className={`text-[13.5px] font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <Settings size={16} className="text-cyan-500" />
                    Finance Assistant Admin Settings & Service Layer Health
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    CONFIG VERIFIED
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11.5px]">
                  <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0B132B] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-[9.5px] text-slate-400 font-bold uppercase mb-1">Service Layer Connection</div>
                    <div className="font-mono text-emerald-600 font-semibold">{adminSettings.sap_status || 'Online'}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Circuit Breaker: {adminSettings.sap_circuit_breaker || 'Closed (Healthy)'}</div>
                    <div className="text-[10px] text-slate-400">Authenticated: {adminSettings.sap_authenticated ? 'Yes' : 'No'}</div>
                  </div>
                  <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0B132B] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-[9.5px] text-slate-400 font-bold uppercase mb-1">Access Control & Permissions</div>
                    <div className={isDark ? 'text-slate-200' : 'text-slate-700'}>
                      Permitted Editing Roles: <span className="font-bold">{Object.keys(adminSettings.role_permission_matrix || {}).join(', ')}</span>
                    </div>
                    <div className="text-slate-400 text-[10px] mt-1">Strict field allowlist enforced on server</div>
                    <div className="text-slate-400 text-[10px]">Locked Fields: DocTotal, VatSum, CardCode (GAAP Compliance)</div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Table Area */}
            {(centerViewMode === 'table' || centerViewMode === 'both') && selectedCategory !== 'audit_log' && selectedCategory !== 'admin_settings' && (
              <div
                className={`rounded-2xl p-4 shadow-sm border ${
                  isDark ? 'bg-[#111C38] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-2xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <TableIcon size={14} className="text-blue-500" />
                    <span className={`text-[12.5px] font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedCategory === 'customers' ? 'Top Purchasing Customers' : selectedCategory === 'suppliers' ? 'Top Suppliers' : 'Transaction Records'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">({filteredTableRows.length} total)</span>
                  </div>

                  {/* Table Search */}
                  <div
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-1 ${
                      isDark ? 'bg-[#0B132B] border-slate-700/80' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Search size={12} className="text-slate-400" />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => {
                        setTableSearch(e.target.value);
                        setTablePage(1);
                      }}
                      placeholder="Search table rows..."
                      className={`bg-transparent text-[10.5px] focus:outline-none w-44 ${
                        isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Table */}
                <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <table className="w-full text-left text-[11px]">
                    <thead
                      className={`font-semibold border-b ${
                        isDark ? 'bg-[#0B132B] text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <tr>
                        <th className="p-2.5">Doc / ID #</th>
                        <th className="p-2.5">Date / Status</th>
                        <th className="p-2.5">Party / Description</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5 text-center">Permitted Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {paginatedRows.map((row, idx) => (
                        <tr key={idx} className={isDark ? 'hover:bg-slate-800/40 transition' : 'hover:bg-slate-50/80 transition'}>
                          <td className="p-2.5 font-mono font-bold text-blue-600">#{row.doc_num}</td>
                          <td className="p-2.5 text-slate-400">
                            <span>{row.date}</span>
                            <span
                              className={`ml-2 px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                                isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td
                            className={`p-2.5 font-medium truncate max-w-[200px] ${
                              isDark ? 'text-slate-200' : 'text-slate-800'
                            }`}
                            title={row.title}
                          >
                            {row.title}
                          </td>
                          <td className={`p-2.5 text-right font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {formatINR(row.amount)}
                          </td>
                          <td className="p-2.5 text-center">
                            {row.editable ? (
                              <button
                                onClick={() => {
                                  setSelectedRecord({
                                    entity_type: row.type,
                                    record_id: String(row.id),
                                    doc_num: String(row.doc_num),
                                  });
                                }}
                                className={`px-2 py-1 rounded-lg text-[9.5px] font-bold border transition cursor-pointer flex items-center gap-1 mx-auto ${
                                  isDark
                                    ? 'bg-blue-950/60 hover:bg-blue-900/60 text-cyan-300 border-blue-800'
                                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                                }`}
                              >
                                <Edit3 size={11} />
                                <span>Inspect / Edit</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedRecord({
                                    entity_type: row.type,
                                    record_id: String(row.id),
                                    doc_num: String(row.doc_num),
                                  });
                                }}
                                className={`px-2 py-1 rounded-lg text-[9.5px] font-bold border transition cursor-pointer flex items-center gap-1 mx-auto ${
                                  isDark
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                                }`}
                              >
                                <Eye size={11} />
                                <span>View Details</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {paginatedRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-5 text-center text-slate-400">
                            No records match your search criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 text-[10.5px] text-slate-400">
                    <div>
                      Page {tablePage} of {totalPages}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                        disabled={tablePage === 1}
                        className={`p-1 rounded-lg disabled:opacity-40 transition cursor-pointer ${
                          isDark ? 'bg-[#0B132B] hover:bg-slate-800 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                        disabled={tablePage === totalPages}
                        className={`p-1 rounded-lg disabled:opacity-40 transition cursor-pointer ${
                          isDark ? 'bg-[#0B132B] hover:bg-slate-800 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ══════════════════════════════════════════════════════════════════════
            COLUMN 4: RECORD DETAILS AND EDITING (RIGHT ~390px DRAWER)
        ══════════════════════════════════════════════════════════════════════ */}
        {selectedRecord && (
          <aside
            className={`w-[390px] border-l flex flex-col shrink-0 animate-in slide-in-from-right duration-200 z-10 transition-colors duration-200 ${
              isDark ? 'border-slate-800/90 bg-[#0B132B]' : 'border-slate-200 bg-white shadow-2xl'
            }`}
          >
            {/* Drawer Header */}
            <div
              className={`p-3.5 border-b flex items-center justify-between ${
                isDark ? 'border-slate-800 bg-[#0E1726]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                  <ShieldCheck size={14} />
                </div>
                <div>
                  <div className={`text-[12px] font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {selectedRecord.entity_type === 'business_partner' || selectedRecord.entity_type === 'customer' || selectedRecord.entity_type === 'supplier'
                      ? 'Business Partner'
                      : 'Finance Record'}{' '}
                    #{selectedRecord.doc_num || selectedRecord.record_id}
                  </div>
                  <div className="text-[9px] text-slate-400 capitalize">
                    {selectedRecord.entity_type.replace('_', ' ')} • Status: {recordDetails?.status || 'Active'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className={`p-1 rounded-lg transition cursor-pointer ${
                  isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-700'
                }`}
              >
                <X size={15} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[11.5px]">
              {/* Role Permission Notice */}
              <div
                className={`p-2.5 rounded-xl border text-[10px] leading-relaxed flex items-start gap-2 ${
                  recordDetails?.can_edit
                    ? isDark
                      ? 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                      : 'bg-blue-50 border-blue-200 text-blue-800 font-medium'
                    : isDark
                    ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                    : 'bg-amber-50 border-amber-200 text-amber-800 font-medium'
                }`}
              >
                {recordDetails?.can_edit ? (
                  <>
                    <ShieldCheck size={14} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-black text-blue-600">Authorized Edit Scope</strong>
                      Permitted fields can be modified and submitted directly to SAP Business One. Accounting totals and GL lines are locked for GAAP compliance.
                    </div>
                  </>
                ) : (
                  <>
                    <Lock size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-black text-amber-600">View-Only Record</strong>
                      This record cannot be edited by your role or has been locked by SAP document lifecycle rules.
                    </div>
                  </>
                )}
              </div>

              {/* Loading & Error States */}
              {recordLoading && (
                <div className="p-4 flex items-center justify-center text-blue-500 gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Loading record details from SAP...</span>
                </div>
              )}
              {recordError && (
                <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-[10px] font-medium">
                  {recordError}
                </div>
              )}

              {/* Submission Result Notification if exists */}
              {submissionResult && (
                <div
                  className={`p-3 rounded-xl border ${
                    submissionResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {submissionResult.success ? (
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    ) : (
                      <AlertCircle size={15} className="text-rose-600" />
                    )}
                    <span>{submissionResult.success ? 'SAP Write-Back Succeeded' : 'SAP Update Failed'}</span>
                  </div>
                  <p className="text-[10px]">
                    {submissionResult.success
                      ? `Record #${selectedRecord.doc_num || selectedRecord.record_id} updated in SAP. Audit ID: ${submissionResult.audit_id || 'logged'}`
                      : submissionResult.message}
                  </p>
                </div>
              )}

              {/* Permitted Editable Fields */}
              {recordDetails && recordDetails.editable_fields && Object.keys(recordDetails.editable_fields).length > 0 && (
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <Edit3 size={12} />
                    Permitted Editable Fields
                  </div>

                  {Object.entries(recordDetails.editable_fields).map(([key, f]) => {
                    const originalVal = f.current_value ?? '';
                    const currentVal = editedValues[key] ?? originalVal;
                    const isChanged = currentVal !== originalVal;

                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <label className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {f.label || key}
                          </label>
                          {isChanged && (
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                              Modified
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={currentVal}
                          disabled={!recordDetails.can_edit || submittingToSap}
                          maxLength={f.max_length || 254}
                          onChange={(e) => {
                            setEditedValues({
                              ...editedValues,
                              [key]: e.target.value,
                            });
                          }}
                          className={`w-full rounded-xl px-3 py-2 text-[11px] focus:outline-none disabled:opacity-50 border transition ${
                            isDark
                              ? 'bg-[#111C38] border-slate-700 text-white focus:border-cyan-500'
                              : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:bg-white'
                          }`}
                        />
                        {isChanged && (
                          <div className="text-[9px] text-slate-400 flex items-center gap-1">
                            <span>Original:</span>
                            <span className="font-mono text-slate-500 truncate max-w-[200px]">
                              {String(originalVal || '(empty)')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Locked Read-Only Fields with Explanations */}
              {recordDetails && recordDetails.locked_fields && (
                <div className={`space-y-2 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Lock size={12} className="text-amber-500" />
                    Locked Accounting Fields
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(recordDetails.locked_fields).map(([fieldName, info]) => (
                      <div
                        key={fieldName}
                        className={`flex items-center justify-between p-2 rounded-lg border text-[10px] ${
                          isDark ? 'bg-[#111C38] border-slate-800/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div>
                          <span className="font-semibold">{fieldName}</span>
                          <span className="text-[9px] text-slate-400 block font-mono">
                            {String(info.current_value ?? '')}
                          </span>
                        </div>
                        <span
                          className="text-[8.5px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold"
                          title={info.reason}
                        >
                          GAAP Lock
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal italic">
                    Financial amounts, VAT sums, and partner codes cannot be altered on posted records to maintain strict General Ledger audit integrity.
                  </p>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div
              className={`p-3.5 border-t flex items-center gap-2 ${
                isDark ? 'border-slate-800 bg-[#0E1726]' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <button
                onClick={() => setSelectedRecord(null)}
                className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                Cancel
              </button>
              {recordDetails?.can_edit && (
                <button
                  onClick={() => setReviewModalOpen(true)}
                  disabled={submittingToSap}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck size={14} />
                  <span>Review Changes</span>
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          EXPLICIT CONFIRMATION MODAL FOR SAP WRITE-BACK
      ─────────────────────────────────────────────────────────────────────── */}
      {reviewModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 border ${
              isDark ? 'bg-[#0E1726] border-cyan-500/40 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className={`text-[14px] font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Explicit Confirmation: Submit Changes to SAP
                </h3>
                <p className="text-[10px] text-slate-400">
                  Target: SAP Business One Service Layer document #{selectedRecord.doc_num || selectedRecord.record_id}
                </p>
              </div>
            </div>

            <div
              className={`rounded-xl border p-3 space-y-2 text-[11px] ${
                isDark ? 'bg-[#0B132B] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-[9.5px] font-bold uppercase tracking-wider text-blue-600">
                Proposed Value Changes Diff:
              </div>
              <div className={`divide-y max-h-48 overflow-y-auto ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {Object.entries(editedValues).map(([key, val]) => {
                  const oldVal = recordDetails?.editable_fields?.[key]?.current_value ?? '';
                  if (val === oldVal) return null;
                  return (
                    <div key={key} className="py-1.5 flex items-center justify-between">
                      <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {recordDetails?.editable_fields?.[key]?.label || key}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-slate-400 line-through">{String(oldVal || '(empty)')}</span>
                        <span className="text-blue-600 font-bold">→ {String(val)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[10px] text-amber-800 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                This action writes directly to SAP Business One. The update will be immutably recorded in the server-side audit log with your user identity (
                <strong>{user?.email || user?.id || 'admin'}</strong>).
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setReviewModalOpen(false)}
                disabled={submittingToSap}
                className={`px-4 py-2 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                Back to Editing
              </button>
              <button
                onClick={handleSubmitToSap}
                disabled={submittingToSap}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-black shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {submittingToSap ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Writing to SAP...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm & Submit to SAP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
