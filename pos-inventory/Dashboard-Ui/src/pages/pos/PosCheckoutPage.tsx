/**
 * POS & Checkout Page — Phase 3
 *
 * Two-column desktop layout:
 *  Left:  Product search + catalog
 *  Right: Cart + checkout panel
 *
 * Fully connected to real backend endpoints via posApi.
 * Cart state is local; no backend cart/session exists.
 * Customer selection uses real /customers/search endpoint.
 * GST values fetched from /sales/gst-values on mount.
 * Sale submission via POST /api/v1/sales.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { posApi } from '../../api/pos';
import { useDebounce } from '../../hooks/useDebounce';
import type {
  Product,
  CartLine,
  CustomerDetails,
  CustomerSearchResult,
  PaymentMethodEntry,
  PaymentMethodType,
  SaleCreatePayload,
  SaleResponse,
  DiscountMode,
  CheckoutResult,
} from '../../types/pos';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Phone,
  Package,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  ReceiptText,
  Tag,
  Building2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

const PAYMENT_OPTIONS: { type: PaymentMethodType; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { type: 'cash', label: 'Cash', icon: Banknote },
  { type: 'card', label: 'Card', icon: CreditCard },
  { type: 'upi', label: 'UPI', icon: Smartphone },
  { type: 'wallet', label: 'Wallet', icon: Wallet },
];

function stockLabel(stock: number | null | undefined): React.ReactNode {
  if (stock === null || stock === undefined)
    return <span className="text-xs text-slate-400">Stock unknown</span>;
  if (stock <= 0)
    return <span className="text-xs font-semibold text-red-500">Out of stock</span>;
  if (stock <= 5)
    return <span className="text-xs font-semibold text-amber-500">Low stock: {stock}</span>;
  return <span className="text-xs text-emerald-600 font-medium">In stock: {stock}</span>;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product;
  onAdd: (p: Product) => void;
  cartQty: number;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAdd, cartQty }) => {
  const outOfStock = product.stock !== null && product.stock !== undefined && product.stock <= 0;
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 ${
        outOfStock ? 'opacity-60' : ''
      }`}
    >
      {/* Image or placeholder */}
      <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center relative">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <Package size={32} className="text-slate-300" />
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center rounded-lg">
            <span className="text-white text-xs font-bold bg-red-500 px-2 py-0.5 rounded">
              Out of Stock
            </span>
          </div>
        )}
        {cartQty > 0 && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold shadow">
            {cartQty}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">{product.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{product.id}</p>
        {product.barcode && (
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <Tag size={10} /> {product.barcode}
          </p>
        )}
        <div className="mt-1">{stockLabel(product.stock)}</div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto">
        <span className="text-base font-bold text-blue-700">{fmt(product.price)}</span>
        <button
          onClick={() => onAdd(product)}
          disabled={outOfStock}
          aria-label={`Add ${product.name} to cart`}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  );
};

// ── Cart Line Item ─────────────────────────────────────────────────────────────

