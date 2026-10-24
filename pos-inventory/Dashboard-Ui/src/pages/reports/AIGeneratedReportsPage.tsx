import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  CreditCard,
  Package,
  Factory,
  BarChart3,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { aiAssistantApi, type AIAssistantChatResponse } from '../../api/endpoints';
import { commonApi } from '../../api/common';
import { ReportDateRangePicker } from '../../components/ReportDateRangePicker';
import { ReportDocumentViewer } from '../../components/ReportDocumentViewer';
import {
  type QuickFilter,
  type AuthoritativeDateFilterState,
  getDateScopeLabel,
} from '../../utils/date';

type ReportCategory = 'sales' | 'finance' | 'payments' | 'inventory' | 'production';

interface ReportCategoryConfig {
  id: ReportCategory;
  name: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  defaultPrompt: string;
  metric: string;
}

const REPORT_CATEGORIES: ReportCategoryConfig[] = [
  {
    id: 'sales',
    name: 'Sales & Revenue Performance',
    badge: 'A/R Invoices & Orders',
    description: 'Executive revenue breakdown, invoice volume, average order values, and branch performance trends.',
    icon: TrendingUp,
    defaultPrompt: 'Generate a sales performance report with revenue metrics, invoice count, and trend analysis.',
    metric: 'sales',
  },
  {
    id: 'finance',
    name: 'Finance & Gross Profitability',
    badge: 'Profit & Margins',
    description: 'Net sales vs vendor purchases, gross profit calculations, margin percentages, and cash flow comparisons.',
    icon: CreditCard,
    defaultPrompt: 'Generate a financial profitability overview comparing sales revenue to purchase costs and gross margin.',
    metric: 'finance',
  },
  {
    id: 'payments',
    name: 'Collections & Incoming Payments',
    badge: 'A/R Cash & Bank',
    description: 'Incoming customer payments, payment method distributions, receipt totals, and outstanding receivables.',
    icon: BarChart3,
    defaultPrompt: 'Generate a collections and incoming payments report detailing cash vs bank receipts and customer payments.',
    metric: 'payments',
  },
  {
    id: 'inventory',
    name: 'Inventory Valuation & Stock Levels',
    badge: 'OITM Stock & Warehouses',
    description: 'Warehouse stock distribution, item inventory valuations, and critical low-stock operational notices.',
    icon: Package,
    defaultPrompt: 'Generate an inventory stock report showing stock levels, warehouse distribution, and low stock items.',
    metric: 'inventory',
  },
  {
    id: 'production',
    name: 'Production Orders & Efficiency',
    badge: 'Manufacturing & OWOR',
    description: 'Production orders status breakdown, planned vs completed quantities, and scrap/rejection monitoring.',
    icon: Factory,
    defaultPrompt: 'Generate a production operations report analyzing planned vs completed production orders and rejection rate.',
    metric: 'production',
  },
];

