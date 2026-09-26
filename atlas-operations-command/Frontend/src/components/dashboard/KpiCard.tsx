import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';

export interface KpiCardProps {
  title: string;
  primaryValue?: string | number | null;
  secondaryValue?: string | null;
  unit?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  icon?: React.ReactNode;
  iconBg?: string;
  status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  error?: string | null;
  onRetry?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  primaryValue,
  secondaryValue,
  unit,
  trend,
  icon,
  iconBg = 'var(--bg-primary)',
  status = 'neutral',
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data recorded',
  error = null,
  onRetry,
  action,
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size="small" message={`Loading ${title}...`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '160px' }}>
        <ErrorState title={`Error: ${title}`} message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (isEmpty || primaryValue === null || primaryValue === undefined) {
    return (
      <div className="card" style={{ minHeight: '160px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{title}</span>
          {icon && <div style={{ padding: '6px', borderRadius: '8px', background: iconBg }}>{icon}</div>}
        </div>
        <EmptyState title="" message={emptyMessage} />
      </div>
    );
  }

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'danger':
        return '#ef4444';
      case 'info':
        return '#06b6d4';
      default:
        return 'var(--text-primary)';
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.direction === 'up') return <TrendingUp size={14} color="#10b981" />;
    if (trend.direction === 'down') return <TrendingDown size={14} color="#ef4444" />;
    return <Minus size={14} color="var(--text-muted)" />;
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '160px',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        cursor: action ? 'pointer' : 'default',
      }}
      onClick={action?.onClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {title}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
            <span
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: getStatusColor(),
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {primaryValue}
            </span>
            {unit && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {unit}
              </span>
            )}
          </div>
        </div>

        {icon && (
          <div
            style={{
              padding: '10px',
              borderRadius: '10px',
              background: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {getTrendIcon()}
          {trend && (
            <span
              style={{
                color:
                  trend.direction === 'up'
                    ? '#34d399'
                    : trend.direction === 'down'
                    ? '#f87171'
                    : 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              {trend.label}
            </span>
          )}
          {secondaryValue && !trend && (
            <span style={{ color: 'var(--text-secondary)' }}>{secondaryValue}</span>
          )}
        </div>

        {action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {action.label} →
          </button>
        )}
      </div>
    </div>
  );
};
