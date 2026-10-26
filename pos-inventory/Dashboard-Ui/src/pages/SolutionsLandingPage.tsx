import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  Landmark,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FileText,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  UserCheck,
  Building2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import atlasLogo from '../assets/LOGO.png';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { useTheme } from '../contexts/ThemeContext';

interface SolutionModule {
  id: string;
  category: 'production' | 'finance';
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

const PRODUCTION_SOLUTIONS: SolutionModule[] = [
  {
    id: 'prod-overview',
    category: 'production',
    title: 'Production Overview',
    path: '/production',
    icon: Factory,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    description: 'Executive manufacturing overview with total planned vs. completed quantities, active orders, and line performance.',
    tags: ['Manufacturing Hub', 'Output Rates', 'Target Tracking'],
    actionText: 'View Production Overview',
  },
  {
    id: 'prod-orders',
    category: 'production',
    title: 'Production Orders',
    path: '/production/orders',
    icon: FileSpreadsheet,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    description: 'Track shop floor work orders, monitor assembly lines, BOM components, completion stages, and SAP production status.',
    tags: ['Work Orders', 'BOM Progress', 'Routing Stages'],
    actionText: 'Manage Production Orders',
  },
  {
    id: 'prod-item-wise',
    category: 'production',
    title: 'Item-wise Production',
    path: '/production/item-wise',
    icon: CheckCircle2,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    description: 'Granular item-level manufacturing records, finished goods output analysis, and per-SKU production throughput.',
    tags: ['SKU Throughput', 'Output Volume', 'Item Breakdown'],
    actionText: 'View Item Production',
  },
  {
    id: 'prod-rejection',
    category: 'production',
    title: 'Production Rejection',
    path: '/production/rejection',
    icon: AlertTriangle,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    description: 'Quality assurance rejection audits, defect categorization, scrap cost monitoring, and trend mitigation.',
    tags: ['Quality Control', 'Scrap Tracking', 'Defect Trends'],
    actionText: 'Analyze Rejections',
  },
  {
    id: 'prod-date-wise',
    category: 'production',
    title: 'Date-wise Production',
    path: '/production/date-wise',
    icon: Calendar,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
    description: 'Daily and weekly production timelines, shift completion comparisons, and manufacturing calendar summaries.',
    tags: ['Shift Logs', 'Daily Totals', 'Timeline History'],
    actionText: 'View Production Calendar',
  },
  {
    id: 'prod-reports',
    category: 'production',
    title: 'Production Reports',
    path: '/production/reports',
    icon: FileText,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    description: 'Comprehensive manufacturing export logs, compliance summaries, batch traceability, and production audits.',
    tags: ['Compliance Logs', 'Traceability', 'Output Exports'],
    actionText: 'View Production Reports',
  },
];

const FINANCE_SOLUTIONS: SolutionModule[] = [
  {
    id: 'fin-overview',
    category: 'finance',
    title: 'Finance Overview',
    path: '/finance',
    icon: Landmark,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    badge: 'SAP Live',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Executive financial cockpit with cash flow status, revenue velocity, pending receivables, and expense breakdowns.',
    tags: ['Cash Flow', 'Receivables', 'Revenue KPIs'],
    actionText: 'Open Finance Overview',
  },
  {
    id: 'fin-purchase-invoices',
    category: 'finance',
    title: 'Purchase Invoices',
    path: '/finance/purchase-invoices',
    icon: Receipt,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    description: 'Accounts Payable invoice records from SAP, vendor due dates, GST input credits, and payment status checks.',
    tags: ['AP Ledger', 'Vendor Invoices', 'GST Input Credits'],
    actionText: 'View Purchase Invoices',
  },
  {
    id: 'fin-incoming-payments',
    category: 'finance',
    title: 'Incoming Payments',
    path: '/finance/incoming-payments',
    icon: ArrowDownLeft,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    description: 'Track customer payments, cash collections, bank transfers, credit card remittances, and account settlements.',
    tags: ['Collections', 'Customer Receipts', 'Bank Reconciliation'],
    actionText: 'View Incoming Payments',
  },
  {
    id: 'fin-outgoing-payments',
    category: 'finance',
    title: 'Outgoing Payments',
    path: '/finance/outgoing-payments',
    icon: ArrowUpRight,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    description: 'Vendor payment vouchers, utility and operating disbursements, bank ledger transfers, and payment approvals.',
    tags: ['Vendor Payouts', 'Operating Expenses', 'Payment Vouchers'],
    actionText: 'View Outgoing Payments',
  },
  {
    id: 'fin-customer-analysis',
    category: 'finance',
    title: 'Customer Analysis',
    path: '/finance/customer-analysis',
    icon: UserCheck,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    description: 'Customer revenue contribution, accounts receivable aging brackets, DSO metrics, and payment behavior analysis.',
    tags: ['Aging Receivables', 'Customer Profitability', 'DSO Analysis'],
    actionText: 'Analyze Customers',
  },
  {
    id: 'fin-supplier-analysis',
    category: 'finance',
    title: 'Supplier Analysis',
    path: '/finance/supplier-analysis',
    icon: Building2,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    description: 'Vendor spend distribution, procurement volume, accounts payable aging, and supplier reliability indices.',
    tags: ['Spend Analysis', 'Vendor Aging', 'Procurement Costs'],
    actionText: 'Analyze Suppliers',
  },
  {
    id: 'fin-profitability-reports',
    category: 'finance',
    title: 'Profitability Reports',
    path: '/finance/profitability-reports',
    icon: TrendingUp,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    description: 'Gross margin tracking, product category margins, operational net margins, and store profitability comparisons.',
    tags: ['Gross Margins', 'Category Profit', 'EBITDA Indicators'],
    actionText: 'View Profitability Reports',
  },
];

export const SolutionsLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSapConnected } = useSystemHealth();
  const { isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'production' | 'finance'>('all');

  const showProduction = selectedCategory === 'all' || selectedCategory === 'production';
  const showFinance = selectedCategory === 'all' || selectedCategory === 'finance';

  return (
    <div className={`w-full min-h-screen flex flex-col transition-all duration-300 ${
      isDark ? 'bg-[#0f172a] text-white' : 'bg-[#f0f6ff] text-slate-900'
    }`}>
      {/* ── Section A: Hero (Full-width edge-to-edge, Adaptive Gradient) ── */}
      <section className={`relative w-full overflow-hidden border-b px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 py-12 sm:py-16 shadow-xs ${
        isDark
          ? 'border-slate-700 bg-gradient-to-br from-[#1e293b] via-[#141f32] to-[#1e3456]'
          : 'border-blue-200/90 bg-gradient-to-br from-blue-100 via-sky-50 to-indigo-100/70'
      }`}>
        {/* Ambient subtle glowing shapes */}
        <div className={`pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full blur-3xl ${
          isDark ? 'bg-blue-600/15' : 'bg-blue-300/30'
        }`} />
        <div className={`pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full blur-3xl ${
          isDark ? 'bg-indigo-600/15' : 'bg-indigo-300/30'
        }`} />

        <div className="relative z-10 max-w-5xl space-y-6">
          {/* Logo & Section Badge */}
          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl backdrop-blur-md border shadow-xs ${
            isDark ? 'bg-[#1e293b]/90 border-slate-700' : 'bg-white/95 border-blue-200'
          }`}>
            <img
              src={atlasLogo}
              alt="ATLAS Logo"
              className="h-9 w-9 object-contain drop-shadow-xs"
            />
            <div className="flex items-center gap-2">
              <span className={`text-base font-black tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>ATLAS</span>
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>• Solutions Section</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className={`atlas-page-title text-3xl sm:text-4xl lg:text-[42px] font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Operational Business <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400">Solutions</span>
          </h1>

          {/* Description */}
          <p className={`atlas-body text-base sm:text-lg max-w-3xl leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Enterprise solutions for Manufacturing Production operations and SAP Business One Financial accounting, cash flows, and profitability.
          </p>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => navigate('/finance')}
              className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13.5px] sm:text-[14px] font-bold shadow-sm transition-all duration-150 cursor-pointer hover:shadow-md"
            >
              <Landmark size={16} />
              <span>Finance Cockpit</span>
            </button>

            <button
              onClick={() => navigate('/production')}
              className={`inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-[13.5px] sm:text-[14px] font-bold border shadow-xs transition-all duration-150 cursor-pointer ${
                isDark
                  ? 'bg-[#1e293b] hover:bg-slate-800 text-blue-300 border-slate-700'
                  : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300'
              }`}
            >
              <Factory size={16} />
              <span>Production Home</span>
            </button>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('atls-toggle-ai', { detail: { open: true } }))}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] sm:text-[14px] font-bold border shadow-xs transition-all duration-150 cursor-pointer ${
                isDark
                  ? 'bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border-indigo-800'
                  : 'bg-white/90 hover:bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}
            >
              <Sparkles size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
              <span>AI Solutions Assistant</span>
            </button>
          </div>

          {/* Verified System Status Pills */}
          <div className={`pt-3 flex flex-wrap items-center gap-3 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-2xs ${
              isDark ? 'bg-[#1e293b]/90 border-slate-700' : 'bg-white/90 border-blue-200/90'
            }`}>
              <span className={`h-2 w-2 rounded-full ${isSapConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-semibold text-[12px]">{isSapConnected ? 'SAP Business One Live Connected' : 'SAP Offline'}</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-2xs ${
              isDark ? 'bg-[#1e293b]/90 border-slate-700' : 'bg-white/90 border-blue-200/90'
            }`}>
              <Layers size={13} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
              <span className="font-semibold text-[12px]">13 Enterprise Solutions Active</span>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-2xs ${
              isDark ? 'bg-[#1e293b]/90 border-slate-700' : 'bg-white/90 border-blue-200/90'
            }`}>
              <ShieldCheck size={13} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
              <span className="font-medium text-[12px]">Manufacturing & Financial Intelligence</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section B: Main Content (Full-width, Adaptive Background) ── */}
      <section className={`w-full py-10 sm:py-14 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 space-y-8 ${
        isDark ? 'bg-[#0f172a]' : 'bg-[#f0f6ff]'
      }`}>
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2.5 pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : isDark
                  ? 'bg-[#1e293b] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-blue-50 border border-blue-200/80'
            }`}
          >
            All Solutions (13)
          </button>
          <button
            onClick={() => setSelectedCategory('production')}
            className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
              selectedCategory === 'production'
                ? 'bg-blue-600 text-white shadow-xs'
                : isDark
                  ? 'bg-[#1e293b] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-blue-50 border border-blue-200/80'
            }`}
          >
            <Factory size={14} />
            <span>Production & Manufacturing (6)</span>
          </button>
          <button
            onClick={() => setSelectedCategory('finance')}
            className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
              selectedCategory === 'finance'
                ? 'bg-blue-600 text-white shadow-xs'
                : isDark
                  ? 'bg-[#1e293b] text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-blue-50 border border-blue-200/80'
            }`}
          >
            <Landmark size={14} />
            <span>Financial Management (7)</span>
          </button>
        </div>

      {/* Category 1: Production & Manufacturing */}
      {showProduction && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                isDark ? 'bg-blue-950/70 text-blue-300 border border-blue-800' : 'bg-blue-100 text-blue-700'
              }`}>
                <Factory size={16} />
              </div>
              <div>
                <h2 className={`atlas-section-title text-lg sm:text-[21px] ${isDark ? 'text-white' : 'text-slate-900'}`}>Production & Manufacturing</h2>
                <p className={`atlas-body-sm text-[13.5px] sm:text-[14px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Shop floor tracking, work orders, quality rejections, and batch reports</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/production')}
              className="text-xs font-semibold text-blue-500 hover:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Production Home</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRODUCTION_SOLUTIONS.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.id}
                  onClick={() => navigate(module.path)}
                  className={`rounded-2xl border p-5 shadow-2xs hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                    isDark
                      ? 'bg-[#1e293b] border-slate-700 hover:border-blue-500/60 shadow-[0_4px_25px_rgba(0,0,0,0.4)]'
                      : 'bg-white border-slate-200/90 hover:shadow-md hover:border-blue-400'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-2xs group-hover:scale-105 transition-transform ${
                        isDark ? 'bg-[#141f32] border border-slate-700' : `${module.iconBg} ${module.iconColor}`
                      }`}>
                        <Icon size={20} className={isDark ? 'text-blue-400' : undefined} />
                      </div>
                      {module.badge && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${module.badgeColor}`}>
                          {module.badge}
                        </span>
                      )}
                    </div>

                    <h3 className={`atlas-card-title text-sm transition-colors ${
                      isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'
                    }`}>
                      {module.title}
                    </h3>
                    <p className={`atlas-body-sm text-xs mt-1 leading-relaxed ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {module.description}
                    </p>
                  </div>

                  <div className={`mt-4 pt-3.5 border-t flex flex-col gap-2.5 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {module.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-medium border ${
                            isDark
                              ? 'bg-[#141f32] text-slate-300 border-slate-700'
                              : 'bg-slate-50 text-slate-600 border-slate-200/60'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-blue-500 group-hover:text-blue-400 pt-0.5">
                      <span>{module.actionText}</span>
                      <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category 2: Financial Management */}
      {showFinance && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                isDark ? 'bg-purple-950/70 text-purple-300 border border-purple-800' : 'bg-purple-100 text-purple-700'
              }`}>
                <Landmark size={16} />
              </div>
              <div>
                <h2 className={`atlas-section-title text-lg sm:text-[21px] ${isDark ? 'text-white' : 'text-slate-900'}`}>Financial Management & SAP Accounting</h2>
                <p className={`atlas-body-sm text-[13.5px] sm:text-[14px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Live AP/AR ledgers, customer/supplier profitability, and cash disbursement analytics</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/finance')}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Finance Cockpit</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FINANCE_SOLUTIONS.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.id}
                  onClick={() => navigate(module.path)}
                  className={`rounded-2xl border p-5 shadow-2xs hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                    isDark
                      ? 'bg-[#1e293b] border-slate-700 hover:border-purple-500/60 shadow-[0_4px_25px_rgba(0,0,0,0.4)]'
                      : 'bg-white border-slate-200/90 hover:shadow-md hover:border-purple-400'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-2xs group-hover:scale-105 transition-transform ${
                        isDark ? 'bg-[#141f32] border border-slate-700' : `${module.iconBg} ${module.iconColor}`
                      }`}>
                        <Icon size={20} className={isDark ? 'text-purple-400' : undefined} />
                      </div>
                      {module.badge && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${module.badgeColor}`}>
                          {module.badge}
                        </span>
                      )}
                    </div>

                    <h3 className={`atlas-card-title text-sm transition-colors ${
                      isDark ? 'text-white group-hover:text-purple-400' : 'text-slate-900 group-hover:text-purple-600'
                    }`}>
                      {module.title}
                    </h3>
                    <p className={`atlas-body-sm text-xs mt-1 leading-relaxed ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {module.description}
                    </p>
                  </div>

                  <div className={`mt-4 pt-3.5 border-t flex flex-col gap-2.5 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {module.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-medium border ${
                            isDark
                              ? 'bg-[#141f32] text-slate-300 border-slate-700'
                              : 'bg-slate-50 text-slate-600 border-slate-200/60'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-purple-400 group-hover:text-purple-300 pt-0.5">
                      <span>{module.actionText}</span>
                      <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </section>
    </div>
  );
};

export default SolutionsLandingPage;
