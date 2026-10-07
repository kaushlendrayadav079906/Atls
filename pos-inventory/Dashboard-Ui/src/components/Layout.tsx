import {
    BarChart3,
    Bell,
    ChevronDown,
    ChevronRight,
    FileText,
    LayoutDashboard,
    Menu,
    Package,
    RotateCcw,
    Search,
    Settings,
    ShoppingCart,
    Users,
    X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { name: 'Dashboard',          path: '/',          icon: LayoutDashboard },
  { name: 'Point of Sale',      path: '/pos',       icon: ShoppingCart },
  { name: 'Products',           path: '/products',  icon: Package },
  { 
    name: 'Sales & Invoices',   
    path: '/sales',     
    icon: FileText,
    subItems: [
      { name: 'Sales Orders', path: '/sales-orders' },
      { name: 'Invoices', path: '/sales' },
      { name: 'Purchase Orders', path: '/purchase-orders' }
    ]
  },
  { name: 'Customers',          path: '/customers', icon: Users },
  { name: 'Returns & Approvals',path: '/returns',   icon: RotateCcw, badge: '5' },
  { name: 'Atlas Analytics',    path: '/analytics', icon: BarChart3 },
  {
    name: 'Reports',
    path: '/reports',
    icon: FileText,
    subItems: [
      { name: 'Sales Reports',     path: '/reports/sales' },
      { name: 'Invoice Reports',   path: '/reports/invoice' },
      { name: 'Payment Reports',   path: '/reports/payment' },
      { name: 'Inventory Reports', path: '/reports/inventory' },
      { name: 'Customer Reports',  path: '/reports/customer' },
      { name: 'AI Generated Reports', path: '/reports/ai' },
    ],
  },
  { name: 'Settings', path: '/settings', icon: Settings },
];

// ── Sidebar colour tokens ──────────────────────────────────────────────────
const SIDEBAR_BG        = '#F7F9FC';   
const SIDEBAR_ACTIVE_BG = '#E8F0FF';   
const SIDEBAR_HOVER_BG  = '#F0F5FF';
const SIDEBAR_BORDER    = '#DCE4EF';   
const TEXT_PRIMARY      = '#14213D';
const TEXT_SECONDARY    = '#52627A';
const TEXT_MUTED        = '#7C8BA1';
const COLOR_PRIMARY     = '#155EEF';
const COLOR_BADGE       = '#EF3340';

