import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  ClipboardList,
  FileText,
  Truck,
  Users,
  RotateCcw,
  ArrowRight,
  Sparkles,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import atlasLogo from '../assets/LOGO.png';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { useTheme } from '../contexts/ThemeContext';

interface ProductModule {
  id: string;
  title: string;
  path: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  tags: string[];
  actionText: string;
}

const PRODUCT_MODULES: ProductModule[] = [
  {
    id: 'products-stock',
    title: 'Products & Stock',
    path: '/products',
    icon: Package,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    description: 'Manage master product catalog, monitor branch stock levels in real time, configure barcode data, and track low-stock items.',
    tags: ['Catalog', 'Branch Stock', 'Low-Stock Alerts'],
    actionText: 'Open Products & Stock',
  },
  {
    id: 'pos',
    title: 'Point of Sale (POS)',
    path: '/pos',
    icon: ShoppingCart,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    description: 'Fast retail terminal with barcode scanning, instant checkout, cash/card split payments, customer selection, and receipt printing.',
    tags: ['Quick Checkout', 'Barcode Scanner', 'Receipt Printing'],
    actionText: 'Launch POS Terminal',
  },
  {
    id: 'sales-orders',
    title: 'Sales Orders',
    path: '/sales-orders',
    icon: ClipboardList,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    description: 'Track customer sales orders synced from SAP Business One, monitor delivery schedules, open order quantities, and fulfillment status.',
    tags: ['SAP Sync', 'Fulfillment Tracking', 'Open Quantities'],
    actionText: 'View Sales Orders',
  },
  {
    id: 'sales-invoices',
    title: 'Sales Invoices',
    path: '/sales',
    icon: FileText,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    description: 'Comprehensive invoice register, view customer billing history, tax breakdowns, payment modes, and download PDF tax invoices.',
    tags: ['Invoice Register', 'Tax & GST', 'PDF Exports'],
    actionText: 'View Sales Invoices',
  },
  {
    id: 'purchase-orders',
    title: 'Purchase Orders',
    path: '/purchase-orders',
    icon: Truck,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    description: 'Manage procurement from vendors, track inbound shipment dates, monitor open supplier quantities, and verify receiving status.',
    tags: ['Vendor Procurement', 'Open Lines', 'Receiving Logs'],
    actionText: 'View Purchase Orders',
  },
  {
    id: 'customers',
    title: 'Customers',
    path: '/customers',
    icon: Users,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
    description: 'Maintain customer profiles, credit limits, phone contacts, billing addresses, and view customer purchase transaction histories.',
    tags: ['Customer Directory', 'Credit Limits', 'Ledger History'],
    actionText: 'Manage Customers',
  },
  {
    id: 'returns-approvals',
    title: 'Returns & Approvals',
    path: '/returns',
    icon: RotateCcw,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    badge: '5 Pending',
    badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
    description: 'Authorize or reject customer return requests, issue credit notes, log damaged item inspections, and sync stock adjustments with SAP.',
    tags: ['Credit Notes', 'Workflow Approval', 'Inspection Logs'],
    actionText: 'Review Returns',
  },
];

