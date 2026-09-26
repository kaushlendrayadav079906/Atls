import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Globe, ShieldCheck, Shield } from 'lucide-react';
import { localizationService } from '../../services/localizationService';
import type { LocalizationConfig } from '../../types';

interface LocalizationSettingsProps {
  config: LocalizationConfig | null;
  isAdmin: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onSaved?: () => void;
}

export const LocalizationSettings: React.FC<LocalizationSettingsProps> = ({
  config,
  isAdmin,
  onSaved,
}) => {
  const [formData, setFormData] = useState({
    country_code: config?.country_code || 'IN',
    state_code: config?.state_code || 'MH',
    timezone: config?.timezone || 'Asia/Kolkata',
    locale: config?.locale || 'en-IN',
    currency_code: config?.currency_code || 'INR',
    gstin: config?.gstin || '27AAAAA0000A1Z5',
    tax_id: config?.tax_id || 'CIN123456789',
    default_tax_rate: config?.default_tax_rate?.toString() || '18.00',
    fiscal_year_start_month: config?.fiscal_year_start_month || 4,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        country_code: config.country_code || 'IN',
        state_code: config.state_code || 'MH',
        timezone: config.timezone || 'Asia/Kolkata',
        locale: config.locale || 'en-IN',
        currency_code: config.currency_code || 'INR',
        gstin: config.gstin || '27AAAAA0000A1Z5',
        tax_id: config.tax_id || 'CIN123456789',
        default_tax_rate: config.default_tax_rate?.toString() || '18.00',
        fiscal_year_start_month: config.fiscal_year_start_month || 4,
      });
    }
  }, [config]);

  if (!config) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await localizationService.updateCompanySettings(config.company_id, {
        country_code: formData.country_code.toUpperCase() || null,
        state_code: formData.state_code.toUpperCase() || null,
        timezone: formData.timezone || 'UTC',
        locale: formData.locale || 'en-US',
        currency_code: formData.currency_code.toUpperCase() || 'USD',
        gstin: formData.gstin || null,
        tax_id: formData.tax_id || null,
        default_tax_rate: formData.default_tax_rate ? parseFloat(formData.default_tax_rate) : 18.0,
        fiscal_year_start_month: Number(formData.fiscal_year_start_month),
      });
      setSaveSuccess(true);
      if (onSaved) onSaved();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update company localization settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '36px',
    backgroundColor: '#070d1e',
    border: '1px solid #1a2846',
    borderRadius: '6px',
    color: '#f8fafc',
    padding: '0 12px',
    fontSize: '0.84rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    color: '#94a3b8',
    marginBottom: '5px',
    fontWeight: 500,
  };

  const helperStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.7rem',
    color: '#64748b',
    marginTop: '4px',
  };

  return (
    <div
      className="inner-content-card"
      style={{
        backgroundColor: '#0c152b',
        border: '1px solid #1a2744',
        borderRadius: '10px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Section Header */}
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
            <Globe size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em' }}>
              Company Localization & Tax Settings
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Configure your company's localization, timezone, currency and tax information.
            </p>
          </div>
        </div>

        {/* Role Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.72rem',
            padding: '3px 10px',
            borderRadius: '16px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            fontWeight: 600,
          }}
        >
          {isAdmin ? <ShieldCheck size={13} /> : <Shield size={13} />}
          <span>{isAdmin ? 'Admin Access' : 'Standard User (Read-Only)'}</span>
        </div>
      </div>

      {saveSuccess && (
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
            fontSize: '0.78rem',
          }}
        >
          <CheckCircle2 size={15} />
          <span>Company localization settings saved successfully.</span>
        </div>
      )}

      {saveError && (
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
            fontSize: '0.78rem',
          }}
        >
          <AlertCircle size={15} />
          <span>{saveError}</span>
        </div>
      )}

      {/* Form with 2-column grid */}
      <form id="form-localization-settings" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '12px 18px',
          }}
        >
          {/* Row 1, Left: Base Currency Code */}
          <div>
            <label style={labelStyle}>
              Base Currency Code (ISO 4217) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={formData.currency_code}
                onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                disabled={!isAdmin || isSaving}
                style={{
                  ...inputStyle,
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  paddingRight: '36px',
                  cursor: 'pointer',
                }}
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
                <option value="SGD">SGD</option>
                <option value="AED">AED</option>
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#64748b',
                  fontSize: '0.7rem',
                }}
              >
                ▼
              </div>
            </div>
          </div>

          {/* Row 1, Right: Country Code */}
          <div>
            <label style={labelStyle}>
              Country Code (ISO 3166-1 alpha-2) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={formData.country_code}
                onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                disabled={!isAdmin || isSaving}
                style={{
                  ...inputStyle,
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  paddingRight: '36px',
                  cursor: 'pointer',
                }}
              >
                <option value="IN">IN</option>
                <option value="US">US</option>
                <option value="GB">GB</option>
                <option value="DE">DE</option>
                <option value="JP">JP</option>
                <option value="AU">AU</option>
                <option value="CA">CA</option>
                <option value="SG">SG</option>
                <option value="AE">AE</option>
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#64748b',
                  fontSize: '0.7rem',
                }}
              >
                ▼
              </div>
            </div>
          </div>

          {/* Row 2, Left: State / Jurisdiction Code */}
          <div>
            <label style={labelStyle}>State / Jurisdiction Code</label>
            <input
              type="text"
              value={formData.state_code}
              onChange={(e) => setFormData({ ...formData, state_code: e.target.value })}
              disabled={!isAdmin || isSaving}
              placeholder="e.g. MH, KA, CA"
              style={inputStyle}
            />
            <span style={helperStyle}>e.g. MH, KA, CA</span>
          </div>

          {/* Row 2, Right: Timezone (IANA) */}
          <div>
            <label style={labelStyle}>
              Timezone (IANA) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                disabled={!isAdmin || isSaving}
                style={{
                  ...inputStyle,
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  paddingRight: '36px',
                  cursor: 'pointer',
                }}
              >
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#64748b',
                  fontSize: '0.7rem',
                }}
              >
                ▼
              </div>
            </div>
          </div>

          {/* Row 3, Left: Locale */}
          <div>
            <label style={labelStyle}>Locale</label>
            <div style={{ position: 'relative' }}>
              <select
                value={formData.locale}
                onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                disabled={!isAdmin || isSaving}
                style={{
                  ...inputStyle,
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  paddingRight: '36px',
                  cursor: 'pointer',
                }}
              >
                <option value="en-IN">en-IN</option>
                <option value="en_IN">en_IN</option>
                <option value="en-US">en-US</option>
                <option value="en-GB">en-GB</option>
                <option value="de-DE">de-DE</option>
                <option value="ja-JP">ja-JP</option>
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#64748b',
                  fontSize: '0.7rem',
                }}
              >
                ▼
              </div>
            </div>
          </div>

          {/* Row 3, Right: Fiscal Year Start Month */}
          <div>
            <label style={labelStyle}>
              Fiscal Year Start Month <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={formData.fiscal_year_start_month}
                onChange={(e) => setFormData({ ...formData, fiscal_year_start_month: Number(e.target.value) })}
                disabled={!isAdmin || isSaving}
                style={{
                  ...inputStyle,
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  paddingRight: '36px',
                  cursor: 'pointer',
                }}
              >
                <option value={1}>January (1)</option>
                <option value={2}>February (2)</option>
                <option value={3}>March (3)</option>
                <option value={4}>April (4)</option>
                <option value={5}>May (5)</option>
                <option value={6}>June (6)</option>
                <option value={7}>July (7)</option>
                <option value={8}>August (8)</option>
                <option value={9}>September (9)</option>
                <option value={10}>October (10)</option>
                <option value={11}>November (11)</option>
                <option value={12}>December (12)</option>
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#64748b',
                  fontSize: '0.7rem',
                }}
              >
                ▼
              </div>
            </div>
          </div>

          {/* Row 4, Left: GSTIN (India GST Identifier) */}
          <div>
            <label style={labelStyle}>GSTIN (India GST Identifier)</label>
            <input
              type="text"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              disabled={!isAdmin || isSaving}
              placeholder="27AAAAA0000A1Z5"
              style={inputStyle}
            />
            <span style={helperStyle}>Enter valid 15-character GSTIN</span>
          </div>

          {/* Row 4, Right: Corporate Tax ID / EIN */}
          <div>
            <label style={labelStyle}>Corporate Tax ID / EIN</label>
            <input
              type="text"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value.toUpperCase() })}
              disabled={!isAdmin || isSaving}
              placeholder="CIN123456789"
              style={inputStyle}
            />
            <span style={helperStyle}>Enter your company's tax ID or EIN</span>
          </div>

          {/* Row 5, Left: Default Tax Rate (%) */}
          <div>
            <label style={labelStyle}>Default Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.default_tax_rate}
              onChange={(e) => setFormData({ ...formData, default_tax_rate: e.target.value })}
              disabled={!isAdmin || isSaving}
              placeholder="18.00"
              style={inputStyle}
            />
            <span style={helperStyle}>Default tax rate for this company</span>
          </div>
        </div>
      </form>
    </div>
  );
};
