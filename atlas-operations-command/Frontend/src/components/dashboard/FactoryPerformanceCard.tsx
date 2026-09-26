import React from 'react';
import { Factory as FactoryIcon, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { Factory } from '../../types';

interface FactoryPerformanceCardProps {
  factories: Factory[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const FactoryPerformanceCard: React.FC<FactoryPerformanceCardProps> = ({
  factories,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading factory performance..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <ErrorState title="Factory Telemetry Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!factories || factories.length === 0) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FactoryIcon size={20} color="#3b82f6" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Factory Performance</h3>
          </div>
        </div>
        <EmptyState
          title="No Factories Registered"
          message="No operational facilities or plants have been configured for this tenant."
          actionLabel="Add Factory"
          onAction={() => navigate('/factories')}
        />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 600,
            }}
          >
            ACTIVE
          </span>
        );
      case 'maintenance':
        return (
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontWeight: 600,
            }}
          >
            MAINTENANCE
          </span>
        );
      default:
        return (
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(148, 163, 184, 0.15)',
              color: 'var(--text-muted)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              fontWeight: 600,
            }}
          >
            INACTIVE
          </span>
        );
    }
  };

  return (
    <div className="card" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FactoryIcon size={20} color="#3b82f6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Factory Performance Summary
          </h3>
        </div>
        <button
          onClick={() => navigate('/factories')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          View All ({factories.length}) <ArrowUpRight size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Plant / Facility</th>
              <th style={{ padding: '8px 12px' }}>Code</th>
              <th style={{ padding: '8px 12px' }}>Location</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {factories.slice(0, 5).map((factory) => (
              <tr
                key={factory.id}
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  transition: 'background 0.15s ease',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/factories')}
              >
                <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {factory.name}
                </td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                  {factory.code || '—'}
                </td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                  {factory.location || '—'}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  {getStatusBadge(factory.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
