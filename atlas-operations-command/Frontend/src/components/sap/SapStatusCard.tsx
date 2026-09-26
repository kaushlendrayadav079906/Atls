import React from 'react';
import { ServerOff, Link2Off, RefreshCw } from 'lucide-react';
import type { SapBusinessDataResponse } from '../../types';

interface SapStatusCardProps {
  sapData: SapBusinessDataResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export const SapStatusCard: React.FC<SapStatusCardProps> = ({
  sapData,
  loading,
  onRefresh,
}) => {
  const isUnavailable = !sapData || sapData.status.toLowerCase() === 'unavailable';

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: isUnavailable ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              color: isUnavailable ? '#ef4444' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${isUnavailable ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
            }}
          >
            {isUnavailable ? <ServerOff size={22} /> : <Link2Off size={22} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Integration Status
            </h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Enterprise ERP Gateway Connector
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            data-testid="sap-status-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              background: isUnavailable ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: isUnavailable ? '#f87171' : '#34d399',
              border: `1px solid ${isUnavailable ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isUnavailable ? '#ef4444' : '#10b981',
              }}
            />
            {isUnavailable ? 'Not Connected / Unavailable' : 'Connected'}
          </span>

          <button
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh SAP Status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          background: 'var(--bg-primary)',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Environment
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            SAP Integration
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Last Sync
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>
            Not Available
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Connection
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f87171' }}>
            Not Configured
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Gateway State
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>
            Awaiting integration
          </span>
        </div>
      </div>
    </div>
  );
};
