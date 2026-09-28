import { useMutation, useQuery } from '@tanstack/react-query';
import {
    AlertCircle,
    ArrowRight,
    BarChart3,
    CalendarDays,
    ChevronDown,
    Download,
    FileText,
    FileUp,
    PackageSearch,
    RefreshCw,
    ShieldAlert,
    ShoppingCart,
    TrendingUp,
    Warehouse,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppSelector } from '../app/hooks';
import {
    exportOperatorReport,
    exportReport,
    getAdminBranches,
    getOperatorReportPreview,
    getReportPreview,
} from '../services/api';
import type { DateRange, ReportPreviewData } from '../types';

type ReportType = 'sales' | 'invoice' | 'payment' | 'inventory' | 'low-stock' | 'returns';
type RangeKey = DateRange;
type OutputFormat = 'csv' | 'xlsx';

type RecentReport = {
  id: string;
  name: string;
  type: string;
  period: string;
  createdAt: string;
  requestedBy: string;
  format: OutputFormat;
  status: 'Completed';
};

const REPORTS: Array<{
  id: ReportType;
  label: string;
  description: string;
  icon: typeof ShoppingCart;
  supported: boolean;
}> = [
  { id: 'sales', label: 'Sales Report', description: 'Sales summary, items, customers', icon: ShoppingCart, supported: true },
  { id: 'invoice', label: 'Invoice Report', description: 'Invoice details and totals', icon: FileText, supported: true },
  { id: 'payment', label: 'Payment Report', description: 'Payment methods and totals', icon: TrendingUp, supported: true },
  { id: 'inventory', label: 'Inventory Report', description: 'Stock levels and movements', icon: PackageSearch, supported: false },
  { id: 'low-stock', label: 'Low Stock Report', description: 'Items below minimum stock', icon: ShieldAlert, supported: false },
  { id: 'returns', label: 'Returns Report', description: 'Returns and approvals summary', icon: RefreshCw, supported: false },
];

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: 'monthly', label: 'This month' },
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This week' },
  { value: 'yearly', label: 'This year' },
  { value: 'all_time', label: 'All time' },
];

const STORAGE_KEY = 'pos_recent_reports_v1';

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);

const readRecentReports = (): RecentReport[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [
        {
          id: 'seed-1',
          name: 'Sales Summary Report',
          type: 'Sales',
          period: 'This month',
          createdAt: formatDate(new Date()),
          requestedBy: 'System',
          format: 'xlsx',
          status: 'Completed',
        },
        {
          id: 'seed-2',
          name: 'Invoice Detail Report',
          type: 'Invoice',
          period: 'This month',
          createdAt: formatDate(new Date(Date.now() - 86400000)),
          requestedBy: 'System',
          format: 'csv',
          status: 'Completed',
        },
      ] as RecentReport[];
    }
    return JSON.parse(raw) as RecentReport[];
  } catch {
    return [];
  }
};

const writeRecentReports = (items: RecentReport[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 6)));
};

