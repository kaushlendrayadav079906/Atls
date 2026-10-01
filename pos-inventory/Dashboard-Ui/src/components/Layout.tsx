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
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { name: 'Dashboard',          path: '/',          icon: LayoutDashboard },
  { name: 'Point of Sale',      path: '/pos',       icon: ShoppingCart },
  { name: 'Products',           path: '/products',  icon: Package },
  { name: 'Sales & Invoices',   path: '/sales',     icon: FileText },
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
      { name: 'AI Generated',      path: '/reports/ai' },
    ],
  },
  { name: 'Settings', path: '/settings', icon: Settings },
];

// ── Sidebar colour tokens ──────────────────────────────────────────────────
const SIDEBAR_BG        = '#f8fafc';   // light gray (slate-50)
const SIDEBAR_HOVER_BG  = '#f1f5f9';   // slightly darker on hover (slate-100)
const SIDEBAR_ACTIVE_BG = '#e2e8f0';   // active row tint (slate-200)
const SIDEBAR_BORDER    = '#e2e8f0';   // subtle divider (slate-200)

export const Layout = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const [reportsExpanded, setReportsExpanded] = useState(
    location.pathname.startsWith('/reports')
  );

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
        <div className={`flex items-center py-5 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          <div className="flex items-center gap-3" title={sidebarCollapsed ? "Atls POS" : undefined}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-base font-black text-white shadow-lg">
              A
            </div>
            {!sidebarCollapsed && (
              <div className="leading-tight overflow-hidden">
                <div className="text-[17px] font-extrabold tracking-tight text-slate-800">Atls</div>
                <div className="text-[10px] font-medium tracking-widest text-slate-500 uppercase whitespace-nowrap">
                  POS &amp; Inventory
                </div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              className="rounded-md p-1 text-slate-500 hover:text-slate-800 md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Thin divider */}
        <div style={{ backgroundColor: SIDEBAR_BORDER }} className="mx-4 h-px" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isReports     = item.name === 'Reports';
            const isActiveParent = isReports && location.pathname.startsWith('/reports');

            return (
              <div key={item.name}>
                {isReports ? (
                  /* Reports accordion trigger */
                  <button
                    onClick={() => {
                      if (sidebarCollapsed) setSidebarCollapsed(false);
                      setReportsExpanded(!reportsExpanded);
                    }}
                    style={{
                      backgroundColor: isActiveParent ? SIDEBAR_ACTIVE_BG : undefined,
                    }}
                    title={sidebarCollapsed ? item.name : undefined}
                    className={`group flex w-full items-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                      sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                    } ${
                      isActiveParent
                        ? 'text-blue-700 bg-slate-200/50'
                        : 'text-slate-600 hover:text-blue-700 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        size={16}
                        className={isActiveParent ? 'text-blue-600' : 'text-slate-500 group-hover:text-blue-700'}
                      />
                      {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <ChevronDown
                        size={13}
                        className={`transition-transform duration-200 group-hover:text-blue-700 ${
                          isActiveParent ? 'text-blue-600' : 'text-slate-500'
                        } ${reportsExpanded ? 'rotate-180' : ''}`}
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
                    className={({ isActive }) =>
                      `group relative flex items-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                        sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                      } ${isActive ? 'text-blue-700 bg-slate-200/50' : 'text-slate-600 hover:text-blue-700 hover:bg-white'}`
                    }
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? SIDEBAR_ACTIVE_BG : undefined,
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active left bar */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-600" />
                        )}
                        <div className="flex items-center gap-3">
                          <item.icon
                            size={16}
                            className={
                              isActive
                                ? 'text-blue-600'
                                : 'text-slate-500 group-hover:text-blue-700 transition-colors'
                            }
                          />
                          {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                        </div>
                        {item.badge && !sidebarCollapsed && (
                          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {item.badge}
                          </span>
                        )}
                        {item.badge && sidebarCollapsed && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </>
                    )}
                  </NavLink>
                )}

                {/* Reports sub-menu */}
                {isReports && reportsExpanded && !sidebarCollapsed && item.subItems && (
                  <div className="mt-1 ml-6 flex flex-col space-y-0.5 border-l-2 border-slate-700/10 pl-3 pr-1">
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.name}
                        to={sub.path}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors ${
                            isActive
                              ? 'text-blue-700 bg-slate-200/50'
                              : 'text-slate-600 hover:text-blue-700 hover:bg-white'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <ChevronRight size={11} className={isActive ? 'text-blue-700' : 'text-slate-400 group-hover:text-blue-700'} />
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

        <div style={{ borderTopColor: SIDEBAR_BORDER }} className="border-t p-3">
          <button
            className={`group flex w-full items-center rounded-xl py-2.5 transition-colors hover:bg-white hover:shadow-sm ${
              sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
            }`}
            title={sidebarCollapsed ? (user?.store_name || 'Main Branch') : undefined}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/80 text-sm group-hover:bg-slate-100">
                🏛️
              </div>
              {!sidebarCollapsed && (
                <div className="text-left leading-tight whitespace-nowrap overflow-hidden">
                  <div className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-800">
                    {user?.store_name || 'Main Branch'}
                  </div>
                  <div className="text-[10px] text-slate-500 group-hover:text-blue-700">
                    {user?.branch_id || 'WH-001'}
                  </div>
                </div>
              )}
            </div>
            {!sidebarCollapsed && <ChevronRight size={14} className="text-slate-400 group-hover:text-blue-700" />}
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
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              <div className="text-left leading-tight">
                <div className="text-[11px] font-semibold text-slate-800">SAP Connected</div>
                <div className="text-[9px] text-slate-500">Last sync: 2 min ago</div>
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
