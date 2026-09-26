import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BrainCircuit, RefreshCw } from 'lucide-react';
import {
  AiAnalysisStatus,
  AiRiskSummary,
  RiskList,
  AiActionsList,
  ExecutiveBriefingCard,
} from '../components/ai';
import { DemoDataBanner } from '../components/dashboard/DemoDataBanner';
import { ErrorState } from '../components/common/ErrorState';
import { aiRiskService } from '../services/aiRiskService';
import type {
  RiskItem,
  AiActionItem,
  ExecutiveBriefingEntity,
  AIAnalysisJob,
} from '../types';

const POLLING_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // Max 60 seconds of polling

export const AiPage: React.FC = () => {
  // Data States
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [actions, setActions] = useState<AiActionItem[]>([]);
  const [briefing, setBriefing] = useState<ExecutiveBriefingEntity | null>(null);

  // Async Job States
  const [currentJob, setCurrentJob] = useState<AIAnalysisJob | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  // UI / Error States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [risksError, setRisksError] = useState<string | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  // Polling Refs for safe cleanup
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  // Fetch Core AI Data (Risks, Actions, Briefing)
  const loadAiData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRisksError(null);
    setActionsError(null);
    setBriefingError(null);

    try {
      const [risksRes, actionsRes, briefingRes] = await Promise.allSettled([
        aiRiskService.getRisks(),
        aiRiskService.getActions(),
        aiRiskService.getLatestBriefing(),
      ]);

      if (!isMountedRef.current) return;

      if (risksRes.status === 'fulfilled') {
        setRisks(risksRes.value || []);
      } else {
        setRisksError('Failed to load risk register.');
      }

      if (actionsRes.status === 'fulfilled') {
        setActions(actionsRes.value || []);
      } else {
        setActionsError('Failed to load AI recommended actions.');
      }

      if (briefingRes.status === 'fulfilled') {
        setBriefing(briefingRes.value);
      } else {
        setBriefingError('Failed to load executive briefing.');
      }

      if (
        risksRes.status === 'rejected' &&
        actionsRes.status === 'rejected' &&
        briefingRes.status === 'rejected'
      ) {
        setError('Unable to reach AI Risk & Intelligence service.');
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'An unexpected error occurred while loading AI telemetry.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAiData();
  }, [loadAiData]);

  // Polling Loop for Async AI Analysis Job
  const pollJobStatus = useCallback((jobId: string) => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const checkStatus = async () => {
      if (!isMountedRef.current) return;

      try {
        pollCountRef.current += 1;
        const jobStatus = await aiRiskService.getJobStatus(jobId);

        if (!isMountedRef.current) return;
        setCurrentJob(jobStatus);

        if (jobStatus.status === 'completed') {
          // Terminal state: completed
          pollTimerRef.current = null;
          // Refresh risks, actions, briefings
          loadAiData();
          return;
        }

        if (jobStatus.status === 'failed') {
          // Terminal state: failed
          pollTimerRef.current = null;
          return;
        }

        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          // Timeout terminal state
          pollTimerRef.current = null;
          setCurrentJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'failed',
                  error: 'AI analysis polling timed out after 60 seconds.',
                }
              : null
          );
          return;
        }

        // Continue polling
        pollTimerRef.current = setTimeout(checkStatus, POLLING_INTERVAL_MS);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        pollTimerRef.current = null;
        setCurrentJob((prev) =>
          prev
            ? {
                ...prev,
                status: 'failed',
                error: err.message || 'Failed to poll AI analysis job status.',
              }
            : null
        );
      }
    };

    pollTimerRef.current = setTimeout(checkStatus, POLLING_INTERVAL_MS);
  }, [loadAiData]);

  // Trigger Asynchronous AI Analysis Workflow
  const handleRunAnalysis = async () => {
    setIsTriggering(true);
    setError(null);
    pollCountRef.current = 0;

    try {
      const job = await aiRiskService.startAnalysisJob();
      if (!isMountedRef.current) return;

      setCurrentJob(job);
      if (job.status === 'completed') {
        // Fast-path (e.g. demo mode)
        loadAiData();
      } else {
        pollJobStatus(job.job_id);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to initiate AI analysis workflow.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsTriggering(false);
      }
    }
  };

  // Resolve an Action Item
  const handleResolveAction = async (actionId: string) => {
    try {
      await aiRiskService.resolveAction(actionId);
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, status: 'completed' } : a))
      );
    } catch {
      const updated = await aiRiskService.getActions();
      if (isMountedRef.current) {
        setActions(updated);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Persistent Demo Data Banner */}
      <DemoDataBanner />

      {/* 2. Page Header */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <BrainCircuit size={26} color="#8b5cf6" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              AI Risk & Executive Intelligence
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Autonomous predictive risk engine, automated mitigation action queue, and executive briefing synthesis.
          </p>
        </div>

        <button
          onClick={loadAiData}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            padding: '6px 12px',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {/* 3. Global Error Notice */}
      {error && (
        <div style={{ padding: '0 4px' }}>
          <ErrorState
            title="AI Intelligence Notice"
            message={error}
            onRetry={loadAiData}
          />
        </div>
      )}

      {/* 4. Asynchronous AI Job Status & Analysis Trigger */}
      <AiAnalysisStatus
        job={currentJob}
        isTriggering={isTriggering}
        onRunAnalysis={handleRunAnalysis}
      />

      {/* 5. Executive Risk Summary KPI Row */}
      <section aria-label="Risk Metrics Summary">
        <AiRiskSummary risks={risks} />
      </section>

      {/* 6. Section C: Executive Intelligence Briefing */}
      <section aria-label="Executive Briefing Synthesis">
        <ExecutiveBriefingCard
          briefing={briefing}
          isLoading={isLoading}
          error={briefingError}
          onRetry={loadAiData}
          onRunAnalysis={handleRunAnalysis}
        />
      </section>

      {/* 7. Section A & B: Active Risk Register & AI Recommended Actions Grid */}
      <section aria-label="Risk Register and Action Items">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Active Risks */}
          <RiskList
            risks={risks}
            isLoading={isLoading}
            error={risksError}
            onRetry={loadAiData}
          />

          {/* AI Recommended Actions */}
          <AiActionsList
            actions={actions}
            isLoading={isLoading}
            error={actionsError}
            onResolve={handleResolveAction}
            onRetry={loadAiData}
          />
        </div>
      </section>
    </div>
  );
};

export default AiPage;
