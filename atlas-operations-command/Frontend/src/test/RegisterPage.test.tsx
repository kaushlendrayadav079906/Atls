import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RegisterPage } from '../pages/RegisterPage';
import { AuthProvider } from '../context/AuthContext';
import { authService } from '../services/authService';

vi.mock('../services/authService', () => ({
  authService: {
    register: vi.fn(),
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

describe('RegisterPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Register page renders
  it('1. Register page renders successfully with branding and submit button', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByText('AtlasOps Cmd')).toBeInTheDocument();
    expect(screen.getByText(/Register Enterprise Account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
  });

  // 2. Company fields render
  it('2. Company fields render properly', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Country Code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Currency Code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Timezone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Locale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fiscal Year Start Month/i)).toBeInTheDocument();
  });

  // 3. Administrator fields render
  it('3. Administrator fields render properly', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
  });

  // 4. Required validation works
  it('4. Required field validation fails when mandatory fields are missing', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.clear(screen.getByLabelText(/Company Name/i));
    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText('Company Name is required.')).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  // 5. Invalid email is rejected
  it('5. Invalid email format is rejected by validation', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'invalid-email');
    await user.type(screen.getByLabelText(/^Password \*/i), 'SecurePassword123!');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'SecurePassword123!');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  // 6. Password shorter than 8 characters is rejected
  it('6. Password shorter than 8 characters is rejected', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^Password \*/i), 'short');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'short');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText('Password must be at least 8 characters long.')).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  // 7. Password mismatch is rejected
  it('7. Password mismatch is rejected', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^Password \*/i), 'SecurePassword123!');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'DifferentPassword456!');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  // 8. Invalid country code is rejected
  it('8. Invalid country code is rejected when not exactly 2 letters', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/Country Code/i), 'USA'); // 3 letters
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^Password \*/i), 'SecurePassword123!');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'SecurePassword123!');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText('Country Code must be exactly 2 letters (e.g. US, IN, DE).')).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  // 9. Invalid currency code is rejected
  it('9. Invalid currency code is rejected when not exactly 3 letters', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.clear(screen.getByLabelText(/Currency Code/i));
    await user.type(screen.getByLabelText(/Currency Code/i), 'US'); // only 2 letters
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^Password \*/i), 'SecurePassword123!');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'SecurePassword123!');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText('Currency Code must be exactly 3 letters (e.g. USD, EUR, INR).')).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  // 10, 11, 12, 13, 14: Successful registration, service call, navigation, companyName/email passed, password NOT passed
  it('10-14. Successful registration calls authService, navigates to /login passing only companyName and email (no password)', async () => {
    const user = userEvent.setup();
    (authService.register as any).mockResolvedValueOnce({
      message: 'Company and administrator registered successfully',
      company_id: '12345678-1234-5678-1234-567812345678',
      company_name: 'Acme Corp',
      email: 'john@example.com',
      full_name: 'John Doe',
    });

    let capturedLocation: any = null;
    const LocationWatcher = () => {
      capturedLocation = useLocation();
      return <div>Login Destination: {capturedLocation.pathname}</div>;
    };

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LocationWatcher />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/Country Code/i), 'US');
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^Password \*/i), 'SuperSecret123!');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'SuperSecret123!');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        company_name: 'Acme Corp',
        country_code: 'US',
        currency_code: 'USD',
        timezone: 'UTC',
        locale: 'en-US',
        region: 'US',
        fiscal_year_start_month: 1,
        full_name: 'John Doe',
        email: 'john@example.com',
        password: 'SuperSecret123!',
        confirm_password: 'SuperSecret123!',
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Login Destination: \/login/i)).toBeInTheDocument();
    });

    // Verify location state
    expect(capturedLocation.state).toBeDefined();
    expect(capturedLocation.state.companyName).toBe('Acme Corp');
    expect(capturedLocation.state.email).toBe('john@example.com');
    expect(capturedLocation.state.successMessage).toBe('Registration successful. Please log in.');
    // Invariant: password MUST NOT be passed in state
    expect(capturedLocation.state.password).toBeUndefined();
    expect(capturedLocation.state.confirm_password).toBeUndefined();
    expect(capturedLocation.state.password_hash).toBeUndefined();
    expect(capturedLocation.state.access_token).toBeUndefined();
  });

  // 15. Backend 409 error displays readable message
  it('15. Backend 409 conflict error displays readable message', async () => {
    const user = userEvent.setup();
    const error409 = new Error('An account with this email already exists.') as any;
    error409.status = 409;
    error409.data = { detail: 'An account with this email already exists.' };
    (authService.register as any).mockRejectedValueOnce(error409);

    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^Password \*/i), 'SuperSecret123!');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'SuperSecret123!');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument();
  });

  // 16. Backend 422 error displays readable message
  it('16. Backend 422 validation error displays readable message', async () => {
    const user = userEvent.setup();
    const error422 = new Error('Validation error') as any;
    error422.status = 422;
    error422.data = {
      detail: [{ loc: ['body', 'timezone'], msg: 'Please enter a valid IANA timezone.' }],
    };
    (authService.register as any).mockRejectedValueOnce(error422);

    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^Password \*/i), 'SuperSecret123!');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'SuperSecret123!');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText('Please enter a valid IANA timezone.')).toBeInTheDocument();
  });

  // 17. Backend 500 error displays readable message
  it('17. Backend 500 internal error displays readable generic message', async () => {
    const user = userEvent.setup();
    const error500 = new Error('Internal Server Error') as any;
    error500.status = 500;
    (authService.register as any).mockRejectedValueOnce(error500);

    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^Password \*/i), 'SuperSecret123!');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'SuperSecret123!');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(
      await screen.findByText('An unexpected server error occurred. Please try again later.')
    ).toBeInTheDocument();
  });

  // 18. Network failure displays readable message
  it('18. Network failure displays readable message', async () => {
    const user = userEvent.setup();
    (authService.register as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/Full Name/i), 'John Doe');
    await user.type(screen.getByLabelText(/Email \*/i), 'john@example.com');
    await user.type(screen.getByLabelText(/^Password \*/i), 'SuperSecret123!');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'SuperSecret123!');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(
      await screen.findByText('Unable to connect to the server. Please check your network connection.')
    ).toBeInTheDocument();
  });

  // 19. Login link navigates to /login
  it('19. Login link navigates user to /login', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    );

    const loginLink = screen.getByRole('link', { name: /Login/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });
});
