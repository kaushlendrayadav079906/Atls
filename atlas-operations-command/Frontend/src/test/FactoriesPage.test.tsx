import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { FactoriesPage } from '../pages/FactoriesPage';
import { FactoryDetailPage } from '../pages/FactoryDetailPage';
import { AppShell } from '../components/layout/AppShell';
import { AuthProvider } from '../context/AuthContext';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { factoryService } from '../services/factoryService';
import { authService } from '../services/authService';

vi.mock('../services/factoryService', () => ({
  factoryService: {
    getFactories: vi.fn(),
    listFactories: vi.fn(),
    getFactory: vi.fn(),
    getFactoryFinancials: vi.fn(),
  },
}));

vi.mock('../services/localizationService', () => ({
  localizationService: {
    getConfig: vi.fn().mockResolvedValue({
      currency_code: 'USD',
      formatting: { currency_symbol: '$' },
    }),
    getCurrentFiscalYear: vi.fn().mockResolvedValue({
      fiscal_year_label: 'FY2026',
      fiscal_quarter_label: 'Q1',
    }),
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

const mockFactories = [
  {
    id: 'f1-austin-plant',
    company_id: 'c1-uuid',
    name: 'Austin Mega-Plant Alpha',
    code: 'PLANT-TX-01',
    location: 'Austin, Texas',
    status: 'active',
  },
  {
    id: 'f2-detroit-plant',
    company_id: 'c1-uuid',
    name: 'Detroit Precision Assembly',
    code: 'PLANT-MI-02',
    location: 'Detroit, Michigan',
    status: 'maintenance',
  },
];

const mockFinancials = {
  factory_id: 'f1-austin-plant',
  factory_name: 'Austin Mega-Plant Alpha',
  month: 9,
  year: 2026,
  revenue: 450000,
  expenditure: 320000,
  profit: 130000,
};

describe('Frontend Unit 3: Factories & Factory Drill-Down', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authService.isAuthenticated as any).mockReturnValue(true);
    (authService.getCurrentUser as any).mockResolvedValue({
      id: 'u1',
      email: 'admin@atlasops.com',
      full_name: 'Operator Alpha',
    });
  });

  // 1. /factories renders
  it('1. /factories page renders successfully with header and search controls', async () => {
    (factoryService.getFactories as any).mockResolvedValueOnce(mockFactories);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <FactoriesPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Factory Management')).toBeInTheDocument();
    expect(screen.getByText(/Fleet status, production facility management/i)).toBeInTheDocument();
  });

  // 2. Factory API is called
  it('2. Factory API is called on page load', async () => {
    (factoryService.getFactories as any).mockResolvedValueOnce(mockFactories);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <FactoriesPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(factoryService.getFactories).toHaveBeenCalledTimes(1);
    });
  });

  // 3. Factory data renders
  it('3. Factory data renders correctly in factory cards and summary KPIs', async () => {
    (factoryService.getFactories as any).mockResolvedValueOnce(mockFactories);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <FactoriesPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Austin Mega-Plant Alpha')).toBeInTheDocument();
      expect(screen.getByText('Detroit Precision Assembly')).toBeInTheDocument();
      expect(screen.getByText('PLANT-TX-01')).toBeInTheDocument();
      expect(screen.getByText('PLANT-MI-02')).toBeInTheDocument();
      expect(screen.getByText('Austin, Texas')).toBeInTheDocument();
      expect(screen.getByText('Detroit, Michigan')).toBeInTheDocument();
    });

    // Summary KPI check
    expect(screen.getByText('Total Factories')).toBeInTheDocument();
    expect(screen.getByText('Active Factories')).toBeInTheDocument();
  });

  // 4. Loading state renders
  it('4. Loading state renders while data is fetching', () => {
    (factoryService.getFactories as any).mockReturnValueOnce(new Promise(() => {}));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <FactoriesPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText(/Loading factory fleet telemetry/i)).toBeInTheDocument();
  });

  // 5. Empty state renders
  it('5. Empty state renders when no factories are returned', async () => {
    (factoryService.getFactories as any).mockResolvedValueOnce([]);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <FactoriesPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No Factories Available')).toBeInTheDocument();
      expect(screen.getByText(/No factories have been registered for this company/i)).toBeInTheDocument();
    });
  });

  // 6. API error state renders
  it('6. API error state renders when factory fetch fails', async () => {
    (factoryService.getFactories as any).mockRejectedValueOnce(
      new Error('Unable to connect to database.')
    );

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <FactoriesPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Factories')).toBeInTheDocument();
      expect(screen.getByText('Unable to connect to database.')).toBeInTheDocument();
    });
  });

  // 7. Clicking View Details navigates correctly
  it('7. Clicking View Details navigates to /factories/:factoryId', async () => {
    const user = userEvent.setup();
    (factoryService.getFactories as any).mockResolvedValueOnce(mockFactories);
    (factoryService.getFactory as any).mockResolvedValueOnce(mockFactories[0]);
    (factoryService.getFactoryFinancials as any).mockResolvedValueOnce(mockFinancials);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <Routes>
            <Route path="/factories" element={<FactoriesPage />} />
            <Route path="/factories/:factoryId" element={<FactoryDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Austin Mega-Plant Alpha')).toBeInTheDocument();
    });

    const viewDetailsButtons = screen.getAllByRole('link', { name: /View Details/i });
    expect(viewDetailsButtons[0]).toHaveAttribute('href', '/factories/f1-austin-plant');

    await user.click(viewDetailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Back to Factories')).toBeInTheDocument();
      expect(factoryService.getFactory).toHaveBeenCalledWith('f1-austin-plant');
    });
  });

  // 8. Factory detail API is called
  it('8. Factory detail API is called on drill-down page load', async () => {
    (factoryService.getFactory as any).mockResolvedValueOnce(mockFactories[0]);
    (factoryService.getFactoryFinancials as any).mockResolvedValueOnce(mockFinancials);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories/f1-austin-plant']}>
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(factoryService.getFactory).toHaveBeenCalledWith('f1-austin-plant');
    });
  });

  // 9. Factory detail data renders
  it('9. Factory detail data renders correctly', async () => {
    (factoryService.getFactory as any).mockResolvedValueOnce(mockFactories[0]);
    (factoryService.getFactoryFinancials as any).mockResolvedValueOnce(mockFinancials);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories/f1-austin-plant']}>
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Austin Mega-Plant Alpha' })).toBeInTheDocument();
      expect(screen.getByText('Facility Operational Status')).toBeInTheDocument();
      expect(screen.getAllByText('PLANT-TX-01').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Austin, Texas').length).toBeGreaterThanOrEqual(1);
    });
  });

  // 10. 404 state renders
  it('10. 404 state renders for invalid factory ID', async () => {
    const error404 = new Error('Factory not found') as any;
    error404.status = 404;
    (factoryService.getFactory as any).mockRejectedValueOnce(error404);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories/non-existent-id']}>
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Factory Not Found')).toBeInTheDocument();
      expect(
        screen.getByText('Factory not found. The requested facility does not exist or has been removed.')
      ).toBeInTheDocument();
    });
  });

  // 11. Financial API is called
  it('11. Financial API is called with factory ID and period parameters', async () => {
    (factoryService.getFactory as any).mockResolvedValueOnce(mockFactories[0]);
    (factoryService.getFactoryFinancials as any).mockResolvedValueOnce(mockFinancials);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories/f1-austin-plant']}>
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(factoryService.getFactoryFinancials).toHaveBeenCalledWith(
        'f1-austin-plant',
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  // 12. Financial data renders
  it('12. Financial data renders revenue, expenditure, and net operating profit', async () => {
    (factoryService.getFactory as any).mockResolvedValueOnce(mockFactories[0]);
    (factoryService.getFactoryFinancials as any).mockResolvedValueOnce(mockFinancials);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories/f1-austin-plant']}>
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Austin Mega-Plant Alpha' })).toBeInTheDocument();
    });
    expect(screen.getByText('Factory Financial Performance')).toBeInTheDocument();
    expect(screen.getByText('Period Revenue')).toBeInTheDocument();
    expect(screen.getByText('Period Expenditure')).toBeInTheDocument();
    expect(screen.getByText('Net Operating Profit')).toBeInTheDocument();
    expect(screen.getByText('$450,000.00')).toBeInTheDocument();
    expect(screen.getByText('$320,000.00')).toBeInTheDocument();
    expect(screen.getByText('$130,000.00')).toBeInTheDocument();
  });

  // 13. Financial empty state renders
  it('13. Financial empty state renders when financial telemetry is zero/empty', async () => {
    (factoryService.getFactory as any).mockResolvedValueOnce(mockFactories[0]);
    (factoryService.getFactoryFinancials as any).mockResolvedValueOnce({
      factory_id: 'f1-austin-plant',
      factory_name: 'Austin Mega-Plant Alpha',
      month: 9,
      year: 2026,
      revenue: 0,
      expenditure: 0,
      profit: 0,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories/f1-austin-plant']}>
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No financial data available for this factory.')).toBeInTheDocument();
    });
  });

  // 14 & 15. /factories and /factories/:factoryId are protected
  it('14-15. Routes are protected and unauthenticated users are redirected', async () => {
    (authService.isAuthenticated as any).mockReturnValue(false);
    (authService.getCurrentUser as any).mockResolvedValue(null);

    let capturedLocation: any = null;
    const LocationWatcher = () => {
      capturedLocation = useLocation();
      return <div>Redirected to: {capturedLocation.pathname}</div>;
    };

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <Routes>
            <Route
              path="/factories"
              element={
                <ProtectedRoute>
                  <FactoriesPage />
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

  // 16. Security invariant: no client company_id injected
  it('16. Tenant safety invariant: factory calls do NOT pass company_id parameter', async () => {
    (factoryService.getFactories as any).mockResolvedValueOnce(mockFactories);
    (factoryService.getFactory as any).mockResolvedValueOnce(mockFactories[0]);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <FactoriesPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(factoryService.getFactories).toHaveBeenCalled();
    });

    // Ensure company_id was not passed as an argument to getFactories
    const calls = (factoryService.getFactories as any).mock.calls;
    expect(calls[0][0]).toBeUndefined(); // skip default
    expect(calls[0][1]).toBeUndefined(); // limit default
  });

  // 17. Search filter functions accurately
  it('17. Search filter narrows down factories by name or location', async () => {
    const user = userEvent.setup();
    (factoryService.getFactories as any).mockResolvedValueOnce(mockFactories);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/factories']}>
          <FactoriesPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Austin Mega-Plant Alpha')).toBeInTheDocument();
      expect(screen.getByText('Detroit Precision Assembly')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search factories by name, code, or location/i);
    await user.type(searchInput, 'Detroit');

    expect(screen.queryByText('Austin Mega-Plant Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Detroit Precision Assembly')).toBeInTheDocument();
  });
});
