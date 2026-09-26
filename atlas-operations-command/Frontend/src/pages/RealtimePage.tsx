import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Activity } from 'lucide-react';
import {
  RealtimeSummary,
  OperationalHealthCard,
  AlertsPanel,
  RealtimeRefreshControl,
} from '../components/realtime';
import { DemoDataBanner } from '../components/dashboard/DemoDataBanner';
import { ErrorState } from '../components/common/ErrorState';
import { realtimeService } from '../services/realtimeService';
import { localizationService } from '../services/localizationService';
import type {
  RealtimeDashboardSummary,
  RealtimeOperationalHealth,
  RealtimeAlertItem,
  LocalizationConfig,
} from '../types';

const AUTO_REFRESH_INTERVAL_MS = 5000;

export const RealtimePage: React.FC = () => {
  // Data States
  const [summary, setSummary] = useState<RealtimeDashboardSummary | null>(null);
  const [health, setHealth] = useState<RealtimeOperationalHealth | null>(null);
  const [alerts, setAlerts] = useState<RealtimeAlertItem[]>([]);
  const [locConfig, setLocConfig] = useState<LocalizationConfig | null>(null);

  // Status & Polling States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Error States
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  // Polling Refs
  const isFetchingRef = useRef<boolean>(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Initial Config Load
  useEffect(() => {
    localizationService
      .getConfig()
      .then((cfg) => {
        if (isMountedRef.current) setLocConfig(cfg);
      })
      .catch(() => {});
  }, []);

  // Fetch Telemetry Data
  const fetchRealtimeData = useCallback(async (isBackground = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);
    setSummaryError(null);
    setHealthError(null);
    setAlertsError(null);

    try {
      const [summaryRes, healthRes, alertsRes] = await Promise.allSettled([
        realtimeService.getSummary(),
        realtimeService.getOperationalHealth(),
        realtimeService.getAlerts(undefined, 20),
      ]);

      if (!isMountedRef.current) return;

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value);
      } else {
        setSummaryError('Failed to fetch real-time summary pulse.');
      }

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      } else {
        setHealthError('Failed to fetch operational health status.');
      }

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value || []);
      } else {
        setAlertsError('Failed to load active operational alerts.');
      }

      if (
        summaryRes.status === 'rejected' &&
        healthRes.status === 'rejected' &&
        alertsRes.status === 'rejected'
      ) {
        setError('Unable to connect to real-time operations telemetry feed.');
      } else {
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'An unexpected error occurred during real-time sync.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
      isFetchingRef.current = false;
    }
  }, []);

  // Initial Mount Fetch
  useEffect(() => {
    isMountedRef.current = true;
    fetchRealtimeData(false);

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchRealtimeData]);

  // Auto-Refresh Polling Loop
  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const scheduleNextPoll = () => {
      if (!isMountedRef.current || !autoRefreshEnabled) return;
      pollTimerRef.current = setTimeout(async () => {
        if (isMountedRef.current && autoRefreshEnabled) {
          await fetchRealtimeData(true);
          scheduleNextPoll();
        }
      }, AUTO_REFRESH_INTERVAL_MS);
    };

    scheduleNextPoll();

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchRealtimeData, autoRefreshEnabled]);

  const currencySymbol = locConfig?.formatting?.currency_symbol || '$';

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
            <Activity size={26} color="#14b8a6" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              Real-Time Operations & Alerts
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            Live operational telemetry pulse, multi-facility health status, and active incident notifications.
          </p>
        </div>

        {/* Refresh Controls & Status */}
        <RealtimeRefreshControl
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          autoRefreshEnabled={autoRefreshEnabled}
          refreshIntervalSeconds={AUTO_REFRESH_INTERVAL_MS / 1000}
          onRefresh={() => fetchRealtimeData(false)}
          onToggleAutoRefresh={setAutoRefreshEnabled}
        />
      </div>

      {/* 3. Global Connection Error Notice */}
      {error && (
        <div style={{ padding: '0 4px' }}>
          <ErrorState
            title="Real-Time Connection Notice"
            message={error}
            onRetry={() => fetchRealtimeData(false)}
          />
        </div>
      )}

      {/* 4. Section B: Operational Health Card */}
      <section aria-label="Operational Health Status">
        <OperationalHealthCard
          health={health}
          isLoading={isLoading}
          error={healthError}
          onRetry={() => fetchRealtimeData(false)}
        />
      </section>

      {/* 5. Section A: Real-Time Summary KPIs */}
      <section aria-label="Real-Time Operations Summary">
        <RealtimeSummary
          summary={summary}
          currencySymbol={currencySymbol}
          isLoading={isLoading}
          error={summaryError}
          onRetry={() => fetchRealtimeData(false)}
        />
      </section>

      {/* 6. Section C: Live Operational Alerts Panel */}
      <section aria-label="Active Operational Alerts">
        <AlertsPanel
          alerts={alerts}
          currencySymbol={currencySymbol}
          isLoading={isLoading}
          error={alertsError}
          onRetry={() => fetchRealtimeData(false)}
        />
      </section>
    </div>
  );
};

export default RealtimePage;
