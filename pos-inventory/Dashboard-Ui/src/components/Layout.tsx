import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  Search,
  Settings,
  Factory,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Mail,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { GlobalSearchModal } from './GlobalSearchModal';
import { AIAssistantPanel, type AIAssistantContext } from './AIAssistantPanel';
import { DraggableChatbotLauncher } from './DraggableChatbotLauncher';
import { AtlasGlobalFooter } from './AtlasGlobalFooter';
import { useAIAssistant } from '../contexts/AIAssistantContext';
import atlasLogo from '../assets/LOGO.png';

interface NavSubItem {
  name: string;
  path: string;
  badge?: string;
  category?: 'Production' | 'Financial';
  permission?: string;
}

interface NavSectionItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  permission?: string;
  requireAdmin?: boolean;
  subItems?: NavSubItem[];
}

const navItems: NavSectionItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
  {
    name: 'Product',
    path: '/product',
    icon: Package,
    subItems: [
      { name: 'Products & Stock', path: '/products', permission: 'products.view' },
      { name: 'Point of Sale', path: '/pos', permission: 'pos.access' },
      { name: 'Sales Orders', path: '/sales-orders', permission: 'sales_orders.view' },
      { name: 'Sales Invoices', path: '/sales', permission: 'invoices.view' },
      { name: 'Purchase Orders', path: '/purchase-orders', permission: 'purchase_orders.view' },
      { name: 'Customers', path: '/customers', permission: 'customers.view' },
      { name: 'Returns & Approvals', path: '/returns', badge: '5', permission: 'returns.view' },
    ],
  },
  {
    name: 'Solutions',
    path: '/solutions',
    icon: Factory,
    subItems: [
      { name: 'Production Overview', path: '/production', category: 'Production', permission: 'production.view' },
      { name: 'Production Orders', path: '/production/orders', category: 'Production', permission: 'production.orders.view' },
      { name: 'Item-wise Production', path: '/production/item-wise', category: 'Production', permission: 'production.view' },
      { name: 'Production Rejection', path: '/production/rejection', category: 'Production', permission: 'production.view' },
      { name: 'Date-wise Production', path: '/production/date-wise', category: 'Production', permission: 'production.view' },
      { name: 'Production Reports', path: '/production/reports', category: 'Production', permission: 'production.reports.view' },
      { name: 'Finance Overview', path: '/finance', category: 'Financial', permission: 'finance.view' },
      { name: 'Purchase Invoices', path: '/finance/purchase-invoices', category: 'Financial', permission: 'finance.invoices.view' },
      { name: 'Incoming Payments', path: '/finance/incoming-payments', category: 'Financial', permission: 'finance.payments.view' },
      { name: 'Outgoing Payments', path: '/finance/outgoing-payments', category: 'Financial', permission: 'finance.payments.view' },
      { name: 'Customer Analysis', path: '/finance/customer-analysis', category: 'Financial', permission: 'finance.view' },
      { name: 'Supplier Analysis', path: '/finance/supplier-analysis', category: 'Financial', permission: 'finance.view' },
      { name: 'Profitability Reports', path: '/finance/profitability-reports', category: 'Financial', permission: 'finance.reports.view' },
    ],
  },
  {
    name: 'Reports',
    path: '/reports',
    icon: FileText,
    subItems: [
      { name: 'Sales Reports', path: '/reports/sales', permission: 'reports.view' },
      { name: 'Invoice Reports', path: '/reports/invoice', permission: 'reports.view' },
      { name: 'Payment Reports', path: '/reports/payment', permission: 'reports.view' },
      { name: 'Inventory Reports', path: '/reports/inventory', permission: 'reports.view' },
      { name: 'Customer Reports', path: '/reports/customer', permission: 'reports.view' },
      { name: 'AI Generated Reports', path: '/reports/ai', permission: 'reports.view' },
    ],
  },
  { name: 'Contact', path: '/contact', icon: Mail },
  { name: 'Settings', path: '/settings', icon: Settings, requireAdmin: true },
];

// ── Sidebar colour tokens ──────────────────────────────────────────────────
const SIDEBAR_BG = '#F7F9FC';
const SIDEBAR_ACTIVE_BG = '#E8F0FF';
const SIDEBAR_HOVER_BG = '#F0F5FF';
const SIDEBAR_BORDER = '#DCE4EF';
const TEXT_PRIMARY = '#14213D';
const TEXT_SECONDARY = '#52627A';
const TEXT_MUTED = '#7C8BA1';
const COLOR_PRIMARY = '#155EEF';
const COLOR_BADGE = '#EF3340';

