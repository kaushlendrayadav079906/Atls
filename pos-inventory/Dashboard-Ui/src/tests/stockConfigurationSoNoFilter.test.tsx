import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StockConfigurationPage } from '../pages/StockConfigurationPage';
import type { StockConfigurationResponse } from '../api/stockConfiguration';
import * as AuthContextModule from '../contexts/AuthContext';
import * as ThemeContextModule from '../contexts/ThemeContext';

describe('StockConfigurationPage SO No. Search Field and Filtering', () => {
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
    ],
    total: 1,
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
      vendors: ['Aditya Engineering Services'],
      groups: ['Fasteners'],
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

  it('renders dedicated Search SO No. input field with correct placeholder and attributes', () => {
    const html = renderComponent();
    expect(html).toContain('placeholder="Search SO No."');
    expect(html).toContain('aria-label="Search SO No."');
  });

  it('positions Search SO No. before All Warehouses dropdown in filter row', () => {
    const html = renderComponent();
    const soNoPos = html.indexOf('placeholder="Search SO No."');
    const warehousePos = html.indexOf('All Warehouses');
    const vendorPos = html.indexOf('All Vendors');
    const groupPos = html.indexOf('All Groups');

    expect(soNoPos).toBeGreaterThan(-1);
    expect(warehousePos).toBeGreaterThan(-1);
    expect(vendorPos).toBeGreaterThan(-1);
    expect(groupPos).toBeGreaterThan(-1);

    // Order in filter row: Search -> Vendor -> Group -> SO No. -> Warehouse -> Apply Filters -> Reset
    expect(vendorPos).toBeLessThan(soNoPos);
    expect(groupPos).toBeLessThan(soNoPos);
    expect(soNoPos).toBeLessThan(warehousePos);
  });

  it('preserves existing Search, Vendor, Group, and Warehouse filters alongside Apply and Reset buttons', () => {
    const html = renderComponent();
    expect(html).toContain('placeholder="Search by SAP code, description, or vendor name..."');
    expect(html).toContain('All Vendors');
    expect(html).toContain('All Groups');
    expect(html).toContain('All Warehouses');
    expect(html).toContain('Apply Filters');
    expect(html).toContain('Reset');
  });
});
