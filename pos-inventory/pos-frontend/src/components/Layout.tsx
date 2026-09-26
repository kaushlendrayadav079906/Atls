import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { clearPersistedCache } from "../app/queryClient";
import { selectCartItemCount } from "../features/cart/cartSlice";
import { logout } from "../features/auth/authSlice";
import { useTokenExpiration } from "../hooks/useTokenExpiration";
import { logoutUser } from "../services/api";
import AlertsDrawer from "./AlertsDrawer";
import { useAlerts } from "../hooks/useAlerts";

const Layout = () => {
  const cartItemCount = useAppSelector(selectCartItemCount);
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const { data: alerts } = useAlerts(true);
  const pendingAlertsCount = alerts ? alerts.length : 0;

  // Monitor token expiration and auto-logout
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
    localStorage.removeItem("pos:operator-dashboard:v1");
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center ${isSidebarCollapsed ? "justify-center" : "gap-3"} my-2 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 ${
      isActive
        ? "bg-cyan-500/10 text-white shadow-sm"
        : "text-gray-600 hover:bg-gray-100 hover:text-white"
    }`;

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-slate-50/50">
      {/* Mobile Menu Button */}
      <button
        aria-label="Toggle Mobile Menu"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={`${isMobileMenuOpen ? "hidden" : ""} lg:hidden fixed top-4 left-4 z-50 bg-white text-slate-800 border border-slate-200 p-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900`}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 ${isSidebarCollapsed ? "lg:w-20" : "w-64"} bg-slate-950 shadow-2xl flex flex-col border-r border-slate-800 z-[140] transform transition-all duration-300 ease-in-out ${
          isMobileMenuOpen
            ? "translate-x-0 w-64"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo/Brand - Header */}
        <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between h-20">
          {!isSidebarCollapsed && (
            <img
              src="/images/black-logo.png"
              alt="Logo"
              className="w-32 h-auto object-contain"
            />
          )}
          {isMobileMenuOpen ? (
            <button
              aria-label="Close Mobile Menu"
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 text-cyan-500 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 text-slate-500 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 mx-auto"
            >
              <svg
                className={`w-5 h-5 shrink-0 transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {!isSidebarCollapsed && (
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Main Menu</p>
          )}
          <NavLink to="/" className={navLinkClass} onClick={closeMobileMenu}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {!isSidebarCollapsed && <span>Dashboard</span>}
          </NavLink>

          <NavLink to="/pos" className={navLinkClass} onClick={closeMobileMenu}>
            <div className="relative">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {cartItemCount > 0 && isSidebarCollapsed && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <>
                <span>POS Checkout</span>
                {cartItemCount > 0 && (
                  <span className="ml-auto bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    {cartItemCount} item{cartItemCount > 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          </NavLink>
          
          <NavLink to="/returns" className={navLinkClass} onClick={closeMobileMenu}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            {!isSidebarCollapsed && <span>Returns</span>}
          </NavLink>
          
          <NavLink to="/products" className={navLinkClass} onClick={closeMobileMenu}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {!isSidebarCollapsed && <span>Products</span>}
          </NavLink>

          <div className="pt-4 mt-2 border-t border-slate-800">
            {!isSidebarCollapsed && (
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Analysis</p>
            )}
            <NavLink to="/reports" className={navLinkClass} onClick={closeMobileMenu}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!isSidebarCollapsed && <span>Reports</span>}
            </NavLink>
            <NavLink to="/project" className={navLinkClass} onClick={closeMobileMenu}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {!isSidebarCollapsed && <span>Project Summary</span>}
            </NavLink>
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <NavLink to="/atlas" className={navLinkClass} onClick={closeMobileMenu}>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {!isSidebarCollapsed && <span>Atlas Analytics</span>}
              </NavLink>
            )}
          </div>

          {user?.role === "admin" && (
            <div className="pt-4 mt-2 border-t border-slate-800">
              {!isSidebarCollapsed && (
                <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Management</p>
              )}
              <NavLink to="/admin" className={navLinkClass} onClick={closeMobileMenu}>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {!isSidebarCollapsed && <span>Admin Panel</span>}
              </NavLink>
            </div>
          )}
        </nav>

        {/* Footer User Profile & Actions */}
        
        <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <button
              onClick={() => setIsAlertsOpen(true)}
              className={`w-full flex items-center justify-center p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                pendingAlertsCount > 0
                  ? 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-white'
              }`}
            >
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {pendingAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
              </div>
              {!isSidebarCollapsed && (
                <span className="ml-3 font-medium text-sm">
                  Alerts {pendingAlertsCount > 0 && `(${pendingAlertsCount})`}
                </span>
              )}
            </button>
          )}

          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-slate-200 font-semibold text-sm">
                    {user?.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-cyan-500 truncate">
                    {user?.store_name ?? user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg hover:bg-gray-100 hover:text-white transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center shrink-0" title={user?.name}>
                <span className="text-slate-200 font-semibold">
                  {user?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center bg-slate-900 text-slate-400 border border-slate-800 rounded-lg hover:bg-gray-100 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
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

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-cyan-500/10/50 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={closeMobileMenu}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0a1128]">
        {/* Top Header */}
        <header className="hidden lg:flex h-16 items-center justify-between px-6 bg-slate-950 border-b border-slate-800 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center text-slate-400 text-sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span>Dashboard</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden xl:block w-96">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="search" placeholder="Search products, customers, invoices..." className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg pl-9 pr-12 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-500" />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <kbd className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 font-mono">Ctrl</kbd>
                <kbd className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 font-mono">K</kbd>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-right hidden sm:block">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  <span className="text-xs font-semibold text-slate-400">Connection status unavailable</span>
                </div>
              </div>

              <button 
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                aria-label="Alerts"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {pendingAlertsCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-slate-950">
                    {pendingAlertsCount}
                  </span>
                )}
              </button>

              <div className="w-px h-6 bg-slate-800 mx-1"></div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center text-cyan-500 font-bold border border-slate-700">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-semibold text-white leading-tight">{user?.name || 'Operator'}</div>
                  <div className="text-[10px] text-slate-400">{user?.role === 'admin' ? 'Admin User' : 'Operator'}</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[#0a1128] lg:ml-0 relative">
          <Outlet />
        </main>
      </div>

      {/* Alerts Drawer */}
      <AlertsDrawer 
        isOpen={isAlertsOpen} 
        onClose={() => setIsAlertsOpen(false)} 
        isAdmin={user?.role === 'admin'}
      />
    </div>
  );
};

export default Layout;
