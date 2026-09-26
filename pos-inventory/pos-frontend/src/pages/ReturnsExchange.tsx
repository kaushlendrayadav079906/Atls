import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAppSelector } from '../app/hooks';
import { useProducts } from '../hooks/useProducts';
import { useCreateReturn, useCreateExchange } from '../hooks/useReturns';
import { lookupInvoice, searchCustomersByMobile } from '../services/api';
import { getErrorMessage } from '../services/api';
import type { InvoiceLookupResult, ReturnLineItem, Product, CustomerSearchResult } from '../types';

type Step = 'search' | 'select' | 'exchange-items' | 'review' | 'success';
type ReturnType = 'refund' | 'store_credit' | 'exchange';

interface SelectedReturnItem extends ReturnLineItem {
  selectedQty: number;
}

interface SuccessData {
  type: ReturnType;
  refNumber: string;
  creditNoteRef?: string;
  newInvoiceRef?: string;
  priceDifference?: number;
  returnAmount?: number;
  newInvoiceAmount?: number;
  status?: string;
  requestId?: string;
}

const ReturnsExchange = () => {
  const navigate = useNavigate();
  const branchId = useAppSelector((state) => state.auth?.user?.branch_id ?? undefined);

  const { data: products = [] } = useProducts();

  const createReturnMutation = useCreateReturn();
  const createExchangeMutation = useCreateExchange();

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceLookupResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedItems, setSelectedItems] = useState<SelectedReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnType, setReturnType] = useState<ReturnType>('refund');

  const [replacementSearch, setReplacementSearch] = useState('');
  const [replacementItems, setReplacementItems] = useState<{ product: Product; quantity: number }[]>([]);

  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mobile customer search state
  const [mobileQuery, setMobileQuery] = useState('');
  const [mobileResults, setMobileResults] = useState<CustomerSearchResult[]>([]);
  const [isMobileSearching, setIsMobileSearching] = useState(false);
  const mobileTimer = useRef<number | null>(null);

  const handleMobileQueryChange = (value: string) => {
    setMobileQuery(value);
    if (mobileTimer.current) clearTimeout(mobileTimer.current);
    if (value.replace(/\D/g, '').length >= 4) {
      mobileTimer.current = setTimeout(async () => {
        setIsMobileSearching(true);
        try {
          const results = await searchCustomersByMobile(value);
          setMobileResults(results);
        } catch {
          setMobileResults([]);
        } finally {
          setIsMobileSearching(false);
        }
      }, 400);
    } else {
      setMobileResults([]);
    }
  };

  const formatSaleId = (docNum: number) =>
    branchId ? `SALE-${branchId}-${String(docNum).padStart(6, '0')}` : String(docNum);

  const handleSelectMobileInvoice = (docNum: number) => {
    setMobileResults([]);
    setMobileQuery('');
    const saleId = formatSaleId(docNum);
    setSearchQuery(saleId);
    void handleSearch(saleId);
  };

  const handleSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? searchQuery).trim();
    if (!q) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await lookupInvoice(q);
      setInvoice(result);
      setSelectedItems(
        result.items.map((item) => ({ ...item, selectedQty: item.quantity }))
      );
      setStep('select');
    } catch (err) {
      setSearchError(getErrorMessage(err));
    } finally {
      setIsSearching(false);
    }
  };

  const toggleItemSelection = useCallback((itemCode: string) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.itemCode === itemCode
          ? { ...item, selectedQty: item.selectedQty > 0 ? 0 : item.quantity }
          : item
      )
    );
  }, []);

  const updateReturnQty = useCallback((itemCode: string, qty: number) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.itemCode === itemCode
          ? { ...item, selectedQty: Math.max(0, Math.min(qty, item.quantity)) }
          : item
      )
    );
  }, []);

  const returnItems = selectedItems.filter((i) => i.selectedQty > 0);
  const returnAmount = returnItems.reduce((sum, i) => sum + i.unitPrice * i.selectedQty, 0);

  const addReplacementItem = (product: Product) => {
    setReplacementItems((prev) => {
      const existing = prev.find((r) => r.product.id === product.id);
      if (existing) {
        return prev.map((r) =>
          r.product.id === product.id ? { ...r, quantity: r.quantity + 1 } : r
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateReplacementQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setReplacementItems((prev) => prev.filter((r) => r.product.id !== productId));
    } else {
      setReplacementItems((prev) =>
        prev.map((r) => (r.product.id === productId ? { ...r, quantity: qty } : r))
      );
    }
  };

  const newInvoiceAmount = replacementItems.reduce((sum, r) => sum + r.product.price * r.quantity, 0);
  const priceDifference = newInvoiceAmount - returnAmount;

  const filteredProducts = products.filter((p) => {
    if (!replacementSearch.trim()) return true;
    const q = replacementSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      p.id.toLowerCase().includes(q)
    );
  });

  const goToReview = () => {
    if (returnItems.length === 0) {
      toast.error('Please select at least one item to return.');
      return;
    }
    if (!returnReason.trim()) {
      toast.error('Please enter a return reason.');
      return;
    }
    if (returnType === 'exchange' && replacementItems.length === 0) {
      setStep('exchange-items');
      return;
    }
    setStep('review');
  };

  const handleSubmit = async () => {
    if (!invoice) return;

    const warehouse = returnItems[0]?.warehouse || branchId || undefined;

    if (returnType === 'exchange') {
      try {
        const result = await createExchangeMutation.mutateAsync({
          originalDocEntry: invoice.docEntry,
          originalDocNum: invoice.docNum,
          returnItems: returnItems.map((i) => ({
            itemCode: i.itemCode,
            itemName: i.itemName,
            quantity: i.selectedQty,
            unitPrice: i.unitPrice,
            lineTotal: i.unitPrice * i.selectedQty,
            warehouse: i.warehouse,
            baseLine: i.baseLine,
          })),
          replacementItems: replacementItems.map((r) => ({
            product: r.product,
            quantity: r.quantity,
          })),
          reason: returnReason,
          warehouse,
        });
        setSuccessData({
          type: 'exchange',
          refNumber: result.returnDocNum ? `RET-${result.returnDocNum}` : `RET-${result.returnDocEntry}`,
          newInvoiceRef: result.newInvoiceDocNum ? `INV-${result.newInvoiceDocNum}` : undefined,
          creditNoteRef: result.creditNoteDocNum ? `CN-${result.creditNoteDocNum}` : undefined,
          priceDifference: result.priceDifference,
          returnAmount: result.returnAmount,
          newInvoiceAmount: result.newInvoiceAmount,
          status: result.status,
          requestId: result.requestId,
        });
        setStep('success');
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
      return;
    }

    try {
      const result = await createReturnMutation.mutateAsync({
        originalDocEntry: invoice.docEntry,
        originalDocNum: invoice.docNum,
        items: returnItems.map((i) => ({
          itemCode: i.itemCode,
          itemName: i.itemName,
          quantity: i.selectedQty,
          unitPrice: i.unitPrice,
          lineTotal: i.unitPrice * i.selectedQty,
          warehouse: i.warehouse,
          baseLine: i.baseLine,
        })),
        reason: returnReason,
        returnType,
        warehouse,
      });
      setSuccessData({
        type: returnType,
        refNumber: result.returnDocNum ? `RET-${result.returnDocNum}` : `RET-${result.returnDocEntry}`,
        creditNoteRef: result.creditNoteDocNum ? `CN-${result.creditNoteDocNum}` : undefined,
        returnAmount: result.refundAmount,
        status: result.status,
        requestId: result.requestId,
      });
      setStep('success');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const resetForm = () => {
    setStep('search');
    setSearchQuery('');
    setInvoice(null);
    setSearchError(null);
    setSelectedItems([]);
    setReturnReason('');
    setReturnType('refund');
    setReplacementItems([]);
    setSuccessData(null);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const isSubmitting = createReturnMutation.isPending || createExchangeMutation.isPending;

  const RETURN_REASON_PRESETS = [
    'Size issue', 'Defective product', 'Wrong item', 'Changed mind', 'Duplicate order',
  ];

  return (
    <div className="h-full p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Returns & Exchange</h1>
            <p className="text-sm text-gray-500">Process customer returns and item exchanges</p>
          </div>
        </div>

        {/* Step Indicator */}
        {step !== 'success' && (
          <div className="flex items-center gap-2 mb-8">
            {(['search', 'select', returnType === 'exchange' ? 'exchange-items' : null, 'review'] as (Step | null)[])
              .filter(Boolean)
              .map((s, idx, arr) => {
                const stepLabels: Record<Step, string> = {
                  search: 'Find Invoice',
                  select: 'Select Items',
                  'exchange-items': 'Replacement',
                  review: 'Review',
                  success: 'Done',
                };
                const currentStepIdx = arr.indexOf(step);
                const isDone = idx < currentStepIdx;
                const isActive = s === step;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 text-sm font-medium ${isActive ? 'text-gray-900' : isDone ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-gray-900 text-white' : isDone ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {isDone ? '✓' : idx + 1}
                      </span>
                      <span className="hidden sm:inline">{stepLabels[s!]}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={`h-px w-6 ${idx < currentStepIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* ── Step 1: Search ── */}
        {step === 'search' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Find Original Invoice</h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter the invoice number, order ID, or scan the receipt barcode to look up the original transaction.
            </p>
            <div className="flex gap-3">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Invoice number or Order ID..."
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                autoFocus
              />
              <button
                onClick={() => handleSearch()}
                disabled={isSearching || !searchQuery.trim()}
                className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSearching ? (
                  <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                Search
              </button>
            </div>
            {searchError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {searchError}
              </div>
            )}

            {/* Mobile Customer Lookup */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Or find customer by mobile</p>
              <div className="relative">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <input
                      type="tel"
                      value={mobileQuery}
                      onChange={(e) => handleMobileQueryChange(e.target.value)}
                      placeholder="Enter 4+ digits of mobile number..."
                      className="w-full pl-9 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    {isMobileSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {mobileQuery && (
                    <button onClick={() => { setMobileQuery(''); setMobileResults([]); }}
                      className="text-xs text-gray-400 hover:text-red-500 px-2 rounded transition-colors">✕</button>
                  )}
                </div>
                {mobileResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <p className="px-4 pt-2 pb-1 text-xs text-gray-400 font-medium">
                      {mobileResults.length} customer{mobileResults.length > 1 ? 's' : ''} found – click an invoice to load it
                    </p>
                    {mobileResults.map((c) => {
                      const invoiceNums = c.invoiceNums?.length
                        ? c.invoiceNums
                        : c.latestDocNum
                          ? [c.latestDocNum]
                          : [];
                      return (
                        <div
                          key={c.mobile}
                          className="px-4 py-2.5 border-t border-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{c.name || c.mobile}</p>
                              <p className="text-xs text-gray-500">{c.mobile}</p>
                            </div>
                            {c.invoiceCount && (
                              <p className="text-xs text-gray-400">{c.invoiceCount} invoice{c.invoiceCount > 1 ? 's' : ''}</p>
                            )}
                          </div>
                          {invoiceNums.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {invoiceNums.map((docNum) => (
                                <button
                                  key={docNum}
                                  onClick={() => handleSelectMobileInvoice(docNum)}
                                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-50 text-gray-900 hover:bg-gray-100 transition-colors"
                                >
                                  {formatSaleId(docNum)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Select Items ── */}
        {step === 'select' && invoice && (
          <div className="space-y-4">
            {invoice.hasReturn && (
              <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
                <span className="text-orange-500 text-xl leading-none">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-orange-800">This invoice has already been returned</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    A credit note was previously issued for invoice #{invoice.docNum}. Proceeding may create a duplicate return.
                  </p>
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Invoice #</span>
                  <span className="ml-2 font-semibold text-gray-900">{invoice.docNum}</span>
                </div>
                {invoice.docDate && (
                  <div>
                    <span className="text-gray-500">Date</span>
                    <span className="ml-2 font-medium text-gray-700">{invoice.docDate}</span>
                  </div>
                )}
                {invoice.customerName && (
                  <div>
                    <span className="text-gray-500">Customer</span>
                    <span className="ml-2 font-medium text-gray-700">{invoice.customerName}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Total</span>
                  <span className="ml-2 font-bold text-gray-900">₹{invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Select Items to Return</h3>
              <div className="space-y-3">
                {selectedItems.map((item) => {
                  const isSelected = item.selectedQty > 0;
                  return (
                    <div
                      key={item.itemCode}
                      className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
                      onClick={() => toggleItemSelection(item.itemCode)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemSelection(item.itemCode)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-gray-900 rounded focus:ring-gray-900"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.itemName}</p>
                        <p className="text-xs text-gray-500">{item.itemCode} · ₹{item.unitPrice.toFixed(2)} each</p>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => updateReturnQty(item.itemCode, item.selectedQty - 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-gray-900 text-sm"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-gray-900">{item.selectedQty}</span>
                          <button
                            onClick={() => updateReturnQty(item.itemCode, item.selectedQty + 1)}
                            disabled={item.selectedQty >= item.quantity}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-gray-900 text-sm disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      )}
                      <div className="text-right min-w-16">
                        <p className="text-sm font-semibold text-gray-900">₹{(item.unitPrice * (isSelected ? item.selectedQty : item.quantity)).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">orig: {item.quantity}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Return Reason <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {RETURN_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setReturnReason(preset)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${returnReason === preset ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-900'}`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Describe the return reason..."
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Return Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: 'refund' as ReturnType, label: 'Refund', icon: '↩', desc: 'Cash back to customer' },
                    { value: 'store_credit' as ReturnType, label: 'Store Credit', icon: '🏷', desc: 'Credit note issued' },
                    { value: 'exchange' as ReturnType, label: 'Exchange', icon: '↔', desc: 'Swap for another item' },
                  ] as const).map(({ value, label, icon, desc }) => (
                    <button
                      key={value}
                      onClick={() => setReturnType(value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${returnType === value ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                      <div className="text-xl mb-1">{icon}</div>
                      <p className={`text-sm font-semibold ${returnType === value ? 'text-gray-900' : 'text-gray-700'}`}>{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep('search'); setInvoice(null); }}
                className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back
              </button>
              <button
                onClick={goToReview}
                disabled={returnItems.length === 0}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {returnType === 'exchange' ? 'Choose Replacement →' : 'Review Return →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Exchange – Pick Replacement Items ── */}
        {step === 'exchange-items' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Choose Replacement Items</h3>
              <p className="text-sm text-gray-500 mb-4">
                Return value: <span className="font-semibold text-gray-900">₹{returnAmount.toFixed(2)}</span>
              </p>
              <input
                type="text"
                value={replacementSearch}
                onChange={(e) => setReplacementSearch(e.target.value)}
                placeholder="Search products by name or barcode..."
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {filteredProducts.slice(0, 30).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addReplacementItem(product)}
                    className="p-3 border border-gray-100 rounded-xl text-left hover:border-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-xs font-semibold text-gray-800 line-clamp-2">{product.name}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">₹{product.price.toFixed(2)}</p>
                    {product.stock !== undefined && (
                      <p className="text-xs text-gray-400">Stock: {product.stock}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {replacementItems.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Selected Replacements</h4>
                <div className="space-y-2">
                  {replacementItems.map((r) => (
                    <div key={r.product.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.product.name}</p>
                        <p className="text-xs text-gray-500">₹{r.product.price.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateReplacementQty(r.product.id, r.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-200 text-sm hover:border-red-300"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{r.quantity}</span>
                        <button
                          onClick={() => updateReplacementQty(r.product.id, r.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-200 text-sm hover:border-gray-900"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-bold text-gray-900 min-w-15 text-right">
                        ₹{(r.product.price * r.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                  <span className="text-gray-600">Price difference</span>
                  <span className={`font-bold ${priceDifference > 0 ? 'text-amber-600' : priceDifference < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                    {priceDifference > 0 ? `+₹${priceDifference.toFixed(2)} (customer pays)` : priceDifference < 0 ? `-₹${Math.abs(priceDifference).toFixed(2)} (refund)` : 'No difference'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={() => setStep('select')} className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 font-medium">
                ← Back
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={replacementItems.length === 0}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Review Exchange →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Review ── */}
        {step === 'review' && invoice && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Review & Confirm</h3>

              <div className="space-y-1 text-sm mb-4">
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Original Invoice</span>
                  <span className="font-medium text-gray-900">#{invoice.docNum}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Return Reason</span>
                  <span className="font-medium text-gray-900 max-w-50 text-right">{returnReason}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Return Type</span>
                  <span className={`font-semibold capitalize ${returnType === 'refund' ? 'text-green-600' : returnType === 'store_credit' ? 'text-gray-900' : 'text-amber-600'}`}>
                    {returnType.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Returning</h4>
              <div className="space-y-2 mb-4">
                {returnItems.map((item) => (
                  <div key={item.itemCode} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.itemName} × {item.selectedQty}</span>
                    <span className="font-semibold text-gray-900">₹{(item.unitPrice * item.selectedQty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                  <span className="text-gray-700">Return Value</span>
                  <span className="text-gray-900">₹{returnAmount.toFixed(2)}</span>
                </div>
              </div>

              {returnType === 'exchange' && replacementItems.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Replacement</h4>
                  <div className="space-y-2 mb-4">
                    {replacementItems.map((r) => (
                      <div key={r.product.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{r.product.name} × {r.quantity}</span>
                        <span className="font-semibold text-gray-900">₹{(r.product.price * r.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                      <span className="text-gray-700">New Invoice Value</span>
                      <span className="text-gray-900">₹{newInvoiceAmount.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between text-sm font-bold rounded-lg p-3 ${priceDifference > 0 ? 'bg-amber-50 text-amber-700' : priceDifference < 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}`}>
                      <span>Price Difference</span>
                      <span>
                        {priceDifference > 0 ? `Customer pays ₹${priceDifference.toFixed(2)}` : priceDifference < 0 ? `Refund ₹${Math.abs(priceDifference).toFixed(2)}` : 'No difference'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(returnType === 'exchange' ? 'exchange-items' : 'select')}
                className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSubmitting && (
                  <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {isSubmitting ? 'Processing...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && successData && (
          <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {successData.status === 'pending_approval'
                ? 'Sent for Manager Approval'
                : successData.type === 'exchange'
                ? 'Exchange Processed!'
                : 'Return Processed!'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {successData.status === 'pending_approval'
                ? 'This request requires manager approval before processing in SAP.'
                : successData.type === 'store_credit'
                ? 'Store credit has been issued to the customer.'
                : successData.type === 'exchange'
                ? 'The exchange has been completed in SAP.'
                : 'The refund has been initiated in SAP.'}
            </p>
            <div className="space-y-2 text-sm text-left max-w-xs mx-auto mb-8">
              {successData.requestId && (
                <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Request ID</span>
                  <span className="font-bold text-gray-900">{successData.requestId.substring(0, 8)}</span>
                </div>
              )}
              {successData.refNumber !== 'RET-0' && (
                <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Return Ref</span>
                  <span className="font-bold text-gray-900">{successData.refNumber}</span>
                </div>
              )}
              {successData.creditNoteRef && (
                <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Credit Note</span>
                  <span className="font-bold text-gray-900">{successData.creditNoteRef}</span>
                </div>
              )}
              {successData.newInvoiceRef && (
                <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">New Invoice</span>
                  <span className="font-bold text-gray-900">{successData.newInvoiceRef}</span>
                </div>
              )}
              {successData.returnAmount !== undefined && (
                <div className="flex justify-between p-2.5 bg-green-50 rounded-lg">
                  <span className="text-gray-600">Return Value</span>
                  <span className="font-bold text-green-700">₹{successData.returnAmount.toFixed(2)}</span>
                </div>
              )}
              {successData.priceDifference !== undefined && Math.abs(successData.priceDifference) > 0.01 && (
                <div className={`flex justify-between p-2.5 rounded-lg ${successData.priceDifference > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                  <span className="text-gray-600">{successData.priceDifference > 0 ? 'Amount to Collect' : 'Refund Due'}</span>
                  <span className={`font-bold ${successData.priceDifference > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                    ₹{Math.abs(successData.priceDifference).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Process Another
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnsExchange;
