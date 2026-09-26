import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import { AuthProvider } from '../context/AuthContext';
import { businessDataService } from '../services/businessDataService';
import { factoryService } from '../services/factoryService';
import { reportService } from '../services/reportService';
import { realtimeService } from '../services/realtimeService';
import { aiRiskService } from '../services/aiRiskService';
import { localizationService } from '../services/localizationService';
import * as configModule from '../config';

// Mock domain services
vi.mock('../services/businessDataService', () => ({
  businessDataService: {
    getOrganicData: vi.fn(),
    getMonthlyTrend: vi.fn(),
    getReceivables: vi.fn(),
    getPayables: vi.fn(),
    getInventory: vi.fn(),
    getProduction: vi.fn(),
  },
}));

vi.mock('../services/factoryService', () => ({
  factoryService: {
    listFactories: vi.fn(),
  },
}));

vi.mock('../services/reportService', () => ({
  reportService: {
    getTopCustomers: vi.fn(),
    getSalesByProduct: vi.fn(),
    getMonthlyRevenueExpenditure: vi.fn(),
  },
}));

vi.mock('../services/realtimeService', () => ({
  realtimeService: {
    getSummary: vi.fn(),
    getOperationalHealth: vi.fn(),
    getAlerts: vi.fn(),
  },
}));

