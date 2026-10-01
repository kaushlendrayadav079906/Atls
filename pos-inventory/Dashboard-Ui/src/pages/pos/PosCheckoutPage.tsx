import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { posApi } from '../../api/pos';
import { useDebounce } from '../../hooks/useDebounce';
import type {
  Product,
  CartLine,
  CustomerDetails,
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
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  User,
  Package,
  CreditCard,
  Banknote,
  Smartphone,
  ReceiptText,
  AlertTriangle,
  Scan,
  Keyboard,
  LayoutGrid,
  Monitor,
  Headphones,
  Printer,
  Speaker,
  Globe
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

const PAYMENT_OPTIONS: { type: PaymentMethodType; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { type: 'cash', label: 'Cash', icon: Banknote },
  { type: 'card', label: 'Card', icon: CreditCard },
  { type: 'upi', label: 'UPI', icon: Smartphone },
  { type: 'wallet', label: 'Online', icon: Globe },
];

const CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: LayoutGrid },
  { id: 'electronics', label: 'Electronics', icon: Monitor },
  { id: 'accessories', label: 'Accessories', icon: Headphones },
  { id: 'office', label: 'Office Equipment', icon: Printer },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'audio', label: 'Audio', icon: Speaker },
];

function stockBadge(stock: number | null | undefined): React.ReactNode {
  if (stock === null || stock === undefined)
    return <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-500">Unknown</span>;
  if (stock <= 0)
    return <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">Out of Stock</span>;
  if (stock <= 5)
    return <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">Low Stock</span>;
  return <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600">In Stock</span>;
}

interface ProductCardProps {
  product: Product;
  onAdd: (p: Product) => void;
  cartQty: number;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAdd, cartQty }) => {
  const outOfStock = product.stock !== null && product.stock !== undefined && product.stock <= 0;
  return (
    <div
      className={`relative flex flex-col rounded-[16px] border border-slate-200 bg-white p-3 transition-all duration-200 hover:border-blue-500/50 hover:bg-white ${
        outOfStock ? 'opacity-50 grayscale-[50%]' : ''
      }`}
    >
      {stockBadge(product.stock)}
      {cartQty > 0 && (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-lg shadow-blue-900/50 z-10">
          {cartQty}
        </div>
      )}

      <div className="mx-auto mt-4 mb-2 flex h-24 w-24 items-center justify-center rounded-xl bg-slate-50 p-2">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <Package size={32} className="text-sky-800/50" />
        )}
      </div>

      <div className="flex-1 mt-2">
        <p className="text-[13px] font-bold leading-tight text-slate-900 line-clamp-1">{product.name}</p>
        <p className="mt-1 text-[10px] text-slate-500">SKU: {product.id}</p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <span className="text-[14px] font-bold text-slate-900">{fmt(product.price)}</span>
          <p className="text-[10px] text-slate-500">Stock: {product.stock ?? 'N/A'}</p>
        </div>
        {!outOfStock ? (
          <button
            onClick={() => onAdd(product)}
            className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 active:scale-95"
          >
            <Plus size={12} />
            Add
          </button>
        ) : (
          <button disabled className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
            Out of Stock
          </button>
        )}
      </div>
    </div>
  );
};

