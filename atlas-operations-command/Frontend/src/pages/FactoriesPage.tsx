import React, { useState, useEffect } from 'react';
import { Factory as FactoryIcon, RefreshCw, Search } from 'lucide-react';
import { factoryService } from '../services/factoryService';
import { FactoryCard } from '../components/factories/FactoryCard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import type { Factory } from '../types';

export const FactoriesPage: React.FC = () => {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchFactories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await factoryService.getFactories();
      setFactories(data || []);
    } catch (err: any) {
      if (err.status === 403) {
        setError('Access forbidden. You do not have permission to view factories.');
      } else if (err.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError(err.message || 'Unable to load factory data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFactories();
  }, []);

  // Filter factories based on search term
  const filteredFactories = factories.filter((f) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = f.name?.toLowerCase().includes(q);
    const codeMatch = f.code ? f.code.toLowerCase().includes(q) : false;
    const locationMatch = f.location ? f.location.toLowerCase().includes(q) : false;
    return nameMatch || codeMatch || locationMatch;
  });

  // Summary Metrics safely derived from actual API response
  const totalFactories = factories.length;
  const activeFactories = factories.filter(
    (f) => f.status?.toLowerCase() === 'active'
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--primary-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <FactoryIcon size={18} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              Factory Management
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Fleet status, production facility management, and individual plant financials.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={fetchFactories}
            className="btn-secondary"
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.85rem',
            }}
            aria-label="Refresh factories list"
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards (Safely derived from actual backend data) */}
      {!isLoading && !error && factories.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          <div
            className="card"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid var(--primary)',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Total Factories
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
              {totalFactories}
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #10b981',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Active Factories
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '4px', color: '#10b981' }}>
              {activeFactories}
            </div>
          </div>
        </div>
      )}

      {/* Search Input Filter */}
      {!isLoading && !error && factories.length > 0 && (
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search factories by name, code, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '38px', height: '40px' }}
            aria-label="Search factories"
          />
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner message="Loading factory fleet telemetry..." />
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="card">
          <ErrorState
            title="Failed to Load Factories"
            message={error}
            onRetry={fetchFactories}
          />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && factories.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<FactoryIcon size={48} />}
            title="No Factories Available"
            message="No factories have been registered for this company."
          />
        </div>
      )}

      {/* Filtered Empty State */}
      {!isLoading && !error && factories.length > 0 && filteredFactories.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Search size={40} />}
            title="No Matching Factories"
            message={`No facilities matched your query "${searchQuery}".`}
          />
        </div>
      )}

      {/* Factory Cards Grid */}
      {!isLoading && !error && filteredFactories.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredFactories.map((factory) => (
            <FactoryCard key={factory.id} factory={factory} />
          ))}
        </div>
      )}
    </div>
  );
};