vi.mock('../services/aiRiskService', () => ({
  aiRiskService: {
    getActions: vi.fn(),
    resolveAction: vi.fn(),
    getRisks: vi.fn(),
    getLatestBriefing: vi.fn(),
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
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 'u1',
      email: 'admin@example.com',
      full_name: 'Lead Commander',
      status: 'active',
      company_id: 'c1',
    }),
    logout: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

const mockDataSetup = () => {
  (localizationService.getConfig as any).mockResolvedValue({
    company_id: 'c1',
    name: 'Atlas Aerospace Ltd',
    currency_code: 'USD',
    formatting: { currency_symbol: '$' },
  });

  (localizationService.getCurrentFiscalYear as any).mockResolvedValue({
    fiscal_year_label: 'FY2026-27',
    fiscal_quarter_label: 'Q2',
  });

  (realtimeService.getOperationalHealth as any).mockResolvedValue({
    status: 'HEALTHY',
    active_plants: 4,
    total_plants: 4,
    active_critical_alerts: 0,
  });

  (businessDataService.getOrganicData as any).mockResolvedValue({
    total_revenue: 12500000,
    total_expenditure: 8900000,
    net_profit: 3600000,
    active_factories: 4,
  });

  (factoryService.listFactories as any).mockResolvedValue([
    {
      id: 'f1',
      name: 'Austin Plant Alpha',
      code: 'TX-01',
      location: 'Austin, TX',
      status: 'active',
    },
    {
      id: 'f2',
      name: 'Detroit Propulsion Center',
      code: 'MI-02',
      location: 'Detroit, MI',
      status: 'active',
    },
  ]);

  (reportService.getTopCustomers as any).mockResolvedValue([
    { customer_id: 'cust-1', customer_name: 'Apex Dynamics', total_revenue: 3500000 },
  ]);

  (reportService.getSalesByProduct as any).mockResolvedValue([
    { product_id: 'prod-1', product_name: 'Turbofan X-1', total_sales: 4200000 },
  ]);

  (businessDataService.getMonthlyTrend as any).mockResolvedValue([
    { month: 4, year: 2026, revenue: 1800000, expenditure: 1400000, profit: 400000 },
    { month: 5, year: 2026, revenue: 2100000, expenditure: 1500000, profit: 600000 },
  ]);

  (businessDataService.getReceivables as any).mockResolvedValue({
    total_receivables: 4500000,
    current: 3500000,
    overdue_30_days: 800000,
    overdue_60_plus_days: 200000,
    currency_code: 'USD',
  });

  (businessDataService.getPayables as any).mockResolvedValue({
    total_payables: 3100000,
    current: 2500000,
    overdue_30_days: 400000,
    overdue_60_plus_days: 200000,
    currency_code: 'USD',
  });

  (businessDataService.getInventory as any).mockResolvedValue({
    total_inventory_value: 8500000,
    total_skus: 1200,
    low_stock_items: 8,
    stockout_risk_count: 0,
    health_status: 'OPTIMAL',
  });

  (businessDataService.getProduction as any).mockResolvedValue({
    monthly_output_units: 48000,
    target_units: 50000,
    achievement_rate_pct: 96.0,
    active_lines: 16,
    overall_equipment_effectiveness_pct: 88.5,
  });

  (aiRiskService.getActions as any).mockResolvedValue([
    {
      id: 'act-1',
      title: 'Reallocate Titanium Ingots',
      description: 'Lead-time delay detected on primary alloy vendor',
      severity: 'HIGH',
      category: 'Supply Chain',
      cta_label: 'Execute Transfer',
      status: 'pending',
      created_at: '2026-09-07T00:00:00Z',
    },
  ]);

  (realtimeService.getSummary as any).mockResolvedValue({
    operational_pulse: { operational_health_pct: 94.2 },
    financial_pulse: { operating_margin_pct: 28.8 },
    risk_summary: { overall_composite_score: 18.0, overall_severity: 'LOW', active_risk_count: 1 },
  });
};

vi.mock('../config', () => ({
  isDemoMode: vi.fn().mockReturnValue(false),
  config: {
    apiBaseUrl: '/api/v1',
    appName: 'AtlasOps Cmd',
    version: '1.0.0',
    isDemoMode: false,
  },
}));

describe('DashboardPage Component (Frontend Unit 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (configModule.isDemoMode as any).mockReturnValue(false);
    mockDataSetup();
  });

  it('1. Renders authenticated header and company context', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Operations Command Center')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Atlas Aerospace Ltd/i)).toBeInTheDocument();
      expect(screen.getByText(/FY2026-27/i)).toBeInTheDocument();
    });
  });

  it('2. Shows Demo Data Banner when VITE_DEMO_MODE is active', async () => {
    (configModule.isDemoMode as any).mockReturnValue(true);

    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/DEMO DATA — LOCAL TESTING/i)).toBeInTheDocument();
    });
  });


  it('3. Renders Executive KPI row with P&L, Factories, Receivables, Payables', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Operational Factories')).toBeInTheDocument();
      expect(screen.getByText('Revenue & Net P&L')).toBeInTheDocument();
      expect(screen.getByText('Accounts Receivable')).toBeInTheDocument();
      expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
      expect(screen.getAllByText('$12.50M').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('4. Renders Operations KPIs: Inventory, Sales, Production, Health', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Stock & Inventory')).toBeInTheDocument();
      expect(screen.getByText('Sales Volume')).toBeInTheDocument();
      expect(screen.getByText('Production Output')).toBeInTheDocument();
      expect(screen.getByText('Plant Solvency & Health')).toBeInTheDocument();
      expect(screen.getByText('48,000 Units')).toBeInTheDocument();
    });
  });

  it('5. Renders Monthly Revenue vs Expenditure Bar Chart', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Monthly Revenue vs Expenditure')).toBeInTheDocument();
      expect(screen.getByText('Total Period Revenue')).toBeInTheDocument();
    });
  });

  it('6. Renders Factory Performance summary table', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Factory Performance Summary')).toBeInTheDocument();
      expect(screen.getByText('Austin Plant Alpha')).toBeInTheDocument();
      expect(screen.getByText('Detroit Propulsion Center')).toBeInTheDocument();
    });
  });

  it('7. Renders Sales and Customer breakdown', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Commercial & Product Sales')).toBeInTheDocument();
      expect(screen.getByText('Apex Dynamics')).toBeInTheDocument();
      expect(screen.getByText('Turbofan X-1')).toBeInTheDocument();
    });
  });

  it('8. Renders Action Items and allows resolving tasks', async () => {
    const user = userEvent.setup();
    (aiRiskService.resolveAction as any).mockResolvedValueOnce({
      id: 'act-1',
      status: 'completed',
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Priority Action Items (1)')).toBeInTheDocument();
      expect(screen.getByText('Reallocate Titanium Ingots')).toBeInTheDocument();
    });

    const resolveBtn = screen.getByRole('button', { name: /Execute Transfer/i });
    await user.click(resolveBtn);

    expect(aiRiskService.resolveAction).toHaveBeenCalledWith('act-1');
  });

  it('9. SAP Work Area clearly presents Awaiting SAP integration without fabrication', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('SAP Enterprise Connector')).toBeInTheDocument();
      expect(screen.getByText('Awaiting SAP integration')).toBeInTheDocument();
      expect(
        screen.getByText(/SAP ERP connectivity will be initialized during the Phase 8 integration rollout/i)
      ).toBeInTheDocument();
    });
  });

  it('10. Handles API error states gracefully on server failure', async () => {
    (localizationService.getConfig as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (localizationService.getCurrentFiscalYear as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (realtimeService.getOperationalHealth as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (businessDataService.getOrganicData as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (factoryService.listFactories as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (realtimeService.getSummary as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (reportService.getTopCustomers as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (reportService.getSalesByProduct as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (businessDataService.getMonthlyTrend as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (businessDataService.getReceivables as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (businessDataService.getPayables as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (businessDataService.getInventory as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (businessDataService.getProduction as any).mockRejectedValueOnce(new Error('Network connection timeout'));
    (aiRiskService.getActions as any).mockRejectedValueOnce(new Error('Network connection timeout'));

    render(
      <AuthProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(
      () => {
        expect(screen.getByText('Dashboard Sync Notice')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
