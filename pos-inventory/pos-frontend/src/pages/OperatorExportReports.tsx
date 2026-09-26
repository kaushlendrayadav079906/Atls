import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { getOperatorReportPreview, exportOperatorReport } from '../services/api';
import type { DateRange, ReportPreviewData } from '../types';

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

const OperatorExportReports = () => {
  const [range, setRange] = useState<DateRange>('monthly');
  const [useCustom, setUseCustom] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [preview, setPreview] = useState<ReportPreviewData | null>(null);

  const previewMutation = useMutation({
    mutationFn: () =>
      getOperatorReportPreview(range, useCustom ? fromDate : undefined, useCustom ? toDate : undefined),
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
    mutationFn: () =>
      exportOperatorReport(range, useCustom ? fromDate : undefined, useCustom ? toDate : undefined),
    onSuccess: () => toast.success('Report downloaded successfully'),
    onError: () => toast.error('Failed to export report. Please try again.'),
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
    <div className="space-y-6 mx-auto max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Sales Report</h1>
        <p className="text-gray-500 text-sm">Export your branch sales data as Excel</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Date Range Preset */}
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
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
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
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 transition-shadow"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setPreview(null); }}
                  min={fromDate}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 transition-shadow"
                />
              </div>
            </div>
          )}
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 w-fit">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Excel (.xlsx)</span>
          </div>
        </div>

        {/* Report info */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800 space-y-1">
          <p className="font-medium">The report includes:</p>
          <ul className="list-disc list-inside space-y-0.5 text-emerald-700">
            <li>Invoice number &amp; date</li>
            <li>Customer name &amp; mobile (from UDF fields)</li>
            <li>Payment method</li>
            <li>Subtotal, discount, GST, and total</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePreview}
            disabled={isBusy}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {previewMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm7 0c-1.8 4.7-5.8 7-10 7s-8.2-2.3-10-7c1.8-4.7 5.8-7 10-7s8.2 2.3 10 7z" />
              </svg>
            )}
            {previewMutation.isPending ? 'Building Preview…' : 'Preview Report'}
          </button>

          {preview && (
            <button
              onClick={handleGenerate}
              disabled={isBusy || preview.rows.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exportMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {exportMutation.isPending ? 'Generating…' : 'Download Excel'}
            </button>
          )}
        </div>

        {!preview && (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            Select a date range and click <span className="font-medium text-gray-700">Preview Report</span> to inspect data before exporting.
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-500">Rows</p>
                <p className="text-lg font-semibold text-gray-800">{preview.rows.length.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-500">Subtotal</p>
                <p className="text-lg font-semibold text-gray-800">{formatCurrency(preview.totals.subtotal)}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-500">GST</p>
                <p className="text-lg font-semibold text-gray-800">{formatCurrency(preview.totals.gst)}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-lg font-semibold text-emerald-700">{formatCurrency(preview.totals.total)}</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-800">Report Preview</h2>
              </div>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['Invoice #', 'Date', 'Customer', 'Payment', 'Subtotal', 'Discount', 'GST', 'Total'].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap border-b border-gray-200">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{row.docNum}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.date}</td>
                        <td className="px-3 py-2 text-gray-800 max-w-[160px] truncate">{row.customer || '-'}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                            {row.paymentMethod || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2  text-gray-700">{formatCurrency(row.subtotal)}</td>
                        <td className="px-3 py-2  text-red-600">{row.discount > 0 ? `-${formatCurrency(row.discount)}` : '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{formatCurrency(row.gst)}</td>
                        <td className="px-3 py-2 font-semibold text-emerald-700">{formatCurrency(row.total)}</td>
                      </tr>
                    ))}
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

export default OperatorExportReports;
