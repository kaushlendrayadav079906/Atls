import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Info, Filter } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { RiskItem } from '../../types';

interface RiskListProps {
  risks: RiskItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const RiskList: React.FC<RiskListProps> = ({
  risks,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Loading persistent risk register..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '340px' }}>
        <ErrorState title="Risk Register Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  const filteredRisks =
    severityFilter === 'ALL'
      ? risks
      : risks.filter((r) => r.severity.toUpperCase() === severityFilter.toUpperCase());

  const getSeverityBadge = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', icon: <ShieldAlert size={14} /> };
      case 'HIGH':
        return { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: 'rgba(249, 115, 22, 0.3)', icon: <AlertTriangle size={14} /> };
      case 'MEDIUM':
        return { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: 'rgba(234, 179, 8, 0.3)', icon: <AlertTriangle size={14} /> };
      default:
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', icon: <Info size={14} /> };
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

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
          <ShieldAlert size={20} color="#f97316" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Active Risk Register
          </h3>
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              background: 'rgba(249, 115, 22, 0.1)',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(249, 115, 22, 0.2)',
            }}
          >
            {risks.length} Documented
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
      {filteredRisks.length === 0 ? (
        <EmptyState
          title={risks.length === 0 ? 'No Active Risks Found' : `No ${severityFilter} Risks Found`}
          message={
            risks.length === 0
              ? 'No enterprise risk factors have been recorded for the company. Run an AI analysis to evaluate current operations.'
              : `No risk items matched the ${severityFilter} severity filter.`
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredRisks.map((risk) => {
            const badge = getSeverityBadge(risk.severity);

            return (
              <div
                key={risk.id}
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
                  transition: 'background 0.2s ease',
                }}
              >
                {/* Risk Title & Meta */}
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
                    <span>{risk.severity}</span>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {risk.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>Category: <strong style={{ color: 'var(--text-secondary)' }}>{risk.category}</strong></span>
                      {risk.department && <span>• Dept: {risk.department}</span>}
                      {risk.likelihood_pct > 0 && <span>• Probability: {risk.likelihood_pct}%</span>}
                    </div>
                  </div>
                </div>

                {/* Financial Impact & Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {risk.financial_impact > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Impact Exposure</span>
                      <strong style={{ fontSize: '0.9rem', color: '#f87171' }}>
                        {formatCurrency(risk.financial_impact)}
                      </strong>
                    </div>
                  )}

                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: risk.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: risk.status === 'active' ? '#f87171' : '#34d399',
                      border: `1px solid ${risk.status === 'active' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {risk.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
