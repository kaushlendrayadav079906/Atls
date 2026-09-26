import React, { useState } from 'react';
import { Bell, ShieldAlert, AlertTriangle, Info, Filter, Clock } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { RealtimeAlertItem } from '../../types';

interface AlertsPanelProps {
  alerts: RealtimeAlertItem[];
  currencySymbol?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  currencySymbol = '$',
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Checking active real-time operational alerts..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <ErrorState title="Alert Telemetry Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  const filteredAlerts =
    severityFilter === 'ALL'
      ? alerts
      : alerts.filter((a) => a.severity.toUpperCase() === severityFilter.toUpperCase());

  const getSeverityBadge = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: 'rgba(239, 68, 68, 0.3)',
          icon: <ShieldAlert size={14} />,
        };
      case 'HIGH':
        return {
          bg: 'rgba(249, 115, 22, 0.15)',
          color: '#f97316',
          border: 'rgba(249, 115, 22, 0.3)',
          icon: <AlertTriangle size={14} />,
        };
      case 'MEDIUM':
        return {
          bg: 'rgba(234, 179, 8, 0.15)',
          color: '#eab308',
          border: 'rgba(234, 179, 8, 0.3)',
          icon: <AlertTriangle size={14} />,
        };
      case 'LOW':
      default:
        return {
          bg: 'rgba(59, 130, 246, 0.15)',
          color: '#3b82f6',
          border: 'rgba(59, 130, 246, 0.3)',
          icon: <Info size={14} />,
        };
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `${currencySymbol}${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `${currencySymbol}${(val / 1000).toFixed(1)}k`;
    return `${currencySymbol}${val.toFixed(0)}`;
  };

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;

  return (
    <div className="card" style={{ minHeight: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={20} color={criticalCount > 0 ? '#ef4444' : '#3b82f6'} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Live Operational Alerts
          </h3>
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              background: criticalCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              padding: '2px 8px',
              borderRadius: '12px',
              border: `1px solid ${criticalCount > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.2)'}`,
            }}
          >
            {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Severity Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
          <Filter size={14} color="var(--text-muted)" />
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              style={{
                background: severityFilter === sev ? 'var(--primary)' : 'rgba(15, 23, 42, 0.5)',
                color: severityFilter === sev ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filteredAlerts.length === 0 ? (
        <EmptyState
          icon={<Bell size={40} color="#10b981" />}
          title={alerts.length === 0 ? 'No Active Alerts' : `No ${severityFilter} Alerts`}
          message={
            alerts.length === 0
              ? 'All manufacturing facilities and telemetry pipelines are running within normal thresholds with 0 critical alerts.'
              : `No active alert items matching the ${severityFilter} filter criteria.`
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredAlerts.map((alert) => {
            const badge = getSeverityBadge(alert.severity);
            const timeAgo = alert.created_at
              ? new Date(alert.created_at).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : 'Recently';

            return (
              <div
                key={alert.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: `3px solid ${badge.color}`,
                  transition: 'background 0.2s ease',
                }}
              >
                {/* Alert Info */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: '1 1 300px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {badge.icon}
                    <span>{alert.severity}</span>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {alert.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>Category: <strong style={{ color: 'var(--text-secondary)' }}>{alert.category}</strong></span>
                      {alert.department && <span>• Dept: {alert.department}</span>}
                    </div>
                  </div>
                </div>

                {/* Financial Exposure & Timestamp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {alert.financial_impact > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Exposure</span>
                      <strong style={{ fontSize: '0.85rem', color: '#f87171' }}>
                        {formatCurrency(alert.financial_impact)}
                      </strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Clock size={12} />
                    <span>{timeAgo}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
