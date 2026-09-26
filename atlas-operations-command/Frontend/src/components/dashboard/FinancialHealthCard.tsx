import React from 'react';
import { HeartPulse, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import type { FinancialPulse, RiskSummaryPulse } from '../../types';

interface FinancialHealthCardProps {
  financialPulse?: FinancialPulse;
  riskSummary?: RiskSummaryPulse;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const FinancialHealthCard: React.FC<FinancialHealthCardProps> = ({
  financialPulse,
  riskSummary,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Calculating solvency index..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '260px' }}>
        <ErrorState title="Financial Health Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  const margin = Number(financialPulse?.operating_margin_pct || 0);
  const compositeScore = Number(riskSummary?.overall_composite_score || 0);
  const severity = (riskSummary?.overall_severity || 'LOW').toUpperCase();

  const getSeverityStyle = () => {
    if (severity === 'CRITICAL') return { color: '#ef4444', label: 'CRITICAL RISK', icon: <ShieldAlert size={20} color="#ef4444" /> };
    if (severity === 'HIGH') return { color: '#f87171', label: 'ELEVATED RISK', icon: <AlertTriangle size={20} color="#f87171" /> };
    if (severity === 'MEDIUM') return { color: '#fbbf24', label: 'MODERATE RISK', icon: <AlertTriangle size={20} color="#fbbf24" /> };
    return { color: '#34d399', label: 'OPTIMAL / HEALTHY', icon: <CheckCircle2 size={20} color="#34d399" /> };
  };

  const statusStyle = getSeverityStyle();

  return (
    <div className="card" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HeartPulse size={20} color="#14b8a6" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Enterprise Financial Health
          </h3>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--border-subtle)',
            color: statusStyle.color,
            fontWeight: 600,
          }}
        >
          {statusStyle.icon}
          <span>{statusStyle.label}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Operating Margin</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: margin >= 0 ? '#34d399' : '#f87171', marginTop: '4px' }}>
            {margin.toFixed(2)}%
          </div>
        </div>

        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Composite Risk Score</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: statusStyle.color, marginTop: '4px' }}>
            {compositeScore.toFixed(1)} / 100
          </div>
        </div>

        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Risk Triggers</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
            {riskSummary?.active_risk_count || 0}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '10px 14px',
          borderRadius: '6px',
          background: 'rgba(20, 184, 166, 0.08)',
          border: '1px solid rgba(20, 184, 166, 0.25)',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
        }}
      >
        Solvency index reflects real-time operating expense coverage and debt obligation ratios across active facilities.
      </div>
    </div>
  );
};
