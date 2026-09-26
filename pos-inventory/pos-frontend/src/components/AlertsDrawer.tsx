import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlerts, type DashboardAlert } from '../hooks/useAlerts';

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

const AlertsDrawer: React.FC<AlertsDrawerProps> = ({ isOpen, onClose, isAdmin }) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data: alerts, isLoading, isError, refetch } = useAlerts(isOpen);

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleAlertClick = (_alert: DashboardAlert) => {
    if (isAdmin) {
      navigate('/admin');
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-[150] transition-opacity" />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-80 sm:w-96 bg-white shadow-2xl z-[160] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Alerts & Notifications</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-slate-500 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-pulse flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
                <span className="mt-4 text-sm text-slate-500">Loading alerts...</span>
              </div>
            </div>
          ) : isError ? (
            <div className="text-center p-8 text-red-500">
              <svg className="w-10 h-10 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p>Failed to load alerts.</p>
            </div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p>No pending alerts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  className={`bg-white rounded-lg p-4 border border-gray-200 shadow-sm transition-all ${
                    isAdmin ? 'cursor-pointer hover:border-gray-900 hover:shadow-md' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 uppercase tracking-wide">
                      {alert.request_type}
                    </span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(alert.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 mb-1">
                    Amount: ${alert.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {alert.reason || "No reason provided."}
                  </p>
                  {!isAdmin && (
                    <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-50 italic">
                      Admin approval required.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AlertsDrawer;
