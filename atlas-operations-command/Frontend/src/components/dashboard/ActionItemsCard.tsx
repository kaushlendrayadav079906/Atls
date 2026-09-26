import React, { useState } from 'react';
import { ListTodo, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { AiActionItem } from '../../types';

interface ActionItemsCardProps {
  actions: AiActionItem[];
  onResolve?: (actionId: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const ActionItemsCard: React.FC<ActionItemsCardProps> = ({
  actions,
  onResolve,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const navigate = useNavigate();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading priority action items..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '300px' }}>
        <ErrorState title="Action Items Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  const pendingActions = actions.filter((a) => a.status === 'pending');

  if (!actions || actions.length === 0 || pendingActions.length === 0) {
    return (
      <div className="card" style={{ minHeight: '300px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListTodo size={20} color="#3b82f6" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Action Items & Mitigation</h3>
          </div>
        </div>
        <EmptyState
          title="No Pending Action Items"
          message="All operational risk alerts and recommendations have been addressed or resolved."
          actionLabel="View Risk Register"
          onAction={() => navigate('/ai')}
        />
      </div>
    );
  }

  const handleResolve = async (actionId: string) => {
    if (!onResolve) return;
    setResolvingId(actionId);
    try {
      await onResolve(actionId);
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const sev = severity.toUpperCase();
    if (sev === 'CRITICAL' || sev === 'HIGH') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            fontWeight: 700,
          }}
        >
          {sev}
        </span>
      );
    }
    if (sev === 'MEDIUM') {
      return (
        <span
          style={{
            fontSize: '0.7rem',
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'rgba(245, 158, 11, 0.2)',
            color: '#fbbf24',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            fontWeight: 700,
          }}
        >
          MEDIUM
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: '0.7rem',
          padding: '2px 6px',
          borderRadius: '4px',
          background: 'rgba(59, 130, 246, 0.2)',
          color: '#60a5fa',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          fontWeight: 700,
        }}
      >
        LOW
      </span>
    );
  };

  return (
    <div className="card" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListTodo size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Priority Action Items ({pendingActions.length})
          </h3>
        </div>
        <button
          onClick={() => navigate('/ai')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          AI Risk Center →
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {pendingActions.slice(0, 4).map((action) => (
          <div
            key={action.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                {getSeverityBadge(action.severity)}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{action.category}</span>
              </div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                {action.title}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                {action.description}
              </p>
            </div>

            {onResolve && (
              <button
                type="button"
                onClick={() => handleResolve(action.id)}
                disabled={resolvingId === action.id}
                className="btn-secondary"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {resolvingId === action.id ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <>
                    <CheckCircle2 size={12} color="#10b981" />
                    <span>{action.cta_label || 'Resolve'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
