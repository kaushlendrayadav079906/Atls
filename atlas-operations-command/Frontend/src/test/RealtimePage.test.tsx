import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RealtimePage } from '../pages/RealtimePage';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';
import { realtimeService } from '../services/realtimeService';
import { authService } from '../services/authService';
import { localizationService } from '../services/localizationService';

vi.mock('../services/realtimeService', () => ({
  realtimeService: {
    getSummary: vi.fn(),
    getOperationalHealth: vi.fn(),
    getAlerts: vi.fn(),
  },
}));

vi.mock('../services/localizationService', () => ({
  localizationService: {
    getConfig: vi.fn(),
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

const mockSummary = {
  company_id: 'c1-uuid',
  timestamp: '2026-09-09T11:00:00Z',
  system_status: 'OPERATIONAL',
  operational_pulse: {
    total_factories: 4,
    active_factories: 3,
    inactive_factories: 1,
    operational_health_pct: 92.5,
  },
  financial_pulse: {
    total_revenue: 12450000.0,
    total_expenditure: 8930000.0,
    net_profit: 3520000.0,
    operating_margin_pct: 28.27,
  },
  risk_summary: {
    active_risk_count: 3,
    critical_count: 0,
    high_count: 1,
    medium_count: 1,
    low_count: 1,
    overall_composite_score: 18.5,
    overall_severity: 'LOW',
  },
  pending_actions_count: 3,
  latest_briefing_timestamp: '2026-09-09T08:00:00Z',
  data_version: '20260909-110000',
};

const mockHealthHealthy = {
  status: 'HEALTHY',
  active_plants: 3,
  total_plants: 4,
  active_critical_alerts: 0,
  last_data_sync: '2026-09-09T11:00:00Z',
};

const mockHealthCritical = {
  status: 'CRITICAL',
  active_plants: 2,
  total_plants: 4,
  active_critical_alerts: 2,
  last_data_sync: '2026-09-09T11:00:00Z',
};

const mockAlerts = [
  {
    id: 'alt-1',
    title: 'Titanium Ingot Supply Variance Alert',
    severity: 'HIGH',
    category: 'Supply Chain',
    financial_impact: 180000,
    department: 'Supply Chain',
    created_at: '2026-09-09T10:30:00Z',
  },
  {
    id: 'alt-2',
    title: 'Operating Margin Compression Alert',
    severity: 'CRITICAL',
    category: 'Financial',
    financial_impact: 350000,
    department: 'Finance',
    created_at: '2026-09-09T10:45:00Z',
  },
];

describe('Frontend Unit 6: Real-Time Operations & Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authService.isAuthenticated as any).mockReturnValue(true);
    (authService.getCurrentUser as any).mockResolvedValue({
      id: 'u1',
      email: 'ops.officer@atlasops.com',
      full_name: 'Operations Officer',
    });
    (localizationService.getConfig as any).mockResolvedValue({
      currency_code: 'USD',
      formatting: { currency_symbol: '$' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Realtime page renders
  it('1. Realtime page renders successfully with header and refresh controls', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValueOnce(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Real-Time Operations & Alerts/i })).toBeInTheDocument();
    expect(screen.getByText(/Live operational telemetry pulse/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Polling/i)).toBeInTheDocument();
  });

  // 2. Summary data renders
  it('2. Summary data renders composite operational health, net profit, risk index, and pending actions', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValueOnce(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('92.5%')).toBeInTheDocument();
      expect(screen.getByText('$3.52M')).toBeInTheDocument();
      expect(screen.getByText('18.5')).toBeInTheDocument();
      expect(screen.getByText('3 Actions')).toBeInTheDocument();
      expect(screen.getByText(/Telemetry Version: 20260909-110000/i)).toBeInTheDocument();
    });
  });

  // 3. Operational health renders
  it('3. Operational health renders operational pulse, status badge, and facility metrics', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValueOnce(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('OPERATIONAL & HEALTHY')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // active plants
      expect(screen.getByText('/ 4')).toBeInTheDocument(); // total plants
      expect(screen.getByText('Operational Pulse & Fleet Health')).toBeInTheDocument();
    });
  });

  // 3b. Operational health critical status renders
  it('3b. Operational health renders critical status badge when critical alerts exist', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthCritical);
    (realtimeService.getAlerts as any).mockResolvedValueOnce(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('CRITICAL SYSTEM STATUS')).toBeInTheDocument();
      expect(screen.getByText('Active critical incidents requiring immediate executive remediation.')).toBeInTheDocument();
    });
  });

  // 4. Alerts render
  it('4. Active alerts render with severity badges, category, and department info', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValueOnce(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Titanium Ingot Supply Variance Alert')).toBeInTheDocument();
      expect(screen.getByText('Operating Margin Compression Alert')).toBeInTheDocument();
      expect(screen.getByText('2 Active Alerts')).toBeInTheDocument();
    });
  });

  // 5. No-alert empty state
  it('5. No-alert empty state renders when alert list is empty', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValueOnce([]);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No Active Alerts')).toBeInTheDocument();
      expect(screen.getByText(/All manufacturing facilities and telemetry pipelines are running within normal thresholds/i)).toBeInTheDocument();
    });
  });

  // 6. Loading state
  it('6. Loading spinner renders during initial telemetry sync', () => {
    (realtimeService.getSummary as any).mockReturnValueOnce(new Promise(() => {}));
    (realtimeService.getOperationalHealth as any).mockReturnValueOnce(new Promise(() => {}));
    (realtimeService.getAlerts as any).mockReturnValueOnce(new Promise(() => {}));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText(/Checking real-time operational health/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthesizing real-time telemetry pulse/i)).toBeInTheDocument();
    expect(screen.getByText(/Checking active real-time operational alerts/i)).toBeInTheDocument();
  });

  // 7. Summary API error
  it('7. Summary API error state renders error component when summary endpoint fails', async () => {
    (realtimeService.getSummary as any).mockRejectedValueOnce(new Error('Summary aggregation error'));
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValueOnce(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Real-Time Telemetry Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch real-time summary pulse.')).toBeInTheDocument();
    });
  });

  // 8. Health API error
  it('8. Health API error state renders error component when health endpoint fails', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockRejectedValueOnce(new Error('Health query failed'));
    (realtimeService.getAlerts as any).mockResolvedValueOnce(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Health Telemetry Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch operational health status.')).toBeInTheDocument();
    });
  });

  // 9. Alerts API error
  it('9. Alerts API error state renders error component when alerts endpoint fails', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockRejectedValueOnce(new Error('Alerts query failed'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Telemetry Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to load active operational alerts.')).toBeInTheDocument();
    });
  });

  // 10. Manual refresh works
  it('10. Manual refresh triggers re-fetching of all realtime services', async () => {
    const user = userEvent.setup();
    (realtimeService.getSummary as any).mockResolvedValue(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValue(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValue(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Refresh Now/i })).toBeInTheDocument();
    });

    const refreshBtn = screen.getByRole('button', { name: /Refresh Now/i });
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(realtimeService.getSummary).toHaveBeenCalledTimes(2);
      expect(realtimeService.getOperationalHealth).toHaveBeenCalledTimes(2);
      expect(realtimeService.getAlerts).toHaveBeenCalledTimes(2);
    });
  });

  // 11. Automatic refresh/polling works
  it('11. Automatic polling executes periodic background updates', async () => {
    vi.useFakeTimers();
    (realtimeService.getSummary as any).mockResolvedValue(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValue(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValue(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(realtimeService.getSummary).toHaveBeenCalledTimes(1);

    // Advance 5 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(realtimeService.getSummary).toHaveBeenCalledTimes(2);

    // Advance another 5 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(realtimeService.getSummary).toHaveBeenCalledTimes(3);
  });

  // 12. Polling stops on unmount
  it('12. Polling timer is cleaned up on unmount preventing memory leaks', async () => {
    vi.useFakeTimers();
    (realtimeService.getSummary as any).mockResolvedValue(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValue(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValue(mockAlerts);

    const { unmount } = render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(realtimeService.getSummary).toHaveBeenCalledTimes(1);

    unmount();

    // Advance 10 seconds post-unmount
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(realtimeService.getSummary).toHaveBeenCalledTimes(1);
  });

  // 13. Auto-refresh toggle pauses polling
  it('13. Unchecking auto-refresh stops periodic polling loops', async () => {
    vi.useFakeTimers();
    (realtimeService.getSummary as any).mockResolvedValue(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValue(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValue(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    const checkbox = screen.getByLabelText(/Auto-refresh/i);
    await act(async () => {
      checkbox.click();
    });

    expect(screen.getByText('Polling Paused')).toBeInTheDocument();

    // Advance timer
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    // Should still only have the initial call
    expect(realtimeService.getSummary).toHaveBeenCalledTimes(1);
  });

  // 14. Last refresh timestamp is displayed
  it('14. Last updated timestamp is displayed after sync', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValueOnce(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/i)).toBeInTheDocument();
    });
  });

  // 15. Tenant safety invariant: No company_id passed by client
  it('15. Tenant safety invariant: Realtime service calls do NOT pass company_id parameter', async () => {
    (realtimeService.getSummary as any).mockResolvedValueOnce(mockSummary);
    (realtimeService.getOperationalHealth as any).mockResolvedValueOnce(mockHealthHealthy);
    (realtimeService.getAlerts as any).mockResolvedValueOnce(mockAlerts);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <RealtimePage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(realtimeService.getSummary).toHaveBeenCalled();
      expect(realtimeService.getOperationalHealth).toHaveBeenCalled();
      expect(realtimeService.getAlerts).toHaveBeenCalled();
    });

    const summaryCall = (realtimeService.getSummary as any).mock.calls[0];
    expect(summaryCall.length).toBe(0);

    const healthCall = (realtimeService.getOperationalHealth as any).mock.calls[0];
    expect(healthCall.length).toBe(0);
  });

  // 16. Protected Route redirection
  it('16. /realtime route is protected and unauthenticated users are redirected to /login', async () => {
    (authService.isAuthenticated as any).mockReturnValue(false);
    (authService.getCurrentUser as any).mockResolvedValue(null);

    let capturedLocation: any = null;
    const LocationWatcher = () => {
      capturedLocation = useLocation();
      return <div>Redirected to: {capturedLocation.pathname}</div>;
    };

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/realtime']}>
          <Routes>
            <Route
              path="/realtime"
              element={
                <ProtectedRoute>
                  <RealtimePage />
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
