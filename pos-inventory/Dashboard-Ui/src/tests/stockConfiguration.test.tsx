import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StockConfigurationPage } from '../pages/StockConfigurationPage';
import type { StockConfigurationResponse } from '../api/stockConfiguration';
import * as AuthContextModule from '../contexts/AuthContext';
import * as ThemeContextModule from '../contexts/ThemeContext';

describe('StockConfigurationPage SAP Read-Only Fields & QC Dropdown', () => {
  let queryClient: QueryClient;

  const mockResponse: StockConfigurationResponse = {
    items: [
      {
        sr_no: 1,
        item_code: 'FG001',
        description: 'Finished Good 1',
        qty: 115,
        stock_qty: 95,
        vendor_name: 'Bajaj Alliance',
        grpo_no: '5099',
        rcvd_qty: 115,
        nt_weight: 14.2,
        qc: true,
        drw_yn: 'Y',
        v_chk: 'Y',
        ok_qty: 110,
        rej_qty: 5,
        lm: 'Y',
        olng: 'Y',
        lpk: 'Y',
        lbl: 'Y',
        mc_or_pt: 'Y',
        items_group_code: 'Finished Goods',
        warehouse_code: '01',
        is_active: true,
        entry_date: '2024-08-12T10:35:00',
        last_submitted_at: '2026-11-13T10:55:00Z',
      },
      {
        sr_no: 2,
        item_code: 'PKG003',
        description: 'Packaging Material',
        qty: 200,
        stock_qty: 180,
        vendor_name: 'Kaushal Supplies',
        grpo_no: '5003',
        rcvd_qty: 180,
        nt_weight: 5.0,
        qc: false,
        drw_yn: 'Y',
        v_chk: 'Y',
        ok_qty: 180,
        rej_qty: 20,
        lm: 'Y',
        olng: 'Y',
        lpk: 'Y',
        lbl: 'Y',
        mc_or_pt: 'Y',
        items_group_code: 'Packaging',
        warehouse_code: '01',
        is_active: true,
        entry_date: '2023-03-05',
      },
    ],
    total: 2,
    page: 1,
    page_size: 10,
    total_pages: 1,
    kpis: {
      total_items: 1008,
      active_items: 982,
      inactive_items: 26,
      warehouses_count: 5,
    },
    filters: {
      vendors: ['Bajaj Alliance', 'Kaushal Supplies'],
      groups: ['Finished Goods', 'Packaging'],
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
        id: 'admin-1',
        username: 'Admin',
        email: 'admin@atlas.local',
        name: 'Administrator',
        role: 'admin',
        is_active: true,
        token_version: 1,
        permissions: ['*'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: true,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn(() => true),
      canAccess: vi.fn(() => true),
    });

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

  it('renders the stock configuration table with actual SAP KPI values', () => {
    const html = renderComponent();
    expect(html).toContain('Stock Configuration (SAP Items)');
    expect(html).toContain('1008'); // Total Items
    expect(html).toContain('982');  // Active Items
    expect(html).toContain('26');   // Inactive Items
    expect(html).toContain('5');    // Warehouses
  });

  it('renders SAP-owned fields as read-only text without editable input boxes', () => {
    const html = renderComponent();

    // SAP-owned fields for FG001
    expect(html).toContain('title="SAP GRPO: 5099"');
    expect(html).toContain('title="SAP Received Qty: 115"');
    expect(html).toContain('title="SAP OK Qty: 110"');
    expect(html).toContain('title="SAP Rejected Qty: 5"');
    expect(html).toContain('Finished Good 1');
    expect(html).toContain('Bajaj Alliance');

    // Confirm that table body does NOT have input boxes for these SAP-owned fields
    expect(html).not.toContain('value="115"');
    expect(html).not.toContain('value="5099"');
    expect(html).not.toContain('value="110"');
  });

  it('renders QC as a compact Y/N dropdown with arrow instead of a checkbox', () => {
    const html = renderComponent();

    // Table body QC must have select dropdown with Y and N options
    expect(html).toContain('<option value="Y" selected="">Y</option>');
    expect(html).toContain('<option value="N">N</option>');

    // Checkbox input for QC in the table rows must no longer exist
    expect(html).not.toContain('type="checkbox"');
  });

  it('maintains editable input for NT. WEIGHT and dropdowns for other configuration fields', () => {
    const html = renderComponent();

    // NT. WEIGHT is still an editable number input
    expect(html).toContain('step="0.1"');
    expect(html).toContain('value="14.2"');

    // DRW. Y/N, V CHK, LM, OLNG, I PK, LBL, MC or PT remain dropdowns
    expect(html).toContain('title="Laser Marking / Line Marking (PDN1.U_LM)"');
    expect(html).toContain('title="Oiling / Loading (PDN1.U_OLNG)"');
    expect(html).toContain('title="Inner Packing (PDN1.U_IPK)"');
  });

  it('renders exact 22 columns according to the updated SQL query', () => {
    const html = renderComponent();

    // 22 exact headers
    const expectedHeaders = [
      'SO NO', 'SAP CODE', 'Desc.', 'Qty.', 'Stock Qty.', 'VENDOR NAME',
      'GRPO No.', 'RCVD. Qty.', 'NT. WEIGHT', 'QC', 'DRW. Y/N', 'V CHK',
      'OK Qty.', 'Rej. Qty.', 'LM', 'OLNG', 'I PK', 'LBL', 'MC or PT',
      'Last Updated', 'Remarks', 'ACTIONS'
    ];
    for (const h of expectedHeaders) {
      expect(html).toContain(h);
    }
  });

  it('renders Last Updated column with date and time in Asia/Kolkata, or dash when not submitted', () => {
    const html = renderComponent();

    // Column header exists
    expect(html).toContain('Last Updated');

    // Not Submitted row (PKG003) shows empty dash with 'Not submitted' title
    expect(html).toContain('title="Not submitted"');
    expect(html).toContain('—');

    // Submitted row (FG001) shows date and time in Asia/Kolkata (13-11-2026 and 04:25 PM)
    expect(html).toContain('13-11-2026');
    expect(html).toContain('04:25 PM');
  });

  it('renders Action Submit button with Submit label and blue styling by default', () => {
    const html = renderComponent();

    expect(html).toContain('title="Submit row to database and SAP"');
    expect(html).toContain('bg-[#155EEF]');
    expect(html).toContain('<span>Submit</span>');
  });

  it('renders Remarks column between Last Updated and ACTIONS with GRPO placeholder', () => {
    const html = renderComponent();

    // Verify header exists with correct OPDN tooltip
    expect(html).toContain('Remarks');
    expect(html).toContain('Goods Receipt PO Remarks (OPDN.U_Remark)');

    // Verify compact text input placeholder
    expect(html).toContain('placeholder="GRPO Remarks..."');

    // Admin user should have enabled input
    expect(html).toContain('title="Enter GRPO Remark"');
  });

  it('renders REMARKS input as disabled with explanatory tooltip for non-admin users', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-2',
        username: 'Operator',
        email: 'op@atlas.local',
        name: 'Regular Operator',
        role: 'user',
        is_active: true,
        token_version: 1,
        permissions: ['products.view'],
      },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: vi.fn(() => true),
      canAccess: vi.fn(() => true),
    });

    const html = renderComponent();
    expect(html).toContain('disabled=""');
    expect(html).toContain('Access restricted: Only Admin users can add or modify GRPO remarks');
    expect(html).toContain('cursor-not-allowed');
  });
});
