import React from 'react';
import { Activity } from 'lucide-react';
import type { Factory } from '../../types';

interface FactoryPerformanceProps {
  factory: Factory;
}

export const FactoryPerformance: React.FC<FactoryPerformanceProps> = ({ factory }) => {
  const isMaintenance = factory.status?.toLowerCase() === 'maintenance';
  const isInactive = factory.status?.toLowerCase() === 'inactive';
  const statusColor = isMaintenance ? '#f59e0b' : isInactive ? '#ef4444' : '#10b981';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={20} color="var(--primary)" />
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
          Facility Operational Status
        </h3>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Status Indicator */}
        <div
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Operating Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: statusColor,
              }}
            />
            <span style={{ fontSize: '1rem', fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
              {factory.status}
            </span>
          </div>
        </div>

        {/* Facility Code */}
        <div
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Plant Code
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {factory.code || 'Unassigned'}
          </div>
        </div>

        {/* Facility Location */}
        <div
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Location Jurisdiction
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {factory.location || 'Global Operations'}
          </div>
        </div>
      </div>
    </div>
  );
};
