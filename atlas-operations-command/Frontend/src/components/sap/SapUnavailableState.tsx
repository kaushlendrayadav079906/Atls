import React from 'react';
import { ServerOff, RefreshCw } from 'lucide-react';

interface SapUnavailableStateProps {
  message?: string;
  onRetry?: () => void;
  loading?: boolean;
}

export const SapUnavailableState: React.FC<SapUnavailableStateProps> = ({
  message = 'SAP integration is currently unavailable.',
  onRetry,
  loading = false,
}) => {
  return (
    <div
      data-testid="sap-unavailable-state"
      style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.03) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ServerOff size={20} />
        </div>

        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 600, color: '#f87171' }}>
            SAP Integration Unavailable / Not Configured
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {message}
          </p>
          <div
            style={{
              marginTop: '12px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              background: 'var(--bg-primary)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <strong>System Boundary Note:</strong> AtlasOps Cmd enforces strict tenant isolation. In Real Mode, no simulated or fabricated SAP records are substituted. Configure external SAP gateway credentials in the enterprise integration registry to enable synchronization.
          </div>
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s ease',
              alignSelf: 'flex-start',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Retrying...' : 'Retry'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
