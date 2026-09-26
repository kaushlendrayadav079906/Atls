import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { clearPersistedCache } from "../app/queryClient";
import { selectCartItemCount } from "../features/cart/cartSlice";
import { logout } from "../features/auth/authSlice";
import { useTokenExpiration } from "../hooks/useTokenExpiration";
import { logoutUser } from "../services/api";

const Layout = () => {
  const cartItemCount = useAppSelector(selectCartItemCount);
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
        ? "bg-gray-900 text-white shadow-sm"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-gray-50/50">
      {/* Mobile Menu Button */}
      <button
        aria-label="Toggle Mobile Menu"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={`${isMobileMenuOpen ? "hidden" : ""} lg:hidden fixed top-4 left-4 z-50 bg-white text-gray-800 border border-gray-200 p-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900`}
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
        className={`fixed lg:static inset-y-0 left-0 ${isSidebarCollapsed ? "lg:w-20" : "w-64"} bg-white shadow-xl flex flex-col border-r border-gray-200 z-[140] transform transition-all duration-300 ease-in-out ${
          isMobileMenuOpen
            ? "translate-x-0 w-64"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo/Brand - Header */}
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between h-20">
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
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 mx-auto"
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
            <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Main Menu</p>
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

          <div className="pt-4 mt-2 border-t border-gray-100">
            {!isSidebarCollapsed && (
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Analysis</p>
            )}
            <NavLink to="/reports" className={navLinkClass} onClick={closeMobileMenu}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!isSidebarCollapsed && <span>Reports</span>}
            </NavLink>
          </div>

          {user?.role === "admin" && (
            <div className="pt-4 mt-2 border-t border-gray-100">
              {!isSidebarCollapsed && (
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Management</p>
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
        <div className="p-4 border-t border-gray-100 bg-white space-y-3">
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-gray-700 font-semibold text-sm">
                    {user?.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.store_name ?? user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0" title={user?.name}>
                <span className="text-gray-700 font-semibold">
                  {user?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-10 h-10 flex items-center justify-center bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
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
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={closeMobileMenu}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-gray-50/50 lg:ml-0 pt-16 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
