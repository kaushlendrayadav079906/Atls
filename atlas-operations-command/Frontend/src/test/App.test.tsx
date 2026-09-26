import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { AppShell } from '../components/layout/AppShell';
import { AuthProvider } from '../context/AuthContext';
import { authService } from '../services/authService';

// Mock authService
vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(false),
  },
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

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form inputs and branding', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('AtlasOps Cmd')).toBeInTheDocument();
    expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('handles successful authentication flow', async () => {
    const user = userEvent.setup();
    (authService.login as any).mockResolvedValueOnce({ access_token: 'fake-token' });
    (authService.getCurrentUser as any).mockResolvedValueOnce({
      id: '123',
      email: 'admin@test.com',
      full_name: 'Admin User',
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Global Corp');
    await user.type(screen.getByLabelText(/Email Address/i), 'admin@test.com');
    await user.type(screen.getByLabelText(/Password/i), 'password123');

    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith(
        'Acme Global Corp',
        'admin@test.com',
        'password123'
      );
    });
  });

  it('displays error state on failed authentication', async () => {
    const user = userEvent.setup();
    (authService.login as any).mockRejectedValueOnce(new Error('Invalid email or password'));

    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Global Corp');
    await user.type(screen.getByLabelText(/Email Address/i), 'bad@test.com');
    await user.type(screen.getByLabelText(/Password/i), 'wrong');

    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText('Login Failed')).toBeInTheDocument();
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  // 20. Registration link
  it('20. renders link to registration page', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    const registerLink = screen.getByRole('link', { name: /Create an account/i });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  // 21-23. Prefill company name, email, password remains empty, success notice
  it('21-23. prefills company name and email from location state while keeping password empty', () => {
    const testState = {
      companyName: 'Acme Global Corp',
      email: 'newadmin@enterprise.com',
      successMessage: 'Registration successful. Please log in.',
    };

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[{ pathname: '/login', state: testState }]}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('Registration successful. Please log in.')).toBeInTheDocument();

    const companyNameInput = screen.getByLabelText(/Company Name/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;

    expect(companyNameInput.value).toBe('Acme Global Corp');
    expect(emailInput.value).toBe('newadmin@enterprise.com');
    // Password must remain empty!
    expect(passwordInput.value).toBe('');
  });
});

describe('AppShell Component', () => {
  it('renders application navigation items and brand', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppShell>
            <div>Dashboard Content</div>
          </AppShell>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('AtlasOps Cmd')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Factories')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('AI Risk & Actions')).toBeInTheDocument();
    expect(screen.getByText('Realtime Health')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });
});
