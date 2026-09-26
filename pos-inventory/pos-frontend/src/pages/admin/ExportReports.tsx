import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { getAdminBranches, exportReport, getReportPreview } from '../../services/api';
import type { DateRange, ReportPreviewData } from '../../types';

const RANGES: { label: string; value: DateRange }[] = [
  { label: 'Today', value: 'daily' },
  { label: 'This Week', value: 'weekly' },
  { label: 'This Month', value: 'monthly' },
  { label: 'This Year', value: 'yearly' },
  { label: 'All Time', value: 'all_time' },
];

function formatCurrency(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

const ExportReports = () => {
  const [range, setRange] = useState<DateRange>('monthly');
  const [branch, setBranch] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [preview, setPreview] = useState<ReportPreviewData | null>(null);

  const previewMutation = useMutation({
    mutationFn: () => getReportPreview(range, branch || undefined, useCustom ? fromDate : undefined, useCustom ? toDate : undefined),
    onSuccess: (data) => {
      setPreview(data);
      toast.success(`Preview loaded (${data.rows.length} rows)`);
    },
    onError: () => {
      setPreview(null);
      toast.error('Failed to generate preview. Please try again.');
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => exportReport(range, 'xlsx', branch || undefined, useCustom ? fromDate : undefined, useCustom ? toDate : undefined),
    onSuccess: () => toast.success('Report downloaded successfully'),
    onError: () => toast.error('Failed to export report. Please try again.'),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['admin-branches'],
    queryFn: getAdminBranches,
    staleTime: 5 * 60_000,
  });

  const handlePreview = () => {
    if (useCustom && (!fromDate || !toDate)) {
      toast.error('Please select both start and end dates for custom range.');
      return;
    }
    setPreview(null);
    previewMutation.mutate();
  };

  const handleGenerate = () => {
    if (!preview || preview.rows.length === 0) {
      toast.info('Preview the report first before generating Excel.');
      return;
    }
    exportMutation.mutate();
  };

  const isBusy = previewMutation.isPending || exportMutation.isPending;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export Reports</h1>
        <p className="text-gray-500 text-sm">Download sales data as Excel for any date range and branch</p>
      </div>

      <div className="admin-card admin-card-body space-y-6">
        {/* Date Range */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Date Range</label>
            <button
              type="button"
              onClick={() => { setUseCustom(!useCustom); setPreview(null); }}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                useCustom
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'text-gray-600 border-gray-200 hover:border-emerald-500 hover:text-emerald-700'
              }`}
            >
              {useCustom ? 'Using Custom Dates' : 'Use Custom Dates'}
            </button>
          </div>

          {!useCustom && (
            <div className="flex flex-wrap gap-2">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setRange(r.value); setPreview(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    range === r.value
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-500 hover:text-emerald-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {useCustom && (
            <div className="flex flex-col sm:flex-row gap-4 mt-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setPreview(null); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => { setToDate(e.target.value); setPreview(null); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Branch Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Branch <span className="text-gray-400 font-normal">(optional — leave blank for all branches)</span>
          </label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.id})
              </option>
            ))}
          </select>
        </div>

        {/* Format (Excel) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 w-fit">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Excel (.xlsx)</span>
          </div>
        </div>

        {/* Report Includes */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-sm text-emerald-700 space-y-1">
          <p className="font-medium">The preview and report include:</p>
          <ul className="list-disc list-inside space-y-0.5 text-emerald-600">
            <li>Invoice number &amp; date</li>
            <li>Customer name, mobile, and sales employee</li>
            <li>Payment method</li>
            <li>Subtotal, discount, GST, and total</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePreview}
            disabled={isBusy}
            className="admin-btn-primary"
          >
            {previewMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm7 0c-1.8 4.7-5.8 7-10 7s-8.2-2.3-10-7c1.8-4.7 5.8-7 10-7s8.2 2.3 10 7z" />
              </svg>
            )}
            {previewMutation.isPending ? 'Building Preview…' : 'Preview Report'}
          </button>

          {preview && (
            <button
              onClick={handleGenerate}
              disabled={isBusy || preview.rows.length === 0}
              className="admin-btn-primary"
            >
              {exportMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {exportMutation.isPending ? 'Generating…' : 'Download Excel'}
            </button>
          )}
        </div>

        {!preview && (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            Select filters and click <span className="font-medium text-gray-700">Preview Report</span> to inspect data before exporting.
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="admin-kpi-card">
                <p className="text-sm text-gray-500">Rows</p>
                <p className="text-lg font-semibold text-gray-800">{preview.rows.length.toLocaleString()}</p>
              </div>
              <div className="admin-kpi-card">
                <p className="text-sm text-gray-500">Subtotal</p>
                <p className="text-lg font-semibold text-gray-800">{formatCurrency(preview.totals.subtotal)}</p>
              </div>
              <div className="admin-kpi-card">
                <p className="text-sm text-gray-500">GST</p>
                <p className="text-lg font-semibold text-gray-800">{formatCurrency(preview.totals.gst)}</p>
              </div>
              <div className="admin-kpi-card">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-lg font-semibold text-emerald-600">{formatCurrency(preview.totals.total)}</p>
              </div>
            </div>

            <div className="admin-card overflow-hidden">
              <div className="admin-card-header">
                <h2 className="text-base font-semibold text-gray-800">Report Preview</h2>
              </div>
              <div className="admin-table-wrap max-h-[420px] overflow-auto">
                <table className="admin-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th>Doc #</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Mobile</th>
                      <th>Sales Employee</th>
                      <th>Payment</th>
                      <th className="text-right">Subtotal</th>
                      <th className="text-right">Discount</th>
                      <th className="text-right">GST</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-6 text-gray-400">
                          No rows found for selected filters.
                        </td>
                      </tr>
                    ) : (
                      preview.rows.map((row, index) => (
                        <tr key={`${row.docNum}-${index}`}>
                          <td className="font-medium text-gray-700">{row.docNum}</td>
                          <td>{row.date}</td>
                          <td>{row.customer || '-'}</td>
                          <td>{row.mobile || '-'}</td>
                          <td>{row.salesEmployee || '-'}</td>
                          <td className="capitalize">{row.paymentMethod || 'unknown'}</td>
                          <td>{formatCurrency(row.subtotal)}</td>
                          <td>{formatCurrency(row.discount)}</td>
                          <td >{formatCurrency(row.gst)}</td>
                          <td className="font-semibold text-emerald-600">{formatCurrency(row.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportReports;
