import React, { useState } from 'react';
import {
  ArrowLeftRight,
  PlusCircle,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Building2,
  Activity,
  Search,
  X,
  Plus,
} from 'lucide-react';
import type { ExchangeRate, ExchangeRateCreatePayload } from '../../types';
import { currencyService } from '../../services/currencyService';

interface ExchangeRateManagementProps {
  rates: ExchangeRate[];
  baseCurrency: string;
  isAdmin: boolean;
  onRateCreated: () => Promise<void> | void;
}

export const ExchangeRateManagement: React.FC<ExchangeRateManagementProps> = ({
  rates,
  baseCurrency,
  isAdmin,
  onRateCreated,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<ExchangeRateCreatePayload>({
    from_currency: baseCurrency || 'INR',
    to_currency: 'USD',
    rate: 0.012,
    effective_date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'rate') {
      const num = parseFloat(value);
      setFormData((prev) => ({ ...prev, rate: isNaN(num) ? 0 : num }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value.toUpperCase() }));
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('You do not have permission to manage exchange rates.');
      return;
    }

    if (!formData.from_currency || !formData.to_currency) {
      setError('Both source and target currency codes are required.');
      return;
    }

    if (formData.from_currency.length !== 3 || formData.to_currency.length !== 3) {
      setError('Currencies must be valid 3-letter currency codes (e.g. USD, INR, EUR).');
      return;
    }

    if (formData.from_currency === formData.to_currency) {
      setError('From currency and To currency must be distinct.');
      return;
    }

    const numericRate = Number(formData.rate);
    if (isNaN(numericRate) || numericRate <= 0) {
      setError('Direct exchange rate must be a strictly positive number.');
      return;
    }

    if (!formData.effective_date) {
      setError('Effective date is required.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await currencyService.createExchangeRate({
        ...formData,
        from_currency: formData.from_currency.toUpperCase(),
        to_currency: formData.to_currency.toUpperCase(),
        rate: numericRate,
      });
      setSuccess(`Exchange rate for ${formData.from_currency} → ${formData.to_currency} successfully registered.`);
      setIsCreating(false);
      setFormData({
        from_currency: baseCurrency || 'INR',
        to_currency: 'USD',
        rate: 1.0,
        effective_date: new Date().toISOString().split('T')[0],
      });
      await onRateCreated();
    } catch (err: any) {
      if (
        err.status === 409 ||
        err.message?.includes('duplicate') ||
        err.message?.includes('409') ||
        err.message?.includes('already exists')
      ) {
        setError('An exchange rate for this currency pair and effective date already exists.');
      } else if (err.status === 401 || err.message?.includes('401')) {
        setError('Your session has expired. Please sign in again.');
      } else if (err.status === 403 || err.message?.includes('403')) {
        setError('You do not have permission to manage exchange rates.');
      } else {
        setError(err.message || 'Unable to load or save exchange rates.');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredRates = rates.filter((r) => {
    if (!filterQuery) return true;
    const q = filterQuery.toUpperCase();
    return r.from_currency.includes(q) || r.to_currency.includes(q) || r.effective_date.includes(q);
  });

  const isConfigured = rates.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ArrowLeftRight size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em' }}>
              Company Exchange Rates
            </h3>
            <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Manage direct currency conversion rates used across financial calculations and reporting.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Three Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '12px',
        }}
      >
        {/* Card 1: Direct Pairs */}
        <div
          style={{
            backgroundColor: '#0c152b',
            border: '1px solid #1a2744',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
              Direct Pairs
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px', fontFamily: 'monospace' }}>
              {rates.length} {rates.length === 1 ? 'Pair' : 'Pairs'}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Configured currency pairs</span>
          </div>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <Layers size={16} />
          </div>
        </div>

        {/* Card 2: Base Currency */}
        <div
          style={{
            backgroundColor: '#0c152b',
            border: '1px solid #1a2744',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
              Base Currency
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', marginTop: '2px', fontFamily: 'monospace' }}>
              {baseCurrency || 'INR'}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Company ledger currency</span>
          </div>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: 'rgba(52, 211, 153, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
            }}
          >
            <Building2 size={16} />
          </div>
        </div>

        {/* Card 3: Rate Status */}
        <div
          style={{
            backgroundColor: '#0c152b',
            border: '1px solid #1a2744',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
              Rate Status
            </span>
            <div
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: isConfigured ? '#34d399' : '#f59e0b',
                marginTop: '2px',
              }}
            >
              {isConfigured ? 'Configured' : 'Not Configured'}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
              {isConfigured ? 'Active exchange matrix' : 'No conversion records'}
            </span>
          </div>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: isConfigured ? 'rgba(52, 211, 153, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isConfigured ? '#34d399' : '#f59e0b',
            }}
          >
            <Activity size={16} />
          </div>
        </div>
      </div>

      {/* 3. Main Exchange Rate Management Card */}
      <div
        style={{
          backgroundColor: '#0c152b',
          border: '1px solid #1a2744',
          borderRadius: '10px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Exchange Rate Management
            </h4>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Authoritative currency pair registry. Rates determine automatic multi-currency conversions.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Search / Filter */}
            <div style={{ position: 'relative' }}>
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: '9px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                }}
              />
              <input
                type="text"
                placeholder="Search pair or date..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{
                  height: '32px',
                  padding: '0 10px 0 28px',
                  backgroundColor: '#070d1e',
                  border: '1px solid #1a2846',
                  borderRadius: '5px',
                  color: '#f8fafc',
                  fontSize: '0.75rem',
                  outline: 'none',
                  width: '160px',
                }}
              />
            </div>

            {/* Add Exchange Rate Button */}
            {isAdmin ? (
              <button
                onClick={() => {
                  setIsCreating(!isCreating);
                  setError(null);
                  setSuccess(null);
                }}
                id="btn-toggle-add-rate"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '5px',
                  background: isCreating ? '#1e293b' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: isCreating ? '1px solid #334155' : 'none',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isCreating ? <X size={13} /> : <Plus size={13} />}
                <span>{isCreating ? 'Cancel' : 'Add Rate'}</span>
              </button>
            ) : (
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: '5px',
                  backgroundColor: '#131e3a',
                  border: '1px solid #223354',
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                }}
              >
                Admin-Only Management
              </div>
            )}
          </div>
        </div>

        {/* 4. Add Rate Modal / Form */}
        {isCreating && isAdmin && (
          <form
            onSubmit={handleSubmit}
            style={{
              backgroundColor: '#090f20',
              border: '1px solid #0284c7',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <PlusCircle size={14} /> Register Direct Rate Pair
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Authoritative backend registry</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '10px',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>
                  From Currency *
                </label>
                <input
                  type="text"
                  name="from_currency"
                  maxLength={3}
                  value={formData.from_currency}
                  onChange={handleInputChange}
                  placeholder="INR"
                  style={{
                    width: '100%',
                    height: '32px',
                    backgroundColor: '#070d1e',
                    border: '1px solid #1a2846',
                    borderRadius: '5px',
                    color: '#f8fafc',
                    padding: '0 8px',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>
                  To Currency *
                </label>
                <input
                  type="text"
                  name="to_currency"
                  maxLength={3}
                  value={formData.to_currency}
                  onChange={handleInputChange}
                  placeholder="USD"
                  style={{
                    width: '100%',
                    height: '32px',
                    backgroundColor: '#070d1e',
                    border: '1px solid #1a2846',
                    borderRadius: '5px',
                    color: '#f8fafc',
                    padding: '0 8px',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Direct Rate *
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0.000001"
                  name="rate"
                  value={formData.rate}
                  onChange={handleInputChange}
                  placeholder="0.012000"
                  style={{
                    width: '100%',
                    height: '32px',
                    backgroundColor: '#070d1e',
                    border: '1px solid #1a2846',
                    borderRadius: '5px',
                    color: '#f8fafc',
                    padding: '0 8px',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Effective Date *
                </label>
                <input
                  type="date"
                  name="effective_date"
                  value={formData.effective_date}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    height: '32px',
                    backgroundColor: '#070d1e',
                    border: '1px solid #1a2846',
                    borderRadius: '5px',
                    color: '#f8fafc',
                    padding: '0 8px',
                    fontSize: '0.75rem',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '5px',
                  backgroundColor: 'transparent',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                id="btn-submit-exchange-rate"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 14px',
                  borderRadius: '5px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                <span>Save Rate Pair</span>
              </button>
            </div>
          </form>
        )}

        {/* Status Messages */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.75rem',
            }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#34d399',
              fontSize: '0.75rem',
            }}
          >
            <CheckCircle2 size={14} />
            <span>{success}</span>
          </div>
        )}

        {/* 5. Professional Rates Table */}
        <div style={{ overflowX: 'auto', border: '1px solid #1e293b', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#090f20', borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Currency Pair</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Direct Rate</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Inverse Rate</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Effective Date</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: 'monospace' }}>
              {filteredRates.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b', fontFamily: 'sans-serif' }}>
                    {filterQuery ? 'No exchange rates matching query.' : 'No exchange rates configured for this company.'}
                  </td>
                </tr>
              ) : (
                filteredRates.map((rate, idx) => {
                  const numericRateVal = Number(rate.rate);
                  const inverse = !isNaN(numericRateVal) && numericRateVal > 0 ? (1 / numericRateVal).toFixed(6) : '—';
                  return (
                    <tr
                      key={`${rate.from_currency}-${rate.to_currency}-${rate.effective_date || idx}`}
                      style={{
                        borderBottom: '1px solid #131e3a',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#131e3a', color: '#38bdf8' }}>
                            {rate.from_currency}
                          </span>
                          <ArrowLeftRight size={12} color="#64748b" />
                          <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#131e3a', color: '#34d399' }}>
                            {rate.to_currency}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>
                        1 {rate.from_currency} = {rate.rate} {rate.to_currency}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                        1 {rate.to_currency} ≈ {inverse} {rate.from_currency}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} color="#64748b" />
                          <span>{rate.effective_date}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'sans-serif' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
