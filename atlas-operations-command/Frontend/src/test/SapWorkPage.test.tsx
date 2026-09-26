import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SapWorkPage } from '../pages/SapWorkPage';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';
import { sapService } from '../services/sapService';
import { authService } from '../services/authService';
import { apiClient, ApiError } from '../services/apiClient';

vi.mock('../services/sapService', () => ({
  sapService: {
    getSapStatus: vi.fn(),
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

vi.mock('../config', async () => {
  const actual = await vi.importActual('../config');
  return {
    ...actual,
    isDemoMode: vi.fn(() => false),
  };
});

describe('Frontend Unit 9: SAP Work & Data Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (authService.isAuthenticated as any).mockReturnValue(true);
    (authService.getCurrentUser as any).mockResolvedValue({
      id: 'usr-123',
      company_id: 'cmp-456',
      email: 'admin@atlasops.io',
      full_name: 'Enterprise Admin',
      role: 'admin',
      status: 'active',
    });
  });

  const renderSapPage = () => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/sap']}>
          <Routes>
            <Route
              path="/sap"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SapWorkPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  it('1. Protected route redirects unauthenticated users to /login', async () => {
    (authService.isAuthenticated as any).mockReturnValue(false);
    (authService.getCurrentUser as any).mockResolvedValue(null);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/sap']}>
          <Routes>
            <Route
              path="/sap"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SapWorkPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('2. SAP page and header render with AppShell navigation item', async () => {
    vi.mocked(sapService.getSapStatus).mockResolvedValueOnce({
      status: 'unavailable',
      message: 'SAP integration is not configured or connected.',
    });

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /SAP Work/i })).toBeInTheDocument();
    });

    // Check AppShell navigation item
    expect(screen.getByRole('link', { name: /SAP Work/i })).toBeInTheDocument();
    expect(
      screen.getByText('SAP integration, synchronization and enterprise data status')
    ).toBeInTheDocument();
  });

  it('3. Authoritative unavailable/not-configured state is rendered transparently', async () => {
    vi.mocked(sapService.getSapStatus).mockResolvedValueOnce({
      status: 'unavailable',
      message: 'SAP integration is not configured or connected.',
    });

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByTestId('sap-status-badge')).toHaveTextContent(
        'Not Connected / Unavailable'
      );
    });

    expect(
      screen.getByText('SAP integration is not configured or connected.')
    ).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Not Configured')).toBeInTheDocument();
    expect(screen.getAllByText('Awaiting integration').length).toBeGreaterThan(0);
  });

  it('4. Integration Overview metrics display authoritative non-invented placeholders', async () => {
    vi.mocked(sapService.getSapStatus).mockResolvedValueOnce({
      status: 'unavailable',
      message: 'SAP integration is not configured or connected.',
    });

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByTestId('overview-card-system-status')).toHaveTextContent('Unavailable');
    });

    expect(screen.getByTestId('overview-card-connection-status')).toHaveTextContent('Not Connected');
    expect(screen.getByTestId('overview-card-last-sync')).toHaveTextContent('Not Available');
    expect(screen.getByTestId('overview-card-records-processed')).toHaveTextContent('Not Available');
    expect(screen.getByTestId('overview-card-pending-work')).toHaveTextContent('Not Available');
  });

  it('5. SAP Work Queue renders empty state without fabricated records', async () => {
    vi.mocked(sapService.getSapStatus).mockResolvedValueOnce({
      status: 'unavailable',
      message: 'SAP integration is not configured or connected.',
    });

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByTestId('sap-work-queue-empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText('No SAP work is currently available.')).toBeInTheDocument();
    expect(
      screen.getByText(/Connect\/configure the SAP integration to begin synchronization/i)
    ).toBeInTheDocument();
    expect(screen.getByText('0 Pending Tasks')).toBeInTheDocument();
  });

  it('6. Synchronization controls are locked when integration is unavailable', async () => {
    vi.mocked(sapService.getSapStatus).mockResolvedValueOnce({
      status: 'unavailable',
      message: 'SAP integration is not configured or connected.',
    });

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Start Sync/i })).toBeDisabled();
    });

    expect(
      screen.getByText(/Synchronization controls are locked/i)
    ).toBeInTheDocument();
  });

  it('7. Manual refresh triggers sapService.getSapStatus and toggles details', async () => {
    vi.mocked(sapService.getSapStatus).mockResolvedValue({
      status: 'unavailable',
      message: 'SAP integration is not configured or connected.',
    });

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByTestId('sap-status-badge')).toBeInTheDocument();
    });

    const refreshButtons = screen.getAllByRole('button', { name: /Refresh Status/i });
    expect(refreshButtons.length).toBeGreaterThan(0);

    fireEvent.click(refreshButtons[0]);

    await waitFor(() => {
      expect(sapService.getSapStatus).toHaveBeenCalledTimes(2);
    });

    // Toggle Integration Details
    const detailsBtn = screen.getByRole('button', { name: /Integration Details/i });
    fireEvent.click(detailsBtn);

    expect(screen.getByTestId('sap-integration-details-panel')).toBeInTheDocument();
    expect(screen.getByText('GET /api/v1/business-data/sap')).toBeInTheDocument();
  });

  it('8. Rapid refresh clicking prevents overlapping requests', async () => {
    let callCount = 0;
    vi.mocked(sapService.getSapStatus).mockImplementation(
      () =>
        new Promise((resolve) => {
          callCount++;
          setTimeout(
            () =>
              resolve({
                status: 'unavailable',
                message: 'SAP integration is not configured or connected.',
              }),
            50
          );
        })
    );

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByTestId('sap-status-badge')).toBeInTheDocument();
    });

    const refreshBtn = screen.getAllByRole('button', { name: /Refresh Status/i })[0];
    fireEvent.click(refreshBtn);
    fireEvent.click(refreshBtn);
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(callCount).toBe(2); // initial call + 1 from synchronized burst
    });
  });

  it('9. Handles 401 Session Expired gracefully', async () => {
    vi.mocked(sapService.getSapStatus).mockRejectedValueOnce(
      new ApiError('Unauthorized', 401)
    );

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByTestId('sap-error-state')).toBeInTheDocument();
    });

    expect(screen.getByText('Session Expired')).toBeInTheDocument();
    expect(
      screen.getByText('Your session has expired. Please sign in again.')
    ).toBeInTheDocument();
  });

  it('10. Handles 403 Forbidden gracefully', async () => {
    vi.mocked(sapService.getSapStatus).mockRejectedValueOnce(
      new ApiError('Forbidden', 403)
    );

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByTestId('sap-error-state')).toBeInTheDocument();
    });

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(
      screen.getByText('You do not have permission to view SAP integration data.')
    ).toBeInTheDocument();
  });

  it('11. Handles 500 server error and allows retry', async () => {
    vi.mocked(sapService.getSapStatus)
      .mockRejectedValueOnce(new ApiError('Internal Server Error', 500))
      .mockResolvedValueOnce({
        status: 'unavailable',
        message: 'SAP integration is not configured or connected.',
      });

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByTestId('sap-error-state')).toBeInTheDocument();
    });

    expect(screen.getByText('Internal Server Error')).toBeInTheDocument();

    const retryBtns = screen.getAllByRole('button', { name: /Retry/i });
    expect(retryBtns.length).toBeGreaterThan(0);
    fireEvent.click(retryBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('sap-status-badge')).toBeInTheDocument();
    });

    expect(sapService.getSapStatus).toHaveBeenCalledTimes(2);
  });

  it('12. Connected status renders when backend reports connected state', async () => {
    vi.mocked(sapService.getSapStatus).mockResolvedValueOnce({
      status: 'Connected',
      message: 'SAP ERP Gateway connected and operational.',
    });

    renderSapPage();

    await waitFor(() => {
      expect(screen.getByTestId('sap-status-badge')).toHaveTextContent('Connected');
    });

    expect(screen.getByTestId('overview-card-system-status')).toHaveTextContent('Connected');
    expect(screen.getByTestId('overview-card-connection-status')).toHaveTextContent('Connected');
  });

  it('13. Service layer verifies backend contract GET /business-data/sap without tenant leaks', async () => {
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      status: 'unavailable',
      message: 'SAP integration is not configured or connected.',
    });

    // Unmock sapService to test actual service implementation
    const actualSapService = (await vi.importActual('../services/sapService')) as { sapService: typeof sapService };
    const result = await actualSapService.sapService.getSapStatus();

    expect(spy).toHaveBeenCalledWith('/business-data/sap');
    expect(result.status).toBe('unavailable');
  });
});
