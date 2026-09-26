import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Building2, Globe, DollarSign, Clock, Calendar, User, Mail, Lock, ArrowRight } from 'lucide-react';
import { authService } from '../services/authService';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { config } from '../config';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  // Company Information state
  const [companyName, setCompanyName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [locale, setLocale] = useState('en-US');
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(1);

  // Administrator Account state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Error state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatErrorMessage = (err: any): string => {
    if (!err) return 'An error occurred during registration. Please try again.';
    
    // Check if network error
    if (err.status === 0 || err.message?.includes('Network error') || err.message?.includes('Failed to fetch')) {
      return 'Unable to connect to the server. Please check your network connection.';
    }

    const data = err.data;
    if (data) {
      if (typeof data.detail === 'string') {
        return data.detail.replace(/^Value error,\s*/i, '');
      }
      if (Array.isArray(data.detail)) {
        // Pydantic validation error list
        const messages = data.detail
          .map((d: any) => (d.msg ? d.msg.replace(/^Value error,\s*/i, '') : `${d.loc?.slice(1).join('.')} is invalid`))
          .join(', ');
        return messages || 'Please correct the highlighted fields.';
      }
      if (typeof data.message === 'string') {
        return data.message;
      }
    }

    if (err.status === 409) {
      return 'An account with this email or company already exists.';
    }

    if (err.status === 422) {
      return 'Please check your registration details and ensure all required fields are valid.';
    }

    if (err.status === 500) {
      return 'An unexpected server error occurred. Please try again later.';
    }

    return err.message || 'An error occurred during registration. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side pre-validations
    const trimmedCompanyName = companyName.trim();
    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedCountry = countryCode.trim().toUpperCase();
    const trimmedCurrency = currencyCode.trim().toUpperCase();
    const trimmedTimezone = timezone.trim();

    if (!trimmedCompanyName) {
      setError('Company Name is required.');
      return;
    }

    if (!trimmedCurrency || trimmedCurrency.length !== 3) {
      setError('Currency Code must be exactly 3 letters (e.g. USD, EUR, INR).');
      return;
    }

    if (trimmedCountry && trimmedCountry.length !== 2) {
      setError('Country Code must be exactly 2 letters (e.g. US, IN, DE).');
      return;
    }

    if (!trimmedTimezone) {
      setError('Timezone is required.');
      return;
    }

    if (fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
      setError('Fiscal Year Start Month must be between 1 and 12.');
      return;
    }

    if (!trimmedFullName) {
      setError('Full Name is required.');
      return;
    }

    // Basic email regex format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authService.register({
        company_name: trimmedCompanyName,
        country_code: trimmedCountry || null,
        currency_code: trimmedCurrency,
        timezone: trimmedTimezone,
        locale: locale.trim() || 'en-US',
        region: trimmedCountry || 'US',
        fiscal_year_start_month: fiscalYearStartMonth,
        full_name: trimmedFullName,
        email: trimmedEmail,
        password: password,
        confirm_password: confirmPassword,
      });

      // Pass only companyName and email to LoginPage via state (no passwords or tokens)
      navigate('/login', {
        state: {
          companyName: response.company_name,
          email: response.email,
          successMessage: 'Registration successful. Please log in.',
        },
      });
    } catch (err: any) {
      setError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top, #1e293b 0%, #0f172a 100%)',
        padding: '32px 16px',
      }}
    >
      {/* Datalists for standard options */}
      <datalist id="currency-options">
        <option value="USD" />
        <option value="EUR" />
        <option value="GBP" />
        <option value="INR" />
        <option value="JPY" />
        <option value="CAD" />
        <option value="AUD" />
        <option value="SGD" />
        <option value="CHF" />
        <option value="CNY" />
        <option value="AED" />
      </datalist>

      <datalist id="country-options">
        <option value="US" />
        <option value="IN" />
        <option value="GB" />
        <option value="DE" />
        <option value="FR" />
        <option value="JP" />
        <option value="CA" />
        <option value="AU" />
        <option value="SG" />
        <option value="AE" />
      </datalist>

      <datalist id="timezone-options">
        <option value="UTC" />
        <option value="Asia/Kolkata" />
        <option value="America/New_York" />
        <option value="America/Chicago" />
        <option value="America/Denver" />
        <option value="America/Los_Angeles" />
        <option value="Europe/London" />
        <option value="Europe/Paris" />
        <option value="Europe/Berlin" />
        <option value="Asia/Tokyo" />
        <option value="Asia/Singapore" />
        <option value="Asia/Dubai" />
        <option value="Australia/Sydney" />
      </datalist>

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--primary-gradient)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              marginBottom: '12px',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {config.appName}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Register Enterprise Account & Command Control
          </p>
        </div>

        {error && <ErrorState title="Registration Failed" message={error} />}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* SECTION 1: Company Information */}
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--primary)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Building2 size={18} /> Company Information
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label
                  htmlFor="companyName"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                >
                  Company Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="companyName"
                  type="text"
                  placeholder="e.g. Acme Global Logistics"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input-field"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    htmlFor="currencyCode"
                    style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                  >
                    Currency Code (3 Letters) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign
                      size={16}
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      id="currencyCode"
                      type="text"
                      list="currency-options"
                      placeholder="USD"
                      value={currencyCode}
                      onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                      className="input-field"
                      style={{ paddingLeft: '32px' }}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="countryCode"
                    style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                  >
                    Country Code
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Globe
                      size={16}
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      id="countryCode"
                      type="text"
                      list="country-options"
                      placeholder="US (Optional)"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                      className="input-field"
                      style={{ paddingLeft: '32px' }}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    htmlFor="timezone"
                    style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                  >
                    Timezone <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Clock
                      size={16}
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      id="timezone"
                      type="text"
                      list="timezone-options"
                      placeholder="e.g. America/New_York or UTC"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: '32px' }}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="locale"
                    style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                  >
                    Locale
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Globe
                      size={16}
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      id="locale"
                      type="text"
                      placeholder="en-US"
                      value={locale}
                      onChange={(e) => setLocale(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: '32px' }}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="fiscalYearStartMonth"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                >
                  Fiscal Year Start Month <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar
                    size={16}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <select
                    id="fiscalYearStartMonth"
                    value={fiscalYearStartMonth}
                    onChange={(e) => setFiscalYearStartMonth(parseInt(e.target.value, 10))}
                    className="input-field"
                    style={{ paddingLeft: '32px' }}
                    disabled={isSubmitting}
                  >
                    <option value={1}>1 — January</option>
                    <option value={2}>2 — February</option>
                    <option value={3}>3 — March</option>
                    <option value={4}>4 — April</option>
                    <option value={5}>5 — May</option>
                    <option value={6}>6 — June</option>
                    <option value={7}>7 — July</option>
                    <option value={8}>8 — August</option>
                    <option value={9}>9 — September</option>
                    <option value={10}>10 — October</option>
                    <option value={11}>11 — November</option>
                    <option value={12}>12 — December</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Administrator Account */}
          <div>
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--primary)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <User size={18} /> Administrator Account
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label
                  htmlFor="fullName"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                >
                  Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={16}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    id="fullName"
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '32px' }}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                >
                  Email <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '32px' }}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    htmlFor="password"
                    style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                  >
                    Password <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      size={16}
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: '32px' }}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}
                  >
                    Confirm Password <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      size={16}
                      style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: '32px' }}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: '8px', width: '100%', height: '44px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <LoadingSpinner size="small" />
            ) : (
              <>
                Create Account <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