const ReportsPage = () => {
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const [selectedReport, setSelectedReport] = useState<ReportType>('sales');
  const [range, setRange] = useState<RangeKey>('monthly');
  const [branch, setBranch] = useState(user?.branch_id || 'WH-001');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('csv');
  const [groupBy, setGroupBy] = useState('Date (Daily)');
  const [salesType, setSalesType] = useState('All Sales');
  const [paymentMethod, setPaymentMethod] = useState('All Payment Methods');
  const [showValidation, setShowValidation] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<RecentReport[]>(readRecentReports);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const selectedMeta = REPORTS.find((item) => item.id === selectedReport) ?? REPORTS[0];
  const dateRangeLabel = RANGE_OPTIONS.find((item) => item.value === range)?.label ?? 'Custom';
  const isSalesReportSupported = ['sales', 'invoice', 'payment'].includes(selectedReport);
  const hasReverseDateRange = !!fromDate && !!toDate && new Date(fromDate) > new Date(toDate);

  const reportTypeOptions = useMemo(
    () => [
      { value: 'sales', label: 'Sales Report' },
      { value: 'invoice', label: 'Invoice Report' },
      { value: 'payment', label: 'Payment Report' },
      { value: 'inventory', label: 'Inventory Report' },
      { value: 'low-stock', label: 'Low Stock Report' },
      { value: 'returns', label: 'Returns Report' },
    ],
    [],
  );

  const { data: branches = [] } = useQuery({
    queryKey: ['admin-branches'],
    queryFn: getAdminBranches,
    staleTime: 5 * 60_000,
    enabled: isAdmin,
  });

  const exportReportMutation = useMutation({
    mutationFn: async () => {
      if (!isSalesReportSupported) {
        throw new Error('This report type is not supported by the current backend contract.');
      }

      if (hasReverseDateRange) {
        throw new Error('The end date must be later than or equal to the start date.');
      }

      const normalizedRange = range || 'monthly';
      const reportName = selectedReport === 'invoice' ? 'invoice' : selectedReport === 'payment' ? 'payment' : 'sales';

      if (isAdmin) {
        await exportReport(normalizedRange, outputFormat, branch || undefined, fromDate || undefined, toDate || undefined, selectedReport);
        return { filename: `${reportName}_report_${normalizedRange}_${new Date().toISOString().slice(0, 10)}.${outputFormat}` };
      }

      await exportOperatorReport(normalizedRange, fromDate || undefined, toDate || undefined, selectedReport);
      return { filename: `${reportName}_report_${normalizedRange}_${new Date().toISOString().slice(0, 10)}.xlsx` };
    },
    onSuccess: () => {
      setExportNotice(null);
      const reportLabel = selectedReport === 'invoice' ? 'Invoice Summary Report' : selectedReport === 'payment' ? 'Payment Summary Report' : 'Sales Summary Report';
      const reportTypeLabel = selectedReport === 'invoice' ? 'Invoice' : selectedReport === 'payment' ? 'Payment' : 'Sales';
      const newEntry: RecentReport = {
        id: `report-${Date.now()}`,
        name: reportLabel,
        type: reportTypeLabel,
        period: fromDate && toDate ? `${fromDate} - ${toDate}` : dateRangeLabel,
        createdAt: formatDate(new Date()),
        requestedBy: user?.name || 'System',
        format: outputFormat,
        status: 'Completed',
      };

      setRecentReports((previous) => {
        const next = [newEntry, ...previous.filter((item) => item.id !== newEntry.id)].slice(0, 6);
        writeRecentReports(next);
        return next;
      });
      setShowValidation(null);
      setExportNotice(`Report exported successfully as ${outputFormat.toUpperCase()}.`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'The report could not be generated.';
      setShowValidation(message);
      setExportNotice(null);
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!isSalesReportSupported) {
        throw new Error('This report type is not available through the current backend contract.');
      }

      if (hasReverseDateRange) {
        throw new Error('The end date must be later than or equal to the start date.');
      }

      if (isAdmin) {
        return getReportPreview(range, branch || undefined, fromDate || undefined, toDate || undefined, selectedReport);
      }

      return getOperatorReportPreview(range, fromDate || undefined, toDate || undefined, selectedReport);
    },
    onSuccess: () => {
      setShowValidation(null);
      setExportNotice(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'The report preview could not be generated.';
      setShowValidation(message);
    },
  });

  const handleGenerate = () => {
    setShowValidation(null);
    if (!isSalesReportSupported) {
      setShowValidation('This report type is not available through the current backend contract.');
      return;
    }
    if (hasReverseDateRange) {
      setShowValidation('The end date must be the same as or later than the start date.');
      return;
    }
    exportReportMutation.mutate();
  };

  const handlePreview = () => {
    setShowValidation(null);
    if (!isSalesReportSupported) {
      setShowValidation('This report type is not available through the current backend contract.');
      return;
    }
    if (hasReverseDateRange) {
      setShowValidation('The end date must be the same as or later than the start date.');
      return;
    }
    previewMutation.mutate();
  };

  const previewData = previewMutation.data as ReportPreviewData | undefined;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 text-slate-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white">Reports & Exports</h1>
          <p className="mt-1 text-sm text-slate-300">Generate and download operational reports for your business</p>
        </div>

        <div className="flex items-center gap-3 self-end rounded-xl border border-sky-800 bg-[#0a2744] px-3 py-2 text-sm text-sky-100 shadow-sm">
          <CalendarDays className="h-4 w-4 text-sky-300" />
          <span>{dateRangeLabel}</span>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-sky-900/80 bg-[#061f39] p-4 shadow-[0_0_0_1px_rgba(59,130,246,0.05)] md:grid-cols-3 xl:grid-cols-[1.3fr_1.3fr_1.3fr_auto]">
        <div className="rounded-xl border border-sky-800 bg-[#0a2744] p-3">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Date Range</label>
          <div className="flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-3 py-2 text-sm text-slate-100">
            <CalendarDays className="h-4 w-4 text-sky-300" />
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as RangeKey)}
              className="w-full bg-transparent text-sm text-slate-100 outline-none"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#071d34] text-slate-200">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-sky-800 bg-[#0a2744] p-3">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Branch</label>
          <div className="flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-3 py-2 text-sm text-slate-100">
            <Warehouse className="h-4 w-4 text-sky-300" />
            <select
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              disabled={!isAdmin}
              className="w-full bg-transparent text-sm text-slate-100 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {branches.length > 0 ? (
                branches.map((item) => (
                  <option key={item.id} value={item.id} className="bg-[#071d34]">
                    {item.name} ({item.id})
                  </option>
                ))
              ) : (
                <>
                  <option value="WH-001" className="bg-[#071d34]">Main Branch (WH-001)</option>
                  <option value="WH-002" className="bg-[#071d34]">North Branch (WH-002)</option>
                  <option value="WH-003" className="bg-[#071d34]">South Branch (WH-003)</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-sky-800 bg-[#0a2744] p-3">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Report Type</label>
          <div className="flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-3 py-2 text-sm text-slate-100">
            <FileUp className="h-4 w-4 text-sky-300" />
            <select
              value={selectedReport}
              onChange={(event) => setSelectedReport(event.target.value as ReportType)}
              className="w-full bg-transparent text-sm text-slate-100 outline-none"
            >
              {reportTypeOptions.map((item) => (
                <option key={item.value} value={item.value} className="bg-[#071d34]">
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={exportReportMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-sky-800"
        >
          <Download className="h-4 w-4" />
          {exportReportMutation.isPending ? 'Exporting...' : 'Export'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_320px]">
        <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-sky-200">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Report Builder</h2>
              <p className="text-sm text-slate-400">Select a report type and configure the parameters below.</p>
            </div>
          </div>

          <div className="mt-2 inline-flex items-center rounded-full border border-sky-800 bg-[#0a2744] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
            {selectedMeta.supported ? 'Backend supported' : 'Currently unavailable'}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {REPORTS.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedReport === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedReport(item.id)}
                  className={[
                    'flex min-h-[118px] flex-col items-start justify-between rounded-xl border p-4 text-left transition',
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 shadow-sm shadow-blue-900/20'
                      : 'border-sky-800 bg-[#0a2744] hover:border-sky-700',
                    !item.supported ? 'opacity-80' : '',
                  ].join(' ')}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0d2f4e] text-sky-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 w-full">
                    <div className="text-lg font-semibold text-white">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-sky-800 bg-[#0a2744] p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Report Period</label>
              <div className="flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-3 py-2">
                <CalendarDays className="h-4 w-4 text-sky-300" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none"
                />
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                <span>to</span>
                <div className="h-px flex-1 bg-sky-800" />
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-3 py-2">
                <CalendarDays className="h-4 w-4 text-sky-300" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-sky-800 bg-[#0a2744] p-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Group By</label>
                <div className="flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-3 py-2">
                  <BarChart3 className="h-4 w-4 text-sky-300" />
                  <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)} className="w-full bg-transparent text-sm text-slate-100 outline-none">
                    <option value="Date (Daily)" className="bg-[#071d34]">Date (Daily)</option>
                    <option value="Branch" className="bg-[#071d34]">Branch</option>
                    <option value="Customer" className="bg-[#071d34]">Customer</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-sky-300" />
                </div>
              </div>

              <div className="rounded-xl border border-sky-800 bg-[#0a2744] p-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Sales Type</label>
                <div className="flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-3 py-2">
                  <ShoppingCart className="h-4 w-4 text-sky-300" />
                  <select value={salesType} onChange={(event) => setSalesType(event.target.value)} className="w-full bg-transparent text-sm text-slate-100 outline-none">
                    <option value="All Sales" className="bg-[#071d34]">All Sales</option>
                    <option value="Cash" className="bg-[#071d34]">Cash</option>
                    <option value="Card" className="bg-[#071d34]">Card</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-sky-300" />
                </div>
              </div>

              <div className="rounded-xl border border-sky-800 bg-[#0a2744] p-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Payment Method</label>
                <div className="flex items-center gap-2 rounded-lg bg-[#0d2f4e] px-3 py-2">
                  <TrendingUp className="h-4 w-4 text-sky-300" />
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="w-full bg-transparent text-sm text-slate-100 outline-none">
                    <option value="All Payment Methods" className="bg-[#071d34]">All Payment Methods</option>
                    <option value="Cash" className="bg-[#071d34]">Cash</option>
                    <option value="Card" className="bg-[#071d34]">Card</option>
                    <option value="Bank Transfer" className="bg-[#071d34]">Bank Transfer</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-sky-300" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-sky-800 bg-[#0a2744] p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <label className="flex items-center gap-2 rounded-md border border-sky-800 bg-[#0d2f4e] px-2 py-1.5">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-500" />
                <span>Include summary row and totals</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border border-sky-800 bg-[#0d2f4e] px-2 py-1.5">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-500" />
                <span>Add grand total and summary information</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-md border border-sky-800 bg-[#0d2f4e] px-2 py-1.5 text-sm text-slate-300">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-500" />
                CSV
              </label>
              <label className="flex items-center gap-2 rounded-md border border-sky-800 bg-[#0d2f4e] px-2 py-1.5 text-sm text-slate-300">
                <input type="checkbox" checked={outputFormat === 'xlsx'} onChange={() => setOutputFormat((current) => (current === 'csv' ? 'xlsx' : 'csv'))} className="h-4 w-4 accent-blue-500" />
                XLSX
              </label>
            </div>
          </div>

          {showValidation && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{showValidation}</span>
            </div>
          )}

          {exportNotice && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <Download className="mt-0.5 h-4 w-4" />
              <span>{exportNotice}</span>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-800 bg-[#0a2744] px-5 py-3 text-base font-semibold text-sky-100 shadow-sm transition hover:border-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FileText className="h-4 w-4" />
              {previewMutation.isPending ? 'Previewing...' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={exportReportMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-sky-800"
            >
              <ArrowRight className="h-4 w-4" />
              {exportReportMutation.isPending ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <h3 className="mb-4 text-xl font-bold text-white">About Reports</h3>
            <ul className="space-y-3 text-sm text-slate-300">
              {[
                'Reports show data based on your access level and branch permissions.',
                'Real-time and historical data are refreshed from the active backend contract.',
                'Multi-format export is available for supported sales report data.',
                'Branch-wide data filtering is only applied when permitted by the backend.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/15 text-blue-200">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
            <h3 className="mb-4 text-xl font-bold text-white">Quick Reports</h3>
            <div className="space-y-2">
              {[
                'Today\'s Sales Summary',
                'This Week\'s Sales',
                'Top Selling Products',
                'Low Stock Items',
                'Pending Return Requests',
                'Customer Wise Sales',
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedReport('sales')}
                  className="flex w-full items-center justify-between rounded-lg border border-sky-800 bg-[#0a2744] px-3 py-2 text-sm text-slate-200 transition hover:border-sky-700"
                >
                  <span>{label}</span>
                  <ArrowRight className="h-4 w-4 text-sky-300" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {previewData && (
        <section className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Preview</h3>
              <p className="text-sm text-slate-400">Rows: {previewData.rows.length} · Total: ₹{previewData.totals.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-sky-800">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="bg-[#0a2744] text-xs uppercase tracking-[0.18em] text-sky-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Doc #</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Mobile</th>
                  <th className="px-4 py-3 font-medium">Sales Employee</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                  <th className="px-4 py-3 font-medium text-right">Discount</th>
                  <th className="px-4 py-3 font-medium text-right">GST</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {previewData.rows.slice(0, 8).map((row, index) => (
                  <tr key={`${row.docNum}-${index}`} className="border-t border-sky-800 bg-[#081d34] hover:bg-[#0a2744]">
                    <td className="px-4 py-3 font-medium text-slate-100">{row.docNum}</td>
                    <td className="px-4 py-3 text-slate-300">{row.date}</td>
                    <td className="px-4 py-3 text-slate-200">{row.customer || '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{row.mobile || '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{row.salesEmployee || '-'}</td>
                    <td className="px-4 py-3 text-slate-300 capitalize">{row.paymentMethod || 'unknown'}</td>
                    <td className="px-4 py-3 text-right text-slate-200">₹{row.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-slate-200">₹{row.discount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-slate-200">₹{row.gst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-300">₹{row.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-sky-900/80 bg-[#061f39] p-5 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Recent Reports</h3>
            <p className="text-sm text-slate-400">View and download previously generated reports.</p>
          </div>
          <button type="button" className="rounded-lg border border-sky-800 bg-[#0a2744] px-3 py-1.5 text-sm font-medium text-sky-200 hover:border-sky-700">
            View all
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-sky-800">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="bg-[#0a2744] text-xs uppercase tracking-[0.18em] text-sky-200">
              <tr>
                <th className="px-4 py-3 font-medium">Report Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Created Date</th>
                <th className="px-4 py-3 font-medium">Requested By</th>
                <th className="px-4 py-3 font-medium">Format</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.map((report) => (
                <tr key={report.id} className="border-t border-sky-800 bg-[#081d34] hover:bg-[#0a2744]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-200">
                        {report.type === 'Sales' ? <ShoppingCart className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <span className="font-medium text-slate-100">{report.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{report.type}</td>
                  <td className="px-4 py-3">{report.period}</td>
                  <td className="px-4 py-3">{report.createdAt}</td>
                  <td className="px-4 py-3">{report.requestedBy}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">{report.format.toUpperCase()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">{report.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="rounded-md border border-sky-800 bg-[#0d2f4e] p-2 text-sky-200 hover:border-sky-700">
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ReportsPage;
