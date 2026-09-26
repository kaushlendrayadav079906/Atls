import React from 'react';
import { Building, Calendar, DollarSign, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { LocalizationConfig, FiscalYearInfo, RealtimeOperationalHealth } from '../../types';

interface DashboardHeaderProps {
  locConfig: LocalizationConfig | null;
  fiscalYear: FiscalYearInfo | null;
  health: RealtimeOperationalHealth | null;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  locConfig,
  fiscalYear,
  health,
}) => {
  const { user } = useAuth();

  const getHealthBadge = () => {
    if (!health) return null;
    const isHealthy = health.status === 'HEALTHY';
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          background: isHealthy ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${isHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: isHealthy ? '#34d399' : '#f87171',
          fontSize: '0.8rem',
          fontWeight: 600,
        }}
      >
        <Activity size={14} />
        <span>SYSTEM: {health.status}</span>
      </div>
    );
  };

  return (
    <header
      className="card"
      style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Operations Command Center
          </h1>
          {getHealthBadge()}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
          Welcome back, <strong>{user?.full_name || 'Executive'}</strong> • Realtime multi-plant orchestration and risk monitoring
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        {locConfig && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-primary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
            }}
          >
            <Building size={16} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-secondary)' }}>Company:</span>
            <strong>{locConfig.name}</strong>
          </div>
        )}

        {fiscalYear && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-primary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
            }}
          >
            <Calendar size={16} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-secondary)' }}>Fiscal Period:</span>
            <strong>{fiscalYear.fiscal_year_label} ({fiscalYear.fiscal_quarter_label})</strong>
          </div>
        )}

        {locConfig && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-primary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
            }}
          >
            <DollarSign size={16} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-secondary)' }}>Currency:</span>
            <strong>{locConfig.currency_code} ({locConfig.formatting?.currency_symbol || '$'})</strong>
          </div>
        )}
      </div>
    </header>
  );
};
