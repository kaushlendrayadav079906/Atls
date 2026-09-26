import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ReportsPage } from '../pages/ReportsPage';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';
import { reportService } from '../services/reportService';
import { authService } from '../services/authService';
import { localizationService } from '../services/localizationService';

vi.mock('../services/reportService', () => ({
  reportService: {
    getTopCustomers: vi.fn(),
    getSalesByProduct: vi.fn(),
    getMonthlyRevenueExpenditure: vi.fn(),
  },
}));

vi.mock('../services/localizationService', () => ({
  localizationService: {
    getConfig: vi.fn(),
    getCurrentFiscalYear: vi.fn(),
  },
}));

vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

const mockTopCustomers = [
  { customer_id: 'c1', customer_name: 'Apex Global Dynamics', total_revenue: 3420000 },
  { customer_id: 'c2', customer_name: 'Nordic Logistics AG', total_revenue: 2890000 },
  { customer_id: 'c3', customer_name: 'Vanguard Aerospace Inc.', total_revenue: 2150000 },
];

const mockSalesByProduct = [
  { product_id: 'p1', product_name: 'Atlas Turbofan Core V4', total_sales: 4200000 },
  { product_id: 'p2', product_name: 'Precision Hydraulic Actuator', total_sales: 3100000 },
];

const mockMonthlyFinancial = {
  month: 9,
  year: 2026,
  revenue: 1750000,
  expenditure: 1150000,
  profit: 600000,
};

