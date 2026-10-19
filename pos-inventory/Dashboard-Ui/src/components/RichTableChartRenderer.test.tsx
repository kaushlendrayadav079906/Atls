import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  RichTableChartRenderer,
  formatCellValue,
} from './RichTableChartRenderer';
import { AIChatRenderer } from './AIChatRenderer';
import { FormattedMessage } from './FormattedMessage';
import type { StructuredTableResponse } from '../types/ai';

describe('RichTableChartRenderer Cell Formatting', () => {
  it('formats currency correctly in Indian Rupees (INR)', () => {
    const formatted = formatCellValue(2000, 'currency');
    expect(formatted.text).toContain('2,000');
    expect(formatted.text).toContain('₹');
  });

  it('formats number correctly with commas', () => {
    const formatted = formatCellValue(1500200, 'number');
    expect(formatted.text).toBe('15,00,200');
  });

  it('formats percentages correctly', () => {
    const formatted = formatCellValue(14.5, 'percentage');
    expect(formatted.text).toBe('14.5%');
  });

  it('formats positive and negative deltas with distinct styling classes', () => {
    const pos = formatCellValue(12.4, 'delta');
    expect(pos.text).toBe('+12.4');
    expect(pos.className).toContain('text-emerald-600');

    const neg = formatCellValue(-8.2, 'delta');
    expect(neg.text).toBe('-8.2');
    expect(neg.className).toContain('text-rose-600');

    const zero = formatCellValue(0, 'delta');
    expect(zero.text).toBe('0.00');
  });

  it('formats ISO dates to YYYY-MM-DD', () => {
    const d = formatCellValue('2026-10-13T10:00:00.000Z', 'date');
    expect(d.text).toBe('2026-10-13');
  });

  it('handles null, undefined, or empty values gracefully with a dash', () => {
    expect(formatCellValue(null, 'string').text).toBe('-');
    expect(formatCellValue(undefined, 'currency').text).toBe('-');
    expect(formatCellValue('', 'number').text).toBe('-');
  });
});

