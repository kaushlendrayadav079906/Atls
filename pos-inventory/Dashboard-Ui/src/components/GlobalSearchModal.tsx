import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Package, Users, FileText, LayoutDashboard,
  Sparkles, ArrowRight, CornerDownLeft, RotateCcw,
  BarChart3, Factory, Settings, ShoppingCart, Mail
} from 'lucide-react';
import { apiClient } from '../api/client';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAskAI?: (prompt: string) => void;
}

interface NavDestination {
  id: string;
  title: string;
  category: 'Navigation' | 'Reports' | 'Operations';
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

const STATIC_DESTINATIONS: NavDestination[] = [
  { id: 'nav-dash', title: 'Dashboard', category: 'Navigation', path: '/', icon: LayoutDashboard, keywords: ['home', 'overview', 'kpi', 'metrics'] },
  { id: 'nav-product-hub', title: 'Product & Operations Hub', category: 'Navigation', path: '/product', icon: Package, keywords: ['product', 'products', 'inventory', 'stock', 'pos', 'sales', 'orders', 'customers'] },
  { id: 'nav-solutions-hub', title: 'Solutions Hub (Production & Finance)', category: 'Navigation', path: '/solutions', icon: Factory, keywords: ['solutions', 'production', 'manufacturing', 'finance', 'accounting', 'payments'] },
  { id: 'nav-reports-hub', title: 'Reports Hub & Analytics', category: 'Navigation', path: '/reports', icon: FileText, keywords: ['reports', 'reporting', 'analytics', 'bi', 'sales report', 'invoices', 'inventory report'] },
  { id: 'nav-pos', title: 'Point of Sale (POS)', category: 'Operations', path: '/pos', icon: ShoppingCart, keywords: ['checkout', 'billing', 'cashier', 'new sale'] },
  { id: 'nav-products', title: 'Products & Inventory', category: 'Operations', path: '/products', icon: Package, keywords: ['items', 'catalog', 'stock', 'pricing'] },
  { id: 'nav-sales', title: 'Sales & Invoices', category: 'Operations', path: '/sales', icon: FileText, keywords: ['invoices', 'bills', 'orders', 'transactions'] },
  { id: 'nav-sales-orders', title: 'Sales Orders', category: 'Operations', path: '/sales-orders', icon: FileText, keywords: ['so', 'pending orders'] },
  { id: 'nav-purchase-orders', title: 'Purchase Orders', category: 'Operations', path: '/purchase-orders', icon: FileText, keywords: ['po', 'vendor orders'] },
  { id: 'nav-customers', title: 'Customers Directory', category: 'Operations', path: '/customers', icon: Users, keywords: ['clients', 'buyers', 'crm'] },
  { id: 'nav-returns', title: 'Returns & Approvals', category: 'Operations', path: '/returns', icon: RotateCcw, keywords: ['refunds', 'credit notes', 'manager approval'] },
  { id: 'nav-production', title: 'Production Overview', category: 'Operations', path: '/production', icon: Factory, keywords: ['manufacturing', 'work orders'] },
  { id: 'nav-analytics', title: 'Atlas Analytics', category: 'Reports', path: '/analytics', icon: BarChart3, keywords: ['insights', 'trends', 'charts', 'deep dive'] },
  { id: 'nav-sales-rep', title: 'Sales Reports', category: 'Reports', path: '/reports/sales', icon: BarChart3, keywords: ['revenue', 'daily report', 'summary'] },
  { id: 'nav-inv-rep', title: 'Invoice Reports', category: 'Reports', path: '/reports/invoice', icon: FileText, keywords: ['gst', 'tax invoice', 'billing report'] },
  { id: 'nav-stock-rep', title: 'Inventory Reports', category: 'Reports', path: '/reports/inventory', icon: Package, keywords: ['low stock', 'valuation', 'warehouse'] },
  { id: 'nav-contact', title: 'Contact & Support', category: 'Navigation', path: '/contact', icon: Mail, keywords: ['contact', 'support', 'help', 'email', 'inquiries', 'connect'] },
  { id: 'nav-settings', title: 'Settings & Users', category: 'Navigation', path: '/settings', icon: Settings, keywords: ['admin', 'branches', 'roles', 'config'] },
];

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onAskAI
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'customers' | 'invoices' | 'pages'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Search Results
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productResults, setProductResults] = useState<any[]>([]);
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [invoiceResults, setInvoiceResults] = useState<any[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setProductResults([]);
      setCustomerResults([]);
      setInvoiceResults([]);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced API search for products, customers, and invoices
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setProductResults([]);
      setCustomerResults([]);
      setInvoiceResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [prodRes, custRes, invRes] = await Promise.allSettled([
          apiClient.get('/products', { params: { search: trimmed.slice(0, 50) } }),
          apiClient.get('/customers/search', { params: { search: trimmed.slice(0, 50), top: 5 } }),
          apiClient.get('/dashboard/recent-sales-feed', { params: { search: trimmed.slice(0, 50), limit: 5 } })
        ]);

        if (prodRes.status === 'fulfilled' && Array.isArray(prodRes.value.data)) {
          setProductResults(prodRes.value.data.slice(0, 6));
        } else {
          setProductResults([]);
        }

        if (custRes.status === 'fulfilled' && Array.isArray(custRes.value.data)) {
          setCustomerResults(custRes.value.data.slice(0, 5));
        } else {
          setCustomerResults([]);
        }

        if (invRes.status === 'fulfilled' && Array.isArray(invRes.value.data?.items)) {
          setInvoiceResults(invRes.value.data.items.slice(0, 5));
        } else {
          setInvoiceResults([]);
        }
      } catch (err: any) {
        setError('Failed to fetch some search results. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Matching static destinations
  const matchingDestinations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STATIC_DESTINATIONS.slice(0, 6);
    return STATIC_DESTINATIONS.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.keywords.some(k => k.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  }, [query]);

  // Flattened items for keyboard navigation
  const flatItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'page' | 'product' | 'customer' | 'invoice' | 'ai';
      title: string;
      subtitle: string;
      action: () => void;
      badge?: string;
    }> = [];

    const isQuestion = /^(how|what|why|who|where|when|check|show|list|tell|explain|find|is|are|can)\b/i.test(query.trim()) || query.includes('?');

    if (activeTab === 'all' || activeTab === 'pages') {
      matchingDestinations.forEach(d => {
        items.push({
          id: d.id,
          type: 'page',
          title: d.title,
          subtitle: d.category,
          badge: 'Page',
          action: () => {
            navigate(d.path);
            onClose();
          }
        });
      });
    }

    if (activeTab === 'all' || activeTab === 'products') {
      productResults.forEach((p, idx) => {
        items.push({
          id: `prod-${p.ItemCode || idx}`,
          type: 'product',
          title: p.ItemName || p.ItemCode,
          subtitle: `Code: ${p.ItemCode} • Stock: ${p.OnHand ?? p.Stock ?? 'N/A'} • Price: ₹${p.Price || 0}`,
          badge: 'Product',
          action: () => {
            navigate(`/products?search=${encodeURIComponent(p.ItemCode)}`);
            onClose();
          }
        });
      });
    }

    if (activeTab === 'all' || activeTab === 'customers') {
      customerResults.forEach((c, idx) => {
        items.push({
          id: `cust-${c.CardCode || idx}`,
          type: 'customer',
          title: c.CardName || c.name || 'Customer',
          subtitle: `Code: ${c.CardCode || '-'} • Phone: ${c.Phone1 || c.mobile || '-'}`,
          badge: 'Customer',
          action: () => {
            navigate(`/customers`);
            onClose();
          }
        });
      });
    }

    if (activeTab === 'all' || activeTab === 'invoices') {
      invoiceResults.forEach((inv, idx) => {
        const invNum = inv.docNum || inv.docEntry || inv.saleId || `INV-${idx+1}`;
        items.push({
          id: `inv-${invNum}`,
          type: 'invoice',
          title: `Invoice #${invNum} — ${inv.customerName || 'Customer'}`,
          subtitle: `Amount: ₹${Number(inv.total || 0).toLocaleString('en-IN')} • Date: ${inv.docDate || 'Recent'}`,
          badge: 'Invoice',
          action: () => {
            if (inv.docEntry || inv.docNum) {
              navigate(`/sales/${inv.docEntry || inv.docNum}`);
            } else {
              navigate('/sales');
            }
            onClose();
          }
        });
      });
    }

    if (query.trim().length > 2) {
      items.push({
        id: 'action-ai-query',
        type: 'ai',
        title: `Ask AI Assistant: "${query.trim()}"`,
        subtitle: isQuestion ? 'Natural-language business intelligence question' : 'Query assistant for data insights',
        badge: 'AI Prompt',
        action: () => {
          if (onAskAI) {
            onAskAI(query.trim());
          }
          onClose();
        }
      });
    }

    return items;
  }, [activeTab, matchingDestinations, productResults, customerResults, invoiceResults, query, navigate, onClose, onAskAI]);

  // Adjust selection if out of bounds
  useEffect(() => {
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(0);
    }
  }, [flatItems.length, selectedIndex]);

  // Keyboard navigation handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (flatItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (flatItems.length || 1)) % (flatItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          flatItems[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-4 border-b border-slate-200 gap-3 bg-white">
          <Search className="h-5.5 w-5.5 text-blue-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search products, customers, invoices, pages, or ask a question..."
            className="flex-1 text-[15px] sm:text-[16px] text-slate-900 placeholder:text-slate-400 bg-transparent outline-none font-medium"
          />
          {loading && (
            <div className="flex items-center gap-1.5 text-[13px] text-blue-600 font-semibold animate-pulse">
              <span>Searching...</span>
            </div>
          )}
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded px-2.5 py-1 text-[12px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200"
          >
            ESC
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto text-[13px] font-semibold text-slate-600">
          <span className="text-slate-400 mr-1 text-[11.5px] uppercase font-bold tracking-wider">Filter:</span>
          {(['all', 'pages', 'products', 'customers', 'invoices'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSelectedIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                activeTab === tab 
                  ? 'bg-blue-600 text-white font-bold shadow-sm' 
                  : 'hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab === 'all' ? 'All Results' : tab}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 max-h-[460px]">
          {error && (
            <div className="p-3 my-2 text-[13.5px] text-amber-700 bg-amber-50 rounded-lg border border-amber-200 font-medium">
              {error}
            </div>
          )}

          {flatItems.length === 0 && !loading && (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Search className="h-9 w-9 text-slate-300" />
              <p className="text-[15px] font-bold text-slate-700">No results found for "{query}"</p>
              <p className="text-[13.5px] text-slate-500">Try searching for product names, customer phone numbers, invoice IDs, or routes.</p>
            </div>
          )}

          {flatItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`group flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-blue-50/80 border border-blue-200' 
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    item.type === 'ai' 
                      ? 'bg-purple-100 text-purple-600'
                      : item.type === 'product'
                      ? 'bg-emerald-100 text-emerald-700'
                      : item.type === 'customer'
                      ? 'bg-amber-100 text-amber-700'
                      : item.type === 'invoice'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {item.type === 'ai' && <Sparkles className="h-4.5 w-4.5" />}
                    {item.type === 'product' && <Package className="h-4.5 w-4.5" />}
                    {item.type === 'customer' && <Users className="h-4.5 w-4.5" />}
                    {item.type === 'invoice' && <FileText className="h-4.5 w-4.5" />}
                    {item.type === 'page' && <LayoutDashboard className="h-4.5 w-4.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-bold text-slate-900 truncate">
                      {item.title}
                    </div>
                    <div className="text-[13px] text-slate-500 font-medium truncate">
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {item.badge && (
                    <span className={`text-[12px] font-bold px-2.5 py-1 rounded-md ${
                      item.type === 'ai' 
                        ? 'bg-purple-100 text-purple-700'
                        : item.type === 'product'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.type === 'customer'
                        ? 'bg-amber-100 text-amber-700'
                        : item.type === 'invoice'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {isSelected ? (
                    <CornerDownLeft className="h-4 w-4 text-blue-600" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-[12.5px] sm:text-[13px] text-slate-600 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[11px] font-bold bg-white border border-slate-200 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 text-[11px] font-bold bg-white border border-slate-200 rounded">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[11px] font-bold bg-white border border-slate-200 rounded">↵</kbd>
              Open
            </span>
          </div>
          <span className="text-[12px] text-slate-500 font-medium">
            Real SAP & ATLS database queries
          </span>
        </div>
      </div>
    </div>
  );
};