describe('Frontend Unit 4: Reports & Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authService.isAuthenticated as any).mockReturnValue(true);
    (authService.getCurrentUser as any).mockResolvedValue({
      id: 'u1',
      email: 'admin@atlasops.com',
      full_name: 'Reports Officer',
    });
    (localizationService.getConfig as any).mockResolvedValue({
      currency_code: 'USD',
      formatting: { currency_symbol: '$' },
    });
    (localizationService.getCurrentFiscalYear as any).mockResolvedValue({
      fiscal_year: 2026,
      fiscal_year_label: 'FY2026-27',
      fiscal_quarter_label: 'Q2',
    });
  });

  // 1. Reports page renders
  it('1. Reports page renders successfully with header and section headings', async () => {
    (reportService.getTopCustomers as any).mockResolvedValueOnce(mockTopCustomers);
    (reportService.getSalesByProduct as any).mockResolvedValueOnce(mockSalesByProduct);
    (reportService.getMonthlyRevenueExpenditure as any).mockResolvedValue(mockMonthlyFinancial);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Reports & Executive Analytics/i })).toBeInTheDocument();
    expect(screen.getByText(/Authoritative periodic financial trajectory/i)).toBeInTheDocument();
  });

  // 2. Monthly financial data renders
  it('2. Monthly financial data renders revenue, expenditure, and net profit', async () => {
    (reportService.getTopCustomers as any).mockResolvedValueOnce(mockTopCustomers);
    (reportService.getSalesByProduct as any).mockResolvedValueOnce(mockSalesByProduct);
    (reportService.getMonthlyRevenueExpenditure as any).mockResolvedValue(mockMonthlyFinancial);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Monthly Revenue vs Expenditure' })).toBeInTheDocument();
      expect(screen.getByText('Period Revenue')).toBeInTheDocument();
      expect(screen.getByText('Period Expenditure')).toBeInTheDocument();
      expect(screen.getByText('Net Operating Profit')).toBeInTheDocument();
    });
  });

  // 3. Top customers render
  it('3. Top customers table renders ranked customers and revenue', async () => {
    (reportService.getTopCustomers as any).mockResolvedValueOnce(mockTopCustomers);
    (reportService.getSalesByProduct as any).mockResolvedValueOnce(mockSalesByProduct);
    (reportService.getMonthlyRevenueExpenditure as any).mockResolvedValue(mockMonthlyFinancial);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Apex Global Dynamics')).toBeInTheDocument();
      expect(screen.getByText('Nordic Logistics AG')).toBeInTheDocument();
      expect(screen.getByText('Vanguard Aerospace Inc.')).toBeInTheDocument();
      expect(screen.getByText('3 Ranked Clients')).toBeInTheDocument();
    });
  });

  // 4. Sales by product render
  it('4. Sales by product table renders products and sales volume', async () => {
    (reportService.getTopCustomers as any).mockResolvedValueOnce(mockTopCustomers);
    (reportService.getSalesByProduct as any).mockResolvedValueOnce(mockSalesByProduct);
    (reportService.getMonthlyRevenueExpenditure as any).mockResolvedValue(mockMonthlyFinancial);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Atlas Turbofan Core V4')).toBeInTheDocument();
      expect(screen.getByText('Precision Hydraulic Actuator')).toBeInTheDocument();
      expect(screen.getByText('2 Products Cataloged')).toBeInTheDocument();
    });
  });

  // 5. Loading states work
  it('5. Loading spinners render during active API requests', () => {
    (reportService.getTopCustomers as any).mockReturnValueOnce(new Promise(() => {}));
    (reportService.getSalesByProduct as any).mockReturnValueOnce(new Promise(() => {}));
    (reportService.getMonthlyRevenueExpenditure as any).mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText(/Loading financial telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading top customer rankings/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading product sales analytics/i)).toBeInTheDocument();
  });

  // 6. Empty states work
  it('6. Empty states render gracefully when APIs return empty arrays / zero values', async () => {
    (reportService.getTopCustomers as any).mockResolvedValueOnce([]);
    (reportService.getSalesByProduct as any).mockResolvedValueOnce([]);
    (reportService.getMonthlyRevenueExpenditure as any).mockResolvedValue({
      month: 1,
      year: 2026,
      revenue: 0,
      expenditure: 0,
      profit: 0,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No Customer Records Found')).toBeInTheDocument();
      expect(screen.getByText('No Product Sales Records')).toBeInTheDocument();
      expect(screen.getByText('No Financial Records Found')).toBeInTheDocument();
    });
  });

  // 7. API error states work
  it('7. API error states render correctly when services reject', async () => {
    (reportService.getTopCustomers as any).mockRejectedValueOnce(new Error('Customer report timeout'));
    (reportService.getSalesByProduct as any).mockRejectedValueOnce(new Error('Product report timeout'));
    (reportService.getMonthlyRevenueExpenditure as any).mockRejectedValue(new Error('Financial report timeout'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load top customers report.')).toBeInTheDocument();
      expect(screen.getByText('Failed to load product sales report.')).toBeInTheDocument();
    });
  });

  // 8. Tenant security: No company_id accepted or passed from UI
  it('8. Tenant security: No company_id parameter is passed to reportService API endpoints', async () => {
    (reportService.getTopCustomers as any).mockResolvedValueOnce(mockTopCustomers);
    (reportService.getSalesByProduct as any).mockResolvedValueOnce(mockSalesByProduct);
    (reportService.getMonthlyRevenueExpenditure as any).mockResolvedValue(mockMonthlyFinancial);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(reportService.getTopCustomers).toHaveBeenCalledWith(5);
      expect(reportService.getSalesByProduct).toHaveBeenCalledWith(5);
    });

    // Ensure company_id was NOT passed to reportService
    const custCalls = (reportService.getTopCustomers as any).mock.calls;
    expect(custCalls[0][0]).toBe(5);
    expect(custCalls[0].length).toBe(1);

    const prodCalls = (reportService.getSalesByProduct as any).mock.calls;
    expect(prodCalls[0][0]).toBe(5);
    expect(prodCalls[0].length).toBe(1);
  });

  // 9. Filter interaction: Limit and Month change
  it('9. Filter interaction updates queries for top limit and specific month', async () => {
    const user = userEvent.setup();
    (reportService.getTopCustomers as any).mockResolvedValue(mockTopCustomers);
    (reportService.getSalesByProduct as any).mockResolvedValue(mockSalesByProduct);
    (reportService.getMonthlyRevenueExpenditure as any).mockResolvedValue(mockMonthlyFinancial);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <ReportsPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Apex Global Dynamics')).toBeInTheDocument();
    });

    // Change ranking limit
    const limitSelect = screen.getByLabelText(/Ranking Limit:/i);
    await user.selectOptions(limitSelect, '10');

    await waitFor(() => {
      expect(reportService.getTopCustomers).toHaveBeenCalledWith(10);
      expect(reportService.getSalesByProduct).toHaveBeenCalledWith(10);
    });

    // Change month filter
    const monthSelect = screen.getByLabelText(/Period:/i);
    await user.selectOptions(monthSelect, '9'); // September

    await waitFor(() => {
      expect(reportService.getMonthlyRevenueExpenditure).toHaveBeenCalledWith(2026, 9);
    });
  });

  // 10. Route protection
  it('10. Route is protected and redirects unauthenticated users to /login', async () => {
    (authService.isAuthenticated as any).mockReturnValue(false);
    (authService.getCurrentUser as any).mockResolvedValue(null);

    let capturedLocation: any = null;
    const LocationWatcher = () => {
      capturedLocation = useLocation();
      return <div>Redirected to: {capturedLocation.pathname}</div>;
    };

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reports']}>
          <Routes>
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LocationWatcher />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Redirected to: /login')).toBeInTheDocument();
    });
  });
});
