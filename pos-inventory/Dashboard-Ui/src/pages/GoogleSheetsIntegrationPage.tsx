import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Eye,
  Save,
  Unlink,
  Link2,
  Loader2,
  Layers,
  TableProperties,
  Clock,
  ShieldCheck,
  Users,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import {
  googleSheetsApi,
  type GoogleSheetsConfigPayload,
  type WorksheetInfo,
  type StockConfigurationRecord,
} from '../api/googleSheets';

// Helper to mask spreadsheet IDs (show first 5 and last 4 characters)
export const maskSpreadsheetId = (id?: string | null): string => {
  if (!id) return '—';
  const trimmed = id.trim();
  if (trimmed.length <= 10) return trimmed;
  return `${trimmed.slice(0, 5)}...${trimmed.slice(-4)}`;
};

// Helper to extract spreadsheet ID from Google Sheets URLs
export const extractSpreadsheetIdFromUrl = (urlOrId: string): string => {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/i);
  if (match && match[1]) {
    return match[1];
  }
  if (/^[a-zA-Z0-9-_]{20,100}$/.test(trimmed)) {
    return trimmed;
  }
  return '';
};

// Helper to safely extract string error messages from API exceptions
export const extractErrorText = (err: any): string => {
  const detail = err.response?.data?.detail;
  if (typeof detail === 'object' && detail !== null) {
    return detail.message || JSON.stringify(detail);
  }
  if (typeof detail === 'string') {
    return detail;
  }
  return err.message || 'Operation failed.';
};

// Google Sheets Logo SVG Component
export const GoogleSheetsLogo = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <div className={`relative flex items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 ${className}`}>
    <svg viewBox="0 0 24 24" className="w-3/5 h-3/5 fill-current" aria-hidden="true">
      <path d="M19.38 6.64L14.36 1.62C14.07 1.33 13.68 1.17 13.27 1.17H6.55C5.45 1.17 4.55 2.07 4.55 3.17V20.83C4.55 21.93 5.45 22.83 6.55 22.83H17.45C18.55 22.83 19.45 21.93 19.45 20.83V7.73C19.45 7.32 19.29 6.93 19.38 6.64ZM14 3.09L17.53 6.62H14V3.09ZM8.27 18.27V16.45H15.73V18.27H8.27ZM8.27 14.64V12.82H15.73V14.64H8.27ZM8.27 11V9.18H15.73V11H8.27Z" />
    </svg>
    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white ring-1 ring-emerald-500/30" />
  </div>
);

export const GoogleSheetsIntegrationPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Form states
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [worksheetName, setWorksheetName] = useState('');
  const [headerRow, setHeaderRow] = useState<number>(1);
  const [dataStartRow, setDataStartRow] = useState<number>(2);

  // UI notifications and states
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Expandable guide state (defaults to collapsed)
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Preview data state
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewTotalColumns, setPreviewTotalColumns] = useState<number>(0);
  const [previewTotalRows, setPreviewTotalRows] = useState<number | null>(null);
  const [availableWorksheets, setAvailableWorksheets] = useState<WorksheetInfo[]>([]);

  // Stock Configuration records preview state
  const [stockRecords, setStockRecords] = useState<StockConfigurationRecord[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [missingExpected, setMissingExpected] = useState<string[]>([]);
  const [totalStockRecords, setTotalStockRecords] = useState<number>(0);
  const [isStockRecordsFetched, setIsStockRecordsFetched] = useState(false);

  // Fetch status
  const {
    data: statusData,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['google-sheets-status'],
    queryFn: googleSheetsApi.getStatus,
    staleTime: 10000,
  });

  // Populate form from status data when initially loaded or updated
  useEffect(() => {
    if (statusData) {
      if (statusData.spreadsheet_url) {
        setSpreadsheetUrl(statusData.spreadsheet_url);
      }
      if (statusData.spreadsheet_id) {
        setSpreadsheetId(statusData.spreadsheet_id);
      }
      if (statusData.worksheet_name) {
        setWorksheetName(statusData.worksheet_name);
      }
      if (statusData.header_row) {
        setHeaderRow(statusData.header_row);
      }
      if (statusData.data_start_row) {
        setDataStartRow(statusData.data_start_row);
      }
      if (statusData.worksheets && statusData.worksheets.length > 0) {
        setAvailableWorksheets(
          statusData.worksheets.map((name, index) => ({ name, index }))
        );
      }
    }
  }, [statusData]);

  // Handle URL change with auto-ID extraction
  const handleUrlChange = (value: string) => {
    setSpreadsheetUrl(value);
    setFormError(null);
    const extracted = extractSpreadsheetIdFromUrl(value);
    if (extracted) {
      setSpreadsheetId(extracted);
    }
  };

  // 1. Connect Mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setFormSuccess(null);
      const targetId = spreadsheetId || extractSpreadsheetIdFromUrl(spreadsheetUrl);
      if (!targetId && !spreadsheetUrl.trim()) {
        throw new Error('Please enter a Google Sheets URL or Spreadsheet ID.');
      }
      return await googleSheetsApi.connect({
        spreadsheet_url: spreadsheetUrl.trim() || undefined,
        spreadsheet_id: targetId || undefined,
      });
    },
    onSuccess: (data) => {
      setFormSuccess(`Connected successfully to "${data.spreadsheet_name || 'Spreadsheet'}".`);
      if (data.spreadsheet_id) {
        setSpreadsheetId(data.spreadsheet_id);
      }
      if (data.worksheets && data.worksheets.length > 0) {
        setAvailableWorksheets(
          data.worksheets.map((name, index) => ({ name, index }))
        );
        if (!worksheetName || !data.worksheets.includes(worksheetName)) {
          setWorksheetName(data.worksheets[0]);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
    onError: (err: any) => {
      setFormError(extractErrorText(err));
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
  });

  // 2. Test Connection Mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setFormSuccess(null);
      const targetId = spreadsheetId || extractSpreadsheetIdFromUrl(spreadsheetUrl);
      return await googleSheetsApi.testConnection({
        spreadsheet_id: targetId || undefined,
        spreadsheet_url: spreadsheetUrl.trim() || undefined,
        worksheet_name: worksheetName.trim() || undefined,
        header_row: headerRow,
      });
    },
    onSuccess: (data) => {
      setFormSuccess(data.message || 'Connection test successful!');
      if (data.worksheets && data.worksheets.length > 0) {
        setAvailableWorksheets(
          data.worksheets.map((name, index) => ({ name, index }))
        );
      }
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
    onError: (err: any) => {
      setFormError(extractErrorText(err));
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
  });

  // 3. Fetch Worksheets Mutation
  const worksheetsMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setFormSuccess(null);
      const targetId = spreadsheetId || extractSpreadsheetIdFromUrl(spreadsheetUrl);
      if (!targetId) {
        throw new Error('Please provide or connect a Spreadsheet first.');
      }
      return await googleSheetsApi.getWorksheets(targetId);
    },
    onSuccess: (data) => {
      setAvailableWorksheets(data.worksheets);
      setFormSuccess(`Fetched ${data.worksheets.length} worksheet(s) from "${data.spreadsheet_name}".`);
      if (data.worksheets.length > 0 && (!worksheetName || !data.worksheets.some(w => w.name === worksheetName))) {
        setWorksheetName(data.worksheets[0].name);
      }
    },
    onError: (err: any) => {
      setFormError(extractErrorText(err));
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
  });

  // 4. Preview Headers Mutation
  const headersMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setFormSuccess(null);
      const targetId = spreadsheetId || extractSpreadsheetIdFromUrl(spreadsheetUrl);
      if (!targetId) {
        throw new Error('Spreadsheet ID is required to preview headers.');
      }
      if (!worksheetName.trim()) {
        throw new Error('Please select or enter a Worksheet Name.');
      }
      if (headerRow < 1) {
        throw new Error('Header row must be 1 or greater.');
      }
      return await googleSheetsApi.getHeaders(worksheetName.trim(), headerRow, targetId);
    },
    onSuccess: (data) => {
      setPreviewHeaders(data.headers);
      setPreviewTotalColumns(data.total_columns);
      setPreviewTotalRows(data.total_rows ?? null);
      setFormSuccess(`Previewing ${data.headers.length} header columns from worksheet "${data.worksheet_name}".`);
    },
    onError: (err: any) => {
      setFormError(extractErrorText(err));
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
  });

  // 5. Save Configuration Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setFormSuccess(null);
      const targetId = spreadsheetId || extractSpreadsheetIdFromUrl(spreadsheetUrl);
      if (!targetId) {
        throw new Error('Spreadsheet ID is required.');
      }
      if (headerRow < 1) {
        throw new Error('Header row must be 1 or greater.');
      }
      if (dataStartRow <= headerRow) {
        throw new Error(`Data start row (${dataStartRow}) must be strictly greater than header row (${headerRow}).`);
      }
      const payload: GoogleSheetsConfigPayload = {
        spreadsheet_url: spreadsheetUrl.trim() || undefined,
        spreadsheet_id: targetId,
        spreadsheet_name: statusData?.spreadsheet_name || undefined,
        worksheet_name: worksheetName.trim() || undefined,
        header_row: headerRow,
        data_start_row: dataStartRow,
      };
      return await googleSheetsApi.saveConfiguration(payload);
    },
    onSuccess: () => {
      setFormSuccess('Google Sheets configuration saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
    onError: (err: any) => {
      setFormError(extractErrorText(err));
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
  });

  // 6. Disconnect Mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!window.confirm('Are you sure you want to disconnect this Google Sheet?')) {
        return null;
      }
      setFormError(null);
      setFormSuccess(null);
      return await googleSheetsApi.disconnect();
    },
    onSuccess: (data) => {
      if (data) {
        setFormSuccess('Google Sheets disconnected successfully.');
        setSpreadsheetUrl('');
        setSpreadsheetId('');
        setWorksheetName('');
        setHeaderRow(1);
        setDataStartRow(2);
        setPreviewHeaders([]);
        setAvailableWorksheets([]);
        queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
      }
    },
    onError: (err: any) => {
      setFormError(extractErrorText(err));
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
  });

  // Copy service account email to clipboard
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  // 7. Stock Records Preview Mutation
  const stockRecordsMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      setFormSuccess(null);
      const targetId = spreadsheetId || extractSpreadsheetIdFromUrl(spreadsheetUrl);
      if (!targetId) {
        throw new Error('Spreadsheet ID is required to fetch stock records.');
      }
      return await googleSheetsApi.getStockRecords({
        spreadsheet_id: targetId,
        worksheet_name: worksheetName || 'Stock Configuration',
        header_row: headerRow,
        data_start_row: dataStartRow,
        limit: 100,
      });
    },
    onSuccess: (data) => {
      setStockRecords(data.records);
      setColumnMapping(data.column_mapping);
      setUnmappedHeaders(data.unmapped_headers);
      setMissingExpected(data.missing_expected_headers);
      setTotalStockRecords(data.total_records);
      setIsStockRecordsFetched(true);
      setFormSuccess(`Fetched ${data.total_records} record(s) from "${data.worksheet_name}". Mapped ${Object.keys(data.column_mapping).length} field(s).`);
    },
    onError: (err: any) => {
      setFormError(extractErrorText(err));
      queryClient.invalidateQueries({ queryKey: ['google-sheets-status'] });
    },
  });

  const isAnyLoading =
    connectMutation.isPending ||
    testMutation.isPending ||
    worksheetsMutation.isPending ||
    headersMutation.isPending ||
    saveMutation.isPending ||
    disconnectMutation.isPending ||
    stockRecordsMutation.isPending;

  // Connection status classification
  const connectionStatus = statusData?.connection_status || 'not_connected';
  const isConnected = connectionStatus === 'connected';

  // Permission mode calculation (Section 7)
  const permissionMode = useMemo(() => {
    if (!isConnected) {
      return {
        label: 'Not Verified',
        badgeColor: 'bg-slate-100 text-slate-700 ring-slate-300',
        description: 'ATLAS has not successfully verified write permission.',
      };
    }
    if (statusData?.read_only === true) {
      return {
        label: 'Read Only',
        badgeColor: 'bg-blue-50 text-blue-700 ring-blue-500/30',
        description: 'ATLAS can view spreadsheet records but cannot update them.',
      };
    }
    return {
      label: 'Read & Write',
      badgeColor: 'bg-emerald-50 text-emerald-700 ring-emerald-500/30',
      description: 'ATLAS can view, add, and update permitted spreadsheet records.',
    };
  }, [isConnected, statusData]);

  // Connection diagnostic classification for Connection Preview (Section 3)
  const connectionDiagnostic = useMemo(() => {
    if (connectionStatus === 'connected') {
      return {
        statusText: 'Connection successful',
        badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-500/30',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
        hint: 'Spreadsheet connection is active and verified.',
      };
    }
    if (connectionStatus === 'worksheet_not_found') {
      return {
        statusText: 'Worksheet not found',
        badgeClass: 'bg-amber-50 text-amber-700 ring-amber-500/30',
        icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
        hint: 'The specified worksheet tab does not exist in this spreadsheet.',
      };
    }
    if (connectionStatus === 'not_connected' || connectionStatus === 'configuration_missing') {
      return {
        statusText: 'Configuration not saved',
        badgeClass: 'bg-slate-100 text-slate-600 ring-slate-300',
        icon: <Info className="h-3.5 w-3.5 text-slate-500" />,
        hint: 'Enter your spreadsheet link and click Save Configuration.',
      };
    }
    return {
      statusText: 'Connection failed',
      badgeClass: 'bg-rose-50 text-rose-700 ring-rose-500/30',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />,
      hint: statusData?.error_message || 'Please check service account sharing and spreadsheet link.',
    };
  }, [connectionStatus, statusData]);

  const statusBadge = useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Connected
          </span>
        );
      case 'api_not_enabled':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 ring-1 ring-purple-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-purple-600" />
            API Not Enabled
          </span>
        );
      case 'permission_denied':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Permission Denied
          </span>
        );
      case 'spreadsheet_not_found':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Spreadsheet Not Found
          </span>
        );
      case 'worksheet_not_found':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Worksheet Not Found
          </span>
        );
      case 'not_a_google_sheet':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/30">
            <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />
            Excel File (.xlsx) - Convert to Sheet
          </span>
        );
      case 'authentication_failed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            Authentication Failed
          </span>
        );
      case 'configuration_missing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-500/30">
            <TableProperties className="h-3.5 w-3.5 text-blue-600" />
            Configuration Missing
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            Connection Error
          </span>
        );
      case 'not_connected':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-300">
            <Unlink className="h-3.5 w-3.5 text-slate-500" />
            Not Connected
          </span>
        );
    }
  }, [connectionStatus]);

  // Steps definition for expandable guide (Section 6)
  const guideSteps = [
    { num: 1, title: 'Step 1: Create or open your Google Spreadsheet.' },
    { num: 2, title: 'Step 2: Share the spreadsheet with the ATLAS service account email.' },
    { num: 3, title: 'Step 3: Copy your Google Spreadsheet URL.' },
    { num: 4, title: 'Step 4: Paste the URL into Connection Configuration.' },
    { num: 5, title: 'Step 5: Select the Stock Configuration worksheet.' },
    { num: 6, title: 'Step 6: Set Header Row to 1 and Data Start Row to 2, if your sheet uses those rows.' },
    { num: 7, title: 'Step 7: Click Connect Google Sheet.' },
    { num: 8, title: 'Step 8: Click Test Connection.' },
    { num: 9, title: 'Step 9: Click Preview Headers.' },
    { num: 10, title: 'Step 10: Click Save Configuration.' },
    { num: 11, title: 'Step 11: Click Fetch Stock Records to verify your data.' },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ── Breadcrumb & Navigation Header ───────────────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-blue-600">
            <NavLink to="/settings" className="hover:underline">Settings</NavLink>
            <span className="text-slate-400">/</span>
            <span>Integrations</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-800">Google Sheets</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <h1 className="atlas-page-title text-[26px] sm:text-[30px] font-bold text-slate-900 leading-tight flex items-center gap-2.5">
              <GoogleSheetsLogo className="w-8 h-8 rounded-lg shrink-0" />
              <span>Google Sheets Integration</span>
            </h1>
            <span className="rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold px-2.5 py-0.5 whitespace-nowrap">
              Phase 1 Foundation
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Connect your Google Spreadsheet to ATLAS to display and manage Stock Configuration records.
          </p>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto shrink-0">
          <NavLink
            to="/settings"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
                isActive ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`
            }
          >
            <Users className="h-4 w-4 text-slate-500" />
            Users & Roles
          </NavLink>
          <NavLink
            to="/settings/integrations/google-sheets"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
                isActive ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`
            }
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Google Sheets
          </NavLink>
        </div>
      </div>

      {/* ── Expandable Step-by-Step Guide: How to Connect Google Sheets (Section 6) ── */}
      <div className="rounded-2xl border border-blue-200 bg-white shadow-md overflow-hidden transition">
        <button
          type="button"
          onClick={() => setIsGuideOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white hover:bg-blue-100/40 transition cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="rounded-xl bg-blue-600 text-white p-2.5 shrink-0 shadow-xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-blue-950">
                  How to Connect Google Sheets
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-200 text-blue-900">
                  Step-by-Step Instructions
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Clear 11-step walkthrough designed for non-technical users. Click to {isGuideOpen ? 'collapse' : 'view steps'}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold shrink-0 ml-2">
            <span>{isGuideOpen ? 'Collapse Guide' : 'View 11 Steps'}</span>
            {isGuideOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {isGuideOpen && (
          <div className="p-5 border-t border-blue-100 bg-slate-50/40 space-y-3.5 animate-in fade-in duration-150">
            <p className="text-xs text-slate-600 leading-relaxed">
              Follow these simple numbered steps in order to connect your spreadsheet without technical knowledge:
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {guideSteps.map((st) => (
                <div
                  key={st.num}
                  className="rounded-xl border border-slate-200 bg-white p-3 flex items-start gap-2.5 shadow-2xs hover:border-blue-300 transition"
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                    st.num === 11 ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}>
                    {st.num}
                  </span>
                  <div className="text-xs text-slate-700 font-medium leading-relaxed flex-1">
                    <span>{st.title}</span>
                    {st.num === 2 && statusData?.service_account_email && (
                      <div className="mt-2 flex items-center justify-between gap-2 p-2 rounded-lg bg-blue-50/80 border border-blue-200">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Service Account Email</span>
                          <span className="font-mono text-[11px] font-semibold text-blue-900 break-all select-all">
                            {statusData.service_account_email}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(statusData.service_account_email!)}
                          className="shrink-0 inline-flex items-center gap-1 rounded bg-white border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 transition shadow-2xs"
                          title="Copy Service Account Email"
                        >
                          {copiedEmail ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-blue-600" />}
                          <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Alerts & Notices ─────────────────────────────────────────────────── */}
      {formError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-800 shadow-xs animate-in fade-in duration-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-rose-900">Integration Notice</h4>
            <p className="mt-0.5 text-rose-700 leading-relaxed">{formError}</p>
          </div>
        </div>
      )}

      {formSuccess && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-800 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-emerald-900">Success</h4>
            <p className="mt-0.5 text-emerald-700 leading-relaxed">{formSuccess}</p>
          </div>
        </div>
      )}

      {/* ── API Not Enabled Alert Banner ─────────────────────────────────────── */}
      {statusData?.connection_status === 'api_not_enabled' && (
        <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 p-5 shadow-md animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-purple-600 text-white p-2.5 shrink-0 shadow-sm">
                <ExternalLink className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-purple-950 flex items-center gap-2">
                  Google Sheets API is Disabled in Google Cloud
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-semibold font-mono">
                    Project 767613266689
                  </span>
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-purple-900/90 leading-relaxed max-w-2xl">
                  Google Cloud reported: <em>{statusData.error_message || 'The Google Sheets API has not been used in project 767613266689 before or it is disabled.'}</em>
                </p>
                <div className="mt-2 text-xs text-purple-900/80">
                  <strong>Action Required:</strong> Click the button below to enable the API in Google Cloud Console. Once enabled, click <strong>Test Connection</strong>.
                </div>
              </div>
            </div>
            <a
              href={statusData?.activation_url || 'https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=767613266689'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Enable Google Sheets API</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* ── Permission Denied Alert Banner ────────────────────────────────────── */}
      {statusData?.connection_status === 'permission_denied' && (
        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-5 shadow-md animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-amber-600 text-white p-2.5 shrink-0 shadow-sm">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  Spreadsheet Permission Denied (HTTP 403)
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-amber-900/90 leading-relaxed max-w-2xl">
                  The Google Sheet is private or has not been shared with the ATLAS service account email.
                  Open your sheet in Google Sheets, click <strong>Share</strong>, and paste the email address below as a <strong>Viewer</strong>.
                </p>
              </div>
            </div>
            {statusData?.service_account_email && (
              <button
                type="button"
                onClick={() => handleCopyEmail(statusData.service_account_email!)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedEmail ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedEmail ? 'Email Copied!' : 'Copy Service Account Email'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Uploaded Excel (.xlsx) Detected Banner ─────────────────────────────── */}
      {statusData?.connection_status === 'not_a_google_sheet' && (
        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-5 shadow-md animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl bg-amber-600 text-white p-2.5 shrink-0 shadow-sm">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  Uploaded Excel File (.xlsx) Detected
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-amber-900 leading-relaxed max-w-2xl">
                  The document is currently an uploaded Microsoft Excel (.xlsx) file in Google Drive. Google Sheets API requires a native Google Spreadsheet to read and write rows.
                  <br />
                  <strong className="text-amber-950">Quick Fix:</strong> Open the spreadsheet in Google Sheets, click <strong>File → Save as Google Sheets</strong>, share the newly created Google Sheet with <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono font-semibold">{statusData?.service_account_email || 'atlas-google-sheets@gen-lang-client-0920050876.iam.gserviceaccount.com'}</code> as Editor, and update the URL in ATLAS.
                </p>
              </div>
            </div>
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Open in Google Sheets</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Integration Status Card (Section 1 & 7) ─────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <GoogleSheetsLogo className="w-12 h-12" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Google Sheets</h2>
                {statusBadge}
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Connect company spreadsheets with ATLAS for bi-directional inventory alignment.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => refetchStatus()}
              disabled={isStatusLoading || isAnyLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isStatusLoading ? 'animate-spin' : ''}`} />
              Refresh Status
            </button>
            {isConnected && (
              <button
                type="button"
                onClick={() => disconnectMutation.mutate()}
                disabled={isAnyLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
              >
                <Unlink className="h-3.5 w-3.5 text-rose-600" />
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Key Metrics / Attributes Grid */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Spreadsheet Name</span>
            <div className="mt-1 text-sm font-semibold text-slate-900 truncate" title={statusData?.spreadsheet_name || 'Not configured'}>
              {statusData?.spreadsheet_name || 'Not connected'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Spreadsheet ID</span>
            <div className="mt-1 font-mono text-xs font-semibold text-slate-800 truncate" title={statusData?.spreadsheet_id || ''}>
              {statusData?.spreadsheet_id ? maskSpreadsheetId(statusData.spreadsheet_id) : '—'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Worksheet</span>
            <div className="mt-1 text-sm font-semibold text-slate-900 truncate">
              {statusData?.worksheet_name || 'None selected'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Last Connection Check</span>
            <div className="mt-1 text-xs font-semibold text-slate-700 flex items-center gap-1.5 truncate">
              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {statusData?.last_tested_at ? new Date(statusData.last_tested_at).toLocaleString() : 'Never tested'}
            </div>
          </div>

          {/* Permission Mode Banner (Section 7) */}
          <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/60 to-slate-50 p-3.5 sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Spreadsheet Permission Mode</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${permissionMode.badgeColor}`}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {permissionMode.label}
                </span>
                <span className="text-xs text-slate-700 font-medium">
                  {permissionMode.description}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shrink-0">
              <strong className="text-slate-800">SAP Write Protection Active:</strong> Updates are saved directly to Google Sheets and never modify SAP Business One.
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout: Form & Preview ──────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Connection Configuration Form (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/20 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TableProperties className="h-4 w-4 text-blue-600" />
              Connection Configuration
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Enter your Google Spreadsheet link and select the worksheet that contains your stock records.
            </p>
          </div>

          <div className="space-y-4">
            {/* Field 1: Spreadsheet URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="spreadsheet-url" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Spreadsheet URL <span className="text-rose-500">*</span>
                </label>
              </div>
              <div className="relative">
                <input
                  id="spreadsheet-url"
                  type="text"
                  value={spreadsheetUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5n.../edit"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl.startsWith('http') ? spreadsheetUrl : `https://${spreadsheetUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 transition"
                    title="Open sheet in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-600 font-medium">
                Paste the full URL copied from your Google Spreadsheet.
              </p>
            </div>

            {/* Field 2: Extracted Spreadsheet ID */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="spreadsheet-id" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Extracted Spreadsheet ID
                </label>
                {spreadsheetId && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Auto-detected
                  </span>
                )}
              </div>
              <input
                id="spreadsheet-id"
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value.trim())}
                placeholder="Auto-extracted alphanumeric ID (e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
              <p className="mt-1 text-[11px] text-slate-600 font-medium">
                Automatically generated from your spreadsheet URL. No manual entry required.
              </p>
            </div>

            {/* Field 3: Worksheet Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="worksheet-name" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Worksheet Name <span className="text-rose-500">*</span>
                </label>
                {availableWorksheets.length > 0 && (
                  <span className="text-[11px] font-medium text-slate-500">
                    {availableWorksheets.length} tab(s) found
                  </span>
                )}
              </div>

              {availableWorksheets.length > 0 ? (
                <div className="flex gap-2">
                  <select
                    id="worksheet-name"
                    value={worksheetName}
                    onChange={(e) => setWorksheetName(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  >
                    <option value="">Select a worksheet tab...</option>
                    {availableWorksheets.map((ws) => (
                      <option key={ws.name} value={ws.name}>
                        {ws.name} {ws.row_count ? `(${ws.row_count} rows)` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => worksheetsMutation.mutate()}
                    disabled={isAnyLoading}
                    className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition cursor-pointer"
                    title="Reload worksheets from sheet"
                  >
                    <RefreshCw className={`h-4 w-4 ${worksheetsMutation.isPending ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="worksheet-name"
                    type="text"
                    value={worksheetName}
                    onChange={(e) => setWorksheetName(e.target.value)}
                    placeholder="e.g. Stock Configuration or Sheet1"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => worksheetsMutation.mutate()}
                    disabled={isAnyLoading || (!spreadsheetId && !spreadsheetUrl)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
                  >
                    <Layers className="h-4 w-4 text-blue-600" />
                    Fetch Tabs
                  </button>
                </div>
              )}
              <p className="mt-1 text-[11px] text-slate-600 font-medium">
                Select the worksheet tab containing your Stock Configuration data.
              </p>
            </div>

            {/* Fields 4 & 5: Header Row & Data Start Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="header-row" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Header Row (1-based)
                </label>
                <input
                  id="header-row"
                  type="number"
                  min="1"
                  value={headerRow}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1;
                    setHeaderRow(val);
                    if (dataStartRow <= val) {
                      setDataStartRow(val + 1);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
                <span className="text-[11px] text-slate-600 mt-1 block font-medium">
                  Enter the row number containing your column names. Usually row 1.
                </span>
              </div>

              <div>
                <label htmlFor="data-start-row" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Data Start Row
                </label>
                <input
                  id="data-start-row"
                  type="number"
                  min={headerRow + 1}
                  value={dataStartRow}
                  onChange={(e) => setDataStartRow(parseInt(e.target.value, 10) || (headerRow + 1))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
                <span className="text-[11px] text-slate-600 mt-1 block font-medium">
                  Enter the row number where your actual stock records begin. Usually row 2.
                </span>
              </div>
            </div>
          </div>

          {/* Form Action Buttons Bar */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Primary: Connect */}
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={isAnyLoading || (!spreadsheetUrl && !spreadsheetId)}
                title="Connect ATLAS to your selected spreadsheet."
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Connect Google Sheet
              </button>

              {/* Test Connection */}
              <button
                type="button"
                onClick={() => testMutation.mutate()}
                disabled={isAnyLoading || (!spreadsheetId && !spreadsheetUrl)}
                title="Check whether ATLAS can access your spreadsheet."
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-slate-500" />
                )}
                Test Connection
              </button>

              {/* Preview Headers */}
              <button
                type="button"
                onClick={() => headersMutation.mutate()}
                disabled={isAnyLoading || (!spreadsheetId && !spreadsheetUrl) || !worksheetName}
                title="Check whether ATLAS recognizes your spreadsheet columns."
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                {headersMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-500" />
                )}
                Preview Headers
              </button>

              {/* Save Configuration */}
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={isAnyLoading || !spreadsheetId}
                title="Save this spreadsheet as the active Stock Configuration source."
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition cursor-pointer ml-auto disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Configuration
              </button>
            </div>

            {/* Helper text description legend for buttons (Section 2) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <div className="leading-tight">
                <strong className="text-blue-700 font-semibold block">Connect Google Sheet:</strong>
                Connect ATLAS to your selected spreadsheet.
              </div>
              <div className="leading-tight">
                <strong className="text-slate-800 font-semibold block">Test Connection:</strong>
                Check whether ATLAS can access your spreadsheet.
              </div>
              <div className="leading-tight">
                <strong className="text-slate-800 font-semibold block">Preview Headers:</strong>
                Check whether ATLAS recognizes your spreadsheet columns.
              </div>
              <div className="leading-tight">
                <strong className="text-emerald-700 font-semibold block">Save Configuration:</strong>
                Save this spreadsheet as the active Stock Configuration source.
              </div>
            </div>
          </div>
        </div>

        {/* Connection Preview Card (5 cols) (Section 3 & 4) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/20 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Eye className="h-4 w-4 text-emerald-600" />
                Connection Preview
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                This section shows the spreadsheet information detected by ATLAS.
              </p>
            </div>
            {previewHeaders.length > 0 && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
                {previewTotalColumns} Columns
              </span>
            )}
          </div>

          {/* Connection Status Indicator Pill */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Connection Status:</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ${connectionDiagnostic.badgeClass}`}>
                {connectionDiagnostic.icon}
                {connectionDiagnostic.statusText}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {connectionDiagnostic.hint}
            </p>
          </div>

          {/* Metadata Overview */}
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Spreadsheet Name:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={statusData?.spreadsheet_name || '—'}>
                  {statusData?.spreadsheet_name || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Spreadsheet ID:</span>
                <span className="font-mono text-slate-800">
                  {statusData?.spreadsheet_id ? maskSpreadsheetId(statusData.spreadsheet_id) : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Selected Worksheet:</span>
                <span className="font-semibold text-blue-700">
                  {worksheetName || statusData?.worksheet_name || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Last Connection Check:</span>
                <span className="font-medium text-slate-700">
                  {statusData?.last_tested_at ? new Date(statusData.last_tested_at).toLocaleString() : 'Never tested'}
                </span>
              </div>
              {previewTotalRows !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Total Worksheet Rows:</span>
                  <span className="font-semibold text-slate-900">
                    {previewTotalRows.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Available Worksheets Tags */}
            {availableWorksheets.length > 0 && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Available Worksheets ({availableWorksheets.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableWorksheets.map((ws) => (
                    <button
                      key={ws.name}
                      type="button"
                      onClick={() => setWorksheetName(ws.name)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        worksheetName === ws.name
                          ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Layers className="h-3 w-3" />
                      {ws.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Column Headers Section (Section 4) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Column Headers Preview
                  </span>
                  {previewHeaders.length > 0 && (
                    <span className="text-[11px] text-slate-500 font-medium">Row {headerRow}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  ATLAS checks your spreadsheet column names and matches them with Stock Configuration fields.
                </p>
              </div>

              {/* Column Matching Summary Stats (Section 4) */}
              {previewHeaders.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Matched Fields</span>
                    <span className="text-xs font-bold text-emerald-700">
                      {isStockRecordsFetched ? `${Object.keys(columnMapping).length} / 22` : `${previewHeaders.length} Detected`}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Expected Fields</span>
                    <span className="text-xs font-bold text-slate-800">22</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Unmapped Columns</span>
                    <span className="text-xs font-semibold text-slate-700">
                      {isStockRecordsFetched ? unmappedHeaders.length : 0}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Missing Required</span>
                    <span className="text-xs font-semibold text-slate-700">
                      {isStockRecordsFetched ? missingExpected.length : 0}
                    </span>
                  </div>
                </div>
              )}

              {previewHeaders.length > 0 ? (
                <div className="space-y-3">
                  {/* Badge list */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                    {previewHeaders.map((hdr, idx) => (
                      <span
                        key={`${hdr}-${idx}`}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800"
                        title={`Column ${idx + 1}`}
                      >
                        <span className="text-[10px] text-slate-600 font-mono">#{idx + 1}</span>
                        {hdr || <em className="text-slate-600 font-normal">Blank</em>}
                      </span>
                    ))}
                  </div>

                  {/* Header Preview Table */}
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="max-h-48 overflow-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold sticky top-0">
                          <tr>
                            <th className="px-3 py-2 w-16">Col #</th>
                            <th className="px-3 py-2">Header Name</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {previewHeaders.map((hdr, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-1.5 font-mono text-slate-600 font-medium">{idx + 1}</td>
                              <td className="px-3 py-1.5 font-medium text-slate-900">{hdr || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <TableProperties className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-xs font-medium text-slate-700">No header preview yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    Connect a sheet and click <strong>Preview Headers</strong> to view the mapped columns.
                  </p>
                </div>
              )}
            </div>

            {/* Privacy & Safety Note */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-[11.5px] text-emerald-800 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Phase 1 Security:</strong> Only column headers and structure metadata are previewed. Confidential row data is never transmitted or synchronized during Phase 1.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stock Configuration Sheet Data Preview Section (Section 5) ──────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                Stock Configuration Sheet Data Preview
              </h3>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
                Verified Live Source
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Preview the actual records ATLAS retrieves from your selected Google Spreadsheet before using them in the Stock Configuration page.
            </p>
          </div>

          <button
            type="button"
            onClick={() => stockRecordsMutation.mutate()}
            disabled={isAnyLoading || stockRecordsMutation.isPending || (!spreadsheetId && !spreadsheetUrl)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            {stockRecordsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>Fetch Stock Records</span>
          </button>
        </div>

        {/* Clear source notice message (Section 5) */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2 text-xs text-blue-900 flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            These records are fetched from your connected Google Spreadsheet.
          </span>
        </div>

        {/* Dynamic Column Mapping Summary */}
        {isStockRecordsFetched && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Records Found</span>
                <div className="mt-1 text-lg font-bold text-slate-900">{totalStockRecords}</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Matched Expected Fields</span>
                <div className="mt-1 text-lg font-bold text-emerald-800">{Object.keys(columnMapping).length} / 22</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Unmapped Columns</span>
                <div className="mt-1 text-sm font-semibold text-slate-700">{unmappedHeaders.length} unmapped</div>
              </div>
            </div>

            {missingExpected.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
                <span className="font-bold">Missing optional fields ({missingExpected.length}):</span>{' '}
                <span className="font-mono text-[11px]">{missingExpected.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {/* Data Preview Table */}
        {stockRecordsMutation.isPending ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 p-12 text-center">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-800">Fetching records from Google Sheets...</p>
            <p className="text-xs text-slate-500 mt-1">Reading data rows and mapping columns in real-time.</p>
          </div>
        ) : isStockRecordsFetched && stockRecords.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Showing first {Math.min(10, stockRecords.length)} records:</span>
              <span className="font-medium text-emerald-700">Live spreadsheet synchronization ready</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-96 overflow-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Record ID</th>
                      <th className="px-3 py-2">SAP Item Code</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3 py-2 text-right">Stock Qty</th>
                      <th className="px-3 py-2">Vendor Name</th>
                      <th className="px-3 py-2">GRPO No</th>
                      <th className="px-3 py-2 text-right">Rcvd Qty</th>
                      <th className="px-3 py-2 text-right">Net Wt</th>
                      <th className="px-3 py-2 text-center">QC</th>
                      <th className="px-3 py-2 text-center">DRW</th>
                      <th className="px-3 py-2 text-center">V Chk</th>
                      <th className="px-3 py-2 text-right">OK Qty</th>
                      <th className="px-3 py-2 text-right">Rej Qty</th>
                      <th className="px-3 py-2 text-center">MC/PT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {stockRecords.slice(0, 10).map((r, i) => (
                      <tr key={r.record_id || r.item_code || i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-blue-600">{r.record_id || '—'}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{r.item_code || '—'}</td>
                        <td className="px-3 py-2 max-w-xs truncate text-slate-700" title={r.description || ''}>{r.description || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-slate-900">{r.qty ?? 0}</td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-slate-900">{r.stock_qty ?? 0}</td>
                        <td className="px-3 py-2 text-slate-700">{r.vendor_name || '—'}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{r.grpo_no || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900">{r.rcvd_qty ?? 0}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900">{r.nt_weight ?? 0}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${r.qc ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            {r.qc ? 'PASS' : 'NO'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono">{r.drw_yn || '—'}</td>
                        <td className="px-3 py-2 text-center font-mono">{r.v_chk || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700 font-semibold">{r.ok_qty ?? 0}</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-700 font-semibold">{r.rej_qty ?? 0}</td>
                        <td className="px-3 py-2 text-center font-mono">{r.mc_or_pt || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <FileSpreadsheet className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-700">No stock records previewed yet</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
              Click <strong>Fetch Stock Records</strong> above to query the connected worksheet and verify dynamic column mapping against the 22 Stock Configuration fields.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleSheetsIntegrationPage;
