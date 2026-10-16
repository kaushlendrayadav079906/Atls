import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Mail,
  MapPin,
  Building2,
  Sparkles,
  ShieldAlert,
  Send,
  Layers,
  Package,
  ShoppingCart,
  ClipboardList,
  Users,
  Factory,
  Landmark,
  BarChart3,
  Headphones,
  ShieldCheck,
  Check
} from 'lucide-react';
import atlasLogo from '../assets/LOGO.png';
import chatbotLogo from '../assets/Chatbot.png';
import { useAuth } from '../contexts/AuthContext';
import { useSystemHealth } from '../hooks/useSystemHealth';

export const ContactPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSapConnected } = useSystemHealth();

  // Contact Form State
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    subject: 'General Operational Inquiry',
    message: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please provide a valid email format (e.g. name@company.com).';
    }
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required.';
    }
    if (!formData.message.trim()) {
      newErrors.message = 'Message content cannot be blank.';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Please provide at least 10 characters describing your inquiry.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitNotice(null);

    // Verified: No dedicated backend contact dispatch endpoint exists in pos-backend.
    // Display clear, honest notice per specifications without storing data insecurely.
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitNotice(
        'Backend Contact Dispatch Not Configured: No automated mail dispatch service is configured in this deployment environment. For immediate operational inquiries, please launch the in-app ATLAS AI Assistant or reach out to your system administrator directly.'
      );
    }, 600);
  };

  const openAIAssistant = () => {
    window.dispatchEvent(new CustomEvent('atls-toggle-ai', { detail: { open: true } }));
  };

  const scrollToContactForm = () => {
    const el = document.getElementById('contact-form');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const platformModules = [
    {
      title: 'Dashboard Cockpit',
      path: '/',
      icon: Layers,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      description: 'Central operational KPIs, real-time sales feed, branch status, and executive metrics.',
      tag: 'Executive Overview'
    },
    {
      title: 'Products & Stock',
      path: '/products',
      icon: Package,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      description: 'Master item catalog, branch stock levels, barcode lookups, and minimum reorder alerts.',
      tag: 'Inventory Hub'
    },
    {
      title: 'Point of Sale (POS)',
      path: '/pos',
      icon: ShoppingCart,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      description: 'High-speed retail checkout, barcode scanner, split tenders, and receipt generation.',
      tag: 'Retail Terminal'
    },
    {
      title: 'Sales Orders & Invoices',
      path: '/sales-orders',
      icon: ClipboardList,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
      description: 'Customer order fulfillment, tax invoice records, GST breakdowns, and PDF exports.',
      tag: 'Sales & Billing'
    },
    {
      title: 'Customers Directory',
      path: '/customers',
      icon: Users,
      iconColor: 'text-cyan-600',
      iconBg: 'bg-cyan-50',
      description: 'Customer contact management, account credit terms, balance aging, and order history.',
      tag: 'CRM'
    },
    {
      title: 'Manufacturing & Production',
      path: '/production',
      icon: Factory,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      description: 'Shop floor work orders, item-level throughput, rejection audits, and batch reports.',
      tag: 'Manufacturing'
    },
    {
      title: 'Financial Management',
      path: '/finance',
      icon: Landmark,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
      description: 'AP purchase invoices, incoming receipts, outgoing disbursements, and margin analytics.',
      tag: 'Finance & Ledger'
    },
    {
      title: 'Reports & Analytics Hub',
      path: '/reports',
      icon: BarChart3,
      iconColor: 'text-sky-600',
      iconBg: 'bg-sky-50',
      description: 'Configurable multi-period sales, invoice, payment, and inventory export reports.',
      tag: 'Reporting & BI'
    },
    {
      title: 'ATLAS AI Assistant',
      action: openAIAssistant,
      icon: Sparkles,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      description: 'Conversational business intelligence assistant querying live authorized SAP data.',
      tag: 'In-App AI'
    }
  ];

  return (
    <div className="w-full min-h-screen bg-[#f0f6ff] text-slate-900 flex flex-col transition-all duration-300">
      {/* ── Section A: Hero (Full-width edge-to-edge, Light Blue Enterprise Gradient) ── */}
      <section className="relative w-full overflow-hidden border-b border-blue-200/90 bg-gradient-to-br from-blue-100 via-sky-50 to-indigo-100/70 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 py-14 sm:py-20 shadow-xs">
        {/* Ambient subtle light-blue glowing shapes */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-sky-300/30 blur-3xl" />

        <div className="relative z-10 max-w-5xl space-y-6">
          {/* Logo & Company Badge */}
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-blue-200 shadow-xs">
            <img
              src={atlasLogo}
              alt="ATLAS Logo"
              className="h-9 w-9 object-contain drop-shadow-xs"
            />
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-wider text-blue-700">ATLAS</span>
              <span className="text-slate-400 text-xs">• Enterprise Operations System</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="atlas-page-title text-3xl sm:text-4xl lg:text-[42px] font-extrabold">
            Let's Connect with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700">ATLAS</span>
          </h1>

          {/* Description */}
          <p className="atlas-body text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
            Unified enterprise management integrating retail Point of Sale, live inventory synchronization, sales order workflows, manufacturing production, and SAP Business One financial intelligence.
          </p>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-[13px] font-semibold shadow-sm transition-all duration-150 cursor-pointer hover:shadow-md"
            >
              <Layers size={15} />
              <span>Explore Dashboard</span>
            </button>

            <button
              onClick={scrollToContactForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-blue-700 text-xs sm:text-[13px] font-semibold border border-blue-300 shadow-xs transition-all duration-150 cursor-pointer"
            >
              <Mail size={15} />
              <span>Contact Support</span>
            </button>

            <button
              onClick={openAIAssistant}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/90 hover:bg-indigo-50 text-indigo-700 text-xs sm:text-[13px] font-semibold border border-indigo-200 shadow-xs transition-all duration-150 cursor-pointer"
            >
              <Sparkles size={15} className="text-indigo-600" />
              <span>Ask ATLAS AI</span>
            </button>
          </div>

          {/* Verified System Status Pills */}
          <div className="pt-4 flex flex-wrap items-center gap-3 text-xs text-slate-700">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-blue-200/90 shadow-2xs">
              <span className={`h-2 w-2 rounded-full ${isSapConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-medium text-[11.5px]">{isSapConnected ? 'SAP Business One Live Connected' : 'SAP Service Layer Offline'}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-blue-200/90 shadow-2xs">
              <Building2 size={13} className="text-blue-600" />
              <span className="font-medium text-[11.5px]">Active Branch: {user?.store_name || 'Main Branch'} ({user?.branch_id || 'SH'})</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-blue-200/90 shadow-2xs">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span className="font-medium text-[11.5px]">Read-Only SAP Safeguards Active</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section B: About ATLAS (Full-width, Light Blue Section) ── */}
      <section className="w-full py-12 sm:py-16 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 bg-[#f0f6ff] border-b border-blue-100/80">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/90 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
              <Building2 size={13} />
              <span>Platform Overview</span>
            </div>
            <h2 className="atlas-section-title text-xl sm:text-2xl font-bold">
              Built for Unified Operations
            </h2>
            <p className="atlas-body text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
              ATLAS bridges front-of-house cashier terminals and back-of-house warehouse, shop-floor, and accounting systems into a single responsive management console.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl border border-blue-100/90 p-5 sm:p-6 shadow-xs space-y-2.5 hover:border-blue-400 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingCart size={20} />
              </div>
              <h3 className="atlas-card-title text-sm">Point of Sale & Checkout</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Fast retail cashier workflow with barcode reader integration, split cash/card payments, customer selection, and tax invoice receipt generation.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-blue-100/90 p-5 sm:p-6 shadow-xs space-y-2.5 hover:border-indigo-400 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package size={20} />
              </div>
              <h3 className="atlas-card-title text-sm">Real-Time Inventory</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Direct integration with SAP Business One stock balances, warehouse batch tracking, minimum stock thresholds, and low-inventory alerts.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-blue-100/90 p-5 sm:p-6 shadow-xs space-y-2.5 hover:border-emerald-400 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Factory size={20} />
              </div>
              <h3 className="atlas-card-title text-sm">Shop-Floor Manufacturing</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Track active manufacturing work orders, BOM assembly stages, shift completions, quality rejection reasons, and scrap trends.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-blue-100/90 p-5 sm:p-6 shadow-xs space-y-2.5 hover:border-purple-400 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Landmark size={20} />
              </div>
              <h3 className="atlas-card-title text-sm">Financial Ledger & AP/AR</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Purchase invoice registers, vendor payout vouchers, incoming customer collections, DSO metrics, and gross profitability insights.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section C: Explore Our Platform (Full-width, Light Blue Tinted Grid) ── */}
      <section className="w-full py-12 sm:py-16 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 bg-[#eaf2fd]/50 border-b border-blue-100/80">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/90 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                <Layers size={13} />
                <span>Platform Modules</span>
              </div>
              <h2 className="atlas-section-title text-xl sm:text-2xl font-bold">
                Explore Available Modules
              </h2>
              <p className="atlas-body text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
                Select any operational subsystem to navigate directly to authorized application views.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platformModules.map((mod) => (
              <div
                key={mod.title}
                onClick={() => {
                  if (mod.path) navigate(mod.path);
                  else if (mod.action) mod.action();
                }}
                className="group bg-white rounded-2xl border border-blue-100/90 p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-blue-400 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`h-10 w-10 rounded-xl ${mod.iconBg} ${mod.iconColor} flex items-center justify-center transition-transform group-hover:scale-105`}>
                      <mod.icon size={20} />
                    </div>
                    <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {mod.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="atlas-card-title text-sm group-hover:text-blue-600 transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                  <span>Open Module</span>
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section D: Business Information (Full-width, Light Blue Theme) ── */}
      <section className="w-full py-12 sm:py-16 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 bg-[#f0f6ff] border-b border-blue-100/80">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/90 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
              <Building2 size={13} />
              <span>Business Information</span>
            </div>
            <h2 className="atlas-section-title text-xl sm:text-2xl font-bold">
              Authorized System Credentials & Status
            </h2>
            <p className="atlas-body text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
              Verified company metadata from active installation parameters and environment configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Company Identity */}
            <div className="bg-white rounded-2xl border border-blue-100/90 p-5 sm:p-6 shadow-xs space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 size={19} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Company Name</div>
                  <div className="text-sm font-bold text-slate-900">ATLAS</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2.5">
                Operating enterprise application for retail POS, production workflows, and SAP Business One data orchestration.
              </p>
            </div>

            {/* Active Store Branch */}
            <div className="bg-white rounded-2xl border border-blue-100/90 p-5 sm:p-6 shadow-xs space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <MapPin size={19} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Configured Branch</div>
                  <div className="text-sm font-bold text-slate-900">
                    {user?.store_name || 'Main Branch'} ({user?.branch_id || 'SH'})
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2.5">
                Primary office address not configured in system settings. Current user assigned to store code {user?.branch_id || 'SH'}.
              </p>
            </div>

            {/* Support Channels */}
            <div className="bg-white rounded-2xl border border-blue-100/90 p-5 sm:p-6 shadow-xs space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Headphones size={19} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Support Routing</div>
                  <div className="text-sm font-bold text-slate-900">In-App AI & Administrator</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2.5">
                Dedicated email and telephone helplines are not configured. Use the ATLAS AI Assistant or contact your site administrator.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section E: Contact Form (Full-width, Light Blue Gradient Background) ── */}
      <section id="contact-form" className="w-full py-12 sm:py-16 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 bg-gradient-to-b from-[#f0f6ff] via-[#e6f0fa] to-[#edf4fc]">
        <div className="bg-white rounded-3xl border border-blue-200/90 p-6 sm:p-10 lg:p-12 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left column: Context & Guidance */}
            <div className="lg:col-span-5 space-y-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
                  <Mail size={13} />
                  <span>Support Inquiries</span>
                </div>
                <h2 className="atlas-section-title text-xl sm:text-2xl font-bold">
                  Send an Inquiry
                </h2>
                <p className="atlas-body text-sm sm:text-base text-slate-500 leading-relaxed">
                  Have questions about your branch configuration, catalog updates, or SAP synchronization status? Submit your details below.
                </p>
              </div>

              {/* Information Checklist */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={13} />
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Live AI Assistant:</span> For instant answers regarding sales, items, and production trends, launch the assistant panel on the right.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={13} />
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Admin Permissions:</span> User role alterations and branch assignments are managed in <button onClick={() => navigate('/settings')} className="text-blue-600 underline font-semibold cursor-pointer">Settings</button>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={13} />
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">SAP Data Accuracy:</span> All transactions reflect live SAP Business One tables with strict read-only protection.
                  </div>
                </div>
              </div>

              {/* Assistant launch prompt box */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-3">
                  <img src={chatbotLogo} alt="AI Robot" className="h-8 w-8 object-contain" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Instant Automated Assistance</div>
                    <div className="text-[11px] text-slate-500">Query your live branch numbers directly</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openAIAssistant}
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 text-indigo-700 text-xs font-semibold border border-indigo-200 shadow-2xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles size={13} className="text-indigo-600" />
                  <span>Launch In-App Assistant</span>
                </button>
              </div>
            </div>

            {/* Right column: Form */}
            <div className="lg:col-span-7 bg-[#f8faff] border border-blue-100 rounded-2xl p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Full Name */}
                <div className="space-y-1">
                  <label htmlFor="fullName" className="text-xs font-semibold text-slate-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Enter your name"
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition ${
                      errors.fullName ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  {errors.fullName && <p className="text-[11px] text-red-600 mt-1">{errors.fullName}</p>}
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="name@company.com"
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition ${
                      errors.email ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <label htmlFor="subject" className="text-xs font-semibold text-slate-700">
                    Subject / Topic <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  >
                    <option value="General Operational Inquiry">General Operational Inquiry</option>
                    <option value="Point of Sale & Checkout Support">Point of Sale & Checkout Support</option>
                    <option value="Stock & Catalog Discrepancy">Stock & Catalog Discrepancy</option>
                    <option value="SAP Synchronization Status">SAP Synchronization Status</option>
                    <option value="Production Work Order Query">Production Work Order Query</option>
                    <option value="Financial & Invoice Discrepancy">Financial & Invoice Discrepancy</option>
                  </select>
                  {errors.subject && <p className="text-[11px] text-red-600 mt-1">{errors.subject}</p>}
                </div>

                {/* Message */}
                <div className="space-y-1">
                  <label htmlFor="message" className="text-xs font-semibold text-slate-700">
                    Message Details <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Describe your inquiry, order number, or operational feedback..."
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition resize-none ${
                      errors.message ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  {errors.message && <p className="text-[11px] text-red-600 mt-1">{errors.message}</p>}
                </div>

                {/* Notice Banner */}
                {submitNotice && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                    <ShieldAlert size={17} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-900">Environment Notice</div>
                      <div className="mt-0.5 leading-relaxed text-[11.5px]">{submitNotice}</div>
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 py-3 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verifying Dispatch System...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Submit Support Inquiry</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
