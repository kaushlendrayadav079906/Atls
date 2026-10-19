import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { BusinessFlowchartRenderer } from './BusinessFlowchartRenderer';
import { RichTableChartRenderer } from './RichTableChartRenderer';
import type { FlowchartData, StructuredTableResponse } from '../types/ai';

describe('BusinessFlowchartRenderer Component', () => {
  const sampleFlowchart: FlowchartData = {
    id: 'sales_pos_flow',
    title: 'Order-to-Cash & Real-Time Invoicing Workflow',
    module: 'Sales & POS',
    description: 'Verified lifecycle of a retail sale from basket checkout to SAP AR Invoice creation and inventory deduction.',
    nodes: [
      {
        id: 'node_1',
        stepNumber: 1,
        title: 'Customer Cart Creation',
        type: 'start',
        badge: 'POS Terminal',
        description: 'Cashier scans barcodes or searches catalog items at active branch.',
        route: '/pos',
        routeLabel: 'Open POS'
      },
      {
        id: 'node_2',
        stepNumber: 2,
        title: 'Stock Availability Validation',
        type: 'decision',
        badge: 'SAP OITW',
        description: 'Checks on-hand physical inventory in branch warehouse before finalizing.',
        route: '/products',
        routeLabel: 'Check Stock'
      },
      {
        id: 'node_3',
        stepNumber: 3,
        title: 'Payment Settlement',
        type: 'process',
        badge: 'Cash / Card / UPI',
        description: 'Tender entered and verified across authorized payment methods.',
        route: '/pos',
        routeLabel: 'Collect Payment'
      },
      {
        id: 'node_4',
        stepNumber: 4,
        title: 'AR Invoice & Journal Entry',
        type: 'end',
        badge: 'SAP OINV',
        description: 'Fiscal tax invoice posted to SAP Service Layer with automatic inventory reduction.',
        route: '/sales',
        routeLabel: 'View Invoices'
      }
    ],
    edges: [
      { from: 'node_1', to: 'node_2', label: 'Item Scan Complete' },
      { from: 'node_2', to: 'node_3', label: 'Stock Verified', condition: 'Qty Available >= Requested' },
      { from: 'node_3', to: 'node_4', label: 'Payment Received' }
    ]
  };

  it('renders all steps, badges, node types, and navigation labels', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BusinessFlowchartRenderer data={sampleFlowchart} />
      </MemoryRouter>
    );

    // Module & title
    expect(html).toContain('Sales &amp; POS');
    expect(html).toContain('Order-to-Cash &amp; Real-Time Invoicing Workflow');
    expect(html).toContain('4 Steps');

    // Steps content
    expect(html).toContain('Customer Cart Creation');
    expect(html).toContain('Stock Availability Validation');
    expect(html).toContain('Payment Settlement');
    expect(html).toContain('AR Invoice &amp; Journal Entry');

    // Badges & types
    expect(html).toContain('POS Terminal');
    expect(html).toContain('SAP OITW');
    expect(html).toContain('SAP OINV');
    expect(html).toContain('decision');
    expect(html).toContain('start');
    expect(html).toContain('end');

    // Deep-links
    expect(html).toContain('Open POS');
    expect(html).toContain('Check Stock');
    expect(html).toContain('View Invoices');

    // Edge condition
    expect(html).toContain('Qty Available &gt;= Requested');
  });

  it('renders clean fallback when flowchart data is missing or invalid', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BusinessFlowchartRenderer data={null as any} />
      </MemoryRouter>
    );

    expect(html).toContain('No flowchart process definition available');
  });

  it('integrates seamlessly inside RichTableChartRenderer with Flowchart & Overview tabs', () => {
    const tableWithFlowchart: StructuredTableResponse = {
      type: 'table',
      title: 'Current Product Stock & Reorder Pipeline',
      summary: 'Verified stock inventory status across branch warehouses.',
      columns: [
        { key: 'itemCode', label: 'Item Code', type: 'string' },
        { key: 'stock', label: 'Stock (Units)', type: 'number' }
      ],
      rows: [
        { itemCode: 'ITEM-001', stock: 150 },
        { itemCode: 'ITEM-002', stock: 12 }
      ],
      chart: {
        type: 'bar',
        xKey: 'itemCode',
        series: ['stock'],
        defaultView: 'flowchart'
      },
      flowchart: sampleFlowchart,
      insights: [
        'ITEM-002 is approaching minimal reorder safety threshold.',
        'Total inventory turnover rate increased 4.2% over prior month.'
      ],
      kpis: [
        { label: 'Active Catalog SKUs', value: 2 },
        { label: 'Total Units on Hand', value: 162, subtext: 'Healthy stock ratio' }
      ]
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RichTableChartRenderer data={tableWithFlowchart} />
      </MemoryRouter>
    );

    // Verify all tabs are rendered
    expect(html).toContain('Overview');
    expect(html).toContain('Chart');
    expect(html).toContain('Results');
    expect(html).toContain('Flowchart');
    expect(html).toContain('Both');

    // Verify flowchart is displayed when defaultView is flowchart
    expect(html).toContain('Order-to-Cash &amp; Real-Time Invoicing Workflow');
    expect(html).toContain('Stock Availability Validation');
  });
});
