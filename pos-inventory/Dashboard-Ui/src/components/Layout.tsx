import {
    BarChart3,
    Bell,
    FileText,
    LayoutDashboard,
    LogOut,
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
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'POS & Checkout', path: '/pos', icon: ShoppingCart, soon: false },
  { name: 'Products & Stock', path: '/products', icon: Package, soon: false },
  { name: 'Sales & Invoices', path: '/sales', icon: FileText, soon: false },
  { name: 'Customers', path: '/customers', icon: Users, soon: false },
  { name: 'Returns & Approvals', path: '/returns', icon: RotateCcw, soon: false },
  { name: 'Atlas Analytics', path: '/analytics', icon: BarChart3, soon: false },
  { name: 'Reports', path: '/reports', icon: FileText, soon: false },
  { name: 'Settings', path: '/settings', icon: Settings, soon: false },
];

export const Layout = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const DEV_PREVIEW = import.meta.env.DEV;
  const isDevPreview = DEV_PREVIEW && !user;
  const displayUser = user || (isDevPreview ? { name: 'Demo User (Mock)', role: 'admin', store_name: 'Main Branch (DEV)' } : null);

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
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-sky-900/80 bg-[#061a2f] text-slate-300 transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-300 text-lg font-bold text-white shadow-lg shadow-blue-900/40">
              A
            </div>
            <div>
              <div className="text-[22px] font-black tracking-[-0.06em] text-white">Atls</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-sky-300/80">POS Inventory</div>
            </div>
          </div>

          <button className="text-slate-400 hover:text-white md:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.soon ? '#' : item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  item.soon
                    ? 'cursor-not-allowed text-slate-500 opacity-70'
                    : isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
              onClick={(e) => {
                if (item.soon) e.preventDefault();
                else setSidebarOpen(false);
              }}
            >
              <item.icon size={18} className={item.soon ? '' : 'group-hover:scale-110 transition-transform duration-200'} />
              <span className="flex-1">{item.name}</span>
              {item.soon && (
                <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-400">
                  Soon
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sky-900/80 bg-[#061a2f] p-4">
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-sky-900/80 bg-[#0d2341] p-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-700 bg-sky-900/60 text-sm font-bold text-white">
              {displayUser?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{displayUser?.name || 'Unknown User'}</div>
              <div className="truncate text-xs capitalize text-slate-400">{displayUser?.role || 'Guest'}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
          >
            <LogOut size={16} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#071d34]">
        {isDevPreview && (
          <div className="flex items-center justify-center bg-amber-500 px-4 py-1.5 text-center text-xs font-bold tracking-wide text-white">
            <span>⚠️ DEV PREVIEW — NOT AUTHENTICATED</span>
          </div>
        )}

        <header className="sticky top-0 z-10 flex h-18 items-center justify-between border-b border-sky-900/80 bg-[#071d34] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-1 text-slate-300 hover:bg-slate-800 hover:text-white md:hidden"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <Menu size={22} />
            </button>

            <div className="hidden items-center gap-2 text-slate-300 md:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-900/70 text-sky-100">
                <LayoutDashboard size={14} />
              </div>
              <span className="text-sm text-slate-300">Dashboard</span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="relative hidden w-full max-w-[560px] sm:block">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Search products, customers, invoices... or ask AI..."
                className="block w-full rounded-xl border border-sky-800 bg-[#0e2a46] py-2 pl-9 pr-20 text-sm text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-sky-700 bg-sky-900/60 px-2 py-1 text-[10px] font-medium text-sky-200">
                Ctrl + K
              </span>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-sky-800 bg-[#0b2340] px-3 py-1.5 text-sm font-medium text-sky-100 md:flex">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              <span>SAP Connected</span>
            </div>

            <button className="relative rounded-full p-2 text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Notifications">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#071d34] bg-red-500" />
            </button>

            <div className="flex items-center gap-3 rounded-full border border-sky-800 bg-[#0b2340] px-2 py-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-bold text-white">
                {displayUser?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-medium text-white">{displayUser?.name || 'Admin User'}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-sky-200/80">{displayUser?.role || 'Administrator'}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
