import React from 'react';
import { Link } from 'react-router-dom';
import { Factory as FactoryIcon, MapPin, Tag, ArrowRight } from 'lucide-react';
import type { Factory } from '../../types';

interface FactoryCardProps {
  factory: Factory;
}

export const FactoryCard: React.FC<FactoryCardProps> = ({ factory }) => {
  const isMaintenance = factory.status?.toLowerCase() === 'maintenance';
  const isInactive = factory.status?.toLowerCase() === 'inactive';

  const statusBg = isMaintenance
    ? 'rgba(245, 158, 11, 0.1)'
    : isInactive
    ? 'rgba(239, 68, 68, 0.1)'
    : 'rgba(16, 185, 129, 0.1)';

  const statusColor = isMaintenance ? '#f59e0b' : isInactive ? '#ef4444' : '#10b981';
  const statusBorder = isMaintenance
    ? '1px solid rgba(245, 158, 11, 0.25)'
    : isInactive
    ? '1px solid rgba(239, 68, 68, 0.25)'
    : '1px solid rgba(16, 185, 129, 0.25)';

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
        minHeight: '220px',
      }}
    >
      <div>
        {/* Card Header: Icon + Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <FactoryIcon size={20} />
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '12px',
              background: statusBg,
              color: statusColor,
              border: statusBorder,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {factory.status || 'ACTIVE'}
          </span>
        </div>

        {/* Factory Name & Code */}
        <h3
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '6px',
            lineHeight: 1.3,
          }}
        >
          {factory.name}
        </h3>

        {factory.code && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginBottom: '10px',
            }}
          >
            <Tag size={12} />
            <span>{factory.code}</span>
          </div>
        )}

        {/* Location Metadata */}
        {factory.location && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              marginTop: '4px',
            }}
          >
            <MapPin size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {factory.location}
            </span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div
        style={{
          marginTop: '20px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          ID: {factory.id.slice(0, 8)}...
        </span>
        <Link
          to={`/factories/${factory.id}`}
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            padding: '6px 12px',
            height: '32px',
            textDecoration: 'none',
          }}
        >
          View Details <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
};
