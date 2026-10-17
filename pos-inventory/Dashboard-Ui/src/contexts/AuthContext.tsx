import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserResponse } from '../api/endpoints';
import { authApi } from '../api/endpoints';

interface AuthContextType {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  canAccess: (module: string) => boolean;
  login: (token: string, user: UserResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const userData = await authApi.me();
        setUser(userData);
      } catch {
        localStorage.removeItem('token');
        setUser(null);
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      await refreshUser();
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = (token: string, user: UserResponse) => {
    localStorage.setItem('token', token);
    setUser(user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const roleLower = (user?.role || '').trim().toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'administrator';

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    const perms = user.permissions || [];
    return perms.includes(permission);
  };

  const canAccess = (module: string): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    switch (module.toLowerCase()) {
      case 'dashboard':
      case 'analytics':
        return hasPermission('dashboard.view');
      case 'products':
      case 'inventory':
        return hasPermission('products.view');
      case 'pos':
        return hasPermission('pos.access');
      case 'sales':
      case 'invoices':
        return hasPermission('invoices.view');
      case 'sales_orders':
      case 'sales-orders':
        return hasPermission('sales_orders.view');
      case 'purchase_orders':
      case 'purchase-orders':
        return hasPermission('purchase_orders.view');
      case 'customers':
        return hasPermission('customers.view');
      case 'returns':
        return hasPermission('returns.view');
      case 'solutions':
        return hasPermission('production.view') || hasPermission('finance.view');
      case 'production':
        return hasPermission('production.view');
      case 'finance':
        return hasPermission('finance.view');
      case 'reports':
        return hasPermission('reports.view');
      case 'settings':
      case 'users':
        return isAdmin || hasPermission('settings.view') || hasPermission('users.manage');
      default:
        return hasPermission(`${module}.view`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAdmin,
        hasPermission,
        canAccess,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