describe('RichTableChartRenderer Component', () => {
  const sampleTableData: StructuredTableResponse = {
    type: 'table',
    title: '2026-10-07 to 2026-10-13 Sales by Branch',
    summary: 'Total sales of ₹2,000.00 across 1 branches (1 invoices) for 2026-10-07 to 2026-10-13.',
    columns: [
      { key: 'branch', label: 'Branch / Warehouse', type: 'string' },
      { key: 'sales', label: 'Total Sales', type: 'currency' },
      { key: 'invoiceCount', label: 'Invoice Count', type: 'number' },
      { key: 'averageBill', label: 'Average Bill', type: 'currency' },
    ],
    rows: [
      {
        branch: 'SAHIBABAD (SH)',
        branchCode: 'SH',
        sales: 2000.0,
        invoiceCount: 1,
        averageBill: 2000.0,
      },
    ],
    filters: {
      period: '2026-10-07 to 2026-10-13',
      dateFrom: '2026-10-07',
      dateTo: '2026-10-13',
      groupBy: ['branch'],
      branch: 'SH',
    },
    chart: {
      type: 'bar',
      xKey: 'branch',
      series: ['sales'],
    },
  };

  it('renders populated table with title, summary, filters, and sequential row numbers', () => {
    const html = renderToStaticMarkup(<RichTableChartRenderer data={sampleTableData} />);

    // Header & summary
    expect(html).toContain('2026-10-07 to 2026-10-13 Sales by Branch');
    expect(html).toContain('Total sales of ₹2,000.00 across 1 branches');

    // Applied filter metadata
    expect(html).toContain('Date Period');
    expect(html).toContain('Date Range');
    expect(html).toContain('Branch / Site');
    expect(html).toContain('Grouping');

    // Column headers
    expect(html).toContain('Branch / Warehouse');
    expect(html).toContain('Total Sales');
    expect(html).toContain('Invoice Count');
    expect(html).toContain('Average Bill');

    // Sequential row number and row values
    expect(html).toContain('>1<'); // row #1
    expect(html).toContain('SAHIBABAD (SH)');
    expect(html).toContain('2,000.00');

    // Chart and Results tabs
    expect(html).toContain('Chart');
    expect(html).toContain('Results');
  });

  it('renders clean empty-data state when rows array is empty', () => {
    const emptyData: StructuredTableResponse = {
      type: 'table',
      title: 'Sales by Branch',
      summary: 'No sales records found for the period.',
      columns: [
        { key: 'branch', label: 'Branch', type: 'string' },
        { key: 'sales', label: 'Sales', type: 'currency' },
      ],
      rows: [],
      filters: { period: 'This Week', branch: 'CP' },
    };

    const html = renderToStaticMarkup(<RichTableChartRenderer data={emptyData} />);
    expect(html).toContain('No data records found');
    expect(html).toContain('There are no matching transactions');
  });

  it('renders gracefully when chart configuration is null/missing', () => {
    const noChartData: StructuredTableResponse = {
      ...sampleTableData,
      chart: null,
    };

    const html = renderToStaticMarkup(<RichTableChartRenderer data={noChartData} />);
    // Results table must be rendered
    expect(html).toContain('SAHIBABAD (SH)');
    expect(html).toContain('Results');
  });

  it('renders prominent error state when backend reports query error', () => {
    const errorData: StructuredTableResponse = {
      type: 'table',
      title: 'Query Failed',
      summary: '',
      columns: [],
      rows: [],
      error: 'Failed to fetch sales data from SAP: Network timeout',
    };

    const html = renderToStaticMarkup(<RichTableChartRenderer data={errorData} />);
    expect(html).toContain('Query Failed');
    expect(html).toContain('Failed to fetch sales data from SAP: Network timeout');
  });

  it('handles null/undefined data safely without crashing', () => {
    const html = renderToStaticMarkup(<RichTableChartRenderer data={null as any} />);
    expect(html).toBe('');
  });
});

