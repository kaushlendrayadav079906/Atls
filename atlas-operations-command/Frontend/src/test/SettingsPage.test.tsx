import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../pages/SettingsPage';
import { AuthProvider } from '../context/AuthContext';
import { localizationService } from '../services/localizationService';
import { currencyService } from '../services/currencyService';
import { taxService } from '../services/taxService';
import { businessDataService } from '../services/businessDataService';
import { factoryService } from '../services/factoryService';
import { reportService } from '../services/reportService';
import { realtimeService } from '../services/realtimeService';
import { aiRiskService } from '../services/aiRiskService';

// Mock services
vi.mock('../services/localizationService', () => ({
  localizationService: {
    getConfig: vi.fn(),
    getCurrentFiscalYear: vi.fn(),
    getFiscalYearForDate: vi.fn(),
    updateCompanySettings: vi.fn(),
  },
}));

vi.mock('../services/currencyService', () => ({
  currencyService: {
    getExchangeRates: vi.fn(),
    createExchangeRate: vi.fn(),
    convertCurrency: vi.fn(),
  },
}));

vi.mock('../services/taxService', () => ({
  taxService: {
    calculateTax: vi.fn(),
  },
}));

vi.mock('../services/businessDataService', () => ({
  businessDataService: {
    getOrganicData: vi.fn().mockResolvedValue({
      active_factories: 4,
      total_revenue: 1250000,
      net_profit: 320000,
    }),
    getMonthlyTrend: vi.fn().mockResolvedValue([]),
    getReceivables: vi.fn().mockResolvedValue({ total_receivables: 120000, overdue_30_days: 15000 }),
    getPayables: vi.fn().mockResolvedValue({ total_payables: 85000, overdue_30_days: 5000 }),
    getInventory: vi.fn().mockResolvedValue({ total_inventory_value: 450000, low_stock_items: 2 }),
    getProduction: vi.fn().mockResolvedValue({ monthly_output_units: 50000, achievement_rate_pct: 95 }),
  },
}));

