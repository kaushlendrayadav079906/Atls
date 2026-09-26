import React, { useState } from 'react';
import { Sparkles, CheckCircle, Clock } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { AiActionItem } from '../../types';

interface AiActionsListProps {
  actions: AiActionItem[];
  isLoading?: boolean;
  error?: string | null;
  onResolve?: (actionId: string) => Promise<void>;
  onRetry?: () => void;
}

export const AiActionsList: React.FC<AiActionsListProps> = ({
  actions,
  isLoading = false,
  error = null,
  onResolve,
  onRetry,
}) => {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading AI recommended mitigations..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <ErrorState title="Recommended Actions Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sparkles size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>AI Recommended Actions</h3>
        </div>
        <EmptyState
          title="No Pending Action Items"
          message="All operational and financial risk mitigations have been resolved or dismissed."
        />
      </div>
    );
  }

  const handleResolveClick = async (actionId: string) => {
    if (!onResolve) return;
    setResolvingId(actionId);
    try {
      await onResolve(actionId);
    } finally {
      setResolvingId(null);
    }
  };

  const pendingCount = actions.filter((a) => a.status === 'pending').length;

  return (
    <div className="card" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            AI Recommended Actions
          </h3>
        </div>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            background: 'rgba(59, 130, 246, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          {pendingCount} Pending Mitigation{pendingCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Action Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {actions.map((act) => {
          const isPending = act.status === 'pending';
          const isResolving = resolvingId === act.id;

          const severityColor =
            act.severity === 'CRITICAL'
              ? '#ef4444'
              : act.severity === 'HIGH'
              ? '#f97316'
              : act.severity === 'MEDIUM'
              ? '#eab308'
              : '#3b82f6';

          return (
            <div
              key={act.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '14px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-subtle)',
                opacity: isPending ? 1 : 0.65,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: `${severityColor}22`,
                      color: severityColor,
                      border: `1px solid ${severityColor}44`,
                      textTransform: 'uppercase',
                    }}
                  >
                    {act.severity}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {act.category}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    color: isPending ? '#fbbf24' : '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 500,
                  }}
                >
                  {isPending ? <Clock size={12} /> : <CheckCircle size={12} />}
                  {isPending ? 'Pending' : 'Completed'}
                </span>
              </div>

              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {act.title}
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {act.description}
              </p>

              {isPending && onResolve && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    onClick={() => handleResolveClick(act.id)}
                    disabled={isResolving}
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      color: '#60a5fa',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '5px 12px',
                      cursor: isResolving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle size={13} />
                    <span>{isResolving ? 'Resolving...' : act.cta_label || 'Mark Resolved'}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
