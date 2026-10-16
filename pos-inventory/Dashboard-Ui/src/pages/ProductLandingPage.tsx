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

  return (
    <div className="w-full min-h-screen bg-[#f0f6ff] text-slate-900 flex flex-col transition-all duration-300">
      {/* ── Section A: Hero (Full-width edge-to-edge, Light Blue Enterprise Gradient) ── */}
      <section className="relative w-full overflow-hidden border-b border-blue-200/90 bg-gradient-to-br from-blue-100 via-sky-50 to-indigo-100/70 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 py-12 sm:py-16 shadow-xs">
        {/* Ambient subtle light-blue glowing shapes */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-sky-300/30 blur-3xl" />

        <div className="relative z-10 max-w-5xl space-y-6">
          {/* Logo & Section Badge */}
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-blue-200 shadow-xs">
            <img
              src={atlasLogo}
              alt="ATLAS Logo"
              className="h-9 w-9 object-contain drop-shadow-xs"
            />
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-wider text-blue-700">ATLAS</span>
              <span className="text-slate-500 text-xs font-semibold">• Product & Operations Hub</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="atlas-page-title text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-900">
            Product & Operations <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700">Hub</span>
          </h1>

          {/* Description */}
          <p className="atlas-body text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
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
              className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-blue-700 text-[13.5px] sm:text-[14px] font-bold border border-blue-300 shadow-xs transition-all duration-150 cursor-pointer"
            >
              <Package size={16} />
              <span>Manage Products & Stock</span>
            </button>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('atls-toggle-ai', { detail: { open: true } }))}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/90 hover:bg-indigo-50 text-indigo-700 text-[13.5px] sm:text-[14px] font-bold border border-indigo-200 shadow-xs transition-all duration-150 cursor-pointer"
            >
              <Sparkles size={16} className="text-indigo-600" />
              <span>Ask ATLAS AI</span>
            </button>
          </div>

          {/* Verified System Status Pills */}
          <div className="pt-3 flex flex-wrap items-center gap-3 text-xs text-slate-700">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-blue-200/90 shadow-2xs">
              <span className={`h-2 w-2 rounded-full ${isSapConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-semibold text-[12px]">{isSapConnected ? 'SAP Business One Live Connected' : 'SAP Offline'}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-blue-200/90 shadow-2xs">
              <Layers size={13} className="text-blue-600" />
              <span className="font-semibold text-[12px]">7 Operational Modules Active</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-blue-200/90 shadow-2xs">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span className="font-medium text-[12px]">Real-Time Inventory Synchronization</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section B: Main Content (Full-width, Light Blue Background) ── */}
      <section className="w-full py-10 sm:py-14 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 space-y-8 bg-[#f0f6ff]">
        {/* Quick Summary Highlights Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div
            onClick={() => navigate('/products')}
            className="bg-white p-5 rounded-2xl border border-blue-100/90 shadow-xs hover:border-blue-400 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Products & Catalog</span>
              <Package size={18} className="text-blue-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2.5 text-xl font-black text-slate-900">Live Inventory</div>
            <p className="text-[12.5px] text-slate-500 mt-1 font-medium">Real-time SAP sync</p>
          </div>

          <div
            onClick={() => navigate('/sales-orders')}
            className="bg-white p-5 rounded-2xl border border-blue-100/90 shadow-xs hover:border-indigo-400 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Sales Orders</span>
              <ClipboardList size={18} className="text-indigo-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2.5 text-xl font-black text-slate-900">Order Lines</div>
            <p className="text-[12.5px] text-slate-500 mt-1 font-medium">Fulfillment & deliveries</p>
          </div>

          <div
            onClick={() => navigate('/sales')}
            className="bg-white p-5 rounded-2xl border border-blue-100/90 shadow-xs hover:border-purple-400 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Invoices</span>
              <FileText size={18} className="text-purple-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2.5 text-xl font-black text-slate-900">Tax Invoices</div>
            <p className="text-[12.5px] text-slate-500 mt-1 font-medium">Payments & billing</p>
          </div>

          <div
            onClick={() => navigate('/returns')}
            className="bg-white p-5 rounded-2xl border border-blue-100/90 shadow-xs hover:border-rose-400 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Returns Pending</span>
              <RotateCcw size={18} className="text-rose-600 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-2.5 text-xl font-black text-rose-600">5 Approvals</div>
            <p className="text-[12.5px] text-slate-500 mt-1 font-medium">Requires supervisor review</p>
          </div>
        </div>

        {/* Product Modules Grid */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="atlas-section-title text-xl sm:text-2xl font-bold">Product & Operations Modules</h2>
              <p className="text-[14px] text-slate-500 font-medium mt-0.5">Direct access to core inventory and commercial pipelines</p>
            </div>
            <span className="text-[13px] text-blue-700 bg-blue-100/80 px-3 py-1 rounded-full font-bold">7 Modules Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRODUCT_MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.id}
                  onClick={() => navigate(module.path)}
                  className="bg-white rounded-2xl border border-blue-100/90 p-6 shadow-xs hover:shadow-md hover:border-blue-400 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${module.iconBg} ${module.iconColor} shadow-2xs group-hover:scale-105 transition-transform`}>
                        <Icon size={24} />
                      </div>
                      {module.badge && (
                        <span className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold border ${module.badgeColor}`}>
                          {module.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="atlas-card-title text-lg font-bold group-hover:text-blue-600 transition-colors">
                      {module.title}
                    </h3>
                    <p className="atlas-body-sm text-[14px] text-slate-600 mt-1.5 leading-relaxed font-normal">
                      {module.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {module.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-slate-50 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 border border-slate-200/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[13.5px] font-bold text-blue-600 group-hover:text-blue-700 pt-1">
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

