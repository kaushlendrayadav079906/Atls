import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportDocumentViewer } from './ReportDocumentViewer';
import type { AIAssistantChatResponse } from '../api/endpoints';
import { TrendingUp } from 'lucide-react';

describe('ReportDocumentViewer Component', () => {
  const sampleReportData: AIAssistantChatResponse = {
    answer: `### Executive Summary
The business generated **₹81,798.88** in net sales across **55 invoices**.
Operating performance indicates stable momentum across key accounts.

### Key Financial Metrics
| Metric | Amount | Supporting Documents |
| Total Net Sales Revenue | ₹81,798.88 | 55 invoices |
| Total Purchase Cost | ₹55,100.00 | 28 invoices |
| Gross Margin | 32.6% | Calculated |

### Key Findings & Observations
- Net revenue increased by 14% compared to the prior period.
- Top 3 customers contributed 42% of total order value.
- Outstanding balance stands at ₹12,450.00 across 4 pending invoices.

### Strategic Recommendations
- Implement priority collections for overdue accounts.
- Review discount thresholds for wholesale clients.

### Audit Notes & Limitations
Calculated based on posted A/R Invoices with Cancelled != 'tYES'. Excludes voided drafts.`,
    tool_calls: [
      {
        id: 'call_1',
        name: 'get_sales_report',
        arguments: { date_from: '2026-01-01', date_to: '2026-10-24' },
      },
    ],
    structured_data: {
      type: 'report',
      title: 'Sales & Revenue Performance Audit',
      summary: 'Verified executive summary of SAP Business One sales performance.',
      kpis: [
        { label: 'Total Net Sales Revenue', value: '₹81,798.88', count: 55, unit: 'invoices' },
        { label: 'Total Purchase Cost', value: '₹55,100.00', count: 28, unit: 'invoices' },
        { label: 'Gross Margin', value: '32.6%', unit: '%' },
      ],
      chart: {
        type: 'bar',
        title: 'Monthly Revenue vs Costs',
        xKey: 'period',
        series: ['sales', 'cost'],
        data: [
          { period: 'Jan 2026', sales: 25000, cost: 18000 },
          { period: 'Feb 2026', sales: 30000, cost: 20000 },
          { period: 'Mar 2026', sales: 26798.88, cost: 17100 },
        ],
      },
      columns: [
        { key: 'DocNum', label: 'Invoice #' },
        { key: 'DocDate', label: 'Date' },
        { key: 'CardName', label: 'Customer' },
        { key: 'DocTotal', label: 'Total (INR)' },
      ],
      rows: [
        { DocNum: 101, DocDate: '2026-03-01', CardName: 'Acme Corp', DocTotal: 15000 },
        { DocNum: 102, DocDate: '2026-03-05', CardName: 'Beta Industries', DocTotal: 11798.88 },
      ],
      suggested_followups: [
        'Break down sales by customer territory',
        'Compare sales against Q1 targets',
      ],
    },
    trace_id: 'trace_test_123',
    sap_connected: true,
  };

  it('renders report header with verified SAP metadata and clean badges', () => {
    const html = renderToStaticMarkup(
      <ReportDocumentViewer
        reportData={sampleReportData}
        categoryName="Sales & Revenue Performance"
        categoryIcon={TrendingUp}
        categoryBadge="A/R Invoices & Orders"
        dateLabel="All Dates (Total)"
        branchLabel="Main Branch"
        generatedAt="24 Oct 2026, 12:30 PM"
        reportDepth="detailed"
        onRegenerate={() => {}}
      />
    );

    // Title and metadata
    expect(html).toContain('Sales &amp; Revenue Performance Audit');
    expect(html).toContain('A/R Invoices &amp; Orders');
    expect(html).toContain('Verified SAP Business One Source');
    expect(html).toContain('All Dates (Total)');
    expect(html).toContain('Main Branch');
    expect(html).toContain('24 Oct 2026, 12:30 PM');
  });

  it('transforms raw markdown tables into clean semantic HTML tables without pipe characters', () => {
    const html = renderToStaticMarkup(
      <ReportDocumentViewer
        reportData={sampleReportData}
        categoryName="Sales & Revenue Performance"
        categoryIcon={TrendingUp}
        categoryBadge="A/R Invoices & Orders"
        dateLabel="All Dates"
        branchLabel="All Branches"
        generatedAt="24 Oct 2026"
        reportDepth="detailed"
        onRegenerate={() => {}}
      />
    );

    // Should NOT contain literal markdown table pipes
    expect(html).not.toContain('| Total Net Sales Revenue |');
    // Should render semantic table tags
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Supporting Documents');
    expect(html).toContain('Total Net Sales Revenue');
  });

  it('strips markdown heading symbols (###) and bold asterisks (**) from narrative text', () => {
    const html = renderToStaticMarkup(
      <ReportDocumentViewer
        reportData={sampleReportData}
        categoryName="Sales & Revenue Performance"
        categoryIcon={TrendingUp}
        categoryBadge="A/R Invoices & Orders"
        dateLabel="All Dates"
        branchLabel="All Branches"
        generatedAt="24 Oct 2026"
        reportDepth="detailed"
        onRegenerate={() => {}}
      />
    );

    // Ensure raw symbols do not leak into text nodes
    expect(html).not.toContain('### Executive Summary');
    expect(html).not.toContain('**₹81,798.88**');
    expect(html).not.toContain('**55 invoices**');
    expect(html).toContain('Executive Briefing &amp; Synthesis');
    expect(html).toContain('₹81,798.88');
  });

  it('renders verified KPI cards with currency and document counts', () => {
    const html = renderToStaticMarkup(
      <ReportDocumentViewer
        reportData={sampleReportData}
        categoryName="Sales & Revenue Performance"
        categoryIcon={TrendingUp}
        categoryBadge="A/R Invoices & Orders"
        dateLabel="All Dates"
        branchLabel="All Branches"
        generatedAt="24 Oct 2026"
        reportDepth="detailed"
        onRegenerate={() => {}}
      />
    );

    expect(html).toContain('Total Net Sales Revenue');
    expect(html).toContain('₹81,798.88');
    expect(html).toContain('55 invoices');
    expect(html).toContain('Total Purchase Cost');
    expect(html).toContain('Gross Margin');
  });

  it('renders structured record table with pagination and column headers', () => {
    const html = renderToStaticMarkup(
      <ReportDocumentViewer
        reportData={sampleReportData}
        categoryName="Sales & Revenue Performance"
        categoryIcon={TrendingUp}
        categoryBadge="A/R Invoices & Orders"
        dateLabel="All Dates"
        branchLabel="All Branches"
        generatedAt="24 Oct 2026"
        reportDepth="detailed"
        onRegenerate={() => {}}
      />
    );

    expect(html).toContain('Detailed Operational Records');
    expect(html).toContain('Invoice #');
    expect(html).toContain('Customer');
    expect(html).toContain('Acme Corp');
    expect(html).toContain('Beta Industries');
    expect(html).toContain('Total (INR)');
  });

  it('renders visual breakdown chart section with real series', () => {
    const html = renderToStaticMarkup(
      <ReportDocumentViewer
        reportData={sampleReportData}
        categoryName="Sales & Revenue Performance"
        categoryIcon={TrendingUp}
        categoryBadge="A/R Invoices & Orders"
        dateLabel="All Dates"
        branchLabel="All Branches"
        generatedAt="24 Oct 2026"
        reportDepth="detailed"
        onRegenerate={() => {}}
      />
    );

    expect(html).toContain('Visual Breakdown');
    expect(html).toContain('Sales &amp; Revenue Performance');
    // Recharts container placeholder in SSR markup
    expect(html).toContain('recharts-responsive-container');
  });

  it('handles empty chart data gracefully without inventing false data', () => {
    const noChartData: AIAssistantChatResponse = {
      answer: '### Executive Summary\nNo transactional records found for this period.',
      tool_calls: [],
      structured_data: {
        type: 'report',
        title: 'Empty Report',
        kpis: [],
      },
      sap_connected: true,
    };

    const html = renderToStaticMarkup(
      <ReportDocumentViewer
        reportData={noChartData}
        categoryName="Finance & Gross Profitability"
        categoryIcon={TrendingUp}
        categoryBadge="A/R vs A/P"
        dateLabel="Custom"
        branchLabel="All Branches"
        generatedAt="24 Oct 2026"
        reportDepth="detailed"
        onRegenerate={() => {}}
      />
    );

    expect(html).toContain('No Transactional Data to Chart');
    expect(html).toContain('No visual trends available because the SAP query returned 0 records for this period.');
  });

  it('renders strategic recommendations and audit limitations sections', () => {
    const html = renderToStaticMarkup(
      <ReportDocumentViewer
        reportData={sampleReportData}
        categoryName="Sales & Revenue Performance"
        categoryIcon={TrendingUp}
        categoryBadge="A/R Invoices & Orders"
        dateLabel="All Dates"
        branchLabel="All Branches"
        generatedAt="24 Oct 2026"
        reportDepth="detailed"
        onRegenerate={() => {}}
      />
    );

    expect(html).toContain('Strategic Recommendations');
    expect(html).toContain('Implement priority collections for overdue accounts.');
    expect(html).toContain('Audit Notes &amp; Limitations');
    expect(html).toContain('Calculated based on posted A/R Invoices');
  });

  it('renders suggested follow-up questions for deeper enterprise inquiry', () => {
    const html = renderToStaticMarkup(
      <ReportDocumentViewer
        reportData={sampleReportData}
        categoryName="Sales & Revenue Performance"
        categoryIcon={TrendingUp}
        categoryBadge="A/R Invoices & Orders"
        dateLabel="All Dates"
        branchLabel="All Branches"
        generatedAt="24 Oct 2026"
        reportDepth="detailed"
        onRegenerate={() => {}}
      />
    );

    expect(html).toContain('Recommended Follow-up Investigations');
    expect(html).toContain('Break down sales by customer territory');
    expect(html).toContain('Compare sales against Q1 targets');
  });
});
