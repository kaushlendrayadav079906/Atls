import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AccessDenied } from './AccessDenied';

interface RequirePermissionProps {
  permission?: string;
  module?: string;
  requireAdmin?: boolean;
  children: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({
  permission,
  module,
  requireAdmin = false,
  children,
}) => {
  const { isAuthenticated, isLoading, isAdmin, hasPermission, canAccess } = useAuth();
  const location = useLocation();

  // 1. Loading State - Prevent flashing unauthorized or unauthenticated content
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Verifying Authorization...
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State - Redirect to login preserving intended target
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // 3. Admin / Settings Guard
  if (requireAdmin && !isAdmin && !hasPermission('settings.view') && !hasPermission('users.manage')) {
    return (
      <AccessDenied
        requiredPermission="settings.view"
        moduleName="Administrator Settings"
        customMessage="This module is reserved exclusively for ATLAS system administrators."
      />
    );
  }

  // 4. Granular Permission Guard
  if (permission && !hasPermission(permission)) {
    return <AccessDenied requiredPermission={permission} />;
  }

  // 5. Module-Level Guard
  if (module && !canAccess(module)) {
    return <AccessDenied moduleName={module} />;
  }

  // 6. Authorized
  return <>{children}</>;
};
