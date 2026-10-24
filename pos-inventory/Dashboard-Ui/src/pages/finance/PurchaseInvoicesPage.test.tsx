import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PurchaseInvoicesPage } from './PurchaseInvoicesPage';
import { financeApi } from '../../api/finance';
import { commonApi } from '../../api/common';

describe('PurchaseInvoicesPage Pagination & SAP Data Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.spyOn(commonApi, 'getFilterOptions').mockResolvedValue({
      branches: [
        { id: 1, name: 'Headquarters' },
        { id: 3, name: 'GZB' },
      ],
      payment_methods: [],
      price_lists: [],
    } as any);
  });

  it('renders pagination footer with default 10 records per page and correct indicators', async () => {
    vi.spyOn(financeApi, 'getPurchaseInvoices').mockResolvedValue({
      period: {
        range: 'all_time',
        label: 'All Dates (Total)',
        from_date: '2023-01-01',
        to_date: '2026-10-24',
      },
      summary: {
        total_invoices: 10,
        total_purchases: 9732.2,
        total_paid: 8608.0,
        total_outstanding_balance: 1124.2,
        currency: 'INR',
        status_counts: {
          open: 7,
          closed: 3,
          paid: 3,
          partially_paid: 2,
          unpaid: 5,
          cancelled: 0,
        },
      },
      total_count: 10,
      page: 1,
      page_size: 10,
      total_pages: 1,
      has_more: false,
      items: [
        {
          doc_entry: 10,
          doc_num: 1,
          doc_date: '2026-08-21',
          doc_due_date: '2026-09-21',
          card_code: 'VEN001',
          card_name: 'AMIT',
          doc_total: 118.0,
          paid_to_date: 0.0,
          balance_due: 118.0,
          payment_status: 'Unpaid',
          doc_status: 'Open',
          currency: 'INR',
          cancelled: 'tNO',
        },
      ],
      filters_applied: {},
    });

    // Populate React Query cache
    await queryClient.prefetchQuery({
      queryKey: ['purchase-invoices', 'all_time', '', '', '', '', '', 1, 10],
      queryFn: () => financeApi.getPurchaseInvoices(),
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PurchaseInvoicesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify header and KPI values
    expect(html).toContain('Purchase Invoices');
    expect(html).toContain('Verified A/P Vendor invoices and balances directly from SAP Business One (OPCH)');
    expect(html).toContain('₹9,732.2');
    expect(html).toContain('₹8,608');
    expect(html).toContain('₹1,124.2');

    // Verify pagination footer showing range and count
    expect(html).toContain('Showing');
    expect(html).toContain('1–10');
    expect(html).toContain('of');
    expect(html).toContain('10');
    expect(html).toContain('invoices');

    // Verify Per Page selector has default 10 selected
    expect(html).toContain('Per page:');
    expect(html).toContain('id="page-size-select"');

    // Verify page indicators and buttons
    expect(html).toContain('Page');
    expect(html).toContain('1');
    expect(html).toContain('of');
    expect(html).toContain('id="prev-page-btn"');
    expect(html).toContain('id="next-page-btn"');
    expect(html).toContain('id="page-btn-1"');
  });

  it('renders multi-page pagination for 47 invoices (example from requirements)', async () => {
    vi.spyOn(financeApi, 'getPurchaseInvoices').mockResolvedValue({
      period: {
        range: 'all_time',
        label: 'All Dates (Total)',
        from_date: '2023-01-01',
        to_date: '2026-10-24',
      },
      summary: {
        total_invoices: 47,
        total_purchases: 125000.0,
        total_paid: 100000.0,
        total_outstanding_balance: 25000.0,
        currency: 'INR',
        status_counts: {
          open: 20,
          closed: 27,
          paid: 25,
          partially_paid: 5,
          unpaid: 17,
          cancelled: 0,
        },
      },
      total_count: 47,
      page: 1,
      page_size: 10,
      total_pages: 5,
      has_more: true,
      items: Array.from({ length: 10 }, (_, i) => ({
        doc_entry: i + 1,
        doc_num: i + 1,
        doc_date: '2026-03-01',
        doc_due_date: '2026-03-31',
        card_code: `V00${i + 1}`,
        card_name: `Supplier ${i + 1}`,
        doc_total: 1000.0,
        paid_to_date: 500.0,
        balance_due: 500.0,
        payment_status: 'Partially Paid' as const,
        doc_status: 'Open',
        currency: 'INR',
        cancelled: 'tNO',
      })),
      filters_applied: {},
    });

    await queryClient.prefetchQuery({
      queryKey: ['purchase-invoices', 'all_time', '', '', '', '', '', 1, 10],
      queryFn: () => financeApi.getPurchaseInvoices(),
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PurchaseInvoicesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify 1-10 of 47 invoices indicator
    expect(html).toContain('1–10');
    expect(html).toContain('47');
    expect(html).toContain('Page');
    expect(html).toContain('5');

    // Page buttons for multiple pages
    expect(html).toContain('id="page-btn-1"');
    expect(html).toContain('id="page-btn-2"');
    expect(html).toContain('id="page-btn-5"');
  });
});