export const AIGeneratedReportsPage: React.FC = () => {
  // Filter & Configuration State
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('sales');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [dateRange, setDateRange] = useState<string>('all_time');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [reportDepth, setReportDepth] = useState<'brief' | 'detailed'>('detailed');

  // Generation & Output State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [reportData, setReportData] = useState<AIAssistantChatResponse | null>(null);
  const [generatedCategory, setGeneratedCategory] = useState<ReportCategory>('sales');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Load SAP-backed authorized branches
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => commonApi.getFilterOptions(),
    staleTime: 300_000,
  });

  const handleDateRangeChange = (filterState: AuthoritativeDateFilterState) => {
    setQuickFilter(filterState.quickFilter);
    setDateRange(filterState.period);
    setDateFrom(filterState.dateFrom);
    setDateTo(filterState.dateTo);
  };

  const handleGenerateReport = async (promptOverride?: string) => {
    const targetCategoryId = promptOverride ? generatedCategory : selectedCategory;
    const categoryConfig = REPORT_CATEGORIES.find((c) => c.id === targetCategoryId) || REPORT_CATEGORIES[0];
    const dateLabel = getDateScopeLabel(quickFilter, dateFrom, dateTo);
    const branchLabel = branch ? (filterOptions?.branches?.find((b: any) => b.id === branch)?.name || branch) : 'All Branches';

    const basePrompt = promptOverride || categoryConfig.defaultPrompt;
    const enrichedMessage = `${basePrompt} Date Range: ${dateLabel}. Branch Scope: ${branchLabel}. Detail Level: ${reportDepth === 'detailed' ? 'Detailed audit' : 'Executive brief'}. Ensure all figures are verified from SAP Business One.`;

    try {
      setIsGenerating(true);
      setGenerationError(null);

      const response = await aiAssistantApi.chat(
        {
          message: enrichedMessage,
          branch_id: branch || 'all',
          context: {
            module: categoryConfig.id,
            metric: categoryConfig.metric,
            range: dateRange,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            branch: branch || undefined,
            detail_level: reportDepth,
          },
        },
        { timeout: 65000 }
      );

      setReportData(response);
      setGeneratedCategory(categoryConfig.id);
      setGeneratedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.error('AI Report Generation Error:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Failed to generate report from SAP data.';
      setGenerationError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentCategory = REPORT_CATEGORIES.find((c) => c.id === selectedCategory) || REPORT_CATEGORIES[0];
  const activeGeneratedCategory = REPORT_CATEGORIES.find((c) => c.id === generatedCategory) || currentCategory;

  const handleExportCSV = () => {
    if (!reportData) return;
    try {
      setIsExporting(true);
      const sd = reportData.structured_data || {};
      const cards: any[] = sd.cards || [];

      const rows: any[] =
        sd.rows ||
        cards.find((c: any) => Array.isArray(c.rows) && c.rows.length > 0)?.rows ||
        cards.find((c: any) => Array.isArray(c.trend))?.trend ||
        cards.find((c: any) => Array.isArray(c.distribution))?.distribution ||
        cards.find((c: any) => Array.isArray(c.top_customers))?.top_customers ||
        cards.find((c: any) => Array.isArray(c.orders))?.orders ||
        cards.find((c: any) => Array.isArray(c.items))?.items ||
        [];

      const rawCols: any[] =
        sd.columns ||
        cards.find((c: any) => Array.isArray(c.columns) && c.columns.length > 0)?.columns ||
        [];

      const colDefs: Array<{ key: string; label: string }> = [];
      if (rawCols.length > 0) {
        rawCols.forEach((c: any) => {
          colDefs.push({
            key: c.key || c.label || String(c),
            label: c.label || c.key || String(c),
          });
        });
      } else if (rows.length > 0) {
        Object.keys(rows[0]).forEach((k) => {
          if (typeof rows[0][k] !== 'object') {
            colDefs.push({
              key: k,
              label: k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            });
          }
        });
      }

      let csv = '';
      if (rows.length > 0 && colDefs.length > 0) {
        csv += colDefs.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',') + '\n';
        rows.forEach((row) => {
          const line = colDefs
            .map((col) => {
              const val = row[col.key] ?? row[col.label] ?? row[col.key.toLowerCase()] ?? '';
              const clean = String(val).replace(/"/g, '""');
              return `"${clean}"`;
            })
            .join(',');
          csv += line + '\n';
        });
      } else {
        csv += `"Report Title","${activeGeneratedCategory.name}"\n`;
        csv += `"Period","${getDateScopeLabel(quickFilter, dateFrom, dateTo)}"\n`;
        csv += `"Branch","${branch || 'All Branches'}"\n`;
        csv += `"Synthesis","${reportData.answer.replace(/"/g, '""')}"\n`;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI_Report_${generatedCategory}_${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export CSV error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-xs">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900">
              AI Generated Reports
            </h1>
            <p className="mt-1 atlas-page-subtitle text-sm sm:text-[15px] text-slate-500">
              Authorized enterprise reports generated using verified SAP Business One transactional documents and deterministic models.
            </p>
          </div>
        </div>

        {/* Top Controls: Date Picker & Branch Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <ReportDateRangePicker
            quickFilter={quickFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onRangeChange={handleDateRangeChange}
          />

          <div className="w-[170px]">
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-700 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-2xs"
            >
              <option value="">All Branches</option>
              {filterOptions?.branches?.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Module Selection Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {REPORT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`p-4 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div
                    className={`p-2 rounded-xl ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <span
                    className={`text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cat.badge}
                  </span>
                </div>
                <h3 className="font-bold text-[14.5px] text-slate-900 mb-1">{cat.name}</h3>
                <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2">{cat.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Action Bar: Report Configuration & Generate Trigger ─────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="text-[13px] text-slate-600 font-medium">
            Active Scope:{' '}
            <span className="font-bold text-slate-900">
              {getDateScopeLabel(quickFilter, dateFrom, dateTo)}
            </span>{' '}
            •{' '}
            <span className="font-bold text-slate-900">
              {branch ? filterOptions?.branches?.find((b: any) => b.id === branch)?.name || branch : 'All Branches'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setReportDepth('detailed')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                reportDepth === 'detailed' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Detailed Audit
            </button>
            <button
              onClick={() => setReportDepth('brief')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                reportDepth === 'brief' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Executive Brief
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {reportData && (
            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-2.5 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Download size={15} />
              <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          )}

          <button
            onClick={() => handleGenerateReport()}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-[13.5px] font-bold shadow-xs transition cursor-pointer disabled:opacity-60"
          >
            <Sparkles size={16} className={isGenerating ? 'animate-spin' : ''} />
            <span>{isGenerating ? 'Synthesizing SAP Data...' : `Generate ${currentCategory.name}`}</span>
          </button>
        </div>
      </div>

      {/* ── Error Notification ──────────────────────────────────────────────── */}
      {generationError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600" />
            <div>
              <span className="font-semibold">Generation Failed: </span>
              <span>{generationError}</span>
            </div>
          </div>
          <button
            onClick={() => handleGenerateReport()}
            className="font-semibold underline cursor-pointer text-rose-900"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* ── Loading Skeleton / Progress ─────────────────────────────────────── */}
      {isGenerating && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/50 to-white p-12 text-center shadow-2xs">
          <RefreshCw size={32} className="animate-spin text-indigo-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Querying SAP Business One Service Layer</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Extracting non-cancelled transactional documents, validating accounting rules, and computing verified report metrics...
          </p>
        </div>
      )}

      {/* ── Generated Report Display ────────────────────────────────────────── */}
      {!isGenerating && reportData && (
        <ReportDocumentViewer
          reportData={reportData}
          categoryName={activeGeneratedCategory.name}
          categoryIcon={activeGeneratedCategory.icon}
          categoryBadge={activeGeneratedCategory.badge}
          dateLabel={getDateScopeLabel(quickFilter, dateFrom, dateTo)}
          branchLabel={
            branch
              ? filterOptions?.branches?.find((b: any) => b.id === branch)?.name || branch
              : 'All Branches'
          }
          generatedAt={generatedAt}
          reportDepth={reportDepth}
          onRegenerate={() => handleGenerateReport()}
          onSelectFollowUp={(q) => handleGenerateReport(q)}
          onExportCSV={handleExportCSV}
        />
      )}

      {/* ── Empty State Prompt ──────────────────────────────────────────────── */}
      {!isGenerating && !reportData && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Sparkles size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900">Ready to Generate Verified Executive Report</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Select your desired business module above and click <span className="font-semibold text-slate-700">Generate Report</span> to synthesize real-time transactional data from SAP Business One.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => handleGenerateReport()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
            >
              <Sparkles size={14} />
              <span>Generate {currentCategory.name} Now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGeneratedReportsPage;
