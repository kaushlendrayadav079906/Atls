import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { localizationService } from '../services/localizationService';
import { currencyService } from '../services/currencyService';
import type { LocalizationConfig, FiscalYear, ExchangeRate } from '../types';
import { DashboardPage } from './DashboardPage';
import { SettingsModal } from '../components/settings';
import type { SettingsSection } from '../components/settings';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const [config, setConfig] = useState<LocalizationConfig | null>(null);
  const [fiscalYear, setFiscalYear] = useState<FiscalYear | null>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings Modal is open by default when navigating to /settings
  const [isModalOpen, setIsModalOpen] = useState(true);
  const activeSection: SettingsSection = 'localization';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configData, fyData, ratesData] = await Promise.all([
        localizationService.getConfig().catch((err) => {
          console.error('Failed to load localization config', err);
          return null;
        }),
        localizationService.getCurrentFiscalYear().catch((err) => {
          console.error('Failed to load fiscal year', err);
          return null;
        }),
        currencyService.getExchangeRates().catch((err) => {
          console.error('Failed to load exchange rates', err);
          return [];
        }),
      ]);

      if (!configData) {
        throw new Error('Could not retrieve company localization configuration.');
      }

      setConfig(configData);
      setFiscalYear(fyData);
      setRates(ratesData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    navigate('/dashboard');
  };

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {/* 
        The existing AtlasOps Cmd Dashboard remains visible directly behind the modal overlay.
      */}
      <DashboardPage />

      {/* Loading overlay while settings data initializes */}
      {loading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading localization & financial settings...</p>
        </div>
      )}

      {/* Error display if configuration fails to load */}
      {error && !loading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.8)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div className="p-6 rounded-xl bg-red-950/90 border border-red-800/80 text-red-200 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-red-400 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-white">Settings Error</h3>
                <p className="text-sm mt-1">{error || 'Could not load company configuration.'}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                Back to Dashboard
              </button>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-red-800/80 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Retry Loading
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONE Centered Settings Modal matching reference design */}
      {!loading && config && (
        <SettingsModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          config={config}
          fiscalYear={fiscalYear}
          rates={rates}
          isAdmin={isAdmin}
          onReload={loadData}
          initialSection={activeSection}
        />
      )}
    </div>
  );
};

export default SettingsPage;