interface CartLineItemProps {
  line: CartLine;
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

const CartLineItem: React.FC<CartLineItemProps> = ({ line, onQtyChange, onRemove }) => {
  const { product, quantity } = line;
  const maxQty =
    product.stock !== null && product.stock !== undefined && product.stock > 0
      ? Math.floor(product.stock)
      : 9999; // No cap if stock unknown
  const lineTotal = product.price * quantity;

  const [editingQty, setEditingQty] = useState(false);
  const [inputVal, setInputVal] = useState(String(quantity));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingQty && inputRef.current) inputRef.current.select();
  }, [editingQty]);

  const commitQty = () => {
    const parsed = parseInt(inputVal, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= maxQty) {
      onQtyChange(product.id, parsed);
    }
    setInputVal(String(quantity));
    setEditingQty(false);
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0 group">
      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 leading-tight truncate">{product.name}</p>
        <p className="text-xs text-slate-400">{product.id} · {fmt(product.price)}</p>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onQtyChange(product.id, Math.max(1, quantity - 1))}
          aria-label="Decrease quantity"
          className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-40"
          disabled={quantity <= 1}
        >
          <Minus size={12} />
        </button>

        {editingQty ? (
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={maxQty}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={commitQty}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitQty();
              if (e.key === 'Escape') { setInputVal(String(quantity)); setEditingQty(false); }
            }}
            className="w-10 text-center text-sm font-semibold border border-blue-400 rounded-md py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          <button
            onClick={() => { setInputVal(String(quantity)); setEditingQty(true); }}
            aria-label="Edit quantity"
            className="w-8 text-center text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
          >
            {quantity}
          </button>
        )}

        <button
          onClick={() => onQtyChange(product.id, Math.min(maxQty, quantity + 1))}
          aria-label="Increase quantity"
          className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-40"
          disabled={quantity >= maxQty}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Line total */}
      <div className="text-right min-w-[70px]">
        <p className="text-sm font-semibold text-slate-900">{fmt(lineTotal)}</p>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(product.id)}
        aria-label={`Remove ${product.name} from cart`}
        className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
};

// ── Customer Search Panel ──────────────────────────────────────────────────────

interface CustomerPanelProps {
  selected: CustomerDetails | null;
  onSelect: (c: CustomerDetails | null) => void;
}

const CustomerPanel: React.FC<CustomerPanelProps> = ({ selected, onSelect }) => {
  const [mobileQuery, setMobileQuery] = useState('');
  const debouncedMobile = useDebounce(mobileQuery, 400);
  const [open, setOpen] = useState(false);

  const { data: results, isLoading } = useQuery({
    queryKey: ['customer-search', debouncedMobile],
    queryFn: () => posApi.searchCustomersByMobile(debouncedMobile),
    enabled: debouncedMobile.trim().length >= 4,
  });

  const pickResult = (r: CustomerSearchResult) => {
    onSelect({
      name: r.name,
      phone: r.mobile,
      email: r.email ?? undefined,
      address: r.address ?? undefined,
    });
    setOpen(false);
    setMobileQuery('');
  };

  if (selected) {
    return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <User size={15} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{selected.name}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Phone size={10} /> {selected.phone}
          </p>
        </div>
        <button
          onClick={() => onSelect(null)}
          aria-label="Remove customer"
          className="text-slate-400 hover:text-red-500 transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
        >
          <User size={15} />
          <span>Search customer by mobile…</span>
        </button>
      ) : (
        <div>
          <div className="relative mb-1">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="tel"
              placeholder="Enter mobile number (min 4 digits)"
              value={mobileQuery}
              onChange={(e) => setMobileQuery(e.target.value.replace(/\D/g, '').slice(0, 20))}
              className="w-full pl-9 pr-8 py-2 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => { setOpen(false); setMobileQuery(''); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
          {isLoading && (
            <div className="text-center py-2">
              <Loader2 size={16} className="animate-spin text-blue-500 mx-auto" />
            </div>
          )}
          {results && results.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm mt-1 max-h-44 overflow-y-auto">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => pickResult(r)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-900">{r.name || 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{r.mobile} {r.invoiceCount != null ? `· ${r.invoiceCount} orders` : ''}</p>
                </button>
              ))}
            </div>
          )}
          {results && results.length === 0 && debouncedMobile.length >= 4 && !isLoading && (
            <p className="text-xs text-slate-400 text-center py-2">No customers found. A walk-in customer will be created.</p>
          )}
          {/* Quick walk-in entry */}
          <button
            onClick={() => {
              setOpen(false);
              setMobileQuery('');
            }}
            className="w-full mt-1.5 text-xs text-slate-400 hover:text-slate-600 py-1 text-center"
          >
            Cancel / Use walk-in customer
          </button>
        </div>
      )}
    </div>
  );
};

// ── Checkout Result ────────────────────────────────────────────────────────────

