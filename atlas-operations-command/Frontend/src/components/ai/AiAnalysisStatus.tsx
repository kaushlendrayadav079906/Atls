import React from 'react';
import { Play, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { AIAnalysisJob } from '../../types';

interface AiAnalysisStatusProps {
  job: AIAnalysisJob | null;
  isTriggering: boolean;
  onRunAnalysis: () => void;
}

export const AiAnalysisStatus: React.FC<AiAnalysisStatusProps> = ({
  job,
  isTriggering,
  onRunAnalysis,
}) => {
  const isPendingOrRunning = job?.status === 'pending' || job?.status === 'running' || isTriggering;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '16px 20px',
        background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: isPendingOrRunning
              ? 'rgba(59, 130, 246, 0.2)'
              : job?.status === 'completed'
              ? 'rgba(16, 185, 129, 0.2)'
              : job?.status === 'failed'
              ? 'rgba(239, 68, 68, 0.2)'
              : 'rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isPendingOrRunning ? (
            <Loader2 size={20} color="#3b82f6" className="spin" />
          ) : job?.status === 'completed' ? (
            <CheckCircle2 size={20} color="#10b981" />
          ) : job?.status === 'failed' ? (
            <XCircle size={20} color="#ef4444" />
          ) : (
            <Clock size={20} color="#6366f1" />
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {isPendingOrRunning
                ? 'AI Risk Engine Evaluating Telemetry...'
                : job?.status === 'completed'
                ? 'AI Risk Intelligence Analysis Completed'
                : job?.status === 'failed'
                ? 'AI Analysis Workflow Failed'
                : 'Asynchronous Predictive Analysis'}
            </span>
            {job?.status && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background:
                    job.status === 'completed'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : job.status === 'failed'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(59, 130, 246, 0.15)',
                  color:
                    job.status === 'completed'
                      ? '#10b981'
                      : job.status === 'failed'
                      ? '#ef4444'
                      : '#60a5fa',
                  border: `1px solid ${
                    job.status === 'completed'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : job.status === 'failed'
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(59, 130, 246, 0.3)'
                  }`,
                }}
              >
                {job.status}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '2px 0 0 0' }}>
            {isPendingOrRunning
              ? 'Polling job telemetry across Financial, Operational, and Supply Chain pipelines...'
              : job?.status === 'completed'
              ? `Job ID ${job.job_id.slice(0, 8)}... — Active risk register and executive briefings updated.`
              : job?.status === 'failed'
              ? job.error || 'Failed to complete asynchronous analysis. Please retry.'
              : 'Trigger multi-pipeline risk synthesis across all registered facilities and financials.'}
          </p>
        </div>
      </div>

      {/* Right Trigger Button */}
      <button
        onClick={onRunAnalysis}
        disabled={isPendingOrRunning}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: isPendingOrRunning
            ? 'rgba(59, 130, 246, 0.3)'
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '8px',
          color: '#ffffff',
          padding: '8px 18px',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: isPendingOrRunning ? 'not-allowed' : 'pointer',
          boxShadow: isPendingOrRunning ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
          transition: 'all 0.2s ease',
        }}
      >
        {isPendingOrRunning ? (
          <>
            <Loader2 size={16} className="spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Play size={16} fill="currentColor" />
            <span>Run AI Analysis</span>
          </>
        )}
      </button>
    </div>
  );
};
