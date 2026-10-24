import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  BarChart3,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  Info,
  Calendar,
  Building2,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { AIAssistantChatResponse } from '../api/endpoints';

// ── Currency & Number Helpers ──────────────────────────────────────────────────

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

export const formatCurrencyOrNumber = (val: any): string => {
  if (val === null || val === undefined || val === '') return '-';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return String(val);
  return inrFormatter.format(num);
};

export const formatCompactINR = (val: number): string => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toFixed(0)}`;
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReportKPI {
  title: string;
  value: string | number;
  subtext?: string;
  format?: 'currency' | 'number' | 'percentage' | 'string';
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ComponentType<{ className?: string; size?: number }>;
}

export interface ParsedMarkdownTable {
  headers: string[];
  rows: string[][];
}

export interface ParsedReportSection {
  id: string;
  title: string;
  type: 'executive_summary' | 'table' | 'observations' | 'recommendations' | 'limitations' | 'general';
  paragraphs: string[];
  bullets: string[];
  table: ParsedMarkdownTable | null;
}

export interface ReportDocumentViewerProps {
  reportData: AIAssistantChatResponse;
  categoryName: string;
  categoryIcon: React.ComponentType<{ className?: string; size?: number }>;
  categoryBadge: string;
  dateLabel: string;
  branchLabel: string;
  generatedAt: string | null;
  reportDepth: 'brief' | 'detailed';
  onRegenerate: () => void;
  onSelectFollowUp?: (query: string) => void;
  onExportCSV?: () => void;
}

const CHART_PALETTE = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6'];

// ── Inline Markdown Token Parser (Removes raw **, ``, etc.) ────────────────────

export const CleanInlineText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Split on bold tokens **text**, code blocks `code`, and risk badges [HIGH RISK], [MEDIUM RISK], [LOW RISK]
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[HIGH RISK\]|\[MEDIUM RISK\]|\[LOW RISK\])/gi);
  return (
    <span>
      {parts.map((part, i) => {
        const upper = part.toUpperCase();
        if (upper === '[HIGH RISK]') {
          return (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 mr-1.5 align-middle shadow-2xs"
            >
              High Risk
            </span>
          );
        }
        if (upper === '[MEDIUM RISK]') {
          return (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 mr-1.5 align-middle shadow-2xs"
            >
              Medium Risk
            </span>
          );
        }
        if (upper === '[LOW RISK]') {
          return (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200 mr-1.5 align-middle shadow-2xs"
            >
              Low Risk
            </span>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[12.5px] text-indigo-700">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

// ── Markdown Document Parser ───────────────────────────────────────────────────

export function parseReportMarkdown(rawText: string): {
  documentTitle: string;
  executiveSummary: string;
  sections: ParsedReportSection[];
  kpisFromText: ReportKPI[];
} {
  const lines = (rawText || '').split('\n');
  let documentTitle = '';
  let executiveSummary = '';
  const sections: ParsedReportSection[] = [];
  const kpisFromText: ReportKPI[] = [];

  let currentSection: ParsedReportSection | null = null;
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const finalizeCurrentSection = () => {
    if (currentSection) {
      if (tableHeaders.length > 0) {
        currentSection.table = { headers: tableHeaders, rows: tableRows };
      }
      sections.push(currentSection);
      currentSection = null;
    }
    inTable = false;
    tableHeaders = [];
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed === '---' || trimmed === '***') {
      if (inTable) {
        if (currentSection && tableHeaders.length > 0) {
          currentSection.table = { headers: tableHeaders, rows: tableRows };
        }
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }
      continue;
    }

    // Document Title H1
    if (trimmed.startsWith('# ') && !documentTitle) {
      documentTitle = trimmed.replace(/^#\s+/, '').replace(/\*\*/g, '').trim();
      continue;
    }

    // Pipe table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (/^\|(\s*[:\-]+\s*\|)+$/.test(trimmed)) {
        continue;
      }

      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim().replace(/\*\*/g, ''));

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
        tableRows = [];
      } else {
        tableRows.push(cells);
      }
      continue;
    }

    // Section Headings (H2 / H3 / H4)
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
      finalizeCurrentSection();

      const headingText = trimmed.replace(/^#+\s+/, '').replace(/\*\*/g, '').trim();
      const lower = headingText.toLowerCase();

      let type: ParsedReportSection['type'] = 'general';
      if (lower.includes('executive summary') || lower.includes('overview') || lower.includes('brief') || lower.includes('intelligence')) {
        type = 'executive_summary';
      } else if (lower.includes('observation') || lower.includes('finding') || lower.includes('risk') || lower.includes('vulnerabilit')) {
        type = 'observations';
      } else if (lower.includes('recommend') || lower.includes('action') || lower.includes('next steps') || lower.includes('strategic')) {
        type = 'recommendations';
      } else if (lower.includes('limitation') || lower.includes('assumption') || lower.includes('accounting standard') || lower.includes('methodology') || lower.includes('scope')) {
        type = 'limitations';
      } else if (lower.includes('breakdown') || lower.includes('table') || lower.includes('revenue by') || lower.includes('orders')) {
        type = 'table';
      }

      currentSection = {
        id: `sec-${sections.length + 1}`,
        title: headingText,
        type,
        paragraphs: [],
        bullets: [],
        table: null,
      };
      continue;
    }

    // Bullet Points
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ') || /^\d+\.\s+/.test(trimmed);
    if (isBullet) {
      const cleanBullet = trimmed.replace(/^([-*•]|\d+\.)\s+/, '');
      if (!currentSection) {
        currentSection = {
          id: `sec-${sections.length + 1}`,
          title: 'Report Summary',
          type: 'general',
          paragraphs: [],
          bullets: [],
          table: null,
        };
      }
      currentSection.bullets.push(cleanBullet);
      continue;
    }

    // Paragraph Line
    if (trimmed.startsWith('**') && (trimmed.includes(':') || trimmed.includes('|'))) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const titlePart = trimmed.slice(0, colonIdx).replace(/\*\*/g, '').trim();
        const valuePart = trimmed.slice(colonIdx + 1).replace(/\*\*/g, '').trim();
        if (valuePart.length > 0 && valuePart.length < 50 && (valuePart.includes('₹') || !isNaN(Number(valuePart)))) {
          kpisFromText.push({
            title: titlePart,
            value: valuePart,
            format: valuePart.includes('₹') ? 'currency' : 'string',
          });
        }
      }
    }

    if (!currentSection) {
      if (!executiveSummary) {
        executiveSummary = trimmed;
      }
      currentSection = {
        id: 'sec-intro',
        title: 'Executive Summary',
        type: 'executive_summary',
        paragraphs: [trimmed],
        bullets: [],
        table: null,
      };
    } else {
      currentSection.paragraphs.push(trimmed);
      if (currentSection.type === 'executive_summary' && !executiveSummary) {
        executiveSummary = trimmed;
      }
    }
  }

  finalizeCurrentSection();

  return {
    documentTitle: documentTitle || 'Executive Operations Audit Report',
    executiveSummary: executiveSummary || 'Operational metrics synthesized from verified SAP Business One transactional documents.',
    sections,
    kpisFromText,
  };
}

// ── Main ReportDocumentViewer Component ─────────────────────────────────────────

export const ReportDocumentViewer: React.FC<ReportDocumentViewerProps> = ({
  reportData,
  categoryName,
  categoryIcon: CategoryIcon,
  categoryBadge,
  dateLabel,
  branchLabel,
  generatedAt,
  reportDepth,
  onRegenerate,
  onSelectFollowUp,
  onExportCSV,
}) => {
  const structuredData = reportData.structured_data || {};
  const cards: any[] = structuredData.cards || [];

  // Parse narrative Markdown text
  const { documentTitle, sections, kpisFromText } = useMemo(
    () => parseReportMarkdown(reportData.answer || ''),
    [reportData.answer]
  );

  const finalTitle = useMemo(() => {
    if (structuredData.title) return structuredData.title;
    if (documentTitle && documentTitle !== 'Executive Operations Audit Report') return documentTitle;
    return categoryName || documentTitle || 'Executive Operations Audit Report';
  }, [structuredData.title, documentTitle, categoryName]);

  const resolvedFollowUps = useMemo<string[]>(() => {
    if (Array.isArray(reportData.suggested_follow_ups) && reportData.suggested_follow_ups.length > 0) {
      return reportData.suggested_follow_ups;
    }
    if (Array.isArray(structuredData.suggested_followups) && structuredData.suggested_followups.length > 0) {
      return structuredData.suggested_followups;
    }
    if (Array.isArray(structuredData.suggested_follow_ups) && structuredData.suggested_follow_ups.length > 0) {
      return structuredData.suggested_follow_ups;
    }
    return [];
  }, [reportData, structuredData]);

  // ── Unified KPI Card Resolution ─────────────────────────────────────────────
  const resolvedKpis = useMemo<ReportKPI[]>(() => {
    const rawKpis: any[] =
      structuredData.kpis ||
      cards.find((c) => Array.isArray(c.kpis))?.kpis ||
      [];

    if (rawKpis.length > 0) {
      return rawKpis.map((k) => ({
        title: k.title || k.label || k.key || 'Metric',
        value: k.value,
        subtext: k.subtitle || k.subtext,
        format: k.format || (typeof k.value === 'number' && k.title?.toLowerCase().includes('sales') ? 'currency' : 'string'),
      }));
    }

    const salesCard = cards.find((c) => c.type === 'sales_report') || (structuredData.type === 'sales_report' ? structuredData : null);
    if (salesCard) {
      const tot = Number(salesCard.total_sales || 0);
      const cnt = Number(salesCard.invoice_count || 0);
      const avg = cnt > 0 ? tot / cnt : 0;
      return [
        { title: 'Total Net Sales', value: tot, format: 'currency', icon: TrendingUp },
        { title: 'Finalized Invoices', value: cnt, format: 'number', icon: FileSpreadsheet },
        { title: 'Average Invoice Value', value: avg, format: 'currency', icon: CreditCard },
      ];
    }

    const finCard = cards.find((c) => c.type === 'finance_summary') || (structuredData.type === 'finance_summary' ? structuredData : null);
    if (finCard && finCard.cards) {
      return finCard.cards.slice(0, 4).map((c: any) => ({
        title: c.title,
        value: c.value,
        subtext: c.subtitle,
        format: c.format || 'currency',
      }));
    }

    const payCard = cards.find((c) => c.type === 'payment_report') || (structuredData.type === 'payment_report' ? structuredData : null);
    if (payCard) {
      return [
        { title: 'Total Collections', value: payCard.total_payments || 0, format: 'currency', icon: CreditCard },
        { title: 'Incoming Payments', value: payCard.payment_count || 0, format: 'number', icon: FileSpreadsheet },
      ];
    }

    const prodCard = cards.find((c) => c.type === 'production_orders' || c.type === 'production_summary');
    if (prodCard && prodCard.kpis) {
      return prodCard.kpis;
    }

    if (kpisFromText.length > 0) {
      return kpisFromText.slice(0, 4);
    }

    return [];
  }, [structuredData, cards, kpisFromText]);

  // ── Unified Chart Resolution ────────────────────────────────────────────────
  const resolvedChart = useMemo(() => {
    const config =
      structuredData.chart ||
      cards.find((c) => c.chart)?.chart ||
      null;

    const rawRows: any[] =
      structuredData.rows ||
      cards.find((c) => Array.isArray(c.rows) && c.rows.length > 0)?.rows ||
      cards.find((c) => Array.isArray(c.trend))?.trend ||
      cards.find((c) => Array.isArray(c.distribution))?.distribution ||
      cards.find((c) => Array.isArray(c.top_customers))?.top_customers ||
      cards.find((c) => Array.isArray(c.orders))?.orders ||
      [];

    if (!config && rawRows.length === 0) return null;

    const data = config?.data || rawRows;
    if (!data || data.length === 0) return null;

    let xKey = config?.xKey;
    if (!xKey) {
      const sample = data[0];
      if (sample) {
        if ('label' in sample) xKey = 'label';
        else if ('month' in sample) xKey = 'month';
        else if ('period' in sample) xKey = 'period';
        else if ('method' in sample) xKey = 'method';
        else if ('customer_name' in sample) xKey = 'customer_name';
        else if ('item_name' in sample) xKey = 'item_name';
        else if ('metric' in sample) xKey = 'metric';
        else xKey = Object.keys(sample)[0];
      }
    }

    let seriesItems: Array<{ dataKey: string; name: string; color: string }> = [];
    if (config?.series && Array.isArray(config.series)) {
      seriesItems = config.series.map((s: any, idx: number) => {
        if (typeof s === 'string') {
          const colTitle = s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          return { dataKey: s, name: colTitle, color: CHART_PALETTE[idx % CHART_PALETTE.length] };
        }
        return {
          dataKey: s.dataKey || s.key,
          name: s.name || s.label || s.dataKey,
          color: s.color || CHART_PALETTE[idx % CHART_PALETTE.length],
        };
      });
    } else {
      const sample = data[0];
      if (sample) {
        Object.keys(sample).forEach((k) => {
          if (k !== xKey && typeof sample[k] === 'number') {
            const colTitle = k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
            seriesItems.push({
              dataKey: k,
              name: colTitle,
              color: CHART_PALETTE[seriesItems.length % CHART_PALETTE.length],
            });
          }
        });
      }
    }

    return {
      type: config?.type || 'bar',
      xKey: xKey || 'label',
      series: seriesItems,
      data,
    };
  }, [structuredData, cards]);

  // ── Unified Table Records Resolution ────────────────────────────────────────
  const resolvedTable = useMemo(() => {
    const rawCols: any[] =
      structuredData.columns ||
      cards.find((c) => Array.isArray(c.columns) && c.columns.length > 0)?.columns ||
      [];

    const rawRows: any[] =
      structuredData.rows ||
      cards.find((c) => Array.isArray(c.rows) && c.rows.length > 0)?.rows ||
      cards.find((c) => Array.isArray(c.trend))?.trend ||
      cards.find((c) => Array.isArray(c.distribution))?.distribution ||
      cards.find((c) => Array.isArray(c.top_customers))?.top_customers ||
      cards.find((c) => Array.isArray(c.orders))?.orders ||
      cards.find((c) => Array.isArray(c.items))?.items ||
      [];

    if (rawRows.length === 0) return null;

    let columns = rawCols;
    if (columns.length === 0 && rawRows.length > 0) {
      columns = Object.keys(rawRows[0])
        .filter((k) => typeof rawRows[0][k] !== 'object')
        .map((k) => ({
          key: k,
          label: k.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          type: typeof rawRows[0][k] === 'number' ? 'number' : 'string',
        }));
    }

    return {
      columns,
      rows: rawRows,
    };
  }, [structuredData, cards]);

  // ── Table Search, Sort, and Pagination State ────────────────────────────────
  const [tableSearch, setTableSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const processedRows = useMemo(() => {
    if (!resolvedTable) return [];
    let list = [...resolvedTable.rows];

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (sortKey) {
      list.sort((a, b) => {
        const valA = a[sortKey] ?? '';
        const valB = b[sortKey] ?? '';
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        return sortOrder === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return list;
  }, [resolvedTable, tableSearch, sortKey, sortOrder]);

  const totalPages = Math.ceil(processedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(
    () => processedRows.slice((page - 1) * pageSize, page * pageSize),
    [processedRows, page, pageSize]
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4 print:text-black">
      {/* ── Document Header & Meta Card ───────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs relative overflow-hidden print:border-none print:shadow-none print:p-0">
        <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 print:hidden" />

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[12px] font-bold shadow-2xs">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Verified SAP Business One Source</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200/80 text-[12px] font-bold">
                <CategoryIcon size={14} />
                <span>{categoryBadge}</span>
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
                {reportDepth === 'detailed' ? 'Detailed Enterprise Audit' : 'Executive Brief'}
              </span>
            </div>

            <h1 className="text-[26px] sm:text-[30px] font-black tracking-tight text-slate-900 leading-tight">
              {finalTitle}
            </h1>

            {/* Scope Bar */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-[13px] text-slate-600 font-medium pt-1">
              <div className="flex items-center gap-1.5">
                <Calendar size={15} className="text-slate-400" />
                <span>Period:</span>
                <span className="font-bold text-slate-900">{dateLabel}</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1.5">
                <Building2 size={15} className="text-slate-400" />
                <span>Branch Scope:</span>
                <span className="font-bold text-slate-900">{branchLabel}</span>
              </div>
              {generatedAt && (
                <>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <ShieldCheck size={15} className="text-emerald-600" />
                    <span>Generated at {generatedAt}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions (Export, Print, Refresh) */}
          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            {onExportCSV && (
              <button
                onClick={onExportCSV}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-bold shadow-2xs transition cursor-pointer"
                title="Download verified records as CSV spreadsheet"
              >
                <Download size={15} />
                <span>Export CSV</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-bold shadow-2xs transition cursor-pointer"
              title="Print report or save as PDF"
            >
              <Printer size={15} />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={onRegenerate}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-700 text-[13px] font-bold shadow-2xs transition cursor-pointer"
              title="Re-synthesize transactional data from SAP"
            >
              <RefreshCw size={15} />
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Executive Summary Callout Box ────────────────────────────────────── */}
      {sections.find((s) => s.type === 'executive_summary') && (
        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-blue-50/40 p-6 sm:p-7 shadow-xs relative">
          <div className="flex items-center gap-2.5 mb-3 text-indigo-900 font-bold text-[16px]">
            <Zap size={18} className="text-indigo-600" />
            <span>Executive Briefing & Synthesis</span>
          </div>

          <div className="space-y-3 text-[14.5px] leading-relaxed text-slate-700 font-normal">
            {sections
              .find((s) => s.type === 'executive_summary')
              ?.paragraphs.map((para, idx) => (
                <p key={idx} className="m-0">
                  <CleanInlineText text={para} />
                </p>
              ))}

            {sections
              .find((s) => s.type === 'executive_summary')
              ?.bullets.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[14px] text-slate-700 pl-1">
                  <span className="text-indigo-600 font-bold mt-0.5">•</span>
                  <span>
                    <CleanInlineText text={bullet} />
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Verified Enterprise KPI Grid ──────────────────────────────────────── */}
      {resolvedKpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {resolvedKpis.map((kpi, idx) => {
            const IconComponent = kpi.icon || CategoryIcon || Sparkles;
            const formattedVal =
              kpi.format === 'currency'
                ? formatCurrencyOrNumber(kpi.value)
                : kpi.format === 'number'
                ? numberFormatter.format(Number(kpi.value) || 0)
                : kpi.format === 'percentage'
                ? `${kpi.value}%`
                : String(kpi.value);

            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-xs transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                    {kpi.title}
                  </span>
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <IconComponent size={16} />
                  </div>
                </div>

                <div className="text-[24px] sm:text-[26px] font-black text-slate-900 tracking-tight">
                  {formattedVal}
                </div>

                {kpi.subtext && (
                  <div className="mt-1.5 text-[12px] font-medium text-slate-500">
                    {kpi.subtext}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Visual Breakdown Chart (Guaranteed Data Binding & Honest Empty State) ──────────────────── */}
      {resolvedChart && resolvedChart.data.length > 0 ? (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <BarChart3 size={18} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">
                  Visual Breakdown ({categoryName})
                </h2>
                <p className="text-[12px] text-slate-500">
                  Interactive multi-period analytical distribution from verified SAP Business One transactional documents.
                </p>
              </div>
            </div>

            <div className="text-[12px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
              {resolvedChart.data.length} Data Points
            </div>
          </div>

          <div className="h-[320px] w-full">
            {resolvedChart.type === 'pie' ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={resolvedChart.data}
                    dataKey="amount"
                    nameKey={resolvedChart.xKey}
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={50}
                    paddingAngle={3}
                    label={(entry: any) => `${entry[resolvedChart.xKey] || ''}: ${formatCompactINR(entry.amount || 0)}`}
                  >
                    {resolvedChart.data.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [inrFormatter.format(Number(val) || 0), 'Amount']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={resolvedChart.data} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey={resolvedChart.xKey}
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={resolvedChart.data.length > 6 ? -25 : 0}
                    textAnchor={resolvedChart.data.length > 6 ? 'end' : 'middle'}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => formatCompactINR(val)}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      typeof val === 'number' && (String(name).toLowerCase().includes('sales') || String(name).toLowerCase().includes('revenue') || String(name).toLowerCase().includes('amount') || String(name).toLowerCase().includes('profit') || String(name).toLowerCase().includes('cost'))
                        ? inrFormatter.format(val)
                        : val,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  {resolvedChart.series.map((s) => (
                    <Bar
                      key={s.dataKey}
                      dataKey={s.dataKey}
                      name={s.name}
                      fill={s.color}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <BarChart3 size={20} />
          </div>
          <h3 className="text-[14.5px] font-bold text-slate-800">No Transactional Data to Chart</h3>
          <p className="text-[12.5px] text-slate-500 max-w-md mx-auto mt-1">
            No visual trends available because the SAP query returned 0 records for this period.
          </p>
        </div>
      )}

      {/* ── Structured Financial & Operational Data Table ─────────────────────── */}
      {resolvedTable && (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">
                  Detailed Operational Records ({processedRows.length})
                </h2>
                <p className="text-[12px] text-slate-500">
                  Verified transactional records supporting executive calculations.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search input */}
              <div className="relative w-full sm:w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {onExportCSV && (
                <button
                  onClick={onExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-slate-100 text-[11.5px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/70">
                <tr>
                  {resolvedTable.columns.map((col: any) => {
                    const key = col.key || col.label || col;
                    const isSorted = sortKey === key;
                    return (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="py-3 px-3.5 cursor-pointer hover:text-slate-900 transition select-none"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.label || col.key || col}</span>
                          {isSorted ? (
                            sortOrder === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                          ) : (
                            <ArrowUpDown size={12} className="text-slate-300" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedRows.map((row: any, rIdx: number) => (
                  <tr key={rIdx} className="hover:bg-slate-50/80 transition">
                    {resolvedTable.columns.map((col: any, cIdx: number) => {
                      const key = col.key || col.label || col;
                      const val = row[key] ?? row[String(key).toLowerCase()] ?? '-';
                      const isNum = typeof val === 'number';
                      const isMoney =
                        isNum &&
                        (String(key).toLowerCase().includes('sales') ||
                          String(key).toLowerCase().includes('total') ||
                          String(key).toLowerCase().includes('amount') ||
                          String(key).toLowerCase().includes('revenue') ||
                          String(key).toLowerCase().includes('profit') ||
                          String(key).toLowerCase().includes('cost'));

                      return (
                        <td
                          key={cIdx}
                          className={`py-3 px-3.5 ${isNum ? 'font-mono text-slate-900' : ''}`}
                        >
                          {isMoney ? formatCurrencyOrNumber(val) : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-xs text-slate-500">
              <div>
                Showing {(page - 1) * pageSize + 1} to{' '}
                {Math.min(page * pageSize, processedRows.length)} of {processedRows.length} entries
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-semibold px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Markdown Narrative Tables & Sub-Sections ─────────────────────────── */}
      {sections.map((sec) => {
        // Skip executive summary (rendered in top callout)
        if (sec.type === 'executive_summary') return null;

        return (
          <div
            key={sec.id}
            className={`rounded-3xl border p-6 shadow-xs ${
              sec.type === 'observations'
                ? 'border-amber-200/80 bg-amber-50/20'
                : sec.type === 'recommendations'
                ? 'border-emerald-200/80 bg-emerald-50/20'
                : sec.type === 'limitations'
                ? 'border-slate-200 bg-slate-50/50'
                : 'border-slate-200/90 bg-white'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-4">
              {sec.type === 'observations' ? (
                <AlertCircle size={18} className="text-amber-600" />
              ) : sec.type === 'recommendations' ? (
                <CheckCircle2 size={18} className="text-emerald-600" />
              ) : sec.type === 'limitations' ? (
                <Info size={18} className="text-slate-500" />
              ) : (
                <Sparkles size={18} className="text-indigo-600" />
              )}
              <h2 className="text-[16px] font-bold text-slate-900">{sec.title}</h2>
            </div>

            {/* Paragraphs */}
            {sec.paragraphs.length > 0 && (
              <div className="space-y-2.5 text-[14px] text-slate-700 leading-relaxed mb-4">
                {sec.paragraphs.map((p, idx) => (
                  <p key={idx} className="m-0">
                    <CleanInlineText text={p} />
                  </p>
                ))}
              </div>
            )}

            {/* Markdown Narrative Table Rendered Beautifully */}
            {sec.table && sec.table.headers.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white my-4 shadow-2xs">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11.5px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      {sec.table.headers.map((h, hIdx) => (
                        <th key={hIdx} className="py-2.5 px-3.5">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {sec.table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/60 transition">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`py-2.5 px-3.5 ${
                              cell.includes('₹') || (!isNaN(Number(cell)) && cell.trim() !== '')
                                ? 'font-mono text-slate-900'
                                : ''
                            }`}
                          >
                            <CleanInlineText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bullet Points */}
            {sec.bullets.length > 0 && (
              <div className="space-y-2 text-[14px] text-slate-700">
                {sec.bullets.map((b, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 pl-1">
                    <span
                      className={`font-black text-sm mt-0.5 ${
                        sec.type === 'observations'
                          ? 'text-amber-600'
                          : sec.type === 'recommendations'
                          ? 'text-emerald-600'
                          : 'text-indigo-600'
                      }`}
                    >
                      •
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <CleanInlineText text={b} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Suggested Follow-up Inquiries ────────────────────────────────────── */}
      {resolvedFollowUps.length > 0 && (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs print:hidden">
          <div className="text-[12px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-600" />
            <span>Recommended Follow-up Investigations:</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {resolvedFollowUps.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onSelectFollowUp?.(q)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-700 text-[12.5px] font-medium transition cursor-pointer shadow-2xs"
              >
                <span>{q}</span>
                <ChevronRight size={13} className="text-slate-400 group-hover:text-indigo-600" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportDocumentViewer;
