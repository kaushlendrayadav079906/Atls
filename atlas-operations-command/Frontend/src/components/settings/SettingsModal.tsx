import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Globe,
  Calendar,
  DollarSign,
  ArrowLeftRight,
  Calculator,
  RefreshCw,
  X,
  Sliders,
  ShieldCheck,
  Building2,
  Save,
  Info,
} from 'lucide-react';
import type { LocalizationConfig, FiscalYear, ExchangeRate } from '../../types';
import { LocalizationSettings } from './LocalizationSettings';
import { FiscalYearCard } from './FiscalYearCard';
import { CurrencyConverter } from './CurrencyConverter';
import { ExchangeRateManagement } from './ExchangeRateManagement';
import { GstCalculator } from './GstCalculator';

export type SettingsSection = 'localization' | 'fiscal_year' | 'currency' | 'rates' | 'gst';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LocalizationConfig | null;
  fiscalYear: FiscalYear | null;
  rates: ExchangeRate[];
  isAdmin: boolean;
  onReload: () => Promise<void> | void;
  initialSection?: SettingsSection;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  fiscalYear,
  rates,
  isAdmin,
  onReload,
  initialSection = 'localization',
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // Handle escape key to close modal & lock body scrolling when open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onReload();
    } finally {
      setIsSyncing(false);
    }
  };

  const navItems: { id: SettingsSection; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'localization', label: 'Company Localization', icon: Globe },
    { id: 'fiscal_year', label: 'Fiscal Year & Calendar', icon: Calendar },
    { id: 'currency', label: 'Currency Converter', icon: DollarSign },
    { id: 'rates', label: 'Exchange Rates', icon: ArrowLeftRight },
    { id: 'gst', label: 'GST / Tax Calculator', icon: Calculator },
  ];

  const handleTriggerSave = () => {
    if (activeSection === 'localization') {
      const form = document.getElementById('form-localization-settings') as HTMLFormElement | null;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      data-testid="settings-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* 
        Independent Backdrop Layer:
        - Transparent click-away layer (no background color, no blur) so the dashboard behind stays completely original, crisp, and clean
        - Captures pointer events to prevent clicking background controls
      */}
      <div
        data-testid="settings-modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'transparent',
          zIndex: 1000,
        }}
        onClick={onClose}
      />

      {/* 
        Modal Panel Layer:
        - Clean pop-up card with top-level z-index: 1100
        - Compact height min(640px, calc(100vh - 48px)) and width min(1120px, calc(100vw - 48px))
        - Clean opaque background (#0b1329) with sleek border & shadow
      */}
      <div
        className="settings-modal-card"
        data-testid="settings-modal-card"
        style={{
          position: 'relative',
          zIndex: 1100,
          width: 'min(1120px, calc(100vw - 48px))',
          height: 'min(640px, calc(100vh - 48px))',
          maxHeight: 'calc(100vh - 48px)',
          backgroundColor: '#0b1329',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================================================
            1. COMPRESSED TOP HEADER (52px height)
           ================================================== */}
        <header
          style={{
            flexShrink: 0,
            height: '52px',
            padding: '0 18px',
            backgroundColor: '#090f20',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          {/* Left: Settings icon + Title & Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
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
              <Sliders size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <h2
                  id="settings-modal-title"
                  style={{
                    margin: 0,
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#f8fafc',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                  }}
                >
                  Settings
                </h2>
                <span
                  style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    lineHeight: 1.2,
                  }}
                >
                  Manage company localization, financial configuration, currency and tax settings.
                </span>
              </div>
            </div>
          </div>

          {/* Right: Base Currency Badge + Sync Button + Close Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Base Currency Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '5px',
                backgroundColor: '#131e3a',
                border: '1px solid #223354',
                fontSize: '0.72rem',
                color: '#94a3b8',
                fontWeight: 500,
              }}
            >
              <Building2 size={13} color="#38bdf8" />
              <span>Base:</span>
              <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
                {config?.currency_code || 'INR'}
              </span>
            </div>

            {/* Sync Button */}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="Synchronize configuration from backend"
              aria-label="Sync settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '5px',
                backgroundColor: '#131e3a',
                border: '1px solid #223354',
                color: '#e2e8f0',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1a284c';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#131e3a';
                e.currentTarget.style.borderColor = '#223354';
              }}
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin text-cyan-400' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Close Settings"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '5px',
                backgroundColor: '#131e3a',
                border: '1px solid #223354',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1a284c';
                e.currentTarget.style.color = '#f8fafc';
                e.currentTarget.style.borderColor = '#475569';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#131e3a';
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.borderColor = '#223354';
              }}
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {/* ==================================================
            2. BODY (Left navigation + Right content)
           ================================================== */}
        <div
          className="settings-modal-body"
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Left Navigation (240px width) with compact bottom info card */}
          <aside
            className="settings-modal-aside"
            style={{
              flex: '0 0 240px',
              width: '240px',
              backgroundColor: '#090f20',
              borderRight: '1px solid #1e293b',
              padding: '12px 10px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              boxSizing: 'border-box',
            }}
          >
            {/* Navigation Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '5px',
                      backgroundColor: isActive ? 'rgba(2, 132, 199, 0.16)' : 'transparent',
                      border: 'none',
                      borderLeft: isActive ? '3px solid #38bdf8' : '3px solid transparent',
                      color: isActive ? '#f8fafc' : '#94a3b8',
                      fontSize: '0.8rem',
                      fontWeight: isActive ? 600 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = '#e2e8f0';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#94a3b8';
                      }
                    }}
                  >
                    <Icon
                      size={15}
                      className={isActive ? 'text-sky-400' : 'text-slate-500'}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Company Settings Information Card matching reference */}
            <div
              className="settings-company-card"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #1e293b',
                borderRadius: '6px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#38bdf8', fontSize: '0.74rem', fontWeight: 600 }}>
                <Info size={13} />
                <span>Company Settings</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b', lineHeight: 1.3 }}>
                These settings are specific to your company and affect financial and tax calculations across AtlasOps Cmd.
              </p>
            </div>
          </aside>

          {/* Right Content Area */}
          <main
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              overflowY: 'auto',
              padding: '14px 18px',
              backgroundColor: '#0b1329',
              boxSizing: 'border-box',
            }}
          >
            {activeSection === 'localization' && (
              <LocalizationSettings
                config={config}
                isAdmin={isAdmin}
                onSaved={onReload}
              />
            )}

            {activeSection === 'fiscal_year' && (
              <FiscalYearCard fiscalYear={fiscalYear} />
            )}

            {activeSection === 'currency' && (
              <CurrencyConverter baseCurrency={config?.currency_code || 'INR'} />
            )}

            {activeSection === 'rates' && (
              <ExchangeRateManagement
                rates={rates}
                isAdmin={isAdmin}
                baseCurrency={config?.currency_code || 'INR'}
                onRateCreated={onReload}
              />
            )}

            {activeSection === 'gst' && (
              <GstCalculator
                companyCountry={config?.country_code || 'IN'}
                companyState={config?.state_code || 'MH'}
                companyCurrency={config?.currency_code || 'INR'}
                defaultTaxRate={config?.default_tax_rate ? Number(config.default_tax_rate) : 18.0}
              />
            )}
          </main>
        </div>

        {/* ==================================================
            3. COMPACT COMPRESSED FOOTER (44px height)
           ================================================== */}
        <footer
          style={{
            flexShrink: 0,
            height: '44px',
            padding: '0 18px',
            backgroundColor: '#090f20',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          {/* Left: Tenant Isolated Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.72rem' }}>
            <ShieldCheck size={14} color="#0284c7" />
            <span style={{ color: '#94a3b8', fontWeight: 500 }}>Tenant-isolated session</span>
            {config?.company_id && (
              <span style={{ fontFamily: 'monospace', color: '#64748b' }}>
                ({config.company_id.slice(0, 8)}...)
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '4px 14px',
                borderRadius: '5px',
                backgroundColor: 'transparent',
                border: '1px solid #334155',
                color: '#cbd5e1',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              Cancel
            </button>

            {activeSection === 'localization' && isAdmin && (
              <button
                onClick={handleTriggerSave}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 14px',
                  borderRadius: '5px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Save size={13} />
                <span>Save Changes</span>
              </button>
            )}
          </div>
        </footer>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .settings-modal-card {
            width: calc(100vw - 16px) !important;
            height: calc(100vh - 16px) !important;
            max-height: calc(100vh - 16px) !important;
            border-radius: 8px !important;
          }
          .settings-modal-body {
            flex-direction: column !important;
          }
          .settings-modal-aside {
            flex: 0 0 auto !important;
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid #1e293b !important;
            flex-direction: row !important;
            overflow-x: auto !important;
            padding: 8px !important;
          }
          .settings-modal-aside > div {
            flex-direction: row !important;
            flex-wrap: nowrap !important;
          }
          .settings-modal-aside button {
            white-space: nowrap !important;
            padding: 6px 10px !important;
          }
          .settings-company-card {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );

  // Render via React Portal to document.body to ensure top-level stacking context
  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(modalNode, document.body);
  }

  return modalNode;
};
