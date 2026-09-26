import React from 'react';
import {
  Factory,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import type { RealtimeDashboardSummary } from '../../types';

interface RealtimeSummaryProps {
  summary: RealtimeDashboardSummary | null;
  currencySymbol?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const RealtimeSummary: React.FC<RealtimeSummaryProps> = ({
  summary,
  currencySymbol = '$',
  isLoading = false,
  error = null,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Synthesizing real-time telemetry pulse..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '260px' }}>
        <ErrorState title="Real-Time Telemetry Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const { operational_pulse, financial_pulse, risk_summary } = summary;

  const formatCurrency = (val: number | string) => {
    const num = Number(val);
    if (isNaN(num)) return `${currencySymbol}0.00`;
    if (num >= 1000000) return `${currencySymbol}${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${currencySymbol}${(num / 1000).toFixed(1)}k`;
    return `${currencySymbol}${num.toFixed(2)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* 1. Operational Efficiency */}
        <div
          className="card"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: '4px solid #3b82f6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Operational Health
            </span>
            <Factory size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {operational_pulse.operational_health_pct.toFixed(1)}%
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {operational_pulse.active_factories} of {operational_pulse.total_factories} Plants Active
          </span>
        </div>

        {/* 2. Real-Time Net Profit */}
        <div
          className="card"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: `4px solid ${financial_pulse.net_profit >= 0 ? '#10b981' : '#ef4444'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Net Operating Profit
            </span>
            <TrendingUp size={18} color={financial_pulse.net_profit >= 0 ? '#10b981' : '#ef4444'} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: financial_pulse.net_profit >= 0 ? '#34d399' : '#f87171' }}>
            {formatCurrency(financial_pulse.net_profit)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Margin: {financial_pulse.operating_margin_pct.toFixed(1)}% ({formatCurrency(financial_pulse.total_revenue)} Rev)
          </span>
        </div>

        {/* 3. Composite Risk Score */}
        <div
          className="card"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: `4px solid ${
              risk_summary.overall_severity === 'CRITICAL'
                ? '#ef4444'
                : risk_summary.overall_severity === 'HIGH'
                ? '#f97316'
                : risk_summary.overall_severity === 'MEDIUM'
                ? '#f59e0b'
                : '#3b82f6'
            }`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Risk Composite Index
            </span>
            <ShieldAlert size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {risk_summary.overall_composite_score.toFixed(1)}
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: '4px',
                marginLeft: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
              }}
            >
              {risk_summary.overall_severity}
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {risk_summary.active_risk_count} Active Risks ({risk_summary.critical_count} Critical, {risk_summary.high_count} High)
          </span>
        </div>

        {/* 4. Action Queue & Telemetry Version */}
        <div
          className="card"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: '4px solid #8b5cf6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Pending Mitigations
            </span>
            <CheckCircle2 size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#a78bfa' }}>
            {summary.pending_actions_count} Actions
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Telemetry Version: {summary.data_version}
          </span>
        </div>
      </div>
    </div>
  );
};