interface CartLineItemProps {
  line: CartLine;
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

const CartLineItem: React.FC<CartLineItemProps> = ({ line, onQtyChange, onRemove }) => {
  const { product, quantity } = line;
  const maxQty = product.stock !== null && product.stock !== undefined && product.stock > 0 ? Math.floor(product.stock) : 9999;
  const lineTotal = product.price * quantity;

  return (
    <div className="group flex items-center gap-3 border-b border-slate-200 py-3 last:border-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-8 w-8 object-contain" />
        ) : (
          <Package size={16} className="text-sky-800/50" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-slate-900">{product.name}</p>
        <p className="text-[10px] text-slate-500">SKU: {product.id}</p>
        <p className="text-[11px] font-semibold text-slate-900">{fmt(product.price)}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border border-slate-200 bg-slate-50">
          <button
            onClick={() => onQtyChange(product.id, Math.max(1, quantity - 1))}
            className="flex h-6 w-6 items-center justify-center text-slate-700 hover:text-slate-900 disabled:opacity-30"
            disabled={quantity <= 1}
          >
            <Minus size={12} />
          </button>
          <span className="w-6 text-center text-[12px] font-semibold text-slate-900">{quantity}</span>
          <button
            onClick={() => onQtyChange(product.id, Math.min(maxQty, quantity + 1))}
            className="flex h-6 w-6 items-center justify-center text-slate-700 hover:text-slate-900 disabled:opacity-30"
            disabled={quantity >= maxQty}
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="w-16 text-right text-[12px] font-bold text-slate-900">
          {fmt(lineTotal)}
        </div>
        <button
          onClick={() => onRemove(product.id)}
          className="flex h-6 w-6 items-center justify-center rounded bg-red-50 text-red-400 hover:bg-red-50"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export const PosCheckoutPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentMethodType>('cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('percent');
  const [discountValue, setDiscountValue] = useState('0');
  const [step, setStep] = useState<'cart' | 'result'>('cart');
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [walkinName] = useState('Walk-in Customer');
  const [walkinPhone] = useState('0000000000');
  const [activeCategory, setActiveCategory] = useState('all');

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['pos-products', debouncedSearch],
    queryFn: () => posApi.searchProducts(debouncedSearch),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: gstData } = useQuery({
    queryKey: ['gst-values'],
    queryFn: () => posApi.getGstValues(),
    staleTime: 300_000,
    retry: 1,
  });
  const defaultGst = gstData?.default ?? 18;

  const subtotal = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const discountNum = parseFloat(discountValue) || 0;
  const discountAmount = discountMode === 'percent'
      ? (subtotal * Math.min(100, Math.max(0, discountNum))) / 100
      : Math.min(subtotal, Math.max(0, discountNum));
  const afterDiscount = subtotal - discountAmount;
  const gstAmount = (afterDiscount * defaultGst) / 100;
  const grandTotal = afterDiscount + gstAmount;

  const changeAmount = paymentType === 'cash' && receivedAmount
      ? parseFloat(receivedAmount) - grandTotal
      : null;
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        const maxQty = product.stock !== null && product.stock !== undefined && product.stock > 0 ? Math.floor(product.stock) : 9999;
        if (existing.quantity >= maxQty) return prev;
        return prev.map((l) => l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const changeQty = useCallback((id: string, qty: number) => {
    setCart((prev) => prev.map((l) => {
      if (l.product.id !== id) return l;
      const maxQty = l.product.stock !== null && l.product.stock !== undefined && l.product.stock > 0 ? Math.floor(l.product.stock) : 9999;
      return { ...l, quantity: Math.max(1, Math.min(qty, maxQty)) };
    }));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((l) => l.product.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setStep('cart');
    setCheckoutResult(null);
    setDiscountValue('0');
    setReceivedAmount('');
  }, []);

  const submitMutation = useMutation<SaleResponse, unknown, SaleCreatePayload>({
    mutationFn: posApi.createSale,
    onSuccess: (data) => {
      setCheckoutResult({ success: true, response: data });
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (err: unknown) => {
      const axiosErr = err as any;
      const isTimeout = axiosErr?.code === 'ECONNABORTED' || axiosErr?.code === 'ERR_NETWORK';
      const is502 = axiosErr?.response?.status === 502;
      setCheckoutResult({
        success: false,
        errorMessage: axiosErr?.response?.data?.detail || (isTimeout ? 'Request timed out.' : 'An unexpected error occurred.'),
        ambiguous: isTimeout || is502,
      });
      setStep('result');
    },
  });

  const handleSubmit = () => {
    if (cart.length === 0 || submitMutation.isPending) return;
    const effectiveCustomer = customer ?? { name: walkinName, phone: walkinPhone };
    const payload: SaleCreatePayload = {
      items: cart.map((l) => ({ product: l.product, quantity: l.quantity })),
      total: Math.round(grandTotal * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discountAmount * 100) / 100,
      gst: Math.round(gstAmount * 100) / 100,
      gstPercentage: defaultGst,
      customer: effectiveCustomer,
      paymentMethods: [{ type: paymentType, amount: grandTotal }],
    };
    submitMutation.mutate(payload);
  };

  const handleNewSale = () => {
    clearCart();
    setCustomer(null);
    setPaymentType('cash');
    searchInputRef.current?.focus();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSubmit]);

  return (
    <div className="flex h-full w-full gap-5 bg-slate-50 text-slate-900">
      {/* LEFT: Product Catalog */}
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-slate-900">Point of Sale</h1>
          <p className="mt-1 text-[13px] text-slate-500">Scan barcode or search products to add to cart</p>
        </div>

        {/* Search Bar & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600/60" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products by name, SKU, or scan barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-[13px] text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <Scan className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600/60" />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[9px] text-slate-500 hover:bg-slate-100">
              <Scan className="mb-0.5 h-3.5 w-3.5" />
              F1 Scan
            </button>
            <button className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[9px] text-slate-500 hover:bg-slate-100">
              <Search className="mb-0.5 h-3.5 w-3.5" />
              F2 Search
            </button>
            <button className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[9px] text-slate-500 hover:bg-slate-100">
              <Keyboard className="mb-0.5 h-3.5 w-3.5" />
              F3 Manual
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all ${
                activeCategory === c.id
                  ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <c.icon className="h-3.5 w-3.5" />
              {c.label}
            </button>
          ))}
          <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          {productsLoading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(products || []).map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAdd={addToCart}
                  cartQty={cart.find((l) => l.product.id === p.id)?.quantity ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart Pane */}
      <div className="flex w-[340px] shrink-0 flex-col rounded-[20px] bg-white border border-slate-200 shadow-xl lg:w-[380px]">
        {step === 'result' && checkoutResult ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            {checkoutResult.success ? (
              <>
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h2 className="text-[20px] font-bold text-slate-900">Sale Completed!</h2>
                <p className="mt-2 text-[12px] text-slate-500">Invoice ID: {checkoutResult.response?.sapDocNum || checkoutResult.response?.saleId}</p>
                <div className="my-6 w-full rounded-xl border border-slate-200 bg-white p-4 text-[14px]">
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Total Paid</span>
                    <span className="font-bold text-slate-900">{fmt(checkoutResult.response?.total || grandTotal)}</span>
                  </div>
                </div>
                <button
                  onClick={handleNewSale}
                  className="w-full rounded-xl bg-blue-600 py-3 text-[14px] font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500"
                >
                  New Sale
                </button>
              </>
            ) : (
              <>
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle className="h-10 w-10" />
                </div>
                <h2 className="text-[20px] font-bold text-slate-900">Sale Failed</h2>
                <p className="mt-2 text-[12px] text-red-400">{checkoutResult.errorMessage}</p>
                <button
                  onClick={() => setStep('cart')}
                  className="mt-6 w-full rounded-xl bg-slate-700 py-3 text-[14px] font-bold text-white hover:bg-slate-600"
                >
                  Back to Cart
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <span className="text-[15px] font-bold text-slate-900">Cart ({cartCount} items)</span>
              </div>
              <button onClick={clearCart} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:bg-red-50 hover:text-red-400">
                <Trash2 className="h-3 w-3" />
                Clear Cart
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-slate-500">
                  <ShoppingCart className="mb-3 h-10 w-10 opacity-30" />
                  <p className="text-[12px]">Cart is empty</p>
                </div>
              ) : (
                cart.map(line => <CartLineItem key={line.product.id} line={line} onQtyChange={changeQty} onRemove={removeFromCart} />)
              )}
            </div>

            {/* Checkout Area */}
            <div className="border-t border-slate-200 bg-white/20 p-5">
              
              {/* Customer */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Customer</label>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-slate-900">{customer?.name || walkinName}</p>
                      <p className="text-[10px] text-slate-500">{customer ? customer.phone : 'General Customer'}</p>
                    </div>
                  </div>
                  <button className="rounded border border-slate-200 px-3 py-1 text-[10px] text-slate-700 hover:bg-slate-100">Change</button>
                </div>
              </div>

              {/* Discount */}
              <div className="mb-4 flex items-center gap-2">
                <div className="text-[11px] font-semibold text-slate-500">Discount</div>
                <div className="flex flex-1 items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <button onClick={() => setDiscountMode('percent')} className={`px-3 py-1.5 text-[11px] font-medium ${discountMode === 'percent' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>%</button>
                  <button onClick={() => setDiscountMode('amount')} className={`border-l border-slate-200 px-3 py-1.5 text-[11px] font-medium ${discountMode === 'amount' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>₹</button>
                  <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="w-full bg-transparent px-3 text-right text-[12px] text-white outline-none" />
                  <div className="pr-3 text-[11px] text-slate-500">{discountMode === 'percent' ? '%' : ''}</div>
                </div>
              </div>

              {/* Totals */}
              <div className="mb-4 space-y-1.5 text-[12px]">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-900">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Discount {discountMode === 'percent' ? `(${discountValue || 0}%)` : ''}</span>
                  <span className="font-medium text-slate-900">- {fmt(discountAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax (GST {defaultGst}%)</span>
                  <span className="font-medium text-slate-900">{fmt(gstAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between rounded-lg bg-white p-2 text-[15px] font-bold text-slate-900">
                  <span>Grand Total</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-4">
                <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <ReceiptText className="h-3.5 w-3.5 text-blue-600" />
                  Payment Method
                </label>
                <div className="flex gap-2">
                  {PAYMENT_OPTIONS.map(opt => (
                    <button
                      key={opt.type}
                      onClick={() => setPaymentType(opt.type)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-medium transition-all ${paymentType === opt.type ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white'}`}
                    >
                      <opt.icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Controls */}
              {paymentType === 'cash' && (
                <div className="mb-4 flex gap-3 text-[12px]">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] text-slate-500">Received Amount</label>
                    <div className="flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <span className="text-blue-600/60">₹</span>
                      <input type="number" placeholder="0" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} className="w-full bg-transparent px-2 text-right text-white outline-none" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] text-slate-500">Change Amount</label>
                    <div className="flex items-center justify-end rounded border border-slate-200 bg-slate-50 px-3 py-1.5 font-bold text-slate-900">
                      ₹ {(changeAmount && changeAmount > 0) ? changeAmount.toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={cart.length === 0 || submitMutation.isPending || (paymentType === 'cash' && receivedAmount !== '' && parseFloat(receivedAmount) < grandTotal)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-50"
              >
                {submitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowLeft className="h-5 w-5 rotate-180" />}
                Complete Sale (F4)
              </button>

            </div>
          </>
        )}
      </div>
    </div>
  );
};
