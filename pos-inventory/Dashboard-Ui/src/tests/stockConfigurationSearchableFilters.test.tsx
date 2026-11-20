import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StockConfigurationPage } from '../pages/StockConfigurationPage';
import type { StockConfigurationResponse } from '../api/stockConfiguration';
import * as AuthContextModule from '../contexts/AuthContext';
import * as ThemeContextModule from '../contexts/ThemeContext';

describe('StockConfigurationPage Searchable Dropdowns and Expandable SO NO Column Search', () => {
  let queryClient: QueryClient;

  const mockResponse: StockConfigurationResponse = {
    items: [
      {
        sr_no: 1,
        item_code: 'CS0227',
        description: 'Socket Head Cap Screw',
        qty: 50,
        stock_qty: 120,
        vendor_name: 'Aditya Engineering Services',
        grpo_no: '473',
        rcvd_qty: 25,
        nt_weight: 10.5,
        qc: true,
        drw_yn: 'Y',
        v_chk: 'Y',
        ok_qty: 20,
        rej_qty: 5,
        lm: 'Y',
        olng: 'Y',
        lpk: 'Y',
        lbl: 'Y',
        mc_or_pt: 'Y',
        items_group_code: 'Fasteners',
        warehouse_code: '01',
        is_active: true,
        entry_date: '2026-11-14',
        so_no: '26271140',
        so_qty: 50,
        po_no: '1378',
        po_doc_entry: 871,
      },
      {
        sr_no: 2,
        item_code: 'BA0099',
        description: 'Bearing Assembly',
        qty: 10,
        stock_qty: 15,
        vendor_name: 'Precision Bearings Ltd',
        grpo_no: '474',
        rcvd_qty: 10,
        nt_weight: 2.5,
        qc: true,
        drw_yn: 'N',
        v_chk: 'Y',
        ok_qty: 10,
        rej_qty: 0,
        lm: 'N',
        olng: 'Y',
        lpk: 'Y',
        lbl: 'Y',
        mc_or_pt: 'N',
        items_group_code: 'Mechanical',
        warehouse_code: '02',
        is_active: true,
        entry_date: '2026-11-15',
        so_no: '26278899',
        so_qty: 10,
        po_no: '1379',
        po_doc_entry: 872,
      },
    ],
    total: 2,
    page: 1,
    page_size: 10,
    total_pages: 1,
    kpis: {
      total_items: 100,
      active_items: 95,
      inactive_items: 5,
      warehouses_count: 2,
    },
    filters: {
      vendors: ['Aditya Engineering Services', 'Precision Bearings Ltd'],
      groups: ['Fasteners', 'Mechanical'],
      warehouses: ['01', '02'],
    },
    sap_status: 'connected',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    queryClient.setQueryData(
      ['stock-configuration', { page: 1, page_size: 10 }],
      mockResponse
    );

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: '1',
        username: 'admin',
        role: 'admin',
        permissions: ['*'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as any);

    vi.spyOn(ThemeContextModule, 'useTheme').mockReturnValue({
      isDark: false,
      theme: 'light',
      toggleTheme: vi.fn(),
      setTheme: vi.fn(),
    });
  });

  const renderComponent = () => {
    return renderToStaticMarkup(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <StockConfigurationPage />
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  it('renders All Vendors, All Groups, and All Warehouses custom dropdown triggers with labels', () => {
    const html = renderComponent();
    expect(html).toContain('All Vendors');
    expect(html).toContain('All Groups');
    expect(html).toContain('All Warehouses');
  });

  it('renders SO NO column with heading and search icon button by default', () => {
    const html = renderComponent();
    expect(html).toContain('SO NO');
    expect(html).toContain('aria-label="Search SO NO"');
    expect(html).toContain('title="Search by Sales Order Number"');
  });

  it('renders both SO NO values in the table body', () => {
    const html = renderComponent();
    expect(html).toContain('26271140');
    expect(html).toContain('26278899');
  });

  it('preserves existing filter bar buttons: Apply Filters and Reset', () => {
    const html = renderComponent();
    expect(html).toContain('Apply Filters');
    expect(html).toContain('Reset');
  });
});

