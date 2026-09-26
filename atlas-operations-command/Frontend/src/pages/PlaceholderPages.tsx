import React from 'react';
import { EmptyState } from '../components/common/EmptyState';
import { FileBarChart2, BrainCircuit, Activity, Settings } from 'lucide-react';

export const ReportsPage: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div className="card">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>Executive Reports & Analytics</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Top customer revenue breakdowns, sales performance by product, and period financials.
      </p>
    </div>
    <div className="card">
      <EmptyState
        icon={<FileBarChart2 size={48} />}
        title="Reports Module Placeholder"
        message="Periodic reporting charts and customer analytics will be populated here."
      />
    </div>
  </div>
);

export const AIPage: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div className="card">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>AI Risk & Recommended Actions</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Autonomous risk engine analysis, mitigation actions, and executive briefings.
      </p>
    </div>
    <div className="card">
      <EmptyState
        icon={<BrainCircuit size={48} />}
        title="AI Intelligence Placeholder"
        message="AI executive briefings and composite risk calculations will be visualized in this view."
      />
    </div>
  </div>
);

export const RealtimePage: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div className="card">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>Realtime Operational Health</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Live telemetry feeds, instant alerts, and facility efficiency metrics.
      </p>
    </div>
    <div className="card">
      <EmptyState
        icon={<Activity size={48} />}
        title="Realtime Feeds Placeholder"
        message="Realtime health aggregations and instant operational alerts will be displayed here."
      />
    </div>
  </div>
);

export const SettingsPage: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div className="card">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>Company Localization & Settings</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        Fiscal year configuration, tax jurisdiction, currency, and timezone preferences.
      </p>
    </div>
    <div className="card">
      <EmptyState
        icon={<Settings size={48} />}
        title="Settings Module Placeholder"
        message="Company administration and localization settings panel will be configured here."
      />
    </div>
  </div>
);