describe('AIChatRenderer Integration and Backward Compatibility', () => {
  it('renders structured table when type is "table"', () => {
    const tableData: StructuredTableResponse = {
      type: 'table',
      title: 'Branch Breakdown',
      summary: 'Summary text',
      columns: [{ key: 'branch', label: 'Branch', type: 'string' }],
      rows: [{ branch: 'SH' }],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={tableData} />
      </MemoryRouter>
    );

    expect(html).toContain('Branch Breakdown');
    expect(html).toContain('SH');
  });

  it('prevents duplicate table rendering when backend provides cards[] containing the table', () => {
    const compositePayload = {
      type: 'table',
      title: 'Root Table Title',
      summary: 'Root summary',
      columns: [{ key: 'branch', label: 'Branch', type: 'string' }],
      rows: [{ branch: 'SH' }],
      cards: [
        {
          type: 'table',
          title: 'Card Table Title',
          summary: 'Card summary',
          columns: [{ key: 'branch', label: 'Branch', type: 'string' }],
          rows: [{ branch: 'SH' }],
        },
        {
          type: 'navigation',
          target: {
            target_module: 'reports_sales',
            label: 'Open Sales Reports',
            route: '/reports/sales',
          },
        },
      ],
      navigation: {
        target_module: 'reports_sales',
        label: 'Open Sales Reports',
        route: '/reports/sales',
      },
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={compositePayload} />
      </MemoryRouter>
    );

    // Should render the table from cards
    expect(html).toContain('Card Table Title');
    // Should NOT duplicate root table
    expect(html).not.toContain('Root Table Title');

    // Should render navigation button exactly once, not twice
    const navOccurrences = (html.match(/Open Sales Reports/g) || []).length;
    expect(navOccurrences).toBe(1);
  });

  it('preserves existing domain-specific renderer types (dashboard_summary, sales_orders, etc.)', () => {
    const summaryData = {
      type: 'dashboard_summary',
      summary: {
        period: 'Today',
        total_sales: 125000,
        invoice_count: 42,
        low_stock_count: 3,
        pending_approvals_count: 1,
      },
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={summaryData} />
      </MemoryRouter>
    );

    expect(html).toContain('Performance Overview');
    expect(html).toContain('Invoices Billed');
    expect(html).toContain('42');
  });

  it('preserves sales_orders card rendering', () => {
    const ordersData = {
      type: 'sales_orders',
      total_count: 2,
      orders: [
        { DocNum: 101, CardName: 'Customer A', DocDate: '2026-10-10', DocTotal: 5000 },
        { DocNum: 102, CardName: 'Customer B', DocDate: '2026-10-11', DocTotal: 7500 },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={ordersData} />
      </MemoryRouter>
    );

    expect(html).toContain('Sales Orders (2)');
    expect(html).toContain('Customer A');
    expect(html).toContain('101');
  });

  it('preserves purchase_orders card rendering', () => {
    const poData = {
      type: 'purchase_orders',
      total_count: 1,
      orders: [
        { DocNum: 501, CardName: 'Supplier X', DocDate: '2026-10-12', DocTotal: 12000 },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={poData} />
      </MemoryRouter>
    );

    expect(html).toContain('Purchase Orders (1)');
    expect(html).toContain('Supplier X');
  });

  it('preserves payment_report card rendering', () => {
    const payData = {
      type: 'payment_report',
      total_payments: 50000,
      distribution: [
        { method: 'UPI', amount: 35000, percentage: 70 },
        { method: 'Cash', amount: 15000, percentage: 30 },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={payData} />
      </MemoryRouter>
    );

    expect(html).toContain('Payment Channels Breakdown');
    expect(html).toContain('UPI');
    expect(html).toContain('70%');
  });

  it('preserves inventory_risk card rendering', () => {
    const riskData = {
      type: 'inventory_risk',
      items: [
        { ItemCode: 'ITEM-1', ItemName: 'Widget Alpha', QuantityOnStock: 2, MinimalStock: 10 },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={riskData} />
      </MemoryRouter>
    );

    expect(html).toContain('Low Stock Alert');
    expect(html).toContain('Widget Alpha');
  });

  it('preserves sap_offline card rendering', () => {
    const offlineData = {
      type: 'sap_offline',
      message: 'SAP Service Layer is unreachable.',
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={offlineData} />
      </MemoryRouter>
    );

    expect(html).toContain('Live SAP Service Unavailable');
    expect(html).toContain('SAP Service Layer is unreachable.');
  });

  it('renders finance_summary KPI grid correctly', () => {
    const financeSummaryData = {
      type: 'finance_summary',
      title: 'Monthly Financial Overview',
      period: 'This Month',
      summary: 'Verified accounting data from SAP Business One.',
      cards: [
        { title: 'Total Sales', value: 405180, format: 'currency', subtitle: '+12.5% vs prev' },
        { title: 'Total Purchases', value: 218460, format: 'currency', subtitle: '+8.2% vs prev' },
        { title: 'Gross Profit', value: 186720, format: 'currency', subtitle: '+18.4% vs prev' },
        { title: 'Gross Margin', value: '46.1%', subtitle: 'Net margin' }
      ]
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={financeSummaryData} />
      </MemoryRouter>
    );

    expect(html).toContain('Monthly Financial Overview');
    expect(html).toContain('This Month');
    expect(html).toContain('Total Sales');
    expect(html).toContain('4,05,180.00');
    expect(html).toContain('Total Purchases');
    expect(html).toContain('Gross Profit');
    expect(html).toContain('Gross Margin');
  });

  it('renders all three view toggle options (Chart, Results, Both)', () => {
    const tableWithChart = {
      type: 'table' as const,
      title: 'Revenue Comparison',
      summary: 'Revenue vs Purchases',
      columns: [
        { key: 'month', label: 'Month', type: 'string' as const },
        { key: 'sales', label: 'Sales', type: 'currency' as const }
      ],
      rows: [
        { month: 'Oct 2026', sales: 150000 },
        { month: 'Nov 2026', sales: 180000 }
      ],
      chart: {
        type: 'bar' as const,
        xKey: 'month',
        series: ['sales'],
        defaultView: 'both' as const
      }
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={tableWithChart} />
      </MemoryRouter>
    );

    expect(html).toContain('Chart');
    expect(html).toContain('Results');
    expect(html).toContain('Both');
    expect(html).toContain('Oct 2026');
    expect(html).toContain('1,50,000.00');
  });
  it('renders top_products card through interactive workspace with catalog button and tabs', () => {
    const topProductsCard = {
      type: 'top_products',
      title: 'Top Performing Products by Quantity',
      products: [
        { itemCode: 'ITM-001', itemName: 'Bearing Assembly', quantitySold: 250, salesAmount: 125000 },
        { itemCode: 'ITM-002', itemName: 'Gear Housing', quantitySold: 180, salesAmount: 90000 }
      ],
      meta: {
        ranking_by: 'quantity',
        ranking_label: 'Quantity Sold (Units)',
        limit: 5,
        date_range: 'This Month'
      }
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={topProductsCard} />
      </MemoryRouter>
    );

    // Header & ranking info
    expect(html).toContain('Top Performing Products by Quantity');
    expect(html).toContain('Quantity Sold (Units)');
    expect(html).toContain('Bearing Assembly');
    expect(html).toContain('ITM-001');
    expect(html).toContain('Gear Housing');

    // Action button to catalog
    expect(html).toContain('Open Products Catalog');

    // Workspace tabs and export
    expect(html).toContain('Chart');
    expect(html).toContain('Results');
    expect(html).toContain('Both');
    expect(html).toContain('Export');
  });

  it('renders pagination controls when rows exceed default page size (8)', () => {
    const manyRowsData: StructuredTableResponse = {
      type: 'table',
      title: 'Monthly Invoices List',
      summary: '12 invoices retrieved.',
      columns: [
        { key: 'docNum', label: 'Doc #', type: 'string' },
        { key: 'amount', label: 'Amount', type: 'currency' }
      ],
      rows: Array.from({ length: 12 }, (_, i) => ({
        docNum: `INV-100${i + 1}`,
        amount: (i + 1) * 1000
      })),
      chart: null
    };

    const html = renderToStaticMarkup(<RichTableChartRenderer data={manyRowsData} />);

    // Pagination elements
    expect(html).toContain('Page 1 of 2');
    expect(html).toContain('Showing 1-8 of 12');
    expect(html).toContain('Previous');
    expect(html).toContain('Next');
  });
});

describe('FormattedMessage Markdown and Bullets', () => {
  it('renders bold markdown as <strong> rather than raw asterisks', () => {
    const html = renderToStaticMarkup(
      <FormattedMessage content="Here is the **Revenue** for **May 2026**." />
    );
    expect(html).toContain('<strong');
    expect(html).toContain('Revenue');
    expect(html).toContain('May 2026');
    expect(html).not.toContain('**Revenue**');
  });

  it('renders bullet items with clean indicators', () => {
    const content = '• Date Range: Past 6 months\n• Metric: Total Sales (₹)';
    const html = renderToStaticMarkup(<FormattedMessage content={content} />);
    expect(html).toContain('Date Range: Past 6 months');
    expect(html).toContain('Metric: Total Sales (₹)');
  });
});

describe('Analytical User Examples (A through E)', () => {
  it('Example A: renders Top Products by sales with horizontal bar chart, table, KPIs, and insights', () => {
    const topProducts = {
      type: 'top_products',
      title: 'Top Performing Products by Sales',
      summary: 'Top 5 products ranked by total sales revenue.',
      products: [
        { itemCode: 'ITM-001', itemName: 'Bearing Assembly', quantitySold: 250, salesAmount: 125000 },
        { itemCode: 'ITM-002', itemName: 'Gear Housing', quantitySold: 180, salesAmount: 90000 },
        { itemCode: 'ITM-003', itemName: 'Shaft 20mm', quantitySold: 150, salesAmount: 60000 },
        { itemCode: 'ITM-004', itemName: 'Flange Coupling', quantitySold: 120, salesAmount: 48000 },
        { itemCode: 'ITM-005', itemName: 'V-Belt B42', quantitySold: 100, salesAmount: 35000 }
      ],
      meta: {
        ranking_by: 'sales_amount',
        ranking_label: 'Sales Revenue (₹)',
        limit: 5,
        date_range: 'Past Month',
        branch_scope: 'SH'
      }
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={topProducts} />
      </MemoryRouter>
    );

    // Answer table and metrics
    expect(html).toContain('Top Performing Products by Sales');
    expect(html).toContain('Bearing Assembly');
    expect(html).toContain('Gear Housing');
    expect(html).toContain('Shaft 20mm');
    expect(html).toContain('1,25,000.00');
    expect(html).toContain('Open Products Catalog');
    expect(html).toContain('Leading item: Bearing Assembly');
    // Views
    expect(html).toContain('Both');
    expect(html).toContain('Chart');
    expect(html).toContain('Results');
  });

  it('Example B: renders Sales trends for past 6 months with monthly breakdown and metrics', () => {
    const trendData: StructuredTableResponse = {
      type: 'table',
      title: 'Monthly Revenue (Past 6 Months)',
      summary: 'Total revenue of ₹7,50,000.00 across 320 invoices. Recent trend: Oct 2026 recorded an increase of ₹45,000.00 (+12.5%).',
      columns: [
        { key: 'month', label: 'Month', type: 'string' },
        { key: 'sales', label: 'Total Sales (₹)', type: 'currency' },
        { key: 'invoiceCount', label: 'Invoice Count', type: 'number' }
      ],
      rows: [
        { month: 'May 2026', sales: 90000, invoiceCount: 42 },
        { month: 'Jun 2026', sales: 110000, invoiceCount: 50 },
        { month: 'Jul 2026', sales: 125000, invoiceCount: 55 },
        { month: 'Aug 2026', sales: 130000, invoiceCount: 58 },
        { month: 'Sep 2026', sales: 140000, invoiceCount: 60 },
        { month: 'Oct 2026', sales: 155000, invoiceCount: 65 }
      ],
      kpis: [
        { label: 'Total Sales', value: '₹7,50,000.00', isPositive: true },
        { label: 'Invoices', value: 320 },
        { label: 'Latest Month', value: '₹1,55,000.00' }
      ],
      chart: {
        type: 'line',
        xKey: 'month',
        series: ['sales'],
        defaultView: 'both'
      },
      insights: [
        'Evaluated 6 monthly records showing steady sequential revenue growth.',
        'Peak revenue month was Oct 2026 with ₹1,55,000.00 billed.'
      ],
      filters: {
        period: 'Past 6 Months',
        branch: 'All Branches'
      }
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={trendData} />
      </MemoryRouter>
    );

    expect(html).toContain('Monthly Revenue (Past 6 Months)');
    expect(html).toContain('May 2026');
    expect(html).toContain('Oct 2026');
    expect(html).toContain('7,50,000.00');
    expect(html).toContain('Peak revenue month was Oct 2026');
    expect(html).toContain('Both');
    expect(html).toContain('Chart');
  });

  it('Example C: renders Low-stock products with safety thresholds and alert KPIs', () => {
    const lowStockCard = {
      type: 'inventory_risk',
      total_count: 3,
      items: [
        { ItemCode: 'RM-STEEL-01', ItemName: 'Cold Rolled Steel Sheet', QuantityOnStock: 4, MinimalStock: 25, WarehouseCode: 'SH' },
        { ItemCode: 'BLT-M8-50', ItemName: 'Hex Bolt M8x50 Grade 8.8', QuantityOnStock: 0, MinimalStock: 100, WarehouseCode: 'SH' },
        { ItemCode: 'NUT-M8', ItemName: 'Hex Nut M8 Zinc Plated', QuantityOnStock: 8, MinimalStock: 100, WarehouseCode: 'SH' }
      ],
      meta: {
        warehouse: 'SH',
        is_low_stock: true
      }
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={lowStockCard} />
      </MemoryRouter>
    );

    expect(html).toContain('Low Stock Alert (3 items)');
    expect(html).toContain('Cold Rolled Steel Sheet');
    expect(html).toContain('Hex Bolt M8x50 Grade 8.8');
    expect(html).toContain('Open Low Stock Inventory');
    expect(html).toContain('Out of Stock (0 units)');
    expect(html).toContain('Both');
    expect(html).toContain('Chart');
  });

  it('Example D: renders Pending production orders with planned vs produced and link', () => {
    const prodOrdersCard = {
      type: 'production_orders',
      total_count: 2,
      orders: [
        { production_order_no: 'PO-2026-101', item_name: 'Motor Assembly 1HP', status: 'Planned', planned_qty: 100, produced_qty: 40, pending_qty: 60, due_date: '2026-10-25' },
        { production_order_no: 'PO-2026-102', item_name: 'Stator Core Pack', status: 'Planned', planned_qty: 250, produced_qty: 150, pending_qty: 100, due_date: '2026-10-28' }
      ],
      summary: {
        planned_orders: 2,
        completed_orders: 0
      },
      meta: {
        warehouse: 'SH',
        status: 'pending'
      }
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={prodOrdersCard} />
      </MemoryRouter>
    );

    expect(html).toContain('Production Orders (2)');
    expect(html).toContain('Motor Assembly 1HP');
    expect(html).toContain('Stator Core Pack');
    expect(html).toContain('PO-2026-101');
    expect(html).toContain('Open Production Orders');
    expect(html).toContain('Both');
    expect(html).toContain('Chart');
  });

  it('Example E: renders Period comparison with current, previous, and percentage variance', () => {
    const compData: StructuredTableResponse = {
      type: 'table',
      title: 'Period Comparison: This Month (October 2026) vs Last Month (September 2026)',
      summary: 'This Month recorded ₹2,48,780.00 (65 invoices) compared to ₹1,20,000.00 (35 invoices) in Last Month. Net variance is +₹1,28,780.00 (+107.3%).',
      columns: [
        { key: 'period', label: 'Period / Timeline', type: 'string' },
        { key: 'sales', label: 'Total Sales (₹)', type: 'currency' },
        { key: 'invoiceCount', label: 'Invoices', type: 'number' },
        { key: 'averageBill', label: 'Average Bill (₹)', type: 'currency' }
      ],
      rows: [
        { period: 'This Month (October 2026)', sales: 248780, invoiceCount: 65, averageBill: 3827.38 },
        { period: 'Last Month (September 2026)', sales: 120000, invoiceCount: 35, averageBill: 3428.57 },
        { period: 'Variance (+107.3%)', sales: 128780, invoiceCount: 30, averageBill: 398.81 }
      ],
      chart: {
        type: 'bar',
        xKey: 'period',
        series: ['sales'],
        defaultView: 'both'
      },
      filters: {
        period: 'This Month vs Last Month',
        branch: 'SH'
      }
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AIChatRenderer structuredData={compData} />
      </MemoryRouter>
    );

    expect(html).toContain('Period Comparison');
    expect(html).toContain('This Month (October 2026)');
    expect(html).toContain('Last Month (September 2026)');
    expect(html).toContain('Variance (+107.3%)');
    expect(html).toContain('2,48,780.00');
    expect(html).toContain('1,28,780.00');
    expect(html).toContain('Both');
    expect(html).toContain('Chart');
  });
});