interface CheckoutResultPanelProps {
  result: CheckoutResult;
  onNewSale: () => void;
}

const CheckoutResultPanel: React.FC<CheckoutResultPanelProps> = ({ result, onNewSale }) => {
  const navigate = useNavigate();

  if (result.success && result.response) {
    const { response } = result;
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 gap-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-in zoom-in-50 duration-300">
          <CheckCircle2 size={44} className="text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sale Completed!</h2>
          <p className="text-slate-500 mt-1.5 text-sm">Invoice created successfully in SAP.</p>
        </div>

        <div className="w-full max-w-xs bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Sale ID</span>
            <span className="font-semibold text-slate-800">{response.saleId}</span>
          </div>
          {response.sapDocNum != null && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">SAP Doc #</span>
              <span className="font-semibold text-slate-800">{response.sapDocNum}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
            <span className="text-slate-500 font-semibold">Total Paid</span>
            <span className="font-bold text-blue-700 text-base">{fmt(response.total)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          {response.sapDocEntry != null && (
            <button
              onClick={() => navigate(`/sales/${response.sapDocEntry}`)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              <ExternalLink size={16} />
              View Invoice Details
            </button>
          )}
          <button
            onClick={onNewSale}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={16} />
            New Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 gap-6">
      <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
        {result.ambiguous ? (
          <AlertTriangle size={44} className="text-amber-500" />
        ) : (
          <AlertCircle size={44} className="text-red-500" />
        )}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          {result.ambiguous ? 'Outcome Uncertain' : 'Sale Failed'}
        </h2>
        {result.ambiguous ? (
          <p className="text-slate-500 mt-2 text-sm max-w-xs">
            The request timed out. The invoice may or may not have been created in SAP. 
            Please check the <strong>Sales & Invoices</strong> list before retrying to avoid a duplicate.
          </p>
        ) : (
          <p className="text-red-600 mt-2 text-sm max-w-xs">{result.errorMessage || 'An unknown error occurred.'}</p>
        )}
      </div>
      <button
        onClick={onNewSale}
        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Cart
      </button>
    </div>
  );
};

// ── Main POS Page ──────────────────────────────────────────────────────────────

export const PosCheckoutPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart state
  const [cart, setCart] = useState<CartLine[]>([]);

  // Customer
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);

  // Payment method
  const [paymentType, setPaymentType] = useState<PaymentMethodType>('cash');
  const [receivedAmount, setReceivedAmount] = useState('');

  // Discount
  const [discountMode, setDiscountMode] = useState<DiscountMode>('percent');
  const [discountValue, setDiscountValue] = useState('0');

  // Checkout step: 'cart' | 'review' | 'result'
  const [step, setStep] = useState<'cart' | 'review' | 'result'>('cart');
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);

  // Clear cart confirmation
  const [clearConfirm, setClearConfirm] = useState(false);

  // Walk-in customer form (shown in review step if no customer searched)
  const [walkinName, setWalkinName] = useState('Walk-in Customer');
  const [walkinPhone, setWalkinPhone] = useState('0000000000');

  // ── Product Search Query ────────────────────────────────────────────────────

  const { data: products, isLoading: productsLoading, isError: productsError, error: productsErr, refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ['pos-products', debouncedSearch],
    queryFn: () => posApi.searchProducts(debouncedSearch),
    staleTime: 60_000, // 1 min — products are cached upstream by backend too
    retry: 1,
  });

  // ── GST Values Query ────────────────────────────────────────────────────────

  const { data: gstData } = useQuery({
    queryKey: ['gst-values'],
    queryFn: () => posApi.getGstValues(),
    staleTime: 300_000, // 5 min
    retry: 1,
  });

  const defaultGst = gstData?.default ?? 18;

  // ── Cart calculations ───────────────────────────────────────────────────────

  const subtotal = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  const discountNum = parseFloat(discountValue) || 0;
  const discountAmount =
    discountMode === 'percent'
      ? (subtotal * Math.min(100, Math.max(0, discountNum))) / 100
      : Math.min(subtotal, Math.max(0, discountNum));

  const afterDiscount = subtotal - discountAmount;
  const gstAmount = (afterDiscount * defaultGst) / 100;
  const grandTotal = afterDiscount + gstAmount;

  const changeAmount =
    paymentType === 'cash' && receivedAmount
      ? parseFloat(receivedAmount) - grandTotal
      : null;

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  // ── Cart actions ────────────────────────────────────────────────────────────

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        const maxQty =
          product.stock !== null && product.stock !== undefined && product.stock > 0
            ? Math.floor(product.stock)
            : 9999;
        if (existing.quantity >= maxQty) return prev;
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const changeQty = useCallback((id: string, qty: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.product.id !== id) return l;
        const maxQty =
          l.product.stock !== null && l.product.stock !== undefined && l.product.stock > 0
            ? Math.floor(l.product.stock)
            : 9999;
        const safe = Math.max(1, Math.min(qty, maxQty));
        return { ...l, quantity: safe };
      })
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((l) => l.product.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setClearConfirm(false);
    setStep('cart');
    setCheckoutResult(null);
    setDiscountValue('0');
    setReceivedAmount('');
  }, []);

  // ── Submit Sale Mutation ────────────────────────────────────────────────────

  const submitMutation = useMutation<SaleResponse, unknown, SaleCreatePayload>({
    mutationFn: posApi.createSale,
    onSuccess: (data) => {
      setCheckoutResult({ success: true, response: data });
      setStep('result');
      // Invalidate sales queries so Sales & Invoices list is refreshed
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { code?: string; response?: { status?: number; data?: { detail?: string } } };
      const isTimeout = axiosErr?.code === 'ECONNABORTED' || axiosErr?.code === 'ERR_NETWORK';
      const is502 = axiosErr?.response?.status === 502;

      const detail =
        axiosErr?.response?.data?.detail ||
        (isTimeout ? 'Request timed out.' : 'An unexpected error occurred.');

      setCheckoutResult({
        success: false,
        errorMessage: detail,
        ambiguous: isTimeout || is502,
      });
      setStep('result');
    },
  });

  const handleSubmit = () => {
    if (cart.length === 0 || submitMutation.isPending) return;

    const effectiveCustomer: CustomerDetails = customer ?? {
      name: walkinName.trim() || 'Walk-in Customer',
      phone: walkinPhone.trim() || '0000000000',
    };

    const paymentMethods: PaymentMethodEntry[] = [
      { type: paymentType, amount: grandTotal },
    ];

    const payload: SaleCreatePayload = {
      items: cart.map((l) => ({ product: l.product, quantity: l.quantity })),
      total: Math.round(grandTotal * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discountAmount * 100) / 100,
      gst: Math.round(gstAmount * 100) / 100,
      gstPercentage: defaultGst,
      customer: effectiveCustomer,
      paymentMethods,
    };

    submitMutation.mutate(payload);
  };

  // ── New sale reset ──────────────────────────────────────────────────────────

  const handleNewSale = () => {
    clearCart();
    setCustomer(null);
    setWalkinName('Walk-in Customer');
    setWalkinPhone('0000000000');
    setPaymentType('cash');
    setReceivedAmount('');
    setDiscountValue('0');
    setStep('cart');
    setCheckoutResult(null);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // ── Branch context ──────────────────────────────────────────────────────────

  const DEV_PREVIEW = import.meta.env.DEV;
  const displayUser = user || (DEV_PREVIEW ? { name: 'Demo User', role: 'cashier', store_name: 'Main Branch', branch_id: undefined } : null);

  // ── Keyboard shortcut: F1 focuses search ───────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-600" />
            POS &amp; Checkout
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Create a sale and complete checkout.</p>
        </div>

        {displayUser?.store_name && (
          <div className="hidden sm:flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full text-sm text-blue-700 font-medium">
            <Building2 size={14} />
            {displayUser.store_name}
            {displayUser.branch_id && (
              <span className="text-blue-400 text-xs">({displayUser.branch_id})</span>
            )}
          </div>
        )}
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row min-h-0">

        {/* ── LEFT: Product Search & Catalog ──────────────────────────────── */}
        <div className="flex flex-col lg:flex-1 overflow-hidden border-r border-slate-200 bg-slate-50">
          {/* Search bar */}
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                id="pos-product-search"
                type="text"
                placeholder="Search products by name, SKU, or scan barcode… (F1)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
                className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 hover:bg-white transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {productsLoading && (
              <div className="flex items-center justify-center h-40">
                <Loader2 size={28} className="animate-spin text-blue-500" />
              </div>
            )}

            {productsError && !productsLoading && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                <AlertCircle size={24} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-red-800">Could not load products</p>
                <p className="text-xs text-red-600 mt-1">
                  {(productsErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Backend unavailable.'}
                </p>
                <button
                  onClick={() => refetchProducts()}
                  className="mt-3 text-sm text-red-700 underline hover:text-red-600"
                >
                  Try again
                </button>
              </div>
            )}

            {!productsLoading && !productsError && products?.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Package size={36} className="text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">No products found</p>
                <p className="text-xs text-slate-400 mt-1">Try a different search term or clear the search.</p>
              </div>
            )}

            {!productsLoading && !productsError && products && products.length > 0 && (
              <>
                <p className="text-xs text-slate-400 mb-3">
                  {products.length} product{products.length !== 1 ? 's' : ''} {debouncedSearch ? `matching "${debouncedSearch}"` : 'available'}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {products.map((p) => {
                    const cartLine = cart.find((l) => l.product.id === p.id);
                    return (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onAdd={addToCart}
                        cartQty={cartLine?.quantity ?? 0}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Cart + Checkout Panel ────────────────────────────────── */}
        <div className="lg:w-96 flex flex-col bg-white overflow-hidden flex-shrink-0 border-t lg:border-t-0 border-slate-200">

          {/* Result step */}
          {step === 'result' && checkoutResult && (
            <CheckoutResultPanel result={checkoutResult} onNewSale={handleNewSale} />
          )}

          {/* Cart & Review steps */}
          {step !== 'result' && (
            <>
              {/* Cart header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={16} className="text-blue-600" />
                  <span className="font-semibold text-slate-900 text-sm">
                    Cart {cartCount > 0 && <span className="text-blue-600">({cartCount} item{cartCount !== 1 ? 's' : ''})</span>}
                  </span>
                </div>
                {cart.length > 0 && (
                  <div>
                    {clearConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Clear all?</span>
                        <button
                          onClick={clearCart}
                          className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-0.5 bg-red-50 rounded"
                        >
                          Yes, clear
                        </button>
                        <button
                          onClick={() => setClearConfirm(false)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setClearConfirm(true)}
                        className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={12} />
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Cart lines */}
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12 text-slate-400">
                    <ShoppingCart size={40} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">Cart is empty</p>
                    <p className="text-xs mt-1 opacity-70">Add products from the catalog.</p>
                  </div>
                ) : (
                  <>
                    {cart.map((line) => (
                      <CartLineItem
                        key={line.product.id}
                        line={line}
                        onQtyChange={changeQty}
                        onRemove={removeFromCart}
                      />
                    ))}
                  </>
                )}
              </div>

              {/* Cart summary & checkout controls */}
              {cart.length > 0 && (
                <div className="border-t border-slate-100 px-4 pt-3 pb-4 space-y-3 flex-shrink-0">

                  {/* Customer */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Customer
                    </label>
                    <CustomerPanel selected={customer} onSelect={setCustomer} />
                  </div>

                  {/* Discount */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Discount
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                        <button
                          onClick={() => setDiscountMode('percent')}
                          className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            discountMode === 'percent'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          %
                        </button>
                        <button
                          onClick={() => setDiscountMode('amount')}
                          className={`px-2.5 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${
                            discountMode === 'amount'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          ₹
                        </button>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={discountMode === 'percent' ? 100 : subtotal}
                        step="0.01"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {discountMode === 'percent' && (
                        <span className="text-xs text-slate-500 font-medium">%</span>
                      )}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-medium">{fmt(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span className="flex items-center gap-1">
                          <Tag size={12} />
                          Discount
                          {discountMode === 'percent' && discountNum > 0 && ` (${discountNum}%)`}
                        </span>
                        <span className="font-medium text-amber-600">- {fmt(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>GST ({defaultGst}%)</span>
                      <span className="font-medium">{fmt(gstAmount)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-900 text-base">
                      <span>Grand Total</span>
                      <span className="text-blue-700">{fmt(grandTotal)}</span>
                    </div>
                  </div>

                  {/* Payment method */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PAYMENT_OPTIONS.map(({ type, label, icon: Icon }) => (
                        <button
                          key={type}
                          onClick={() => setPaymentType(type)}
                          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-medium border transition-all duration-150 ${
                            paymentType === type
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-300'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <Icon size={16} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cash received / change */}
                  {paymentType === 'cash' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 block mb-1">Received Amount (₹)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={receivedAmount}
                            onChange={(e) => setReceivedAmount(e.target.value)}
                            placeholder={String(Math.ceil(grandTotal))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 block mb-1">Change</label>
                          <div className={`w-full border rounded-lg px-3 py-1.5 text-sm font-semibold ${
                            changeAmount !== null && changeAmount < 0
                              ? 'bg-red-50 border-red-200 text-red-600'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          }`}>
                            {changeAmount !== null
                              ? fmt(Math.max(0, changeAmount))
                              : fmt(0)}
                          </div>
                        </div>
                      </div>
                      {changeAmount !== null && changeAmount < 0 && (
                        <p className="text-xs text-red-500">Received amount is less than total.</p>
                      )}
                    </div>
                  )}

                  {/* Review + Submit */}
                  {step === 'cart' && (
                    <button
                      onClick={() => setStep('review')}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 shadow-sm shadow-blue-300"
                    >
                      Review Order
                      <ChevronRight size={16} />
                    </button>
                  )}

                  {step === 'review' && (
                    <div className="space-y-2">
                      {/* Review summary */}
                      <div className="bg-slate-50 rounded-xl border border-slate-200 px-3 py-2.5 space-y-1 text-xs text-slate-600">
                        <p className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                          <ReceiptText size={13} className="text-blue-500" />
                          Order Summary
                        </p>
                        <p>{cart.length} line{cart.length !== 1 ? 's' : ''} · {cartCount} item{cartCount !== 1 ? 's' : ''}</p>
                        <p>Customer: <strong>{customer?.name ?? walkinName}</strong> · {customer?.phone ?? walkinPhone}</p>
                        <p>Payment: <strong className="capitalize">{paymentType}</strong></p>
                        <p className="font-semibold text-slate-900 pt-1 border-t border-slate-200 mt-1">
                          Total: {fmt(grandTotal)}
                        </p>
                        {!customer && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                            <p className="text-slate-500 font-medium">Walk-in Customer Details</p>
                            <input
                              type="text"
                              placeholder="Customer name"
                              value={walkinName}
                              onChange={(e) => setWalkinName(e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="tel"
                              placeholder="Phone number"
                              value={walkinPhone}
                              onChange={(e) => setWalkinPhone(e.target.value.replace(/\D/g, '').slice(0, 20))}
                              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStep('cart')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
                        >
                          <ArrowLeft size={14} />
                          Back
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={
                            submitMutation.isPending ||
                            cart.length === 0 ||
                            (paymentType === 'cash' && receivedAmount !== '' && parseFloat(receivedAmount) < grandTotal)
                          }
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-150 shadow-sm shadow-emerald-300"
                        >
                          {submitMutation.isPending ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Creating Invoice…
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} />
                              Complete Sale
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
