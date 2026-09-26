import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { PRODUCTS_KEY, useProducts } from "../hooks/useProducts";
import * as api from "../services/api";
import { useGstValues } from "../hooks/useGstValues";
import { handleError } from "../utils/errorHandler";
import {
  addItem,
  removeItem,
  updateQty,
  clearCart,
  selectCartTotal,
  setGstPercentage,
  setDiscountType,
  setDiscountValue,
} from "../features/cart/cartSlice";
import type { Product } from "../types";
import Loader from "../components/Loader";

const POS = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading: productsLoading, error: productsError } = useProducts();
  const { data: gstData, isLoading: gstLoading } = useGstValues();
  const branchId = useAppSelector((state) => state.auth?.user?.branch_id ?? null);
  const cartItems = useAppSelector((state) => state.cart.items);
  const cartTotal = useAppSelector(selectCartTotal);
  const gstPercentage = useAppSelector((state) => state.cart.gstPercentage);
  const discountType = useAppSelector((state) => state.cart.discountType);
  const discountValue = useAppSelector((state) => state.cart.discountValue);

  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showDiscountGst, setShowDiscountGst] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Item filter state
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [filterBrand, setFilterBrand] = useState("");

  const productsQueryKey = [...PRODUCTS_KEY, branchId] as const;
  const handleManualProductRefresh = async () => {
    try {
      setIsManualRefreshing(true);
      // Pass forceRefresh=true: sends Cache-Control: no-cache to bypass browser
      // cache AND force_refresh=true query param to bust the backend in-memory cache
      const data = await api.getProducts(true);
      queryClient.setQueryData(productsQueryKey, data);
      toast.success('Products refreshed');
    } catch (error) {
      toast.error(handleError(error, "Product Fetch"));
    } finally {
      setIsManualRefreshing(false);
    }
  };


  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const scanBufferRef = useRef<string>("");
  const lastScanKeyTimeRef = useRef<number>(0);
  const scanResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addToastId = useRef<string | number | null>(null);
  const removeToastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Focus barcode input on mount
    barcodeInputRef.current?.focus();
  }, []);

  const findProductByScannedCode = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return undefined;
      const productsArray = Array.isArray(products) ? products : [];
      return productsArray.find((p) => {
        const barcode = String(p.barcode ?? "").trim();
        const id = String(p.id ?? "").trim();
        return barcode === code || id === code;
      });
    },
    [products],
  );

  const handleBarcodeScan = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      const product = findProductByScannedCode(code);
      if (product) {
        dispatch(addItem(product));
        toast.success(`${product.name} added to cart!`);
      } else {
        toast.error("Product not found");
      }

      // Keep the hidden input focused for scanners that target focused elements
      barcodeInputRef.current?.focus();
    },
    [dispatch, findProductByScannedCode],
  );

  useEffect(() => {
    // Capture keyboard-wedge barcode scanners globally.
    // Heuristic: scanners type very fast, then send Enter/Tab as a suffix.
    const MAX_INTER_KEY_MS = 60;
    const RESET_AFTER_MS = 120;
    const MIN_CODE_LENGTH = 3;
    const MIN_CODE_LENGTH_TIMEOUT = 6;

    const resetBuffer = () => {
      scanBufferRef.current = "";
      lastScanKeyTimeRef.current = 0;
      if (scanResetTimerRef.current) {
        clearTimeout(scanResetTimerRef.current);
        scanResetTimerRef.current = null;
      }
    };

    const scheduleReset = () => {
      if (scanResetTimerRef.current) clearTimeout(scanResetTimerRef.current);
      scanResetTimerRef.current = setTimeout(() => {
        const code = scanBufferRef.current;
        if (code.length >= MIN_CODE_LENGTH_TIMEOUT) {
          handleBarcodeScan(code);
        }
        resetBuffer();
      }, RESET_AFTER_MS);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      // Ignore modified keystrokes (shortcuts)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const key = e.key;

      // Suffix keys used by scanners
      if (key === "Enter" || key === "Tab") {
        const code = scanBufferRef.current;
        const timeSinceLast = lastScanKeyTimeRef.current
          ? now - lastScanKeyTimeRef.current
          : Number.POSITIVE_INFINITY;

        if (code.length >= MIN_CODE_LENGTH && timeSinceLast <= RESET_AFTER_MS) {
          e.preventDefault();
          e.stopPropagation();
          handleBarcodeScan(code);
        }
        resetBuffer();
        return;
      }

      if (key === "Escape") {
        resetBuffer();
        return;
      }

      // Only accept printable characters
      if (key.length !== 1) return;

      const interKeyMs = lastScanKeyTimeRef.current
        ? now - lastScanKeyTimeRef.current
        : 0;

      // If typing is slow, treat as a fresh buffer (likely human typing)
      if (lastScanKeyTimeRef.current && interKeyMs > MAX_INTER_KEY_MS) {
        scanBufferRef.current = "";
      }

      scanBufferRef.current += key;
      lastScanKeyTimeRef.current = now;
      scheduleReset();

      // If this looks like a scan-in-progress, keep it from polluting focused inputs
      if (scanBufferRef.current.length >= 2 && interKeyMs <= MAX_INTER_KEY_MS) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (scanResetTimerRef.current) {
        clearTimeout(scanResetTimerRef.current);
        scanResetTimerRef.current = null;
      }
    };
  }, [handleBarcodeScan]);

  const allowedGstValues = useMemo(() => {
    return gstData?.values && gstData.values.length > 0 ? gstData.values : [5];
  }, [gstData?.values]);
  const defaultGstValue = gstData?.default ?? 5;

  // On first load, always apply the API-provided default GST rate.
  // This ensures the UI starts at 5% (or whatever SAP returns) rather than
  // the Redux initial state of 18%.
  const hasAppliedApiDefault = useRef(false);
  useEffect(() => {
    if (gstData && !hasAppliedApiDefault.current) {
      hasAppliedApiDefault.current = true;
      dispatch(setGstPercentage(defaultGstValue));
    }
  }, [gstData, defaultGstValue, dispatch]);

  useEffect(() => {
    if (!allowedGstValues.includes(gstPercentage)) {
      const fallback = allowedGstValues.includes(defaultGstValue)
        ? defaultGstValue
        : allowedGstValues[0];
      dispatch(setGstPercentage(fallback));
    }
  }, [allowedGstValues, defaultGstValue, gstPercentage, dispatch]);

  const filteredProducts = useMemo(
    () =>
      (Array.isArray(products) ? products : []).filter(
        (product) => {
          const matchesSearch =
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (product.barcode && product.barcode.includes(searchQuery));
          const matchesCategory = !filterCategory || product.category === filterCategory;
          const matchesSize = !filterSize || product.size === filterSize;
          const matchesColor = !filterColor || product.color === filterColor;
          const matchesBrand = !filterBrand || product.brand === filterBrand;
          return matchesSearch && matchesCategory && matchesSize && matchesColor && matchesBrand;
        },
      ),
    [products, searchQuery, filterCategory, filterSize, filterColor, filterBrand],
  );

  // Derive unique filter options from the full product list
  const filterOptions = useMemo(() => {
    const allProducts = Array.isArray(products) ? products : [];
    const unique = (arr: (string | undefined)[]): string[] =>
      [...new Set(arr.filter((v): v is string => !!v))].sort();
    return {
      categories: unique(allProducts.map((p) => p.category)),
      sizes: unique(allProducts.map((p) => p.size)),
      colors: unique(allProducts.map((p) => p.color)),
      brands: unique(allProducts.map((p) => p.brand)),
    };
  }, [products]);

  const hasActiveFilters = filterCategory || filterSize || filterColor || filterBrand;
  const clearFilters = () => {
    setFilterCategory("");
    setFilterSize("");
    setFilterColor("");
    setFilterBrand("");
  };

  const handleAddToCart = (product: Product) => {
    dispatch(addItem(product));
    if (addToastId.current) {
      toast.dismiss(addToastId.current);
    }
    addToastId.current = toast.success(`${product.name} added to cart!`);
  };

  const handleRemoveFromCart = (productId: string) => {
    const product = cartItems.find(
      (item) => item.product.id === productId,
    )?.product;
    if (product) {
      if (removeToastTimeout.current) clearTimeout(removeToastTimeout.current);
      removeToastTimeout.current = setTimeout(() => {
        toast.error(`${product.name} removed from cart`);
      }, 500);
    }
    dispatch(removeItem(productId));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    dispatch(updateQty({ productId, quantity }));
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleBarcodeScan(barcodeInput);
    setBarcodeInput("");
  };

  // Calculate totals
  const subtotal = cartTotal;
  const discountAmount =
    discountType === "percentage"
      ? (subtotal * discountValue) / 100
      : discountValue;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const gstAmount = (subtotalAfterDiscount * gstPercentage) / 100;
  const finalTotal = subtotalAfterDiscount + gstAmount;

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Cart is empty!");
      return;
    }

    // Navigate to checkout page with cart data
    navigate("/checkout", {
      state: {
        checkoutData: {
          items: cartItems,
          subtotal,
          discount: discountAmount,
          gst: gstAmount,
          gstPercentage,
          total: finalTotal,
          paymentMethods: [],
        },
      },
    });
  };

  return (
    <div className="h-screen bg-white flex flex-col lg:flex-row relative">
      {/* Hidden Barcode Input - Background Scanning Only */}
      <form
        onSubmit={handleBarcodeSubmit}
        className="absolute opacity-0 pointer-events-none"
      >
        <input
          ref={barcodeInputRef}
          type="text"
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          tabIndex={-1}
        />
      </form>

      {/* Mobile Cart Toggle Button */}
      <button
        onClick={() => setShowMobileCart(!showMobileCart)}
        className="lg:hidden fixed bottom-4 left-4 z-50 bg-pink-500 text-white p-3 rounded-full shadow-lg hover:bg-pink-600 transition-colors"
      >
        <div className="relative">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          {cartItems.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {cartItems.length}
            </span>
          )}
        </div>
      </button>

      {/* Left Panel - Product Search & Grid */}
      <div className="flex-1 flex flex-col p-3 sm:p-4 lg:p-6 overflow-hidden pt-0 lg:pt-3">
        {/* Header Section */}
        <div className="mb-4 lg:px-8 sm:mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="pr-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">
                Point of Sale
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Select products to add to cart
              </p>
            </div>
            {/* Search Section */}
            <div className="bg-white w-45 lg:w-174 rounded-xl">
              {/* Product Search */}
              <div className="relative flex gap-2 items-center">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search products by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <button
                  onClick={handleManualProductRefresh}
                  disabled={productsLoading || isManualRefreshing}
                  title="Refresh products"
                  className="shrink-0 p-3 border-2 border-gray-200 rounded-lg hover:border-pink-400 hover:bg-pink-50 text-gray-500 hover:text-pink-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className={`w-5 h-5 ${(productsLoading || isManualRefreshing) ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Item Filters Row */}
          <div className="flex flex-wrap gap-2 items-center">
            {filterOptions.categories.length > 0 && (
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-pink-400"
              >
                <option value="">All Categories</option>
                {filterOptions.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {filterOptions.sizes.length > 0 && (
              <select
                value={filterSize}
                onChange={(e) => setFilterSize(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-pink-400"
              >
                <option value="">All Sizes</option>
                {filterOptions.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {filterOptions.colors.length > 0 && (
              <select
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-pink-400"
              >
                <option value="">All Colors</option>
                {filterOptions.colors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {filterOptions.brands.length > 0 && (
              <select
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-pink-400"
              >
                <option value="">All Brands</option>
                {filterOptions.brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-pink-600 hover:text-pink-800 font-medium px-2 py-1.5 rounded-lg hover:bg-pink-50 transition-colors"
              >
                Clear filters ✕
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">{filteredProducts.length} items</span>
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-md p-3 sm:p-4 lg:p-6">
          {productsLoading || isManualRefreshing ? (
            <div className="flex items-center justify-center h-full">
              <Loader message="Loading products..." size="large" />
            </div>
          ) : productsError ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Failed to load products</h3>
              <p className="text-gray-500 mb-4">{handleError(productsError, 'Product Fetch')}</p>
              <button
                onClick={handleManualProductRefresh}
                className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    className="group bg-white hover:bg-pink-50 border-2 border-gray-200 hover:border-pink-400 rounded-xl p-3 sm:p-4 text-left transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
                  >
                    <div className="flex flex-col h-full">
                      {/* Product Image */}
                      <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-2 sm:mb-3 overflow-hidden group-hover:scale-105 transition-transform">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg
                            className="w-7 h-7 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Product Name */}
                      <div className="font-semibold text-gray-800 text-xs sm:text-sm mb-2 line-clamp-2 grow">
                        {product.name}
                      </div>

                      {/* Price and Stock */}
                      <div className="flex items-end justify-between mt-auto">
                        <div className="text-base sm:text-lg lg:text-xl font-bold text-pink-500">
                          ₹{product.price.toFixed(2)}
                        </div>
                        {product.stock !== undefined && (
                          <div
                            className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              product.stock > 10
                                ? "bg-green-100 text-green-700"
                                : product.stock > 0.9
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {product.stock > 0.9
                              ? `${(product.stock).toFixed(0)} left`
                              : "Out"}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg
                    className="w-20 h-20 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p className="text-lg font-medium">
                    {searchQuery
                      ? "No products found"
                      : "No products available"}
                  </p>
                  <p className="text-sm mt-1">
                    {searchQuery
                      ? "Try a different search term"
                      : "Add products to get started"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div
        className={`${
          showMobileCart ? "fixed" : "hidden"
        } lg:inline-flex lg:static inset-0 lg:inset-auto w-full lg:w-96 mt-16 lg:mt-0 bg-white shadow-lg flex flex-col border-t lg:border-t-0 lg:border-l border-gray-200 h-screen lg:h-screen overflow-hidden z-40`}
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => setShowMobileCart(false)}
          className="lg:hidden absolute top-4 right-4 z-10 bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-full transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        {/* Cart Header */}
        <div className="bg-[#1e1e1e] p-2 sm:p-3 lg:p-4 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg lg:text-xl font-bold">
                Current Order
              </h2>
              <p className="text-pink-300 text-xs sm:text-sm mt-0.5">
                {cartItems.length} {cartItems.length === 1 ? "item" : "items"}{" "}
                in cart
              </p>
            </div>
            {/* <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div> */}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 p-2 sm:p-3 lg:p-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-600">
                Cart is Empty
              </p>
              <p className="text-sm mt-2 text-center">
                Scan barcode or click on products
                <br />
                to add them to cart
              </p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {cartItems.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-white rounded-lg p-2 sm:p-3 lg:p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 pr-2">
                      <div className="font-semibold text-sm sm:text-base text-gray-800 mb-0.5 line-clamp-2">
                        {item.product.name}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">
                        ₹{item.product.price.toFixed(2)} × {item.quantity}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 sm:gap-2">
                      <button
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors"
                      >
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                      <div className="text-sm sm:text-base lg:text-lg font-bold text-gray-800">
                        ₹{(item.product.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleUpdateQuantity(item.product.id, item.quantity - 1)
                      }
                      className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-gray-700 transition-colors text-sm sm:text-base"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateQuantity(
                          item.product.id,
                          parseInt(e.target.value) || 1,
                        )
                      }
                      className="w-12 sm:w-14 lg:w-16 text-center border-2 border-gray-200 rounded-lg px-1 sm:px-2 py-1 sm:py-1.5 font-semibold focus:outline-none focus:border-pink-500 text-sm sm:text-base"
                      min="1"
                    />
                    <button
                      onClick={() =>
                        handleUpdateQuantity(item.product.id, item.quantity + 1)
                      }
                      className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-lg bg-pink-500 hover:bg-pink-600 flex items-center justify-center font-bold text-white transition-colors text-sm sm:text-base"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer - Discount, Tax & Totals */}
        <div className="border-t-2 border-gray-200 p-2 sm:p-3 lg:p-4 bg-white space-y-2 sm:space-y-3 shrink-0">
          {/* Toggle Discount/GST Button */}
          <button
            onClick={() => setShowDiscountGst(!showDiscountGst)}
            className="w-full flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors"
          >
            <span className="text-xs sm:text-sm font-semibold text-pink-700">
              {showDiscountGst ? "Hide" : "Show"} Discount & GST
            </span>
            <svg
              className={`w-5 h-5 text-pink-700 transition-transform ${showDiscountGst ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Collapsible Discount & GST Section */}
          {showDiscountGst && (
            <div className="space-y-2 sm:space-y-3 lg:space-y-4 animate-fadeIn">
              {/* Discount Controls */}
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <label className="text-xs sm:text-sm font-semibold text-gray-700">
                    Discount
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => dispatch(setDiscountType("percentage"))}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        discountType === "percentage"
                          ? "bg-pink-500 text-white shadow-sm"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      }`}
                    >
                      %
                    </button>
                    <button
                      onClick={() => dispatch(setDiscountType("fixed"))}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        discountType === "fixed"
                          ? "bg-pink-500 text-white shadow-sm"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      }`}
                    >
                      ₹
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  max={
                    discountType === "percentage" ? "100" : subtotal.toString()
                  }
                  step="0.01"
                  value={discountValue}
                  onChange={(e) =>
                    dispatch(setDiscountValue(parseFloat(e.target.value) || 0))
                  }
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent font-medium text-sm sm:text-base"
                  placeholder={
                    discountType === "percentage" ? "Enter %" : "Enter ₹"
                  }
                />
              </div>

              {/* GST Controls */}
              <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-1 sm:mb-2">
                  GST %
                </label>
                <select
                  value={gstPercentage}
                  onChange={(e) =>
                    dispatch(setGstPercentage(parseFloat(e.target.value) || 0))
                  }
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent font-medium text-sm sm:text-base"
                  disabled={gstLoading}
                >
                  {allowedGstValues.map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Totals Breakdown */}
          <div className="bg-pink-50 rounded-lg p-2 sm:p-3 lg:p-4 space-y-1 sm:space-y-2">
            <div className="flex justify-between text-gray-600 text-xs sm:text-sm">
              <span className="font-medium">Subtotal</span>
              <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600 text-xs sm:text-sm">
                <span className="font-medium">
                  Discount{" "}
                  {discountType === "percentage" ? `(${discountValue}%)` : ""}
                </span>
                <span className="font-semibold">
                  -₹{discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            {gstAmount > 0 && (
              <div className="flex justify-between text-gray-600 text-xs sm:text-sm">
                <span className="font-medium">GST ({gstPercentage}%)</span>
                <span className="font-semibold">+₹{gstAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t-2 border-gray-300 pt-2 flex justify-between items-center">
              <span className="text-sm sm:text-base lg:text-lg font-bold text-gray-800">
                Total
              </span>
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-pink-500">
                ₹{finalTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1 sm:pt-2">
            <button
              onClick={() => {
                dispatch(clearCart());
                dispatch(setGstPercentage(defaultGstValue));
                dispatch(setDiscountType("percentage"));
                dispatch(setDiscountValue(0));
              }}
              className="bg-[#1e1e1e] hover:bg-gray-800 py-2 sm:py-2.5 lg:py-3 text-white text-sm sm:text-base lg:text-lg rounded-lg lg:rounded-xl font-bold transition-all transform hover:scale-105 shadow-md hover:shadow-lg flex items-center justify-center gap-1 sm:gap-2"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Clear
            </button>
            <button
              onClick={handleCheckout}
              disabled={cartItems.length === 0}
              className="bg-pink-500 hover:bg-pink-600 text-white py-2 sm:py-2.5 lg:py-3 text-sm sm:text-base lg:text-lg rounded-lg lg:rounded-xl font-bold transition-all transform hover:scale-105 shadow-md hover:shadow-lg disabled:bg-pink-300 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-1 sm:gap-2"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POS;
