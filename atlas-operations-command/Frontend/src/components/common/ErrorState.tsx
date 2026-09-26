import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
}) => {
  return (
    <div
      className="error-state-card"
      style={{
        padding: '24px',
        borderRadius: '8px',
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        color: '#f87171',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '12px',
        margin: '16px 0',
      }}
    >
      <AlertTriangle size={36} color="#ef4444" />
      <div>
        <h4 style={{ margin: '0 0 4px 0', color: '#ef4444', fontWeight: 600 }}>{title}</h4>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.85rem',
            marginTop: '8px',
          }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
};
