import { useMutation } from '@tanstack/react-query';
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
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type ReportType = 'sales' | 'invoice' | 'payment' | 'inventory' | 'low-stock' | 'returns';
type RangeKey = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
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
  { value: 'monthly', label: 'Nov 1, 2024 - Nov 30, 2024' },
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'This week' },
  { value: 'yearly', label: 'This year' },
  { value: 'all_time', label: 'All time' },
];

const STORAGE_KEY = 'atlas_recent_reports_v1';

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
          period: 'Nov 1, 2024 - Nov 30, 2024',
          createdAt: 'Nov 30, 2024 10:24 AM',
          requestedBy: 'Admin User',
          format: 'xlsx',
          status: 'Completed',
        },
        {
          id: 'seed-2',
          name: 'Invoice Detail Report',
          type: 'Invoice',
          period: 'Nov 1, 2024 - Nov 30, 2024',
          createdAt: 'Nov 29, 2024 04:18 PM',
          requestedBy: 'Admin User',
          format: 'pdf',
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

export const ReportsPage = () => {
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState<ReportType>('sales');
  const [range, setRange] = useState<RangeKey>('monthly');
  const [branch, setBranch] = useState(user?.branch_id || 'WH-001');
  const [outputFormat, setOutputFormat] = useState<'csv' | 'xlsx'>('csv');
  const [groupBy, setGroupBy] = useState('Date (Daily)');
  const [salesType, setSalesType] = useState('All Sales');
  const [paymentMethod, setPaymentMethod] = useState('All Payment Methods');
  const [showValidation, setShowValidation] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [recentReports, setRecentReports] = useState<RecentReport[]>(readRecentReports);
  const [fromDate, setFromDate] = useState('2024-11-01');
  const [toDate, setToDate] = useState('2024-11-30');

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const selectedMeta = REPORTS.find((item) => item.id === selectedReport) ?? REPORTS[0];
  const dateRangeLabel = RANGE_OPTIONS.find((item) => item.value === range)?.label ?? 'Custom';

  const isSelectedReportSupported = ['sales', 'invoice', 'payment'].includes(selectedReport);

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
    []
  );

  const exportReport = useMutation({
    mutationFn: async () => {
      if (!isSelectedReportSupported) {
        throw new Error('This report type is not supported by the current backend contract.');
      }

      if (hasReverseDateRange) {
        throw new Error('The end date must be later than or equal to the start date.');
      }

      const endpoint = isAdmin ? '/admin/reports/export' : '/dashboard/reports/export';
      const params: Record<string, string | undefined> = {
        range,
        report_type: selectedReport,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        format: outputFormat,
      };

      if (isAdmin) {
        params.branch = branch || undefined;
      }

      const response = await apiClient.get(endpoint, {
        params,
        responseType: 'blob',
      });

      const contentDisposition = response.headers['content-disposition'] || '';
      const filenameFromHeader = contentDisposition
        .split('filename=')[1]
        ?.replace(/"/g, '')
        .replace(/;.*$/, '') || `report_${Date.now()}.${outputFormat}`;

      const contentTypeHeader = Array.isArray(response.headers['content-type'])
        ? response.headers['content-type'][0]
        : response.headers['content-type'];
      const normalizedContentType = typeof contentTypeHeader === 'string' && contentTypeHeader.length > 0
        ? contentTypeHeader
        : 'application/octet-stream';

      const blob = new Blob([response.data], {
        type: normalizedContentType,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFromHeader;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return {
        filename: filenameFromHeader,
      };
    },
    onSuccess: () => {
      setExportNotice(null);
      const newEntry: RecentReport = {
        id: `report-${Date.now()}`,
        name: 'Sales Summary Report',
        type: 'Sales',
        period: `${fromDate || 'N/A'} - ${toDate || 'N/A'}`,
        createdAt: formatDate(new Date()),
        requestedBy: user?.name || 'Admin User',
        format: outputFormat,
        status: 'Completed',
      };
      const next = [newEntry, ...recentReports.filter((item) => item.id !== newEntry.id)].slice(0, 6);
      setRecentReports(next);
      writeRecentReports(next);
      setShowValidation(null);
      setExportNotice(`Report exported successfully as ${outputFormat.toUpperCase()}.`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'The report could not be generated.';
      setShowValidation(message);
      setExportNotice(null);
    },
  });

  const handleGenerate = () => {
    setShowValidation(null);
    if (!isSelectedReportSupported) {
      setShowValidation('This report type is not available through the current backend contract.');
      return;
    }
    if (hasReverseDateRange) {
      setShowValidation('The end date must be the same as or later than the start date.');
      return;
    }
    exportReport.mutate();
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 text-slate-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Reports & Exports</h1>
          <p className="mt-1 text-sm text-slate-600">Generate and download operational reports for your business</p>
        </div>

        <div className="flex items-center gap-3 self-end rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          <span>{dateRangeLabel}</span>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-[1.3fr_1.3fr_1.3fr_auto]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Date Range</label>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-100">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as RangeKey)}
              className="w-full bg-transparent text-sm text-slate-100 outline-none"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-50 text-slate-200">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Branch</label>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-100">
            <Warehouse className="h-4 w-4 text-blue-600" />
            <select
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              disabled={!isAdmin}
              className="w-full bg-transparent text-sm text-slate-100 outline-none disabled:cursor-not-allowed"
            >
              <option value="WH-001" className="bg-slate-50">Main Branch (WH-001)</option>
              <option value="WH-002" className="bg-slate-50">North Branch (WH-002)</option>
              <option value="WH-003" className="bg-slate-50">South Branch (WH-003)</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Report Type</label>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-100">
            <FileUp className="h-4 w-4 text-blue-600" />
            <select
              value={selectedReport}
              onChange={(event) => setSelectedReport(event.target.value as ReportType)}
              className="w-full bg-transparent text-sm text-slate-100 outline-none"
            >
              {reportTypeOptions.map((item) => (
                <option key={item.value} value={item.value} className="bg-slate-50">
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={exportReport.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {exportReport.isPending ? 'Exporting...' : 'Export'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-slate-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Report Builder</h2>
              <p className="text-sm text-slate-500">Select a report type and configure the parameters below.</p>
            </div>
          </div>

          <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
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
                      : 'border-slate-200 bg-slate-50 hover:border-slate-200',
                    !item.supported ? 'opacity-80' : '',
                  ].join(' ')}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 w-full">
                    <div className="text-lg font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Report Period</label>
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none"
                />
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <span>to</span>
                <div className="h-px flex-1 bg-sky-800" />
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Group By</label>
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)} className="w-full bg-transparent text-sm text-slate-100 outline-none">
                    <option value="Date (Daily)" className="bg-slate-50">Date (Daily)</option>
                    <option value="Branch" className="bg-slate-50">Branch</option>
                    <option value="Customer" className="bg-slate-50">Customer</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Sales Type</label>
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <select value={salesType} onChange={(event) => setSalesType(event.target.value)} className="w-full bg-transparent text-sm text-slate-100 outline-none">
                    <option value="All Sales" className="bg-slate-50">All Sales</option>
                    <option value="Cash" className="bg-slate-50">Cash</option>
                    <option value="Card" className="bg-slate-50">Card</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Payment Method</label>
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="w-full bg-transparent text-sm text-slate-100 outline-none">
                    <option value="All Payment Methods" className="bg-slate-50">All Payment Methods</option>
                    <option value="Cash" className="bg-slate-50">Cash</option>
                    <option value="Card" className="bg-slate-50">Card</option>
                    <option value="Bank Transfer" className="bg-slate-50">Bank Transfer</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-2 py-1.5">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-500" />
                <span>Include summary row and totals</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-2 py-1.5">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-500" />
                <span>Add grand total and summary information</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-600">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-500" />
                CSV
              </label>
              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-600">
                <input type="checkbox" checked={outputFormat === 'xlsx'} onChange={() => setOutputFormat((current) => (current === 'csv' ? 'xlsx' : 'csv'))} className="h-4 w-4 accent-blue-500" />
                XLSX
              </label>
            </div>
          </div>

          {showValidation && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{showValidation}</span>
            </div>
          )}

          {exportNotice && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <Download className="mt-0.5 h-4 w-4" />
              <span>{exportNotice}</span>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={exportReport.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowRight className="h-4 w-4" />
              {exportReport.isPending ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-slate-900">About Reports</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              {[
                'Reports show data based on your access level and branch permissions.',
                'Real-time and historical data are refreshed from the active backend contract.',
                'Multi-format export is available for supported sales report data.',
                'Branch-wide data filtering is only applied when permitted by the backend.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xl font-bold text-slate-900">Quick Reports</h3>
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
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-200"
                >
                  <span>{label}</span>
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Recent Reports</h3>
            <p className="text-sm text-slate-500">View and download previously generated reports.</p>
          </div>
          <button type="button" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-200">
            View all
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-600">
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
                <tr key={report.id} className="border-t border-slate-200 bg-[#081d34] hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
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
                    <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{report.format.toUpperCase()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{report.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="rounded-md border border-slate-200 bg-slate-100 p-2 text-slate-600 hover:border-slate-200">
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
