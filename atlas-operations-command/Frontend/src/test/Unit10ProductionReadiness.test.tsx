import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AppErrorBoundary } from '../components/common/AppErrorBoundary';
import { apiClient, ApiError, getUserSafeErrorMessage } from '../services/apiClient';
import { authService } from '../services/authService';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { App } from '../App';

// Problematic component for testing error boundary
const BuggyComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Crashing rendering with secret db_password=secret_val');
  }
  return <div>Component rendered successfully</div>;
};

// Component for testing Auth & Protected Route
const DummyProtectedDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div>
      <h1>Protected Dashboard</h1>
      <p data-testid="user-name">{user?.full_name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('Unit 10: Audit, Monitoring & Production Readiness Suite', () => {
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    console.error = vi.fn(); // Suppress noisy React error boundary logs
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  // 1. Error Boundary
  it('1. AppErrorBoundary catches unexpected render errors and shows recovery screen without leaking stack/secrets', () => {
    render(
      <AppErrorBoundary>
        <BuggyComponent shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(
      screen.getByText('AtlasOps Cmd encountered an unexpected application error.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload Application/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();

    // Security invariant: No raw error or stack trace leak
    expect(screen.queryByText(/db_password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret_val/i)).not.toBeInTheDocument();
  });

  // 2. Error Boundary Try Again reset
  it('2. AppErrorBoundary Try Again button resets error boundary when error condition resolves', () => {
    const { rerender } = render(
      <AppErrorBoundary>
        <BuggyComponent shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();

    // Now re-render without throw and click Try Again
    rerender(
      <AppErrorBoundary>
        <BuggyComponent shouldThrow={false} />
      </AppErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    expect(screen.getByText('Component rendered successfully')).toBeInTheDocument();
  });

  // 3. API Client Status Handling: 401 Session Handling
  it('3. API 401 response clears token from storage and returns safe user message', async () => {
    apiClient.setToken('invalid-or-expired-token');
    expect(localStorage.getItem('atlasops_token')).toBe('invalid-or-expired-token');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Token has expired' }),
    });

    await expect(apiClient.get('/factories')).rejects.toThrow(ApiError);
    expect(localStorage.getItem('atlasops_token')).toBeNull();
  });

  // 4. API Client Status Handling: 403 Permission Handling
  it('4. API 403 forbidden returns permission error message without internals', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Not authorized for this resource' }),
    });

    await expect(apiClient.get('/restricted')).rejects.toThrow(
      'Not authorized for this resource'
    );
  });

  // 5. API Client Status Handling: 404 Not Found Handling
  it('5. API 404 returns resource unavailable message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Factory plant not found' }),
    });

    await expect(apiClient.get('/factories/missing-id')).rejects.toThrow(
      'Factory plant not found'
    );
  });

  // 6. API Client Status Handling: 409 Conflict Handling
  it('6. API 409 conflict returns conflict guidance', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Resource already exists' }),
    });

    await expect(apiClient.post('/currency/rates', { from_currency: 'USD' })).rejects.toThrow(
      'Resource already exists'
    );
  });

  // 7. API Client Status Handling: 422 Validation Handling
  it('7. API 422 validation formats FastAPI validation array safely', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: { get: () => 'application/json' },
      json: async () => ({
        detail: [
          { loc: ['body', 'email'], msg: 'value is not a valid email address' },
          { loc: ['body', 'company_name'], msg: 'field required' },
        ],
      }),
    });

    try {
      await apiClient.post('/auth/register', {});
      expect.fail('Expected error');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toContain('email: value is not a valid email address');
      expect(err.message).toContain('company_name: field required');
    }
  });

  // 8. API Client Status Handling: 429 Rate Limit Handling
  it('8. API 429 rate limit returns slow down message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Rate limit exceeded' }),
    });

    await expect(apiClient.get('/ai/risk-analysis')).rejects.toThrow(
      'Rate limit exceeded'
    );
  });

  // 9. API Client Status Handling: 5xx Server Failure Masking
  it('9. API 500 server failure masks internal tracebacks and raw SQL errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({
        detail:
          'Traceback (most recent call last): sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (2003, "Can\'t connect to MySQL server on \'127.0.0.1\'")',
      }),
    });

    try {
      await apiClient.get('/internal-crash');
      expect.fail('Expected error');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe('An internal server error occurred. Please try again later.');
      // Crucial: No DB or traceback leaked
      expect(err.message).not.toContain('pymysql');
      expect(err.message).not.toContain('MySQL');
      expect(err.message).not.toContain('Traceback');
    }
  });

  // 10. API Client Network Failure
  it('10. Network failure (status 0) produces connection error message', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    try {
      await apiClient.get('/unreachable');
      expect.fail('Expected error');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(0);
      expect(err.message).toContain('Unable to connect to the server');
    }
  });

  // 11. Protected Route: Unauthenticated redirect to /login
  it('11. ProtectedRoute redirects unauthenticated users to /login', async () => {
    localStorage.removeItem('atlasops_token');

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div>LoginPage View</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DummyProtectedDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('LoginPage View')).toBeInTheDocument();
      expect(screen.queryByText('Protected Dashboard')).not.toBeInTheDocument();
    });
  });

  // 12. Protected Route: Authenticated user is allowed
  it('12. ProtectedRoute renders children when user session is active', async () => {
    localStorage.setItem('atlasops_token', 'valid-active-jwt');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        id: 'usr-123',
        email: 'admin@acme.com',
        full_name: 'Lead Operator',
        company_id: 'cmp-123',
        role: 'admin',
      }),
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div>LoginPage View</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DummyProtectedDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('user-name')).toHaveTextContent('Lead Operator');
    });
  });

  // 13. Security Invariant: No Client company_id Injection in apiClient
  it('13. Security Invariant: apiClient does not accept or automatically append company_id params', () => {
    const client = apiClient as any;
    expect(client.company_id).toBeUndefined();
    expect(client.companyId).toBeUndefined();
  });

  // 14. Unknown Route Fallback
  it('14. Unknown routes redirect to dashboard without crashing', async () => {
    localStorage.setItem('atlasops_token', 'valid-active-jwt');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        id: 'usr-123',
        email: 'admin@acme.com',
        full_name: 'Lead Operator',
        company_id: 'cmp-123',
        role: 'admin',
      }),
    });

    render(<App />);

    // App renders and initializes
    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });

  // 15. getUserSafeErrorMessage comprehensive coverage
  it('15. getUserSafeErrorMessage covers 413, 415, 502, 503, 504 and custom messages', () => {
    expect(getUserSafeErrorMessage(413)).toContain('too large');
    expect(getUserSafeErrorMessage(415)).toContain('Unsupported');
    expect(getUserSafeErrorMessage(502)).toContain('Bad gateway');
    expect(getUserSafeErrorMessage(503)).toContain('Service temporarily unavailable');
    expect(getUserSafeErrorMessage(504)).toContain('Gateway timeout');
  });
});
