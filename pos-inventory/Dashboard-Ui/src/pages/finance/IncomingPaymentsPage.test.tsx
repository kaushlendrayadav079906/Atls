import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import IncomingPaymentsPage from './IncomingPaymentsPage';
import { financeApi } from '../../api/finance';
import { commonApi } from '../../api/common';

describe('IncomingPaymentsPage Pagination & SAP Integration', () => {
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
    vi.spyOn(financeApi, 'getIncomingPayments').mockResolvedValue({
      summary: {
        total_receipts_count: 10,
        total_received_amount: 54000.0,
        currency: 'INR',
        method_breakdown: {
          bank_transfer: 34000.0,
          cash: 20000.0,
          other: 0.0,
        },
      },
      total_count: 10,
      page: 1,
      page_size: 10,
      total_pages: 1,
      has_more: false,
      items: [
        {
          doc_entry: 101,
          doc_num: 101,
          doc_date: '2026-08-22',
          card_code: 'CUST001',
          card_name: 'Alpha Traders',
          doc_currency: 'INR',
          cash_sum: 5000.0,
          transfer_sum: 10000.0,
          total_amount: 15000.0,
          payment_method: 'Transfer & Cash',
          applied_invoices_count: 2,
          applied_invoices: [],
        },
      ],
      filters_applied: {},
    });

    await queryClient.prefetchQuery({
      queryKey: ['incoming-payments', 'all_time', '', '', '', '', '', 1, 10],
      queryFn: () => financeApi.getIncomingPayments(),
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <IncomingPaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify header and KPI values
    expect(html).toContain('Incoming Payments');
    expect(html).toContain('₹54,000');
    expect(html).toContain('Alpha Traders');

    // Verify pagination footer showing range and count
    expect(html).toContain('Showing');
    expect(html).toContain('1–10');
    expect(html).toContain('of');
    expect(html).toContain('10');
    expect(html).toContain('payments');

    // Verify Per Page selector has default 10
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

  it('renders multi-page navigation for 35 incoming payment receipts', async () => {
    vi.spyOn(financeApi, 'getIncomingPayments').mockResolvedValue({
      summary: {
        total_receipts_count: 35,
        total_received_amount: 180000.0,
        currency: 'INR',
        method_breakdown: {
          bank_transfer: 120000.0,
          cash: 60000.0,
          other: 0.0,
        },
      },
      total_count: 35,
      page: 1,
      page_size: 10,
      total_pages: 4,
      has_more: true,
      items: Array.from({ length: 10 }, (_, i) => ({
        doc_entry: i + 1,
        doc_num: i + 1,
        doc_date: '2026-04-10',
        card_code: `C00${i + 1}`,
        card_name: `Customer ${i + 1}`,
        doc_currency: 'INR',
        cash_sum: 1000.0,
        transfer_sum: 4000.0,
        total_amount: 5000.0,
        payment_method: 'Transfer & Cash',
        applied_invoices_count: 1,
        applied_invoices: [],
      })),
      filters_applied: {},
    });

    await queryClient.prefetchQuery({
      queryKey: ['incoming-payments', 'all_time', '', '', '', '', '', 1, 10],
      queryFn: () => financeApi.getIncomingPayments(),
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <IncomingPaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify range
    expect(html).toContain('1–10');
    expect(html).toContain('35');
    expect(html).toContain('Page');
    expect(html).toContain('4');

    // Page buttons
    expect(html).toContain('id="page-btn-1"');
    expect(html).toContain('id="page-btn-2"');
    expect(html).toContain('id="page-btn-4"');
  });
});
