import React from 'react';
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AccessDeniedProps {
  requiredPermission?: string;
  moduleName?: string;
  customMessage?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  requiredPermission,
  moduleName,
  customMessage,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-slate-800">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/90 bg-white p-8 shadow-xl shadow-slate-900/5 text-center">
        {/* Shield Icon Accent */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/50">
          <ShieldAlert className="h-10 w-10 text-amber-500" />
        </div>

        {/* Access Restricted Header */}
        <div className="mt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-700">
            <Lock className="h-3 w-3" />
            403 Forbidden
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Access Restricted
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {customMessage ||
              (moduleName
                ? `Your account does not have authorization to view the ${moduleName} module.`
                : 'You do not have permission to view this resource.')}
          </p>
        </div>

        {/* Security context note */}
        <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-left text-xs text-slate-500">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="font-semibold text-slate-700">Account:</span>
            <span className="font-mono text-slate-800">{user?.username || user?.email || 'Authenticated User'}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="font-semibold text-slate-700">Assigned Role:</span>
            <span className="capitalize font-semibold text-slate-800">{user?.role || 'User'}</span>
          </div>
          {requiredPermission && (
            <div className="flex justify-between items-center py-1">
              <span className="font-semibold text-slate-700">Required Permission:</span>
              <span className="font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                {requiredPermission}
              </span>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-400">
          If you require access to this capability, please contact your ATLAS system administrator.
        </p>

        {/* Navigation Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-500"
          >
            <Home className="h-4 w-4" />
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
