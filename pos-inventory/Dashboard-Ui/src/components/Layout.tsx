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
  Factory,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Landmark,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { GlobalSearchModal } from './GlobalSearchModal';
import { AIAssistantPanel, type AIAssistantContext } from './AIAssistantPanel';
import atlasLogo from '../assets/LOGO.png';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Point of Sale', path: '/pos', icon: ShoppingCart },
  { name: 'Products', path: '/products', icon: Package },
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
  { name: 'Customers', path: '/customers', icon: Users },
  { name: 'Returns & Approvals', path: '/returns', icon: RotateCcw, badge: '5' },
  {
    name: 'Production',
    path: '/production',
    icon: Factory,
    subItems: [
      { name: 'Overview', path: '/production' },
      { name: 'Production Orders', path: '/production/orders' },
      { name: 'Item-wise Production', path: '/production/item-wise' },
      { name: 'Production Rejection', path: '/production/rejection' },
      { name: 'Date-wise Production', path: '/production/date-wise' },
      { name: 'Reports', path: '/production/reports' },
    ]
  },
  {
    name: 'Financial',
    path: '/finance',
    icon: Landmark,
    subItems: [
      { name: 'Finance Overview', path: '/finance' },
      { name: 'Purchase Invoices', path: '/finance/purchase-invoices' },
      { name: 'Incoming Payments', path: '/finance/incoming-payments' },
      { name: 'Outgoing Payments', path: '/finance/outgoing-payments' },
      { name: 'Customer Analysis', path: '/finance/customer-analysis' },
      { name: 'Supplier Analysis', path: '/finance/supplier-analysis' },
      { name: 'Profitability Reports', path: '/finance/profitability-reports' },
    ]
  },
  { name: 'Atlas Analytics', path: '/analytics', icon: BarChart3 },
  {
    name: 'Reports',
    path: '/reports',
    icon: FileText,
    subItems: [
      { name: 'Sales Reports', path: '/reports/sales' },
      { name: 'Invoice Reports', path: '/reports/invoice' },
      { name: 'Payment Reports', path: '/reports/payment' },
      { name: 'Inventory Reports', path: '/reports/inventory' },
      { name: 'Customer Reports', path: '/reports/customer' },
      { name: 'AI Generated Reports', path: '/reports/ai' },
    ],
  },
  { name: 'Settings', path: '/settings', icon: Settings },
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
  const [productionExpanded, setProductionExpanded] = useState(
    location.pathname.startsWith('/production')
  );
  const [financeExpanded, setFinanceExpanded] = useState(
    location.pathname.startsWith('/finance')
  );

  const { isSapConnected } = useSystemHealth();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.open !== undefined) {
        setAiOpen(e.detail.open);
      } else {
        setAiOpen(prev => !prev);
      }
    };
    window.addEventListener('atls-toggle-ai', handler);
    return () => window.removeEventListener('atls-toggle-ai', handler);
  }, []);

  const getPageContext = (pathname: string): AIAssistantContext => {
    if (pathname === '/products') return 'products';
    if (pathname === '/customers') return 'customers';
    if (pathname === '/pos') return 'pos';
    if (pathname === '/sales-orders') return 'sales_orders';
    if (pathname === '/purchase-orders') return 'purchase_orders';
    if (pathname === '/sales' || pathname.startsWith('/sales/')) return 'invoices';
    if (pathname === '/returns') return 'returns';
    if (pathname === '/analytics') return 'analytics';
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
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* ── Full-Width Fixed Top Navbar (Spanning all the way across left & right) ── */}
      <header className="sticky top-0 z-30 flex h-[60px] w-full items-center justify-between border-b border-slate-200/90 bg-white px-4 sm:px-6 shrink-0 shadow-xs">
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

        {/* Right side: SAP Status, Notifications & User Avatar */}
        <div className="flex items-center gap-3.5">
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

          {/* Notifications */}
          <button className="relative rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer">
            <Bell size={17} />
            <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-white bg-red-500 text-[8px] font-bold text-white">
              5
            </span>
          </button>

          {/* User Profile - Icon Only with Cursor Hover Tooltip */}
          <div className="relative group pl-1.5 border-l border-slate-200">
            <div
              className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-[11.5px] font-bold text-white shadow-2xs cursor-pointer transition-all duration-150 ring-2 ring-transparent group-hover:ring-blue-100"
              title={`${user?.name || 'kaushlendra kamlesh kumar yadav'} (${user?.role || 'User'})`}
            >
              {user?.name ? user.name.split(' ').filter(Boolean).map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : 'KK'}
            </div>

            {/* Hover Tooltip displaying user login name */}
            <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col items-start rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-xl z-50 min-w-[210px] whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
              <div className="text-[12px] font-bold text-slate-800 leading-tight">
                {user?.name || 'kaushlendra kamlesh kumar yadav'}
              </div>
              <div className="text-[10px] font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="capitalize">{user?.role || 'User'}</span>
                {user?.branch_id && <span className="text-slate-400">• {user.branch_id}</span>}
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
          style={{ backgroundColor: SIDEBAR_BG, borderRightColor: SIDEBAR_BORDER }}
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
                  className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-10 text-[11px] text-slate-700 placeholder:text-slate-400 group-hover:border-blue-400 focus:outline-none transition shadow-2xs"
                />
                <span className="pointer-events-none absolute right-1.5 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[8.5px] font-semibold text-slate-500 shadow-3xs group-hover:border-blue-300">
                  ⌘ K
                </span>
              </div>
            </div>
          )}

          {/* Thin divider */}
          <div style={{ backgroundColor: SIDEBAR_BORDER }} className="mx-4 h-px" />

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {navItems.filter(item => {
              if (item.name === 'Atlas Analytics' || item.name === 'AI Assistant') {
                return false; // Based on strict requested nav structure
              }
              return true;
            }).map((item) => {
              const hasSubItems = !!item.subItems;
              const isActiveParent = hasSubItems && (
                (item.name === 'Reports' && location.pathname.startsWith('/reports')) ||
                (item.name === 'Sales & Invoices' && location.pathname.startsWith('/sales')) ||
                (item.name === 'Production' && location.pathname.startsWith('/production')) ||
                (item.name === 'Financial' && location.pathname.startsWith('/finance'))
              );
              const isExpanded = item.name === 'Reports' ? reportsExpanded :
                (item.name === 'Sales & Invoices' ? salesExpanded :
                  (item.name === 'Production' ? productionExpanded :
                    (item.name === 'Financial' ? financeExpanded : false)));

              return (
                <div key={item.name}>
                  {hasSubItems ? (
                    /* Accordion trigger */
                    <button
                      onClick={() => {
                        if (sidebarCollapsed) setSidebarCollapsed(false);
                        if (item.name === 'Reports') setReportsExpanded(!reportsExpanded);
                        if (item.name === 'Sales & Invoices') setSalesExpanded(!salesExpanded);
                        if (item.name === 'Production') setProductionExpanded(!productionExpanded);
                        if (item.name === 'Financial') setFinanceExpanded(!financeExpanded);
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
                      className={`group relative flex w-full items-center rounded-lg py-[9px] text-[13.5px] font-medium transition-colors ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                        }`}
                    >
                      {isActiveParent && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" style={{ backgroundColor: COLOR_PRIMARY }} />
                      )}
                      <div className="flex items-center gap-2.5">
                        <item.icon
                          size={17}
                          style={{ color: isActiveParent ? COLOR_PRIMARY : TEXT_MUTED }}
                          className="transition-colors group-hover:text-[#155EEF]"
                        />
                        {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                      </div>
                      {!sidebarCollapsed && (
                        <ChevronDown
                          size={14}
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
                        `group relative flex items-center rounded-lg py-[9px] text-[13.5px] font-medium transition-colors ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                        }`
                      }
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? (item.path === '/' ? '#155EEF' : SIDEBAR_ACTIVE_BG) : undefined,
                        color: isActive ? (item.path === '/' ? '#ffffff' : COLOR_PRIMARY) : TEXT_SECONDARY,
                      })}
                      onMouseEnter={(e) => {
                        const isActive = location.pathname === item.path;
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = SIDEBAR_HOVER_BG;
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
                          <div className="flex items-center gap-2.5">
                            <item.icon
                              size={17}
                              style={{ color: isActive ? (item.path === '/' ? '#ffffff' : COLOR_PRIMARY) : TEXT_MUTED }}
                              className="transition-colors"
                            />
                            {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                          </div>
                          {item.badge && !sidebarCollapsed && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white shadow-xs" style={{ backgroundColor: COLOR_BADGE }}>
                              {item.badge}
                            </span>
                          )}
                          {item.badge && sidebarCollapsed && (
                            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_BADGE }} />
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
                            `group flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-medium transition-colors`
                          }
                          style={({ isActive }) => ({
                            color: isActive ? COLOR_PRIMARY : TEXT_SECONDARY,
                            backgroundColor: isActive ? SIDEBAR_ACTIVE_BG : 'transparent',
                            borderRadius: '0 6px 6px 0',
                            marginLeft: '-1px',
                            borderLeft: isActive ? `2px solid ${COLOR_PRIMARY}` : '2px solid transparent'
                          })}
                        >
                          {() => (
                            <span className="whitespace-nowrap">{sub.name}</span>
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
              className={`group flex w-full items-center rounded-xl py-2 px-2.5 border transition-colors ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between'
                }`}
              style={{ backgroundColor: '#ffffff', borderColor: SIDEBAR_BORDER }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = SIDEBAR_HOVER_BG}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              title={sidebarCollapsed ? (user?.store_name || 'Main Branch') : undefined}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#EAF1FF', color: COLOR_PRIMARY }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
                </div>
                {!sidebarCollapsed && (
                  <div className="text-left leading-tight whitespace-nowrap overflow-hidden">
                    <div className="text-[13px] font-semibold" style={{ color: TEXT_PRIMARY }}>
                      {user?.store_name || 'Main Branch'}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: TEXT_MUTED }}>
                      {user?.branch_id || 'SH'}
                    </div>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && <ChevronRight size={15} style={{ color: TEXT_MUTED }} className="group-hover:text-[#155EEF]" />}
            </button>
          </div>
        </aside>

        {/* ── Main area ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 relative">
          {location.pathname !== '/' && location.pathname !== '/finance' && location.pathname !== '/finance/' ? (
            <div className="flex-1 overflow-auto w-full p-4 sm:p-5 flex flex-col lg:flex-row gap-6 items-start transition-all duration-300">
              <div className="flex-1 min-w-0 w-full">
                <Outlet />
              </div>

              <AIAssistantPanel
                key={location.pathname}
                pageContext={getPageContext(location.pathname)}
                pageFilters={{ pathname: location.pathname }}
                isOpen={aiOpen}
                onClose={() => setAiOpen(false)}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4 sm:p-5 w-full">
              <Outlet />
            </div>
          )}

          {/* Floating AI Button across all non-dashboard / non-finance pages when assistant panel is closed */}
          {location.pathname !== '/' && location.pathname !== '/finance' && location.pathname !== '/finance/' && !aiOpen && (
            <button
              onClick={() => setAiOpen(true)}

              className="fixed right-5 bottom-6 z-40 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_4px_20px_rgba(99,102,241,0.35)] transition-all cursor-pointer hover:shadow-[0_6px_25px_rgba(99,102,241,0.5)] hover:scale-[1.02] active:scale-[0.98]"
              title="Open ATLAS AI Assistant"
            >
              <Sparkles size={16} />
              <span>Open ATLAS AI Assistant</span>
            </button>
          )}
        </main>
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
