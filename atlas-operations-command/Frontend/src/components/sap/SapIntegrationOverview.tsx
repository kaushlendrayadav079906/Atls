import React from 'react';
import { Activity, Database, Clock, FileSpreadsheet, AlertCircle } from 'lucide-react';
import type { SapBusinessDataResponse } from '../../types';

interface SapIntegrationOverviewProps {
  sapData: SapBusinessDataResponse | null;
}

export const SapIntegrationOverview: React.FC<SapIntegrationOverviewProps> = ({ sapData }) => {
  const isUnavailable = !sapData || sapData.status.toLowerCase() === 'unavailable';

  const metrics = [
    {
      id: 'system-status',
      label: 'System Status',
      value: isUnavailable ? 'Unavailable' : sapData?.status,
      subtext: isUnavailable ? 'Gateway offline' : 'Active connection',
      icon: <Activity size={18} />,
      color: isUnavailable ? '#ef4444' : '#10b981',
      bg: isUnavailable ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
    },
    {
      id: 'connection-status',
      label: 'Connection Status',
      value: isUnavailable ? 'Not Connected' : 'Connected',
      subtext: isUnavailable ? 'Endpoint unconfigured' : 'Active endpoint',
      icon: <Database size={18} />,
      color: isUnavailable ? '#f59e0b' : '#3b82f6',
      bg: isUnavailable ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
    },
    {
      id: 'last-sync',
      label: 'Last Successful Sync',
      value: 'Not Available',
      subtext: 'No sync history recorded',
      icon: <Clock size={18} />,
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.1)',
    },
    {
      id: 'records-processed',
      label: 'Records Processed',
      value: 'Not Available',
      subtext: 'Awaiting integration',
      icon: <FileSpreadsheet size={18} />,
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.1)',
    },
    {
      id: 'pending-work',
      label: 'Pending Work',
      value: 'Not Available',
      subtext: 'No active ingest queue',
      icon: <AlertCircle size={18} />,
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.1)',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        Integration Overview
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        {metrics.map((m) => (
          <div
            key={m.id}
            data-testid={`overview-card-${m.id}`}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {m.label}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  background: m.bg,
                  color: m.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {m.icon}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {m.value}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginTop: '2px',
                }}
              >
                {m.subtext}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
