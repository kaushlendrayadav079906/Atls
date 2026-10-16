import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import atlasLogo from '../assets/LOGO.png';
import { useAuth } from '../contexts/AuthContext';
import { useSystemHealth } from '../hooks/useSystemHealth';

export const AtlasGlobalFooter: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isSapConnected } = useSystemHealth();

  const openAIAssistant = () => {
    window.dispatchEvent(new CustomEvent('atls-toggle-ai', { detail: { open: true } }));
  };

  const scrollToTop = () => {
    // Try scrolling main content container first, fallback to window
    const mainEl = document.querySelector('main > div.overflow-y-auto') || document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <footer className="w-full bg-gradient-to-b from-[#eef5fc] via-[#e5effb] to-[#edf4fd] text-slate-800 py-12 sm:py-16 px-6 sm:px-12 lg:px-16 xl:px-20 2xl:px-24 border-t border-blue-200/90 shadow-[0_-12px_36px_-6px_rgba(37,99,235,0.12)] space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10">
        
        {/* Column 1: Brand Info, Socials, Legal & SAP Status */}
        <div className="lg:col-span-2 space-y-5">
          {/* Logo & ATLAS Name */}
          <div className="flex items-center gap-3">
            <img
              src={atlasLogo}
              alt="ATLAS Logo"
              className="h-10 w-10 object-contain drop-shadow-xs"
            />
            <span className="text-2xl font-black tracking-wider text-slate-900">ATLAS</span>
          </div>

          <p className="text-[12.5px] sm:text-[13px] text-slate-500 max-w-sm leading-relaxed">
            Unified Point of Sale, inventory intelligence, shop-floor production, and financial operations engine natively connected to SAP Business One.
          </p>

          {/* Social Icons row (LinkedIn, YouTube, X) */}
          <div className="flex items-center gap-2.5 pt-1">
            {/* LinkedIn Icon */}
            <a
              href="https://www.linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              title="ATLAS on LinkedIn"
              className="h-9 w-9 rounded-full bg-white border border-blue-200/90 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 flex items-center justify-center transition-all duration-200 shadow-2xs hover:shadow-xs cursor-pointer group"
            >
              <svg className="h-4 w-4 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45c-.96 0-1.74.78-1.74 1.74 0 .96.78 1.74 1.74 1.74.96 0 1.74-.78 1.74-1.74 0-.96-.78-1.74-1.74-1.74Z"/>
              </svg>
            </a>

            {/* YouTube Icon */}
            <a
              href="https://www.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              title="ATLAS on YouTube"
              className="h-9 w-9 rounded-full bg-white border border-blue-200/90 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 flex items-center justify-center transition-all duration-200 shadow-2xs hover:shadow-xs cursor-pointer group"
            >
              <svg className="h-4 w-4 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>

            {/* X (Twitter) Icon */}
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              title="ATLAS on X"
              className="h-9 w-9 rounded-full bg-white border border-blue-200/90 text-slate-800 hover:bg-slate-900 hover:text-white hover:border-slate-900 flex items-center justify-center transition-all duration-200 shadow-2xs hover:shadow-xs cursor-pointer group"
            >
              <svg className="h-3.5 w-3.5 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>

          {/* Copyright & Legal Links */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[12px] sm:text-[12.5px] text-slate-500 font-medium">
              © {new Date().getFullYear()} ATLAS. All rights reserved.
            </div>
            <div className="flex items-center gap-2.5 text-[12px] sm:text-[12.5px] text-slate-500">
              <span className="hover:text-blue-600 transition cursor-pointer">Privacy</span>
              <span>|</span>
              <span className="hover:text-blue-600 transition cursor-pointer">Terms</span>
              <span>|</span>
              <span className="hover:text-blue-600 transition cursor-pointer">Security</span>
            </div>
          </div>

          {/* Live SAP Status Pill */}
          <div className="pt-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-blue-200 text-[11.5px] sm:text-[12px] text-slate-700 shadow-3xs font-medium">
              <span className={`h-2 w-2 rounded-full ${isSapConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span>{isSapConnected ? 'SAP Live Connected' : 'SAP Offline'}</span>
              <span className="text-slate-400">• Branch {user?.branch_id || 'SH'}</span>
            </div>
          </div>
        </div>

        {/* Right Columns: Structured Multi-column Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 lg:col-span-4">
          
          {/* Column 2: PRODUCT */}
          <div className="space-y-3">
            <div className="text-[12.5px] sm:text-[13px] font-bold text-slate-900 uppercase tracking-wider">Product</div>
            <div className="h-0.5 w-6 bg-blue-600 rounded-full" />
            <ul className="space-y-2.5 text-[13px] sm:text-[13.5px] text-slate-600">
              <li>
                <button
                  onClick={() => navigate('/products')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/products') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Products & Stock
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/pos')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/pos') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Point of Sale
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/product')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/product') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Product Catalog
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/returns')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/returns') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Returns & Approvals
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: SOLUTIONS */}
          <div className="space-y-3">
            <div className="text-[12.5px] sm:text-[13px] font-bold text-slate-900 uppercase tracking-wider">Solutions</div>
            <div className="h-0.5 w-6 bg-blue-600 rounded-full" />
            <ul className="space-y-2.5 text-[13px] sm:text-[13.5px] text-slate-600">
              <li>
                <button
                  onClick={() => navigate('/production')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/production') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Production Overview
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/production/orders')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/production/orders') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Production Orders
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/finance')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/finance') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Finance Overview
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/solutions')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/solutions') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Solutions Hub
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: OPERATIONS */}
          <div className="space-y-3">
            <div className="text-[12.5px] sm:text-[13px] font-bold text-slate-900 uppercase tracking-wider">Operations</div>
            <div className="h-0.5 w-6 bg-blue-600 rounded-full" />
            <ul className="space-y-2.5 text-[13px] sm:text-[13.5px] text-slate-600">
              <li>
                <button
                  onClick={() => navigate('/')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Dashboard Overview
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/sales-orders')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/sales-orders') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Sales Orders
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/sales')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/sales') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Invoices & Tax Bills
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/customers')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/customers') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Customer Directory
                </button>
              </li>
            </ul>
          </div>

          {/* Column 5: COMPANY & TOOLS */}
          <div className="space-y-3">
            <div className="text-[12.5px] sm:text-[13px] font-bold text-slate-900 uppercase tracking-wider">Company & Tools</div>
            <div className="h-0.5 w-6 bg-blue-600 rounded-full" />
            <ul className="space-y-2.5 text-[13px] sm:text-[13.5px] text-slate-600">
              <li>
                <button
                  onClick={() => navigate('/reports')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/reports') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Reports & BI
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/contact')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/contact') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Contact & Support
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/settings')}
                  className={`hover:text-blue-600 font-medium transition cursor-pointer text-left ${isCurrent('/settings') ? 'text-blue-600 font-bold' : ''}`}
                >
                  Settings & Users
                </button>
              </li>
              <li>
                <button
                  onClick={openAIAssistant}
                  className="hover:text-indigo-600 text-indigo-600 font-bold transition cursor-pointer flex items-center gap-1.5 text-left"
                >
                  <Sparkles size={13} className="text-indigo-600 shrink-0" />
                  <span>ATLAS AI Assistant</span>
                </button>
              </li>
              <li className="pt-1">
                <button
                  onClick={scrollToTop}
                  className="text-slate-500 hover:text-blue-600 font-semibold transition cursor-pointer flex items-center gap-1 text-left"
                >
                  <span>Back to Top ↑</span>
                </button>
              </li>
            </ul>
          </div>

        </div>

      </div>
    </footer>
  );
};