export const Layout = () => {
  const { user, isAdmin, hasPermission, canAccess, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isProductActive =
    location.pathname === '/product' ||
    location.pathname === '/products' ||
    location.pathname.startsWith('/products/') ||
    location.pathname === '/pos' ||
    location.pathname === '/sales-orders' ||
    location.pathname === '/sales' ||
    location.pathname.startsWith('/sales/') ||
    location.pathname === '/purchase-orders' ||
    location.pathname === '/customers' ||
    location.pathname === '/returns';

  const isSolutionsActive =
    location.pathname === '/solutions' ||
    location.pathname.startsWith('/production') ||
    location.pathname.startsWith('/finance');

  const isReportsActive =
    location.pathname.startsWith('/reports') ||
    location.pathname === '/analytics';

  const [productExpanded, setProductExpanded] = useState(isProductActive);
  const [solutionsExpanded, setSolutionsExpanded] = useState(isSolutionsActive);
  const [reportsExpanded, setReportsExpanded] = useState(isReportsActive);

  useEffect(() => {
    if (isProductActive) setProductExpanded(true);
    if (isSolutionsActive) setSolutionsExpanded(true);
    if (isReportsActive) setReportsExpanded(true);
  }, [location.pathname, isProductActive, isSolutionsActive, isReportsActive]);

  // Dynamically compute visible navigation items and sub-items based on RBAC permissions
  const visibleNavItems = useMemo(() => {
    return navItems
      .map((item) => {
        if (item.requireAdmin && !isAdmin && !hasPermission('settings.view') && !hasPermission('users.manage')) {
          return null;
        }
        if (item.permission && !hasPermission(item.permission)) {
          return null;
        }
        if (item.name === 'Solutions') {
          if (!canAccess('solutions')) {
            return null;
          }
          if (item.subItems) {
            const visibleSubItems = item.subItems.filter((sub) => {
              if (!sub.permission) return true;
              return hasPermission(sub.permission);
            });
            return { ...item, subItems: visibleSubItems };
          }
          return item;
        }
        if (item.subItems) {
          const visibleSubItems = item.subItems.filter((sub) => {
            if (!sub.permission) return true;
            return hasPermission(sub.permission);
          });
          if (visibleSubItems.length === 0) {
            return null;
          }
          return { ...item, subItems: visibleSubItems };
        }
        return item;
      })
      .filter((item): item is NavSectionItem => item !== null);
  }, [isAdmin, hasPermission, canAccess]);

  const showProductNav = visibleNavItems.some((item) => item.name === 'Product');
  const showSolutionsNav = visibleNavItems.some((item) => item.name === 'Solutions') || canAccess('solutions');
  const showReportsNav = visibleNavItems.some((item) => item.name === 'Reports') || hasPermission('reports.view');
  const showSettingsNav = isAdmin || hasPermission('settings.view') || hasPermission('users.manage');

  const { isSapConnected } = useSystemHealth();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const { isOpen: aiOpen, setIsOpen: setAiOpen } = useAIAssistant();
  const { isDark, toggleTheme } = useTheme();

  const getPageContext = (pathname: string): AIAssistantContext => {
    if (pathname === '/product' || pathname === '/products' || pathname.startsWith('/products/')) return 'products';
    if (pathname === '/solutions') return 'production';
    if (pathname === '/customers') return 'customers';
    if (pathname === '/pos') return 'pos';
    if (pathname === '/sales-orders') return 'sales_orders';
    if (pathname === '/purchase-orders') return 'purchase_orders';
    if (pathname === '/sales' || pathname.startsWith('/sales/')) return 'invoices';
    if (pathname === '/returns') return 'returns';
    if (pathname === '/analytics') return 'analytics';
    if (pathname === '/contact') return 'dashboard';
    if (pathname === '/settings') return 'settings';

    if (pathname === '/production/orders') return 'production_orders';
    if (pathname === '/production/item-wise') return 'production_item_wise';
    if (pathname === '/production/rejection') return 'production_rejection';
    if (pathname === '/production/date-wise') return 'production_date_wise';
    if (pathname === '/production/reports') return 'production_reports';
    if (pathname.startsWith('/production')) return 'production';

    if (pathname === '/reports/sales') return 'reports_sales';
    if (pathname === '/reports/invoice') return 'reports_invoice';
    if (pathname === '/reports/payment') return 'reports_payment';
    if (pathname === '/reports/inventory') return 'reports_inventory';
    if (pathname === '/reports/customer') return 'reports_customer';
    if (pathname === '/reports/ai') return 'reports_ai';
    if (pathname.startsWith('/reports')) return 'reports';

    if (pathname === '/finance' || pathname === '/finance/overview') return 'finance_overview';
    if (pathname === '/finance/purchase-invoices') return 'finance_purchase_invoices';
    if (pathname === '/finance/incoming-payments') return 'finance_incoming_payments';
    if (pathname === '/finance/outgoing-payments') return 'finance_outgoing_payments';
    if (pathname === '/finance/customer-analysis') return 'finance_customer_analysis';
    if (pathname === '/finance/supplier-analysis') return 'finance_supplier_analysis';
    if (pathname === '/finance/profitability-reports') return 'finance_profitability_reports';
    if (pathname.startsWith('/finance')) return 'finance';

    return 'dashboard';
  };


  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleAskAI = (prompt: string) => {
    // Open assistant and fill prompt directly on the active page
    window.dispatchEvent(new CustomEvent('atls-toggle-ai', { detail: { open: true } }));
    window.dispatchEvent(new CustomEvent('atls-ai-prompt', { detail: prompt }));
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className={`flex flex-col h-screen font-sans overflow-hidden transition-colors duration-200 ${isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* ── Full-Width Fixed Top Navbar (Spanning all the way across left & right) ── */}
      <header className={`sticky top-0 z-30 flex h-[60px] w-full items-center justify-between border-b px-4 sm:px-6 shrink-0 shadow-xs transition-colors duration-200 ${
        isDark ? 'bg-[#152033] border-slate-700/80 text-white' : 'bg-white border-slate-200/90 text-slate-900'
      }`}>
        {/* Left: Brand Logo & ATLAS Name + Collapse / Mobile toggle */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger menu */}
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:hidden cursor-pointer"
            onClick={toggleSidebar}
            title="Toggle Menu"
          >
            <Menu size={20} />
          </button>

          {/* Logo & ATLAS Name */}
          <div className="flex items-center gap-3">
            <img
              src={atlasLogo}
              alt="ATLAS Logo"
              className="h-10 w-10 shrink-0 object-contain drop-shadow-md"
            />
            <span className="text-[21px] font-black tracking-wider text-blue-600 select-none">
              ATLAS
            </span>
          </div>

          {/* Desktop Sidebar Collapse / Expand Toggle Button directly in navbar */}
          <button
            className="hidden md:flex items-center justify-center rounded-lg p-1.5 ml-2 hover:bg-slate-100 transition-colors text-slate-500 hover:text-blue-600 cursor-pointer"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar (icons only)"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={19} className="text-blue-600" />
            ) : (
              <PanelLeftClose size={19} />
            )}
          </button>
        </div>

        {/* Right side: 3 Main Navbar Sections + SAP Status, Notifications & User Avatar */}
        <div className="flex items-center gap-3 sm:gap-3.5">
          {/* 3 Main Navbar Sections (Product, Solutions, Reports) */}
          <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
            {showProductNav && (
              <NavLink
                to="/product"
                className={({ isActive }) => {
                  const active = isActive || isProductActive;
                  return `relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-[14.5px] font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-blue-50 text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`;
                }}
              >
                <Package size={16} />
                <span>Product</span>
              </NavLink>
            )}

            {showSolutionsNav && (
              <NavLink
                to="/solutions"
                className={({ isActive }) => {
                  const active = isActive || isSolutionsActive;
                  return `relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-[14.5px] font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-indigo-50 text-indigo-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`;
                }}
              >
                <Factory size={16} />
                <span>Solutions</span>
              </NavLink>
            )}

            {showReportsNav && (
              <NavLink
                to="/reports"
                className={({ isActive }) => {
                  const active = isActive || isReportsActive;
                  return `relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-[14.5px] font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-blue-50 text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`;
                }}
              >
                <FileText size={16} />
                <span>Reports</span>
              </NavLink>
            )}

            <NavLink
              to="/contact"
              className={({ isActive }) => {
                const active = isActive || location.pathname === '/contact';
                return `relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-[14.5px] font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-blue-50 text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`;
              }}
            >
              <Mail size={16} />
              <span>Contact</span>
            </NavLink>

            {showSettingsNav && (
              <NavLink
                to="/settings"
                className={({ isActive }) => {
                  const active = isActive || location.pathname.startsWith('/settings');
                  return `relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-[14.5px] font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-blue-50 text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`;
                }}
              >
                <Settings size={16} />
                <span>Settings</span>
              </NavLink>
            )}
          </nav>

          <div className="hidden md:block h-5 w-px bg-slate-200" />

          {/* SAP status pill */}
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1 shadow-2xs">
            <span className={`h-2 w-2 rounded-full ${isSapConnected === false ? 'bg-red-500' : isSapConnected === true ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            <div className="text-left leading-tight">
              <div className="text-[11px] font-semibold text-slate-800">
                {isSapConnected === false ? 'SAP Disconnected' : isSapConnected === true ? 'SAP Connected' : 'Checking SAP...'}
              </div>
              <div className="text-[9px] text-slate-500">
                {isSapConnected === false ? 'Offline' : isSapConnected === true ? 'Live connection' : 'Connecting...'}
              </div>
            </div>
          </div>

          {/* AI Assistant Reopen Button */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('atls-toggle-ai'))}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200/90 bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 hover:from-blue-100 hover:to-purple-100 px-2.5 py-1 text-[11.5px] font-semibold text-indigo-700 transition cursor-pointer shadow-2xs"
            title="Toggle ATLAS AI Assistant"
          >
            <Sparkles size={13} className="text-indigo-600" />
            <span className="hidden md:inline">AI Assistant</span>
          </button>

          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center h-8.5 w-8.5 rounded-full border transition-all cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700 hover:text-amber-200 ring-2 ring-amber-400/20'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Dark/Light Mode"
          >
            {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}
          </button>

          {/* Notifications */}
          <button className="relative rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer">
            <Bell size={17} />
            <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-white bg-red-500 text-[8px] font-bold text-white">
              5
            </span>
          </button>

          {/* User Profile - Icon with Hover & Click Menu containing Logout */}
          <div
            ref={userMenuRef}
            className="relative group pl-1.5 border-l border-slate-200"
            onMouseEnter={() => setUserDropdownOpen(true)}
            onMouseLeave={() => setUserDropdownOpen(false)}
          >
            <button
              type="button"
              onClick={() => setUserDropdownOpen((prev) => !prev)}
              className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-[11.5px] font-bold text-white shadow-2xs cursor-pointer transition-all duration-150 ring-2 ring-transparent group-hover:ring-blue-100 focus:outline-hidden"
              title={`${user?.name || 'User Profile'} (${user?.role || 'User'})`}
              aria-label="User Profile"
              aria-expanded={userDropdownOpen}
            >
              {user?.name
                ? user.name.split(' ').filter(Boolean).map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                : (user?.username ? user.username.slice(0, 2).toUpperCase() : 'KK')}
            </button>

            {/* Profile Menu Dropdown with Logout Option */}
            <div
              className={`absolute right-0 top-full pt-1.5 z-50 ${
                userDropdownOpen ? 'block' : 'hidden group-hover:block'
              } animate-in fade-in zoom-in-95 duration-150 min-w-[230px]`}
            >
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xl ring-1 ring-black/5 whitespace-nowrap">
                {/* User Details */}
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[12px] font-bold text-white shadow-2xs">
                    {user?.name
                      ? user.name.split(' ').filter(Boolean).map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                      : (user?.username ? user.username.slice(0, 2).toUpperCase() : 'KK')}
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <div
                      className="text-[12.5px] font-bold text-slate-800 leading-tight truncate"
                      title={user?.name || user?.username || 'User'}
                    >
                      {user?.name || user?.username || 'User'}
                    </div>
                    {user?.email && (
                      <div className="text-[11px] text-slate-400 truncate mt-0.5" title={user.email}>
                        {user.email}
                      </div>
                    )}
                    <div className="text-[10px] font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="capitalize font-semibold text-slate-700">{user?.role || 'User'}</span>
                      {user?.branch_id && <span className="text-slate-400">• {user.branch_id}</span>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-1">
                  {isAdmin && (
                    <NavLink
                      to="/settings"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50/80 rounded-lg transition-colors cursor-pointer"
                    >
                      <Settings size={14} className="text-slate-400" />
                      <span>Settings</span>
                    </NavLink>
                  )}

                  {/* Logout Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12.5px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer group/btn"
                    id="user-logout-button"
                  >
                    <LogOut size={14} className="text-rose-500 group-hover/btn:translate-x-0.5 transition-transform" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content Body: Sidebar + Main Content (both sitting BELOW the top navbar) ── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-slate-900/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Sidebar (Below full-width navbar) ── */}
        <aside
          style={{
            backgroundColor: isDark ? '#111a2c' : SIDEBAR_BG,
            borderRightColor: isDark ? '#26354a' : SIDEBAR_BORDER
          }}
          className={`fixed inset-y-0 left-0 top-[60px] z-20 flex flex-col border-r transition-all duration-300 md:static md:top-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } md:translate-x-0 ${sidebarCollapsed ? 'w-[72px]' : 'w-[220px]'}`}
        >
          {/* Compact Sidebar Search (Matching Reference Screenshot) */}
          {!sidebarCollapsed && (
            <div className="relative px-3.5 pt-4 pb-2">
              <div
                onClick={() => setSearchModalOpen(true)}
                className="relative flex items-center cursor-pointer group"
              >
                <Search size={13} className="pointer-events-none absolute left-2.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                <input
                  type="text"
                  readOnly
                  placeholder="Search menu, reports..."
                  className={`w-full cursor-pointer rounded-lg border py-1.5 pl-8 pr-10 text-[11px] group-hover:border-blue-400 focus:outline-none transition shadow-2xs ${
                    isDark
                      ? 'border-slate-700 bg-[#141f32] text-slate-200 placeholder:text-slate-400'
                      : 'border-slate-200 bg-white text-slate-700 placeholder:text-slate-400'
                  }`}
                />
                <span className={`pointer-events-none absolute right-1.5 rounded border px-1 py-0.5 text-[8.5px] font-semibold shadow-3xs group-hover:border-blue-300 ${
                  isDark ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}>
                  ⌘ K
                </span>
              </div>
            </div>
          )}

          {/* Thin divider */}
          <div style={{ backgroundColor: isDark ? '#1e293b' : SIDEBAR_BORDER }} className="mx-4 h-px" />

          {/* Nav */}
          <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-4'} py-3 space-y-1.5`}>
            {visibleNavItems.map((item) => {
              const hasSubItems = !!item.subItems && item.subItems.length > 0;
              const isActiveParent = hasSubItems && (
                (item.name === 'Product' && isProductActive) ||
                (item.name === 'Solutions' && isSolutionsActive) ||
                (item.name === 'Reports' && isReportsActive)
              );
              const isExpanded =
                item.name === 'Product'
                  ? productExpanded
                  : item.name === 'Solutions'
                  ? solutionsExpanded
                  : item.name === 'Reports'
                  ? reportsExpanded
                  : false;

              return (
                <div key={item.name} className={sidebarCollapsed ? 'flex justify-center' : undefined}>
                  {hasSubItems ? (
                    /* Section Parent Item (Navigates to Landing Page + Expands) */
                    <div
                      style={{
                        backgroundColor: isActiveParent ? (isDark ? '#152547' : SIDEBAR_ACTIVE_BG) : undefined,
                        color: isActiveParent ? COLOR_PRIMARY : (isDark ? '#cbd5e1' : TEXT_SECONDARY),
                      }}
                      onMouseEnter={(e) => {
                        if (!isActiveParent) e.currentTarget.style.backgroundColor = isDark ? '#0f1c35' : SIDEBAR_HOVER_BG;
                      }}
                      onMouseLeave={(e) => {
                        if (!isActiveParent) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      className={`group relative flex items-center transition-all duration-150 ${
                        sidebarCollapsed
                          ? 'h-10 w-10 justify-center rounded-xl p-0'
                          : 'w-full justify-between rounded-lg py-[9px] px-3 text-[14.5px] font-semibold'
                      }`}
                    >
                      {!sidebarCollapsed && isActiveParent && (
                        <span
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                          style={{ backgroundColor: COLOR_PRIMARY }}
                        />
                      )}
                      <NavLink
                        to={item.path}
                        onClick={() => {
                          if (sidebarCollapsed) setSidebarCollapsed(false);
                          setSidebarOpen(false);
                          if (item.name === 'Product') setProductExpanded(true);
                          if (item.name === 'Solutions') setSolutionsExpanded(true);
                          if (item.name === 'Reports') setReportsExpanded(true);
                        }}
                        title={sidebarCollapsed ? item.name : undefined}
                        className={`flex items-center ${
                          sidebarCollapsed ? 'h-full w-full justify-center' : 'flex-1 gap-2.5 overflow-hidden'
                        } text-inherit no-underline`}
                      >
                        <item.icon
                          size={18}
                          style={{ color: isActiveParent ? COLOR_PRIMARY : (isDark ? '#94a3b8' : TEXT_MUTED) }}
                          className="transition-colors group-hover:text-[#155EEF] shrink-0"
                        />
                        {!sidebarCollapsed && (
                          <span className="whitespace-nowrap font-medium text-inherit">{item.name}</span>
                        )}
                      </NavLink>

                      {!sidebarCollapsed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (item.name === 'Product') setProductExpanded(!productExpanded);
                            if (item.name === 'Solutions') setSolutionsExpanded(!solutionsExpanded);
                            if (item.name === 'Reports') setReportsExpanded(!reportsExpanded);
                          }}
                          className={`p-1 rounded transition-colors ml-1 cursor-pointer ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200/50'}`}
                          title={`Toggle ${item.name} submenu`}
                        >
                          <ChevronDown
                            size={14}
                            style={{ color: isActiveParent ? COLOR_PRIMARY : (isDark ? '#94a3b8' : TEXT_MUTED) }}
                            className={`transition-transform duration-200 group-hover:text-[#155EEF] ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Standard single nav link (Dashboard, Settings) */
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      onClick={() => setSidebarOpen(false)}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={() =>
                        `group relative flex items-center transition-all duration-150 ${
                          sidebarCollapsed
                            ? 'h-10 w-10 justify-center rounded-xl p-0'
                            : 'w-full justify-between rounded-lg py-[9px] px-3 text-[14.5px] font-semibold'
                        }`
                      }
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? (item.path === '/' ? '#155EEF' : (isDark ? '#152547' : SIDEBAR_ACTIVE_BG)) : undefined,
                        color: isActive ? (item.path === '/' ? '#ffffff' : COLOR_PRIMARY) : (isDark ? '#cbd5e1' : TEXT_SECONDARY),
                      })}
                      onMouseEnter={(e) => {
                        const isActive = location.pathname === item.path;
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = isDark ? '#0f1c35' : SIDEBAR_HOVER_BG;
                        }
                      }}
                      onMouseLeave={(e) => {
                        const isActive = location.pathname === item.path;
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {({ isActive }) => (
                        <>
                          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                            <item.icon
                              size={18}
                              style={{ color: isActive ? (item.path === '/' ? '#ffffff' : COLOR_PRIMARY) : (isDark ? '#94a3b8' : TEXT_MUTED) }}
                              className="transition-colors"
                            />
                            {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                          </div>
                          {item.badge && !sidebarCollapsed && (
                            <span
                              className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white shadow-xs"
                              style={{ backgroundColor: COLOR_BADGE }}
                            >
                              {item.badge}
                            </span>
                          )}
                          {item.badge && sidebarCollapsed && (
                            <span
                              className="absolute right-1 top-1 h-2 w-2 rounded-full"
                              style={{ backgroundColor: COLOR_BADGE }}
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  )}

                  {/* Sub-menu rendering */}
                  {isExpanded && !sidebarCollapsed && item.subItems && (
                    <div
                      className="mt-1 mb-2 ml-7 flex flex-col space-y-0.5 border-l"
                      style={{ borderColor: isDark ? '#26354a' : SIDEBAR_BORDER }}
                    >
                      {item.subItems.map((sub, idx) => {
                        const showCategoryHeader =
                          sub.category &&
                          (idx === 0 || item.subItems![idx - 1].category !== sub.category);

                        return (
                          <React.Fragment key={sub.name}>
                            {showCategoryHeader && (
                              <div className="px-3 pt-2.5 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase select-none">
                                {sub.category}
                              </div>
                            )}
                            <NavLink
                              key={sub.name}
                              to={sub.path}
                              onClick={() => setSidebarOpen(false)}
                              className="group flex items-center justify-between px-3 py-1.5 text-[13.5px] sm:text-[14px] font-medium transition-colors"
                              style={({ isActive }) => ({
                                color: isActive ? COLOR_PRIMARY : (isDark ? '#94a3b8' : TEXT_SECONDARY),
                                backgroundColor: isActive ? (isDark ? '#1a2c4e' : SIDEBAR_ACTIVE_BG) : 'transparent',
                                borderRadius: '0 6px 6px 0',
                                marginLeft: '-1px',
                                borderLeft: isActive ? `2px solid ${COLOR_PRIMARY}` : '2px solid transparent',
                              })}
                            >
                              {() => (
                                <>
                                  <span className="whitespace-nowrap">{sub.name}</span>
                                  {sub.badge && (
                                    <span
                                      className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow-2xs"
                                      style={{ backgroundColor: COLOR_BADGE }}
                                    >
                                      {sub.badge}
                                    </span>
                                  )}
                                </>
                              )}
                            </NavLink>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div style={{ borderTopColor: isDark ? '#26354a' : SIDEBAR_BORDER }} className="border-t p-3">
            <button
              className={`group flex w-full items-center rounded-xl py-2 px-2.5 border transition-colors ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between'
                }`}
              style={{ backgroundColor: isDark ? '#141f32' : '#ffffff', borderColor: isDark ? '#26354a' : SIDEBAR_BORDER }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : SIDEBAR_HOVER_BG}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDark ? '#141f32' : '#ffffff'}
              title={sidebarCollapsed ? (user?.store_name || 'Main Branch') : undefined}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: isDark ? '#1a2c4e' : '#EAF1FF', color: COLOR_PRIMARY }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
                </div>
                {!sidebarCollapsed && (
                  <div className="text-left leading-tight whitespace-nowrap overflow-hidden">
                    <div className="text-[13px] font-semibold" style={{ color: isDark ? '#f1f5f9' : TEXT_PRIMARY }}>
                      {user?.store_name || 'Main Branch'}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: isDark ? '#94a3b8' : TEXT_MUTED }}>
                      {user?.branch_id || 'SH'}
                    </div>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && <ChevronRight size={15} style={{ color: isDark ? '#94a3b8' : TEXT_MUTED }} className="group-hover:text-[#155EEF]" />}
            </button>
          </div>
        </aside>

        {/* ── Main area ── */}
        {(() => {
          const isFullBleedPage =
            location.pathname === '/contact' ||
            location.pathname === '/product' ||
            location.pathname === '/solutions' ||
            location.pathname === '/reports';

          return (
            <main className={`flex min-w-0 flex-1 flex-col overflow-hidden relative transition-colors duration-200 ${
              isDark ? 'bg-[#0f172a]' : 'bg-[#f0f6ff]'
            }`}>
              <div
                className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col transition-all duration-300 ${
                  aiOpen
                    ? 'w-full lg:w-[calc(100%-425px)] xl:w-[calc(100%-450px)] 2xl:w-[calc(100%-465px)]'
                    : 'w-full'
                }`}
              >
                <div
                  className={`flex-1 w-full ${
                    isFullBleedPage ? 'p-0' : 'p-4 sm:p-5 lg:p-6'
                  } transition-all duration-300`}
                >
                  <div className={isFullBleedPage ? 'w-full h-full' : 'w-full max-w-7xl 2xl:max-w-[1440px] mx-auto'}>
                    <Outlet />
                  </div>
                </div>

                {/* ── ATLAS Global Footer (Full-Width Light Blue Design across all pages) ── */}
                <AtlasGlobalFooter />
              </div>

              {/* Floating Fixed AI Assistant Panel when open */}
              {aiOpen && (
                <AIAssistantPanel
                  pageContext={getPageContext(location.pathname)}
                  isOpen={aiOpen}
                  onClose={() => setAiOpen(false)}
                />
              )}

              {/* Draggable Floating AI Assistant Launcher across all pages when panel is closed */}
              {!aiOpen && (
                <DraggableChatbotLauncher onOpen={() => setAiOpen(true)} />
              )}
            </main>
          );
        })()}
      </div>

      {/* Global Command Palette / Search Modal */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onAskAI={handleAskAI}
      />
    </div>
  );
};
