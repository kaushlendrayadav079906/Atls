import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Data Available',
  message,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div
      className="empty-state-card"
      style={{
        padding: '32px 24px',
        borderRadius: '8px',
        background: 'var(--bg-card)',
        border: '1px dashed var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '12px',
        margin: '16px 0',
      }}
    >
      <div style={{ color: 'var(--text-muted)' }}>
        {icon || <Inbox size={40} />}
      </div>
      <div>
        <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontWeight: 600 }}>{title}</h4>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{message}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn-secondary"
          style={{ marginTop: '8px' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