export const ProductLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSapConnected } = useSystemHealth();
  const { isDark } = useTheme();

  return (
    <div className={`w-full min-h-screen flex flex-col transition-all duration-300 ${isDark ? 'bg-[#0f172a] text-white' : 'bg-[#f0f6ff] text-slate-900'
      }`}>
      {/* ── Section A: Hero (Full-width edge-to-edge, Adaptive Gradient) ── */}
      <section className={`relative w-full overflow-hidden border-b px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 py-12 sm:py-16 shadow-xs ${isDark
          ? 'border-slate-700 bg-gradient-to-br from-[#1e293b] via-[#141f32] to-[#1e3456]'
          : 'border-blue-200/90 bg-gradient-to-br from-blue-100 via-sky-50 to-indigo-100/70'
        }`}>
        {/* Ambient subtle glowing shapes */}
        <div className={`pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full blur-3xl ${isDark ? 'bg-blue-600/15' : 'bg-blue-300/30'
          }`} />
        <div className={`pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full blur-3xl ${isDark ? 'bg-sky-600/15' : 'bg-sky-300/30'
          }`} />

        <div className="relative z-10 max-w-5xl space-y-6">
          {/* Logo & Section Badge */}
          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl backdrop-blur-md border shadow-xs ${isDark ? 'bg-[#1e293b]/90 border-slate-700' : 'bg-white/95 border-blue-200'
            }`}>
            <img
              src={atlasLogo}
              alt="ATLAS Logo"
              className="h-9 w-9 object-contain drop-shadow-xs"
            />
            <div className="flex items-center gap-2">
              <span className={`text-base font-black tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>ATLAS</span>
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>• Product & Operations Hub</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className={`atlas-page-title text-3xl sm:text-4xl lg:text-[42px] font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Product & Operations <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400">Hub</span>
          </h1>

          {/* Description */}
          <p className={`atlas-body text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Centralized operations for product inventory, point-of-sale checkout, customer orders, tax invoicing, procurement, customer CRM, and return workflows.
          </p>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => navigate('/pos')}
              className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13.5px] sm:text-[14px] font-bold shadow-sm transition-all duration-150 cursor-pointer hover:shadow-md"
            >
              <ShoppingCart size={16} />
              <span>Open POS Terminal</span>
            </button>

            <button
              onClick={() => navigate('/products')}
              className={`inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-[13.5px] sm:text-[14px] font-bold border shadow-xs transition-all duration-150 cursor-pointer ${isDark
                  ? 'bg-[#1e293b] hover:bg-slate-800 text-blue-300 border-slate-700'
                  : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300'
                }`}
            >
              <Package size={16} />
              <span>Manage Products & Stock</span>
            </button>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('atls-toggle-ai', { detail: { open: true } }))}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] sm:text-[14px] font-bold border shadow-xs transition-all duration-150 cursor-pointer ${isDark
                  ? 'bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border-indigo-800'
                  : 'bg-white/90 hover:bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}
            >
              <Sparkles size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
              <span>Ask ATLAS AI</span>
            </button>
          </div>

          {/* Verified System Status Pills */}
          <div className={`pt-3 flex flex-wrap items-center gap-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-2xs ${isDark ? 'bg-[#1e293b]/90 border-slate-700' : 'bg-white/90 border-blue-200/90'
              }`}>
              <span className={`h-2 w-2 rounded-full ${isSapConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-semibold text-[12px]">{isSapConnected ? 'SAP Business One Live Connected' : 'SAP Offline'}</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-2xs ${isDark ? 'bg-[#1e293b]/90 border-slate-700' : 'bg-white/90 border-blue-200/90'
              }`}>
              <Layers size={13} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
              <span className="font-semibold text-[12px]">7 Operational Modules Active</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-2xs ${isDark ? 'bg-[#1e293b]/90 border-slate-700' : 'bg-white/90 border-blue-200/90'
              }`}>
              <ShieldCheck size={13} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
              <span className="font-medium text-[12px]">Real-Time Inventory Synchronization</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section B: Main Content (Full-width, Adaptive Background) ── */}
      <section className={`w-full py-10 sm:py-14 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 space-y-8 ${isDark ? 'bg-[#0f172a]' : 'bg-[#f0f6ff]'
        }`}>
        {/* Quick Summary Highlights Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div
            onClick={() => navigate('/products')}
            className={`p-5 rounded-2xl border shadow-xs transition cursor-pointer group ${isDark
                ? 'bg-[#1e293b] border-slate-700 hover:border-blue-500/60'
                : 'bg-white border-blue-100/90 hover:border-blue-400 hover:shadow-md'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[13px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Products & Catalog</span>
              <Package size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className={`mt-2.5 text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Live Inventory</div>
            <p className={`text-[12.5px] mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Real-time SAP sync</p>
          </div>


          <div
            onClick={() => navigate('/sales-orders')}
            className={`p-5 rounded-2xl border shadow-xs transition cursor-pointer group ${isDark
                ? 'bg-[#1e293b] border-slate-700 hover:border-indigo-500/60'
                : 'bg-white border-blue-100/90 hover:border-indigo-400 hover:shadow-md'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[13px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sales Orders</span>
              <ClipboardList size={18} className="text-indigo-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className={`mt-2.5 text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Order Lines</div>
            <p className={`text-[12.5px] mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fulfillment & deliveries</p>
          </div>

          <div
            onClick={() => navigate('/sales')}
            className={`p-5 rounded-2xl border shadow-xs transition cursor-pointer group ${isDark
                ? 'bg-[#1e293b] border-slate-700 hover:border-purple-500/60'
                : 'bg-white border-blue-100/90 hover:border-purple-400 hover:shadow-md'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[13px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Invoices</span>
              <FileText size={18} className="text-purple-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className={`mt-2.5 text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Tax Invoices</div>
            <p className={`text-[12.5px] mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Payments & billing</p>
          </div>

          <div
            onClick={() => navigate('/returns')}
            className={`p-5 rounded-2xl border shadow-xs transition cursor-pointer group ${isDark
                ? 'bg-[#1e293b] border-slate-700 hover:border-rose-500/60'
                : 'bg-white border-blue-100/90 hover:border-rose-400 hover:shadow-md'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[13px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Returns Pending</span>
              <RotateCcw size={18} className="text-rose-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2.5 text-xl font-black text-rose-500">5 Approvals</div>
            <p className={`text-[12.5px] mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Requires supervisor review</p>
          </div>
        </div>

        {/* Product Modules Grid */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`atlas-section-title text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Product & Operations Modules
              </h2>
              <p className={`text-[14px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Direct access to core inventory and commercial pipelines
              </p>
            </div>
            <span className={`text-[13px] px-3 py-1 rounded-full font-bold ${isDark ? 'bg-blue-950/70 text-blue-300 border border-blue-800' : 'text-blue-700 bg-blue-100/80'
              }`}>
              7 Modules Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRODUCT_MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.id}
                  onClick={() => navigate(module.path)}
                  className={`rounded-2xl border p-6 shadow-xs hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group ${isDark
                      ? 'bg-[#1e293b] border-slate-700 hover:border-blue-500/60 shadow-[0_4px_25px_rgba(0,0,0,0.4)]'
                      : 'bg-white border-blue-100/90 hover:shadow-md hover:border-blue-400'
                    }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-2xs group-hover:scale-105 transition-transform ${isDark ? 'bg-[#141f32] border border-slate-700' : `${module.iconBg} ${module.iconColor}`
                        }`}>
                        <Icon size={24} className={isDark ? 'text-blue-400' : undefined} />
                      </div>
                      {module.badge && (
                        <span className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold border ${module.badgeColor}`}>
                          {module.badge}
                        </span>
                      )}
                    </div>

                    <h3 className={`atlas-card-title text-lg font-bold transition-colors ${isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'
                      }`}>
                      {module.title}
                    </h3>
                    <p className={`atlas-body-sm text-[14px] mt-1.5 leading-relaxed font-normal ${isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}>
                      {module.description}
                    </p>
                  </div>

                  <div className={`mt-6 pt-4 border-t flex flex-col gap-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {module.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold border ${isDark
                              ? 'bg-[#141f32] text-slate-300 border-slate-700'
                              : 'bg-slate-50 text-slate-600 border-slate-200/60'
                            }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[13.5px] font-bold text-blue-500 group-hover:text-blue-400 pt-1">
                      <span>{module.actionText}</span>
                      <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProductLandingPage;

