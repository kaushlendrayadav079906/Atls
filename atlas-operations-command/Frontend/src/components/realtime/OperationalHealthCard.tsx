import React from 'react';
import { HeartPulse, CheckCircle2, AlertTriangle, AlertOctagon, Activity, ShieldCheck, Clock } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import type { RealtimeOperationalHealth } from '../../types';

interface OperationalHealthCardProps {
  health: RealtimeOperationalHealth | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const OperationalHealthCard: React.FC<OperationalHealthCardProps> = ({
  health,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Checking real-time operational health..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '240px' }}>
        <ErrorState title="Health Telemetry Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!health) {
    return null;
  }

  const normalizedStatus = (health.status || 'HEALTHY').toUpperCase();

  const getStatusBadge = () => {
    switch (normalizedStatus) {
      case 'CRITICAL':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: 'rgba(239, 68, 68, 0.3)',
          icon: <AlertOctagon size={20} color="#ef4444" />,
          label: 'CRITICAL SYSTEM STATUS',
          description: 'Active critical incidents requiring immediate executive remediation.',
        };
      case 'DEGRADED':
      case 'WARNING':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: 'rgba(245, 158, 11, 0.3)',
          icon: <AlertTriangle size={20} color="#f59e0b" />,
          label: 'DEGRADED OPERATIONAL STATE',
          description: 'Sub-optimal availability or open high-severity operational notices.',
        };
      case 'HEALTHY':
      default:
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          border: 'rgba(16, 185, 129, 0.3)',
          icon: <CheckCircle2 size={20} color="#10b981" />,
          label: 'OPERATIONAL & HEALTHY',
          description: 'All manufacturing facilities and telemetry pipelines reporting optimal availability.',
        };
    }
  };

  const statusInfo = getStatusBadge();

  const lastSyncFormatted = health.last_data_sync
    ? new Date(health.last_data_sync).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    : 'Recent Live Sync';

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        borderLeft: `4px solid ${statusInfo.color}`,
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <HeartPulse size={22} color={statusInfo.color} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            Operational Pulse & Fleet Health
          </h3>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: statusInfo.bg,
            color: statusInfo.color,
            border: `1px solid ${statusInfo.border}`,
            fontSize: '0.8rem',
            fontWeight: 700,
          }}
        >
          {statusInfo.icon}
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* Description */}
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.4 }}>
        {statusInfo.description}
      </p>

      {/* Health Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          paddingTop: '6px',
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa', marginBottom: '4px' }}>
            <Activity size={14} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Active Facilities</span>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {health.active_plants} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {health.total_plants}</span>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: health.active_critical_alerts > 0 ? '#ef4444' : '#10b981', marginBottom: '4px' }}>
            <ShieldCheck size={14} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Critical Alerts</span>
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: health.active_critical_alerts > 0 ? '#ef4444' : 'var(--text-primary)' }}>
            {health.active_critical_alerts}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <Clock size={14} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Last Live Sync</span>
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
            {lastSyncFormatted}
          </div>
        </div>
      </div>
    </div>
  );
};
