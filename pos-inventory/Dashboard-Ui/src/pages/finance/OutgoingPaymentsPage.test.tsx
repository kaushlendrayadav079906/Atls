import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OutgoingPaymentsPage from './OutgoingPaymentsPage';
import { financeApi } from '../../api/finance';
import { commonApi } from '../../api/common';

describe('OutgoingPaymentsPage Pagination & SAP Integration', () => {
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
    vi.spyOn(financeApi, 'getOutgoingPayments').mockResolvedValue({
      summary: {
        total_vouchers_count: 10,
        total_disbursed_amount: 45000.0,
        currency: 'INR',
        method_breakdown: {
          bank_transfer: 30000.0,
          cash: 15000.0,
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
          doc_entry: 201,
          doc_num: 201,
          doc_date: '2026-08-23',
          card_code: 'VEN001',
          card_name: 'Beta Suppliers',
          doc_currency: 'INR',
          cash_sum: 5000.0,
          transfer_sum: 10000.0,
          total_amount: 15000.0,
          payment_method: 'Bank Transfer',
          applied_purchase_invoices_count: 1,
          applied_invoices: [],
        },
      ],
      filters_applied: {},
    });

    await queryClient.prefetchQuery({
      queryKey: ['outgoing-payments', 'all_time', '', '', '', '', '', 1, 10],
      queryFn: () => financeApi.getOutgoingPayments(),
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OutgoingPaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify header and KPI values
    expect(html).toContain('Outgoing Vendor Payments');
    expect(html).toContain('₹45,000');
    expect(html).toContain('Beta Suppliers');

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

  it('renders multi-page navigation for 25 outgoing payment vouchers', async () => {
    vi.spyOn(financeApi, 'getOutgoingPayments').mockResolvedValue({
      summary: {
        total_vouchers_count: 25,
        total_disbursed_amount: 110000.0,
        currency: 'INR',
        method_breakdown: {
          bank_transfer: 80000.0,
          cash: 30000.0,
          other: 0.0,
        },
      },
      total_count: 25,
      page: 1,
      page_size: 10,
      total_pages: 3,
      has_more: true,
      items: Array.from({ length: 10 }, (_, i) => ({
        doc_entry: i + 1,
        doc_num: i + 1,
        doc_date: '2026-05-15',
        card_code: `V00${i + 1}`,
        card_name: `Vendor ${i + 1}`,
        doc_currency: 'INR',
        cash_sum: 2000.0,
        transfer_sum: 3000.0,
        total_amount: 5000.0,
        payment_method: 'Bank Transfer',
        applied_purchase_invoices_count: 1,
        applied_invoices: [],
      })),
      filters_applied: {},
    });

    await queryClient.prefetchQuery({
      queryKey: ['outgoing-payments', 'all_time', '', '', '', '', '', 1, 10],
      queryFn: () => financeApi.getOutgoingPayments(),
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OutgoingPaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify range
    expect(html).toContain('1–10');
    expect(html).toContain('25');
    expect(html).toContain('Page');
    expect(html).toContain('3');

    // Page buttons
    expect(html).toContain('id="page-btn-1"');
    expect(html).toContain('id="page-btn-2"');
    expect(html).toContain('id="page-btn-3"');
  });
});
