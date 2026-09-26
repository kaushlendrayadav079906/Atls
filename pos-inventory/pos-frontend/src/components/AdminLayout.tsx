import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { clearPersistedCache } from '../app/queryClient';
import { logout } from '../features/auth/authSlice';
import { useTokenExpiration } from '../hooks/useTokenExpiration';
import { logoutUser } from '../services/api';

const AdminLayout = () => {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useTokenExpiration();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore logout API errors; still clear local state.
    }
    dispatch(logout());
    queryClient.clear();
    clearPersistedCache();
    localStorage.removeItem('pos:operator-dashboard:v1');
    navigate('/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} my-2 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${
      isActive
        ? 'bg-cyan-500/10 text-white shadow-sm'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
    }`;

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="admin-shell flex h-screen bg-slate-50/50">
      {/* Mobile menu button */}
      <button
        aria-label="Toggle Admin Mobile Menu"
        onClick={() => setMobileOpen(!mobileOpen)}
        className={`${mobileOpen ? 'hidden' : ''} lg:hidden fixed top-4 left-4 z-50 bg-white text-slate-800 border border-slate-200 p-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 ${collapsed ? 'lg:w-20' : 'w-64'} bg-slate-950 shadow-2xl flex flex-col border-r border-slate-800 z-[140] transition-all duration-300 ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between h-20">
          {!collapsed && (
            <div className="flex-1 flex flex-col items-start justify-center">
              <img
                src="/images/black-logo.png"
                alt="Logo"
                className="w-32 h-auto object-contain"
              />
              <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mt-1">Admin Center</span>
            </div>
          )}
          {mobileOpen ? (
            <button aria-label="Close Admin Menu" onClick={closeMobile} className="p-2 rounded-lg hover:bg-slate-800/50 text-cyan-500 focus:outline-none focus:ring-2 focus:ring-gray-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              aria-label={collapsed ? "Expand Admin Sidebar" : "Collapse Admin Sidebar"}
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-2 rounded-lg hover:bg-slate-800/50 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 mx-auto"
            >
              <svg
                className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {!collapsed && (
            <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Management</p>
          )}
          {/* Home / Dashboard */}
          <NavLink to="/admin" end className={navClass} onClick={closeMobile}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {!collapsed && <span>Dashboard</span>}
          </NavLink>

          {/* Branches */}
          <NavLink to="/admin/branches" className={navClass} onClick={closeMobile}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {!collapsed && <span>Branches</span>}
          </NavLink>

          {/* Export Reports */}
          <NavLink to="/admin/reports" className={navClass} onClick={closeMobile}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {!collapsed && <span>Export Reports</span>}
          </NavLink>

          {/* Approvals */}
          <NavLink to="/admin/approvals" className={navClass} onClick={closeMobile}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {!collapsed && <span>Approvals</span>}
          </NavLink>

          {/* POS Shortcut */}
          <div className="pt-4 mt-2 border-t border-slate-800">
            {!collapsed && (
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Shortcuts</p>
            )}
            <NavLink to="/" className={navClass} onClick={closeMobile}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {!collapsed && <span>Go to POS</span>}
            </NavLink>
            <NavLink to="/project" className={navClass} onClick={closeMobile}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {!collapsed && <span>Project Summary</span>}
            </NavLink>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-white space-y-3">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 bg-slate-800/50 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-gray-700 font-semibold text-sm">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                  <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Admin</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 bg-slate-800/50 rounded-full flex items-center justify-center shrink-0" title={user?.name}>
                <span className="text-gray-700 font-semibold text-sm">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-cyan-500/10/50 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={closeMobile}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-50/50 lg:ml-0 pt-16 lg:pt-0">
        <div className="admin-page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;

