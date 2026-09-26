import React from 'react';
import { ShieldAlert, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { RiskItem } from '../../types';

interface AiRiskSummaryProps {
  risks: RiskItem[];
}

export const AiRiskSummary: React.FC<AiRiskSummaryProps> = ({ risks }) => {
  const criticalCount = risks.filter((r) => r.severity === 'CRITICAL').length;
  const highCount = risks.filter((r) => r.severity === 'HIGH').length;
  const mediumCount = risks.filter((r) => r.severity === 'MEDIUM').length;
  const lowCount = risks.filter((r) => r.severity === 'LOW').length;

  const activeCount = risks.filter((r) => r.status === 'active').length;
  const resolvedCount = risks.filter((r) => r.status === 'resolved' || r.status === 'mitigated').length;

  const totalFinancialExposure = risks
    .filter((r) => r.status === 'active')
    .reduce((acc, r) => acc + Number(r.financial_impact || 0), 0);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
      }}
    >
      {/* 1. Critical & High Exposure */}
      <div
        className="card"
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderLeft: '4px solid #ef4444',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Critical / High Risks
          </span>
          <ShieldAlert size={18} color="#ef4444" />
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: criticalCount + highCount > 0 ? '#ef4444' : 'var(--text-primary)' }}>
          {criticalCount + highCount}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {criticalCount} Critical, {highCount} High Priority
        </span>
      </div>

      {/* 2. Moderate & Low Risks */}
      <div
        className="card"
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderLeft: '4px solid #f59e0b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Medium / Low Risks
          </span>
          <AlertTriangle size={18} color="#f59e0b" />
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {mediumCount + lowCount}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {mediumCount} Medium, {lowCount} Low Priority
        </span>
      </div>

      {/* 3. Active Risk Register Total */}
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
            Active Register
          </span>
          <AlertCircle size={18} color="#3b82f6" />
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {activeCount}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {resolvedCount} Mitigated / Resolved
        </span>
      </div>

      {/* 4. Estimated Financial Exposure */}
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
            Financial Exposure
          </span>
          <CheckCircle2 size={18} color="#8b5cf6" />
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#a78bfa' }}>
          {formatCurrency(totalFinancialExposure)}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Aggregated open risk impact
        </span>
      </div>
    </div>
  );
};
