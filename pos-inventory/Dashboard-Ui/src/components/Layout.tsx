import {
    BarChart3,
    Bell,
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
    ChevronDown
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Point of Sale', path: '/pos', icon: ShoppingCart, soon: false },
  { name: 'Products', path: '/products', icon: Package, soon: false },
  { name: 'Sales & Invoices', path: '/sales', icon: FileText, soon: false },
  { name: 'Customers', path: '/customers', icon: Users, soon: false },
  { name: 'Returns & Approvals', path: '/returns', icon: RotateCcw, soon: false, badge: '5' },
  { name: 'Atlas Analytics', path: '/analytics', icon: BarChart3, soon: false },
  { 
    name: 'Reports', 
    path: '/reports', 
    icon: FileText, 
    soon: false,
    subItems: [
      { name: 'Sales Reports', path: '/reports/sales' },
      { name: 'Invoice Reports', path: '/reports/invoice' },
      { name: 'Payment Reports', path: '/reports/payment' },
      { name: 'Inventory Reports', path: '/reports/inventory' },
      { name: 'Customer Reports', path: '/reports/customer' },
      { name: 'AI Generated Reports', path: '/reports/ai' }
    ]
  },
  { name: 'Settings', path: '/settings', icon: Settings, soon: false },
];

export const Layout = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const [reportsExpanded, setReportsExpanded] = useState(location.pathname.startsWith('/reports'));

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen bg-[#071d34] text-slate-100 font-sans">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-sky-900/50 bg-[#061a2f] text-slate-300 transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-300 text-lg font-bold text-white shadow-lg shadow-blue-900/40">
              A
            </div>
            <div className="leading-tight">
              <div className="text-[20px] font-black tracking-[-0.04em] text-white">Atls</div>
              <div className="text-[10px] tracking-[0.05em] text-sky-200/70">POS & Inventory</div>
            </div>
          </div>

          <button className="text-slate-400 hover:text-white md:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-hide">
          {navItems.map((item) => {
            const isReports = item.name === 'Reports';
            const isActiveParent = isReports && location.pathname.startsWith('/reports');
            
            return (
              <div key={item.name}>
                {isReports ? (
                  <button
                    onClick={() => {
                      if (item.soon) return;
                      setReportsExpanded(!reportsExpanded);
                    }}
                    className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                      item.soon
                        ? 'cursor-not-allowed text-slate-500 opacity-70'
                        : isActiveParent
                          ? 'bg-[#0d52a1] text-white shadow-md shadow-blue-900/20'
                          : 'text-sky-100/70 hover:bg-[#0b2340] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={16} className={item.soon ? '' : 'group-hover:text-white text-sky-300/70 transition-colors duration-200'} />
                      <span>{item.name}</span>
                    </div>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${reportsExpanded ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <NavLink
                    to={item.soon ? '#' : item.path}
                    className={({ isActive }) =>
                      `group flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                        item.soon
                          ? 'cursor-not-allowed text-slate-500 opacity-70'
                          : isActive
                            ? 'bg-[#0d52a1] text-white shadow-md shadow-blue-900/20'
                            : 'text-sky-100/70 hover:bg-[#0b2340] hover:text-white'
                      }`
                    }
                    onClick={(e) => {
                      if (item.soon) e.preventDefault();
                      else setSidebarOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={16} className={item.soon ? '' : 'group-hover:text-white text-sky-300/70 transition-colors duration-200'} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                )}
                
                {/* Submenu for Reports */}
                {isReports && reportsExpanded && item.subItems && (
                  <div className="mt-1 flex flex-col space-y-1 pl-9 pr-2">
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.name}
                        to={sub.path}
                        className={({ isActive }) =>
                          `relative flex items-center rounded-lg px-3 py-2 text-[12px] font-medium transition-all ${
                            isActive
                              ? 'text-white'
                              : 'text-sky-200/60 hover:text-white'
                          }`
                        }
                        onClick={() => setSidebarOpen(false)}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <span className="absolute -left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]" />}
                            {sub.name}
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

        <div className="border-t border-sky-900/50 bg-[#061a2f] p-4">
          <button className="flex w-full items-center justify-between rounded-xl border border-sky-800/60 bg-[#0b2340] px-3 py-2.5 hover:bg-[#112847]">
            <div className="flex items-center gap-2">
              <span className="text-[16px]">🏛️</span>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[12px] font-semibold text-white">Main Branch</span>
                <span className="text-[10px] text-sky-200/60">WH-001</span>
              </div>
            </div>
            <span className="text-sky-300/70">›</span>
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#071d34]">
        <header className="flex h-[60px] items-center justify-between border-b border-sky-900/60 bg-[#071d34] px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              className="rounded-md p-1 text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
              onClick={toggleSidebar}
            >
              <Menu size={20} />
            </button>
            <div className="hidden items-center gap-2 text-[13px] text-sky-100/60 md:flex">
              <LayoutDashboard size={14} className="text-sky-300/80" />
              <span>›</span>
              <span className="text-sky-100 capitalize">{location.pathname.split('/')[1] || 'Dashboard'}</span>
              {location.pathname.split('/')[2] && (
                <>
                  <span>›</span>
                  <span className="text-sky-100 capitalize">{location.pathname.split('/')[2]}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="relative hidden w-full max-w-[420px] lg:block">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sky-300/60">
                <Search size={14} />
              </div>
              <input
                type="text"
                placeholder="Search products, customers, invoices, or ask AI..."
                className="block w-full rounded-lg border border-sky-800/60 bg-[#0b2340]/50 py-1.5 pl-9 pr-14 text-[13px] text-slate-100 placeholder:text-sky-100/40 focus:border-blue-500 focus:outline-none"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-sky-800/60 bg-[#071d34] px-1.5 py-0.5 text-[9px] font-medium text-sky-200/60">
                Ctrl + K
              </span>
            </div>

            <div className="hidden items-center gap-2 rounded-lg border border-sky-800/60 bg-[#0b2340]/40 px-3 py-1 md:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[12px] font-semibold text-emerald-400">SAP Connected</span>
                <span className="text-[9px] text-sky-200/50">Last sync: 2 min ago</span>
              </div>
            </div>

            <button className="relative rounded-full p-1.5 text-sky-100/70 hover:bg-slate-800 hover:text-white">
              <Bell size={18} />
              <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#071d34] bg-red-500 text-[8px] font-bold text-white">5</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-[13px] font-bold text-[#071d34]">
                {user?.name ? user.name.substring(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="hidden text-left sm:block leading-tight">
                <div className="text-[13px] font-semibold text-white">{user?.name || 'Admin User'}</div>
                <div className="text-[10px] text-sky-200/60 capitalize">{user?.role || 'Administrator'}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-5 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