export const Layout = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const [reportsExpanded, setReportsExpanded] = useState(
    location.pathname.startsWith('/reports')
  );
  const [salesExpanded, setSalesExpanded] = useState(
    location.pathname.startsWith('/sales')
  );
  const [sapConnected, setSapConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api/v1';
        const healthUrl = baseURL.replace('/api/v1', '/health');
        const res = await axios.get(healthUrl);
        if (res.data?.dependencies?.sap === 'connected') {
          setSapConnected(true);
        } else {
          setSapConnected(false);
        }
      } catch (err) {
        setSapConnected(false);
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        style={{ backgroundColor: SIDEBAR_BG, borderRightColor: SIDEBAR_BORDER }}
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r transition-all duration-300 md:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 ${sidebarCollapsed ? 'w-[72px]' : 'w-[220px]'}`}
      >
        {/* Logo */}
        <div className={`flex items-center py-5 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-5'}`}>
          <div className="flex items-center gap-3" title={sidebarCollapsed ? "Atls POS" : undefined}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: COLOR_PRIMARY }}>
              <span className="text-xl font-bold">A</span>
            </div>
            {!sidebarCollapsed && (
              <div className="leading-tight overflow-hidden">
                <div className="text-[19px] font-bold tracking-tight" style={{ color: TEXT_PRIMARY }}>Atls</div>
                <div className="text-[10px] font-semibold tracking-[0.1em] uppercase whitespace-nowrap" style={{ color: COLOR_PRIMARY }}>
                  POS &amp; INVENTORY
                </div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              className="rounded-md p-1 hover:bg-slate-200/50 md:hidden transition-colors"
              style={{ color: TEXT_MUTED }}
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Thin divider */}
        <div style={{ backgroundColor: SIDEBAR_BORDER }} className="mx-4 h-px" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {navItems.filter(item => {
            if (item.name === 'Atlas Analytics' || item.name === 'AI Assistant') {
              return false; // Based on strict requested nav structure
            }
            return true;
          }).map((item) => {
            const hasSubItems = !!item.subItems;
            const isActiveParent = hasSubItems && (item.name === 'Reports' ? location.pathname.startsWith('/reports') : location.pathname.startsWith('/sales'));
            const isExpanded = item.name === 'Reports' ? reportsExpanded : (item.name === 'Sales & Invoices' ? salesExpanded : false);

            return (
              <div key={item.name}>
                {hasSubItems ? (
                  /* Accordion trigger */
                  <button
                    onClick={() => {
                      if (sidebarCollapsed) setSidebarCollapsed(false);
                      if (item.name === 'Reports') setReportsExpanded(!reportsExpanded);
                      if (item.name === 'Sales & Invoices') setSalesExpanded(!salesExpanded);
                    }}
                    style={{
                      backgroundColor: isActiveParent ? SIDEBAR_ACTIVE_BG : undefined,
                      color: isActiveParent ? COLOR_PRIMARY : TEXT_SECONDARY,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActiveParent) e.currentTarget.style.backgroundColor = SIDEBAR_HOVER_BG;
                    }}
                    onMouseLeave={(e) => {
                      if (!isActiveParent) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title={sidebarCollapsed ? item.name : undefined}
                    className={`group relative flex w-full items-center rounded-lg py-[11px] text-[14px] font-medium transition-colors ${
                      sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                    }`}
                  >
                    {isActiveParent && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" style={{ backgroundColor: COLOR_PRIMARY }} />
                    )}
                    <div className="flex items-center gap-3">
                      <item.icon
                        size={19}
                        style={{ color: isActiveParent ? COLOR_PRIMARY : TEXT_MUTED }}
                        className="transition-colors group-hover:text-[#155EEF]"
                      />
                      {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <ChevronDown
                        size={15}
                        style={{ color: isActiveParent ? COLOR_PRIMARY : TEXT_MUTED }}
                        className={`transition-transform duration-200 group-hover:text-[#155EEF] ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>
                ) : (
                  /* Standard nav link */
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.name : undefined}
                    className={() =>
                      `group relative flex items-center rounded-lg py-[11px] text-[14px] font-medium transition-colors ${
                        sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                      }`
                    }
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? SIDEBAR_ACTIVE_BG : undefined,
                      color: isActive ? COLOR_PRIMARY : TEXT_SECONDARY,
                    })}
                    onMouseEnter={(e) => {
                      if (e.currentTarget.style.backgroundColor !== SIDEBAR_ACTIVE_BG) {
                        e.currentTarget.style.backgroundColor = SIDEBAR_HOVER_BG;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (e.currentTarget.style.backgroundColor === SIDEBAR_HOVER_BG) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active left bar */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" style={{ backgroundColor: COLOR_PRIMARY }} />
                        )}
                        <div className="flex items-center gap-3">
                          <item.icon
                            size={19}
                            style={{ color: isActive ? COLOR_PRIMARY : TEXT_MUTED }}
                            className="transition-colors group-hover:text-[#155EEF]"
                          />
                          {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                        </div>
                        {item.badge && !sidebarCollapsed && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white shadow-sm" style={{ backgroundColor: COLOR_BADGE }}>
                            {item.badge}
                          </span>
                        )}
                        {item.badge && sidebarCollapsed && (
                          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_BADGE }} />
                        )}
                      </>
                    )}
                  </NavLink>
                )}

                {/* Sub-menu rendering */}
                {isExpanded && !sidebarCollapsed && item.subItems && (
                  <div className="mt-1 mb-2 ml-7 flex flex-col space-y-0.5 border-l" style={{ borderColor: SIDEBAR_BORDER }}>
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.name}
                        to={sub.path}
                        onClick={() => setSidebarOpen(false)}
                        className={() =>
                          `group flex items-center gap-2.5 px-4 py-2 text-[13.5px] font-medium transition-colors`
                        }
                        style={({ isActive }) => ({
                          color: isActive ? COLOR_PRIMARY : TEXT_SECONDARY,
                          backgroundColor: isActive ? SIDEBAR_ACTIVE_BG : 'transparent',
                          borderRadius: '0 8px 8px 0',
                          marginLeft: '-1px', // Overlay on border slightly if active, but usually just pad it
                          borderLeft: isActive ? `2px solid ${COLOR_PRIMARY}` : '2px solid transparent'
                        })}
                        onMouseEnter={(e) => {
                          if (e.currentTarget.style.backgroundColor !== SIDEBAR_ACTIVE_BG) {
                            e.currentTarget.style.backgroundColor = SIDEBAR_HOVER_BG;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (e.currentTarget.style.backgroundColor === SIDEBAR_HOVER_BG) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        {() => (
                          <>
                            <span className="whitespace-nowrap">{sub.name}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div style={{ borderTopColor: SIDEBAR_BORDER }} className="border-t p-4">
          <button
            className={`group flex w-full items-center rounded-xl py-2 px-3 border transition-colors ${
              sidebarCollapsed ? 'justify-center px-0' : 'justify-between'
            }`}
            style={{ backgroundColor: '#ffffff', borderColor: SIDEBAR_BORDER }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = SIDEBAR_HOVER_BG}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            title={sidebarCollapsed ? (user?.store_name || 'Main Branch') : undefined}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#EAF1FF', color: COLOR_PRIMARY }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
              </div>
              {!sidebarCollapsed && (
                <div className="text-left leading-tight whitespace-nowrap overflow-hidden">
                  <div className="text-[14px] font-semibold" style={{ color: TEXT_PRIMARY }}>
                    {user?.store_name || 'Main Branch'}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: TEXT_MUTED }}>
                    {user?.branch_id || 'WH-001'}
                  </div>
                </div>
              )}
            </div>
            {!sidebarCollapsed && <ChevronRight size={16} style={{ color: TEXT_MUTED }} className="group-hover:text-[#155EEF]" />}
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
        {/* Top header */}
        <header className="flex h-[60px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:hidden"
              onClick={toggleSidebar}
            >
              <Menu size={20} />
            </button>
            <button
              className="hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:block transition-colors mr-2"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <Menu size={20} />
            </button>
            <div className="hidden items-center gap-1.5 text-sm text-slate-400 md:flex">
              <span className="font-semibold text-slate-700 capitalize">
                {location.pathname.split('/')[1] || 'Dashboard'}
              </span>
              {location.pathname.split('/')[2] && (
                <>
                  <ChevronRight size={14} className="opacity-70" />
                  <span className="font-semibold text-slate-700 capitalize">
                    {location.pathname.split('/')[2]}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            {/* Search */}
            <div className="relative hidden w-full max-w-[400px] lg:block">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={14} />
              </div>
              <input
                type="text"
                placeholder="Search products, customers, invoices, or ask AI..."
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-14 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                Ctrl + K
              </span>
            </div>

            {/* SAP status */}
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
              <span className={`h-2 w-2 rounded-full ${sapConnected === false ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'}`} />
              <div className="text-left leading-tight">
                <div className="text-[11px] font-semibold text-slate-800">
                  {sapConnected === null ? 'Checking SAP...' : sapConnected ? 'SAP Connected' : 'SAP Disconnected'}
                </div>
                <div className="text-[9px] text-slate-500">
                  {sapConnected ? 'Live connection' : 'Offline'}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <button className="relative rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
              <Bell size={18} />
              <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-white bg-blue-600 text-[8px] font-bold text-white">
                5
              </span>
            </button>

            {/* User */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[12px] font-bold text-white">
                {user?.name ? user.name.substring(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="hidden text-left sm:block leading-tight">
                <div className="text-[13px] font-semibold text-slate-800">
                  {user?.name || 'Admin User'}
                </div>
                <div className="text-[10px] text-slate-500 capitalize">
                  {user?.role || 'Administrator'}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-5 lg:p-6 page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
