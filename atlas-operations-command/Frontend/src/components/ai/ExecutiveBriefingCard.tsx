import React from 'react';
import { BrainCircuit, Clock, AlertTriangle, TrendingUp, Zap, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import type { ExecutiveBriefingEntity } from '../../types';

interface ExecutiveBriefingCardProps {
  briefing: ExecutiveBriefingEntity | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRunAnalysis?: () => void;
}

export const ExecutiveBriefingCard: React.FC<ExecutiveBriefingCardProps> = ({
  briefing,
  isLoading = false,
  error = null,
  onRetry,
  onRunAnalysis,
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Generating executive briefing synthesis..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ minHeight: '380px' }}>
        <ErrorState title="Executive Briefing Error" message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="card" style={{ minHeight: '380px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <BrainCircuit size={20} color="#8b5cf6" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Executive Intelligence Briefing</h3>
        </div>
        <EmptyState
          title="No Briefing Generated Yet"
          message="No persisted executive synthesis exists for this company. Trigger an AI analysis to produce the initial executive briefing."
          actionLabel="Run Analysis"
          onAction={onRunAnalysis}
        />
      </div>
    );
  }

  const generatedDate = briefing.generated_at
    ? new Date(briefing.generated_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Recently';

  return (
    <div
      className="card"
      style={{
        minHeight: '380px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BrainCircuit size={20} color="#a78bfa" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Executive Intelligence Briefing
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Authoritative synthesis from operational, financial, and supply chain telemetry
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <Clock size={13} color="var(--text-muted)" />
          <span>Generated: {generatedDate}</span>
        </div>
      </div>

      {/* Executive Summary Narrative */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.5)',
          borderLeft: '4px solid #8b5cf6',
          borderRadius: '0 8px 8px 0',
          padding: '14px 18px',
        }}
      >
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginBottom: '6px' }}>
          Executive Summary
        </div>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
          {briefing.summary_text}
        </p>
      </div>

      {/* Structured Sections Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Business Impact Observations */}
        {briefing.business_impact && briefing.business_impact.length > 0 && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              padding: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <TrendingUp size={16} color="#3b82f6" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Business Impact & Health
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {briefing.business_impact.map((impact, idx) => (
                <li key={idx}>{impact}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Critical Issues */}
        {briefing.critical_issues && briefing.critical_issues.length > 0 && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              padding: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <AlertTriangle size={16} color="#ef4444" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444' }}>
                Critical Vulnerabilities ({briefing.critical_issues.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {briefing.critical_issues.map((issue, idx) => (
                <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <ChevronRight size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: '3px' }} />
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{issue.title}:</strong> {issue.explanation || issue.impact || 'Attention required'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Priority Actions */}
        {briefing.priority_actions && briefing.priority_actions.length > 0 && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              padding: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Zap size={16} color="#f59e0b" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Recommended Strategic Priorities
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {briefing.priority_actions.map((act, idx) => (
                <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <ChevronRight size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: '3px' }} />
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{act.title}:</strong> {act.action || act.description || 'Action required'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
