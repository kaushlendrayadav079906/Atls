import React from 'react';
import { RefreshCw, Clock, Radio } from 'lucide-react';

interface RealtimeRefreshControlProps {
  lastUpdated: Date | null;
  isRefreshing: boolean;
  autoRefreshEnabled: boolean;
  refreshIntervalSeconds: number;
  onRefresh: () => void;
  onToggleAutoRefresh: (enabled: boolean) => void;
}

export const RealtimeRefreshControl: React.FC<RealtimeRefreshControlProps> = ({
  lastUpdated,
  isRefreshing,
  autoRefreshEnabled,
  refreshIntervalSeconds,
  onRefresh,
  onToggleAutoRefresh,
}) => {
  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Never';

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.85rem',
      }}
    >
      {/* Live Polling Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: autoRefreshEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
          border: `1px solid ${autoRefreshEnabled ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.2)'}`,
          padding: '4px 10px',
          borderRadius: '20px',
          color: autoRefreshEnabled ? '#34d399' : 'var(--text-muted)',
          fontSize: '0.75rem',
          fontWeight: 600,
        }}
      >
        <Radio size={12} className={autoRefreshEnabled ? 'pulse-live' : ''} />
        <span>
          {autoRefreshEnabled ? `Live Polling (${refreshIntervalSeconds}s)` : 'Polling Paused'}
        </span>
      </div>

      {/* Last Updated Timestamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
        }}
      >
        <Clock size={13} color="var(--text-muted)" />
        <span>
          Last updated: <strong style={{ color: 'var(--text-primary)' }}>{formattedTime}</strong>
        </span>
      </div>

      {/* Auto Refresh Toggle */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
        }}
      >
        <input
          type="checkbox"
          checked={autoRefreshEnabled}
          onChange={(e) => onToggleAutoRefresh(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <span>Auto-refresh</span>
      </label>

      {/* Manual Refresh Button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
          color: 'var(--text-primary)',
          padding: '6px 12px',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: isRefreshing ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s ease',
        }}
      >
        <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
        <span>{isRefreshing ? 'Syncing...' : 'Refresh Now'}</span>
      </button>
    </div>
  );
};