vi.mock('../services/factoryService', () => ({
  factoryService: {
    listFactories: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/reportService', () => ({
  reportService: {
    getTopCustomers: vi.fn().mockResolvedValue([]),
    getSalesByProduct: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/realtimeService', () => ({
  realtimeService: {
    getOperationalHealth: vi.fn().mockResolvedValue({ operational_health_pct: 98 }),
    getSummary: vi.fn().mockResolvedValue({
      operational_pulse: { operational_health_pct: 98 },
      financial_pulse: {},
      risk_summary: {},
    }),
  },
}));

vi.mock('../services/aiRiskService', () => ({
  aiRiskService: {
    getActions: vi.fn().mockResolvedValue([]),
    resolveAction: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 'user-admin-1',
      email: 'admin@acme.corp',
      full_name: 'Lead Admin',
      status: 'active',
      company_id: 'tenant-ind-12345',
      role: 'admin',
    }),
    logout: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

const mockConfigINR = {
  company_id: 'tenant-ind-12345',
  name: 'Acme Bharat Operations Ltd',
  country_code: 'IN',
  state_code: 'MH',
  timezone: 'Asia/Kolkata',
  locale: 'en_IN',
  currency_code: 'INR',
  gstin: '27AABCU9603R1ZM',
  tax_id: 'PAN1234567',
  default_tax_rate: '18.00',
  fiscal_year_start_month: 4,
  formatting: {
    currency_symbol: '₹',
    currency_decimals: 2,
    date_format: 'DD/MM/YYYY',
    decimal_separator: '.',
    thousands_separator: ',',
  },
};

const mockFiscalYear = {
  company_id: 'tenant-ind-12345',
  fiscal_year_start_month: 4,
  as_of_date: '2026-09-09',
  fiscal_year: 2026,
  fiscal_year_label: 'FY 2026-27',
  fiscal_quarter: 2,
  fiscal_quarter_label: 'Q2',
  fiscal_period: 6,
  fiscal_year_start_date: '2026-04-01',
  fiscal_year_end_date: '2027-03-31',
  quarter_start_date: '2026-07-01',
  quarter_end_date: '2026-09-30',
};

const mockRates = [
  {
    from_currency: 'INR',
    to_currency: 'USD',
    rate: 0.012,
    effective_date: '2026-09-01',
  },
  {
    from_currency: 'INR',
    to_currency: 'EUR',
    rate: 0.011,
    effective_date: '2026-09-01',
  },
];

describe('Settings Modal & Financial Localization Suite (Frontend Unit 7 UI Match)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    localStorage.setItem('atlasops_token', 'mock_token_abc');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 'user-admin-1',
        email: 'admin@acme.corp',
        role: 'admin',
        company_id: 'tenant-ind-12345',
      })
    );

    (localizationService.getConfig as any).mockResolvedValue(mockConfigINR);
    (localizationService.getCurrentFiscalYear as any).mockResolvedValue(mockFiscalYear);
    (currencyService.getExchangeRates as any).mockResolvedValue(mockRates);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AuthProvider>
          <SettingsPage />
        </AuthProvider>
      </MemoryRouter>
    );

  it('1. Clicking Settings opens modal directly over dashboard with no old landing hub cards', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Old landing page text should NOT be present
    expect(screen.queryByText(/Open Settings Modal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Return to Command Dashboard/i)).not.toBeInTheDocument();

    // Modal elements are present
    expect(screen.getByText(/Manage company localization, financial configuration, currency and tax settings/i)).toBeInTheDocument();
    expect(screen.getAllByText('INR').length).toBeGreaterThan(0);
  });

  it('2. Settings modal contains all 5 required navigation items and Company Settings info card', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Company Localization/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fiscal Year & Calendar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Currency Converter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exchange Rates/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GST \/ Tax Calculator/i })).toBeInTheDocument();

    // Company Settings Information Card
    expect(screen.getByText(/Company Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/These settings are specific to your company and affect financial and tax calculations/i)).toBeInTheDocument();
  });

  it('3. Company Localization renders inner card with Admin Access badge and 3-column field structure', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue('IN')).toBeInTheDocument();
    });

    expect(screen.getByText(/Admin Access/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('MH')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Asia/Kolkata')).toBeInTheDocument();
    expect(screen.getByDisplayValue('en_IN')).toBeInTheDocument();
    expect(screen.getByDisplayValue('INR')).toBeInTheDocument();
    expect(screen.getByDisplayValue('27AABCU9603R1ZM')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PAN1234567')).toBeInTheDocument();
    expect(screen.getByDisplayValue('18.00')).toBeInTheDocument();
  });

  it('4. Switching to Fiscal Year & Calendar replaces right content with FiscalYearCard', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const fyNav = screen.getByRole('button', { name: /Fiscal Year & Calendar/i });
    await userEvent.click(fyNav);

    expect(screen.getAllByText(/FY 2026-27/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2026-04-01 → 2027-03-31/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-07-01 → 2026-09-30/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Q2/i).length).toBeGreaterThan(0);
  });

  it('5. Fiscal year date lookup inside modal invokes backend API deterministically', async () => {
    (localizationService.getFiscalYearForDate as any).mockResolvedValue({
      company_id: 'tenant-ind-12345',
      fiscal_year_start_month: 4,
      as_of_date: '2025-11-15',
      fiscal_year: 2025,
      fiscal_year_label: 'FY 2025-26',
      fiscal_quarter: 3,
      fiscal_quarter_label: 'Q3',
      fiscal_period: 8,
      fiscal_year_start_date: '2025-04-01',
      fiscal_year_end_date: '2026-03-31',
      quarter_start_date: '2025-10-01',
      quarter_end_date: '2025-12-31',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const fyNav = screen.getByRole('button', { name: /Fiscal Year & Calendar/i });
    await userEvent.click(fyNav);

    const lookupInput = screen.getByLabelText(/Lookup Date/i);
    await userEvent.type(lookupInput, '2025-11-15');

    const queryBtn = screen.getByRole('button', { name: /Check Period/i });
    await userEvent.click(queryBtn);

    await waitFor(() => {
      expect(localizationService.getFiscalYearForDate).toHaveBeenCalledWith('2025-11-15');
    });

    await waitFor(() => {
      expect(screen.getByText(/2025-04-01 → 2026-03-31/i)).toBeInTheDocument();
    });
  });

  it('6. Currency Converter tab invokes backend currency conversion without client-side calc', async () => {
    (currencyService.convertCurrency as any).mockResolvedValue({
      original_amount: 1000,
      from_currency: 'INR',
      to_currency: 'USD',
      exchange_rate: 0.012,
      converted_amount: 12,
      target_date: '2026-09-01',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const currNav = screen.getByRole('button', { name: /Currency Converter/i });
    await userEvent.click(currNav);

    const convertBtn = screen.getByRole('button', { name: /^Convert$/i });
    await userEvent.click(convertBtn);

    await waitFor(() => {
      expect(currencyService.convertCurrency).toHaveBeenCalled();
    });

    expect(screen.getByText(/Applied Rate: 1 INR = 0.012 USD/i)).toBeInTheDocument();
  });

  it('7. Exchange Rates tab renders rates list and provides direct rate pair creation for admin', async () => {
    (currencyService.createExchangeRate as any).mockResolvedValue({
      from_currency: 'INR',
      to_currency: 'GBP',
      rate: 0.0095,
      effective_date: '2026-09-09',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const fxNav = screen.getByRole('button', { name: /Exchange Rates/i });
    await userEvent.click(fxNav);

    expect(screen.getByText(/1 INR = 0.012 USD/i)).toBeInTheDocument();
    expect(screen.getByText(/1 INR = 0.011 EUR/i)).toBeInTheDocument();

    const addRateBtn = screen.getByRole('button', { name: /Add Rate/i });
    await userEvent.click(addRateBtn);

    expect(screen.getByText(/Register Direct Rate Pair/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Rate Pair/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(currencyService.createExchangeRate).toHaveBeenCalled();
    });
  });

  it('8. Non-admin user sees Standard User (Read-Only) badge and cannot see exchange rate mutation controls', async () => {
    const { authService } = await import('../services/authService');
    (authService.getCurrentUser as any).mockResolvedValueOnce({
      id: 'user-viewer-1',
      email: 'viewer@acme.corp',
      role: 'viewer',
      company_id: 'tenant-ind-12345',
      full_name: 'Standard Viewer',
      status: 'active',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText(/Standard User \(Read-Only\)/i)).toBeInTheDocument();

    const fxNav = screen.getByRole('button', { name: /Exchange Rates/i });
    await userEvent.click(fxNav);

    expect(screen.queryByRole('button', { name: /Add Rate/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Admin-Only Management/i)).toBeInTheDocument();
  });

  it('9. GST / Tax Calculator renders and invokes backend tax calculation API', async () => {
    (taxService.calculateTax as any).mockResolvedValue({
      original_amount: 10000,
      taxable_amount: 10000,
      tax_rate: 18,
      total_tax: 1800,
      total_amount: 11800,
      cgst_rate: 9,
      cgst_amount: 900,
      sgst_rate: 9,
      sgst_amount: 900,
      igst_rate: 0,
      igst_amount: 0,
      jurisdiction_type: 'INTRA_STATE',
      is_tax_inclusive: false,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const gstNav = screen.getByRole('button', { name: /GST \/ Tax Calculator/i });
    await userEvent.click(gstNav);

    expect(screen.getByText(/GST \/ Tax Calculation/i)).toBeInTheDocument();

    const calcBtn = screen.getByRole('button', { name: /Calculate GST/i });
    await userEvent.click(calcBtn);

    await waitFor(() => {
      expect(taxService.calculateTax).toHaveBeenCalled();
    });

    expect(screen.getByText(/INTRA_STATE/i)).toBeInTheDocument();
    expect(screen.getByText(/CGST \(9%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/SGST \(9%\)/i)).toBeInTheDocument();
  });

  it('10. GST / Tax section renders inter-state IGST calculation result', async () => {
    (taxService.calculateTax as any).mockResolvedValue({
      original_amount: 50000,
      taxable_amount: 50000,
      tax_rate: 18,
      total_tax: 9000,
      total_amount: 59000,
      cgst_rate: 0,
      cgst_amount: 0,
      sgst_rate: 0,
      sgst_amount: 0,
      igst_rate: 18,
      igst_amount: 9000,
      jurisdiction_type: 'INTER_STATE',
      is_tax_inclusive: false,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const gstNav = screen.getByRole('button', { name: /GST \/ Tax Calculator/i });
    await userEvent.click(gstNav);

    const calcBtn = screen.getByRole('button', { name: /Calculate GST/i });
    await userEvent.click(calcBtn);

    await waitFor(() => {
      expect(taxService.calculateTax).toHaveBeenCalled();
    });

    expect(screen.getByText(/INTER_STATE/i)).toBeInTheDocument();
    expect(screen.getByText(/IGST \(18%\)/i)).toBeInTheDocument();
  });

  it('11. Close button and Cancel button work to close modal', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /Close Settings/i });
    await userEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('12. Escape key closes modal gracefully', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('13. Admin company settings update invokes authoritative backend API and reloads config', async () => {
    (localizationService.updateCompanySettings as any).mockResolvedValue({
      id: 'tenant-ind-12345',
      name: 'Acme Bharat Operations Ltd',
      currency_code: 'INR',
      region: 'MH',
      fiscal_year_start_month: 4,
      status: 'active',
      country_code: 'IN',
      timezone: 'Asia/Kolkata',
      locale: 'en_IN',
      state_code: 'MH',
      default_tax_rate: '18.00',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const saveButtons = screen.getAllByRole('button', { name: /Save Changes/i });
    expect(saveButtons.length).toBeGreaterThan(0);
    await userEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(localizationService.updateCompanySettings).toHaveBeenCalledWith(
        'tenant-ind-12345',
        expect.objectContaining({
          country_code: 'IN',
          state_code: 'MH',
          currency_code: 'INR',
        })
      );
    });

    expect(screen.getByText(/Company localization settings saved successfully/i)).toBeInTheDocument();
  });

  it('14. No arbitrary company_id input field exists in the UI', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText(/Enter Tenant ID/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Company ID override/i)).not.toBeInTheDocument();
  });

  it('15. Full viewport backdrop is rendered via portal covering application with high z-index and strong dark opacity', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const overlay = screen.getByTestId('settings-modal-overlay');
    const backdrop = screen.getByTestId('settings-modal-backdrop');
    const modalCard = screen.getByTestId('settings-modal-card');

    expect(overlay).toBeInTheDocument();
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.zIndex).toBe('1100');

    expect(backdrop).toBeInTheDocument();
    expect(backdrop.style.position).toBe('fixed');
    expect(backdrop.style.zIndex).toBe('1000');
    expect(backdrop.style.backgroundColor).toBe('transparent');

    expect(modalCard).toBeInTheDocument();
    expect(modalCard.style.zIndex).toBe('1100');
  });

  it('16. Dashboard content, header, and metrics remain mounted behind the modal', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Dashboard page elements are mounted behind
    expect(screen.getByText('Operations Command Center')).toBeInTheDocument();
    expect(screen.getByText('Operational Factories')).toBeInTheDocument();
  });
});
