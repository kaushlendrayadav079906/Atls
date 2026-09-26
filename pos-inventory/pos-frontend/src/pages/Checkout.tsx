import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAppDispatch } from '../app/hooks';
import { clearCart } from '../features/cart/cartSlice';
import { useSale } from '../hooks/useSale';
import { handleError, handleSuccess } from '../utils/errorHandler';
import {
  buildReceiptDocument,
  getReceiptLogoDataUrl,
  printReceiptInBrowser,
} from '../utils/receiptPrinter';
import { searchCustomersByMobile } from '../services/api';
import type { CheckoutData, CustomerDetails, CustomerSearchResult } from '../types';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const saleMutation = useSale();

  const checkoutData: CheckoutData = location.state?.checkoutData || {
    items: [],
    subtotal: 0,
    discount: 0,
    gst: 0,
    total: 0,
    paymentMethods: [],
  };

  const prefilled = location.state?.prefilledCustomer as { name?: string; phone?: string } | undefined;

  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>({
    name: prefilled?.name || '',
    phone: prefilled?.phone || '',
    email: '',
    sales_employee: '',
    address: '',
  });

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'wallet'>('cash');
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<string>(checkoutData.total.toFixed(2));
  const [showReceipt, setShowReceipt] = useState(false);
  const [saleId, setSaleId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [phoneError, setPhoneError] = useState<string>('');
  const [nameError, setNameError] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string>('');
  const [hasTriggeredAutoPrint, setHasTriggeredAutoPrint] = useState(false);

  // Mobile autocomplete
  const [phoneSuggestions, setPhoneSuggestions] = useState<CustomerSearchResult[]>([]);
  const [isPhoneSearching, setIsPhoneSearching] = useState(false);
  const phoneSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = (field: keyof CustomerDetails, value: string) => {
    if (field === 'phone') {
      setPhoneError('');
      // Trigger mobile autocomplete when 4+ digits typed
      if (phoneSearchTimer.current) clearTimeout(phoneSearchTimer.current);
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 4) {
        phoneSearchTimer.current = setTimeout(async () => {
          setIsPhoneSearching(true);
          try {
            const results = await searchCustomersByMobile(value);
            setPhoneSuggestions(results);
          } catch {
            setPhoneSuggestions([]);
          } finally {
            setIsPhoneSearching(false);
          }
        }, 400);
      } else {
        setPhoneSuggestions([]);
      }
    }
    if (field === 'name') setNameError('');
    setCustomerDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSelectPhoneSuggestion = (customer: CustomerSearchResult) => {
    setPhoneSuggestions([]);
    setCustomerDetails((prev) => ({
      ...prev,
      phone: customer.mobile,
      name: customer.name || prev.name,
      email: customer.email || prev.email || '',
      sales_employee: customer.salesEmployee || prev.sales_employee || '',
      address: customer.address || prev.address || '',
    }));
    setPhoneError('');
    if (customer.name) setNameError('');
  };

  // Effective total after extra discount applied
  const effectiveTotal = Math.max(0, checkoutData.total - extraDiscount);

  // Recalculate GST proportionally after extra discount.
  // Use gstPercentage directly when available (more precise than dividing gst/base).
  // Formula: effectiveGst = effectiveTotal × gstRate / (1 + gstRate)
  // This is correct because: effectiveTotal = effectiveBase × (1 + gstRate)
  //   → effectiveBase = effectiveTotal / (1 + gstRate)
  //   → effectiveGst  = effectiveTotal − effectiveBase
  const originalBase = checkoutData.subtotal - checkoutData.discount;
  const gstRate = checkoutData.gstPercentage != null
    ? checkoutData.gstPercentage / 100
    : (originalBase > 0 ? checkoutData.gst / originalBase : 0);
  const effectiveGst =
    gstRate > 0
      ? parseFloat((effectiveTotal * gstRate / (1 + gstRate)).toFixed(2))
      : checkoutData.gst;

  // Keep paidAmount in sync when extra discount changes
  useEffect(() => {
    setPaidAmount(effectiveTotal.toFixed(2));
  }, [extraDiscount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRoundOff = () => {
    const fractional = effectiveTotal % 1;
    if (fractional > 0.001) {
      setExtraDiscount(parseFloat((extraDiscount + fractional).toFixed(2)));
    }
  };

  const calculateChange = () => {
    const paid = parseFloat(paidAmount) || 0;
    const change = paid - effectiveTotal;
    return change > 0 ? change : 0;
  };

  const getReceiptDocument = async () => {
    const logoSrc = await getReceiptLogoDataUrl();
    return buildReceiptDocument({
      saleId,
      items: checkoutData.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        amount: item.product.price * item.quantity,
        hsnCode: item.product.barcode || item.product.id || 'N/A',
      })),
      subtotal: checkoutData.subtotal,
      discount: checkoutData.discount + extraDiscount,
      gst: effectiveGst,
      gstPercentage: checkoutData.gstPercentage,
      total: effectiveTotal,
      paymentMethod: selectedPaymentMethod,
      paidAmount: parseFloat(paidAmount) || effectiveTotal,
      changeAmount: calculateChange(),
      customer: {
        name: customerDetails.name,
        phone: customerDetails.phone,
        email: customerDetails.email,
        salesEmployee: customerDetails.sales_employee,
      },
      logoSrc,
    });
  };

  const printReceipt = async () => {
    type ReceiptPrinterBridge = {
      printReceipt?: (payload: { saleId: string; html: string }) => Promise<void>;
    };

    const printerBridge = (window as Window & { receiptPrinter?: ReceiptPrinterBridge }).receiptPrinter;
    const receiptDocument = await getReceiptDocument();

    if (printerBridge?.printReceipt) {
      await printerBridge.printReceipt({ saleId, html: receiptDocument });
      return;
    }

    await printReceiptInBrowser(receiptDocument);
  };

  useEffect(() => {
    if (!showReceipt || !saleId || hasTriggeredAutoPrint) {
      return;
    }

    let active = true;
    setHasTriggeredAutoPrint(true);
    setIsPrinting(true);
    setPrintError('');

    const runPrint = async () => {
      try {
        await printReceipt();
        if (!active) return;

        toast.success('Receipt printed successfully');
        handleNewSale();
      } catch (error) {
        if (!active) return;

        const message = handleError(error, 'Receipt Print');
        setPrintError(message);
        toast.error(message);
      } finally {
        if (active) {
          setIsPrinting(false);
        }
      }
    };

    void runPrint();

    return () => {
      active = false;
    };
  }, [hasTriggeredAutoPrint, saleId, showReceipt]);

  const handleCompleteSale = async () => {
    if (checkoutData.items.length === 0) {
      toast.error('Your cart is empty. Add items to continue');
      return;
    }

    let hasValidationError = false;
    if (!customerDetails.name.trim()) {
      toast.error('Customer name is required');
      setNameError('Customer name is required');
      hasValidationError = true;
    }
    if (!customerDetails.phone?.trim()) {
      toast.error('Customer phone number is required');
      setPhoneError('Phone number is required');
      hasValidationError = true;
    }
    if (hasValidationError) return;

    const paid = parseFloat(paidAmount) || 0;
    if (selectedPaymentMethod === 'cash' && paid < parseFloat(effectiveTotal.toFixed(2))) {
      toast.error('Payment amount is insufficient');
      return;
    }

    const customer: CustomerDetails = {
      name: customerDetails.name.trim(),
      phone: customerDetails.phone!.trim(),
      ...(customerDetails.email?.trim() && { email: customerDetails.email.trim() }),
      ...(customerDetails.sales_employee?.trim() && { sales_employee: customerDetails.sales_employee.trim() }),
      ...(customerDetails.address?.trim() && { address: customerDetails.address.trim() }),
    };

    const salePayload: CheckoutData = {
      ...checkoutData,
      discount: checkoutData.discount + extraDiscount,
      gst: effectiveGst,
      total: effectiveTotal,
      customer,
      paymentMethods: [{ type: selectedPaymentMethod, amount: parseFloat(paidAmount) || effectiveTotal }],
    };

    setIsProcessing(true);

    saleMutation.mutate(salePayload, {
      onSuccess: (data) => {
        setIsProcessing(false);
        setSaleId(data.saleId);
        setHasTriggeredAutoPrint(false);
        setPrintError('');
        setShowReceipt(true);
        handleSuccess('Sale completed successfully', 'Sale');
        toast.success('Payment processed successfully!');
      },
      onError: (error) => {
        setIsProcessing(false);
        const errorMsg = handleError(error, 'Sale');
        toast.error(errorMsg);
      },
    });
  };

  const handleNewSale = () => {
    dispatch(clearCart());
    setHasTriggeredAutoPrint(false);
    setPrintError('');
    setIsPrinting(false);
    setShowReceipt(false);
    navigate('/pos', { replace: true });
  };

  const handlePrintAgain = async () => {
    setPrintError('');
    setIsPrinting(true);

    try {
      await printReceipt();
      toast.success('Receipt printed successfully');
      handleNewSale();
    } catch (error) {
      const message = handleError(error, 'Receipt Print');
      setPrintError(message);
      toast.error(message);
    } finally {
      setIsPrinting(false);
    }
  };

  if (showReceipt) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-transparent bg-opacity-40 backdrop-blur-sm p-4 sm:p-8 z-150">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-4 sm:p-8 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-800">Payment Successful!</h2>
            <p className="text-gray-500 text-sm mt-2 bg-gray-50 inline-block px-4 py-2 rounded-full">
              Serial Number: <span className="font-semibold text-gray-900">{saleId}</span>
            </p>
            <p className="text-sm text-gray-500 mt-3">
              {isPrinting ? 'Printing receipt...' : printError ? 'Receipt print needs attention.' : 'Receipt printed. Starting next sale...'}
            </p>
            {printError && <p className="text-sm text-red-500 mt-2">{printError}</p>}
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-5 mb-6 bg-white shadow-inner">
            <div className="text-center mb-4 pb-4 border-b-2 border-dashed border-gray-300">
              <h3 className="font-bold text-xl text-gray-800">RECEIPT</h3>
              <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleString()}</p>
            </div>

            {customerDetails.name && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-700">Customer Details</p>
                <p className="text-sm text-gray-600">{customerDetails.name}</p>
                <p className="text-sm text-gray-600">{customerDetails.phone}</p>
                {customerDetails.email && <p className="text-sm text-gray-600">{customerDetails.email}</p>}
                {customerDetails.sales_employee && <p className="text-sm text-gray-600">Sales Employee: {customerDetails.sales_employee}</p>}
              </div>
            )}

            <div className="mb-4 space-y-2">
              {checkoutData.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    <span className="font-medium">{item.product.name}</span>
                    <span className="text-gray-500"> × {item.quantity}</span>
                  </span>
                  <span className="font-semibold text-gray-800">₹{(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-dashed border-gray-300 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold">₹{checkoutData.subtotal.toFixed(2)}</span>
              </div>
              {(checkoutData.discount + extraDiscount) > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span className="font-semibold">-₹{(checkoutData.discount + extraDiscount).toFixed(2)}</span>
                </div>
              )}
              {effectiveGst > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST{checkoutData.gstPercentage ? ` (${checkoutData.gstPercentage}%)` : ''}</span>
                  <span className="font-semibold">+₹{effectiveGst.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-xl border-t-2 border-gray-300 pt-3 mt-2">
                <span className="text-gray-800">TOTAL</span>
                <span className="text-gray-900">₹{effectiveTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-semibold text-gray-800 uppercase">{selectedPaymentMethod}</span>
              </div>
              {selectedPaymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600">Paid</span>
                    <span className="font-semibold text-gray-800">₹{parseFloat(paidAmount).toFixed(2)}</span>
                  </div>
                  {calculateChange() > 0 && (
                    <div className="flex justify-between text-sm mt-1 bg-green-50 p-2 rounded">
                      <span className="text-green-700 font-semibold">Change to Return</span>
                      <span className="font-bold text-green-600 text-lg">₹{calculateChange().toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300 text-center">
              <p className="text-xs text-gray-500">Thank you for your business!</p>
              <p className="text-xs text-gray-500 mt-1">EXCHANGE IS ONLY POSSIBLE IN LESS THAN 7 DAYS</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handlePrintAgain}
              disabled={isPrinting}
              className={`w-full py-4 rounded-xl font-bold transition-all shadow-md ${isPrinting ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-black hover:bg-gray-900 text-white'}`}
            >
              {isPrinting ? 'Printing...' : 'Print Receipt Again'}
            </button>
            <button
              onClick={handleNewSale}
              className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-all shadow-md"
            >
              Start New Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 sm:p-6 lg:p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/pos')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to POS
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Checkout</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Complete your sale</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Customer Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerDetails.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow ${nameError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                    placeholder="Customer name"
                  />
                  {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={customerDetails.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      onBlur={() => setTimeout(() => setPhoneSuggestions([]), 200)}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow ${phoneError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                      placeholder="Phone number (type 4+ digits to search)"
                      autoComplete="off"
                    />
                    {isPhoneSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-4 h-4 animate-spin text-pink-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                    {phoneSuggestions.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <p className="px-3 pt-2 pb-1 text-xs text-gray-400 font-medium">Select to auto-fill customer details</p>
                        {phoneSuggestions.map((c) => (
                          <button
                            key={c.mobile}
                            type="button"
                            onMouseDown={() => handleSelectPhoneSuggestion(c)}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors text-left border-t border-gray-50"
                          >
                            <p className="text-sm font-semibold text-gray-800">{c.name || c.mobile}</p>
                            <div className="text-right">
                              <p className="text-xs text-gray-600">{c.mobile}</p>
                              {c.invoiceCount && <p className="text-xs text-gray-400">{c.invoiceCount} order{c.invoiceCount > 1 ? 's' : ''}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email (Optional)</label>
                  <input
                    type="email"
                    value={customerDetails.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sales Employee (Optional)</label>
                  <input
                    type="text"
                    value={customerDetails.sales_employee ?? ''}
                    onChange={(e) => handleInputChange('sales_employee', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                    placeholder="Employee name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address (Optional)</label>
                  <textarea
                    value={customerDetails.address ?? ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow resize-none"
                    placeholder="Customer address"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Discount &amp; Round Off
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={checkoutData.total}
                    value={extraDiscount === 0 ? '' : extraDiscount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setExtraDiscount(Math.min(Math.max(0, val), checkoutData.total));
                    }}
                    className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                    placeholder="0.00"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRoundOff}
                  disabled={effectiveTotal % 1 < 0.001}
                  className="w-full py-3 border-2 border-gray-900 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Round Off (₹{(effectiveTotal % 1).toFixed(2)})
                </button>
                {extraDiscount > 0 && (
                  <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm">
                    <span className="text-red-700 font-medium">Total discount applied</span>
                    <span className="text-red-600 font-bold">-₹{extraDiscount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Payment Method
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {(['cash', 'card', 'upi', 'wallet'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`p-4 rounded-xl border transition-all ${
                      selectedPaymentMethod === method
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="font-semibold uppercase text-sm">{method}</div>
                  </button>
                ))}
              </div>

              {selectedPaymentMethod === 'cash' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount Received</label>
                  <input
                    type="number"
                    step="0.01"
                    min={effectiveTotal}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg font-semibold transition-shadow"
                  />
                  {calculateChange() > 0 && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Change to Return</span>
                        <span className="text-2xl font-bold text-green-600">₹{calculateChange().toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:sticky lg:top-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
              <div className="mb-4 max-h-60 overflow-y-auto">
                {checkoutData.items.map((item, index) => (
                  <div key={index} className="flex justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-gray-800">{item.product.name}</p>
                      <p className="text-sm text-gray-500">₹{item.product.price} × {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-gray-800">₹{(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-4 border-t-2 border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">₹{checkoutData.subtotal.toFixed(2)}</span>
                </div>
                {(checkoutData.discount + extraDiscount) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount</span>
                    <span className="font-semibold">-₹{(checkoutData.discount + extraDiscount).toFixed(2)}</span>
                  </div>
                )}
                {checkoutData.gst > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>GST</span>
                    <span className="font-semibold">+₹{checkoutData.gst.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                  <span className="text-xl font-bold text-gray-800">Total</span>
                  <span className="text-3xl font-bold text-gray-900">₹{effectiveTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCompleteSale}
                disabled={isProcessing}
                className={`w-full mt-6 py-4 ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2`}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Complete Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
