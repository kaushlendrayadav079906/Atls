import { useQuery } from '@tanstack/react-query';
import {
    AlertTriangle,
    Boxes,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Package2,
    Search,
    ShieldAlert,
    TrendingUp,
    Warehouse,
    Eye,
    XCircle,
    Download
} from 'lucide-react';
import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { posApi } from '../api/pos';
import { commonApi } from '../api/common';
import { useDebounce } from '../hooks/useDebounce';
import { useAIAssistant } from '../contexts/AIAssistantContext';
import type { Product } from '../types/pos';

const fallbackProducts: Product[] = [];

const statusTone = (stock?: number | null) => {
  if (typeof stock !== 'number') return 'border border-slate-200 bg-sky-50 text-slate-600';
  if (stock <= 0) return 'border border-red-500/30 bg-red-50 text-red-600';
  if (stock <= 10) return 'border border-amber-200 bg-amber-50 text-amber-700';
  return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
};

const stockLabel = (stock?: number | null) => {
  if (typeof stock !== 'number') return 'N/A';
  if (stock <= 0) return 'Out of stock';
  if (stock <= 10) return 'Low stock';
  return 'In Stock';
};

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export const ProductsStockPage = () => {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const { setPageFilters } = useAIAssistant();

  const urlSearch = searchParams.get('search') || searchParams.get('sku') || params.id || '';
  const urlOpenDetails = searchParams.get('openDetails') === 'true' || Boolean(params.id);

  const [search, setSearch] = useState(urlSearch);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [stockStatus, setStockStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(params.id || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const debouncedSearch = useDebounce(search, 300);

  // Fetch verified SAP filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => commonApi.getFilterOptions(),
    staleTime: 300_000,
  });

  // Sync with URL params changes
  useEffect(() => {
    if (urlSearch && urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  // Sync page filters to AIAssistantContext
  useEffect(() => {
    setPageFilters({
      search,
      warehouse: warehouseFilter,
      stockStatus,
    });
  }, [search, warehouseFilter, stockStatus, setPageFilters]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, warehouseFilter, stockStatus]);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsModalOpen(false);
      };
      window.addEventListener('keydown', handleEsc);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
      };
    }
  }, [isModalOpen]);

  const { data: products = fallbackProducts, isLoading, isError, error, refetch } = useQuery<Product[]>({
    queryKey: ['products-stock', debouncedSearch, warehouseFilter, stockStatus],
    queryFn: () => posApi.searchProducts({
      search: debouncedSearch,
      warehouse: warehouseFilter || undefined,
      stock_status: stockStatus === 'all' ? undefined : stockStatus,
    }),
    staleTime: 60_000,
  });

  const baseProducts = Array.isArray(products) ? products : [];

  // Auto-open product details modal if navigated with openDetails or product ID
  useEffect(() => {
    if (urlOpenDetails && baseProducts.length > 0 && !isModalOpen) {
      const targetQuery = (urlSearch || selectedId || '').toLowerCase();
      const matched = baseProducts.find(
        (p) =>
          p.id?.toLowerCase() === targetQuery ||
          p.barcode?.toLowerCase() === targetQuery ||
          p.name?.toLowerCase().includes(targetQuery)
      );
      if (matched) {
        setSelectedId(matched.id);
        setIsModalOpen(true);
      } else if (baseProducts.length === 1) {
        setSelectedId(baseProducts[0].id);
        setIsModalOpen(true);
      }
    }
  }, [urlOpenDetails, urlSearch, baseProducts]);

  const filteredProducts = baseProducts;

  const selectedProduct = filteredProducts.find((product) => product.id === selectedId) ?? filteredProducts[0] ?? baseProducts[0] ?? null;

  const totalProducts = baseProducts.length;
  const outOfStock = baseProducts.filter((product) => Number(product.stock ?? 0) <= 0).length;
  const lowStock = baseProducts.filter((product) => {
    const s = Number(product.stock ?? 0);
    return s > 0 && s <= 10;
  }).length;
  const inStock = baseProducts.filter((product) => Number(product.stock ?? 0) > 10).length;

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredProducts.slice(start, start + limit);
  }, [filteredProducts, page, limit]);

  const handleClearFilters = () => {
    setSearch('');
    setWarehouseFilter('');
    setStockStatus('all');
    setPage(1);
  };

  const handleExportCSV = () => {
    if (filteredProducts.length === 0) return;
    const headers = ["Item Code / SKU", "Product Name", "Barcode", "Category", "Warehouse", "Stock", "Price"];
    const rows = filteredProducts.map(p => [
      `"${p.id || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${p.barcode || ''}"`,
      `"${p.category || ''}"`,
      `"${p.warehouse || ''}"`,
      p.stock ?? 0,
      p.price ?? 0
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_stock_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-8 text-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="atlas-page-title text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900">Products & Stock</h1>
          <p className="mt-1.5 atlas-page-subtitle text-sm sm:text-[15px] font-normal text-slate-500">Manage your product catalog and monitor stock across warehouses</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
          >
            <Download className="h-4 w-4 text-blue-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Products" value={`${totalProducts}`} change="live SAP catalog" trend="positive" icon={<Package2 className="h-5 w-5" />} tone="blue" metadata="SAP Items" />
        <StatCard title="In Stock" value={`${inStock}`} change="stock > 10" trend="positive" icon={<Boxes className="h-5 w-5" />} tone="emerald" metadata="Available" />
        <StatCard title="Low Stock" value={`${lowStock}`} change="stock 1-10" trend="warning" icon={<AlertTriangle className="h-5 w-5" />} tone="amber" metadata="Reorder soon" />
        <StatCard title="Out of Stock" value={`${outOfStock}`} change="stock = 0" trend="negative" icon={<ShieldAlert className="h-5 w-5" />} tone="red" metadata="Depleted" />
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden flex flex-col">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Search className="h-4 w-4" />
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products by name, SKU, or barcode..."
                className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-[14px] sm:text-[14.5px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Warehouse selector */}
              <div className="relative min-w-[170px]">
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-8 text-[13px] font-semibold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="">All Warehouses</option>
                  {filterOptions?.warehouses?.map((w) => (
                    <option key={w.code} value={w.code}>{w.name} ({w.code})</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>

              {/* Stock status selector */}
              <div className="relative min-w-[160px]">
                <select
                  value={stockStatus}
                  onChange={(event) => setStockStatus(event.target.value as any)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-8 text-[13px] font-semibold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="all">All Stock Status</option>
                  <option value="in_stock">In Stock (&gt;10)</option>
                  <option value="low_stock">Low Stock (1-10)</option>
                  <option value="out_of_stock">Out of Stock (0)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>

              <button 
                onClick={handleClearFilters}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13.5px] sm:text-[14px] text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 text-center">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-200 bg-white accent-blue-500" />
                  </th>
                  <th className="px-4 py-3.5">SKU</th>
                  <th className="px-4 py-3.5">Product</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Warehouse</th>
                  <th className="px-4 py-3.5 text-right">Available</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500 text-sm">Loading products...</td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <div className="space-y-2">
                        <p className="text-base font-semibold text-red-600">Could not load products</p>
                        <p className="text-sm text-slate-500">{(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Backend unavailable.'}</p>
                        <button onClick={() => refetch()} className="rounded-xl border border-red-500/30 bg-red-50 px-3.5 py-1.5 text-sm font-semibold text-red-700">
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500 text-sm">No products match your current search or filter.</td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => (
                    <tr key={product.id} className={`cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50/60 group ${selectedProduct?.id === product.id ? 'bg-blue-50/50' : ''}`} onClick={() => setSelectedId(String(product.id))}>
                      <td className="px-5 py-4 text-center text-slate-500">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-200 bg-white accent-blue-500" />
                      </td>
                      <td className="px-5 py-4 text-[13.5px] font-bold text-blue-600">{product.id}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-700 shadow-sm">
                            <Package2 className="h-5 w-5 opacity-70" />
                          </div>
                          <div>
                            <div className="text-[14.5px] font-semibold text-slate-800">{product.name || 'Unnamed item'}</div>
                            <div className="text-[12px] font-medium text-slate-500">{product.barcode || 'No barcode'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[13.5px] font-medium text-slate-600">{product.category || 'General'}</td>
                      <td className="px-5 py-4 text-[13.5px] font-medium text-slate-600">{product.warehouse || ''}</td>
                      <td className="px-5 py-4 text-right text-[15px] font-black text-slate-900">{Number(product.stock ?? 0).toLocaleString()}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold tracking-wide ${statusTone(Number(product.stock ?? 0))}`}>
                          {stockLabel(Number(product.stock ?? 0))}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedId(String(product.id)); setIsModalOpen(true); }} className="rounded-lg p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"><Eye className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4.5 border-t border-slate-200 text-sm">
            <div className="text-slate-500 text-[13.5px]">
               Showing {filteredProducts.length ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, filteredProducts.length)} of {filteredProducts.length} products
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[13.5px]">Rows per page</span>
                  <select 
                     className="border border-slate-200 rounded-lg px-2.5 py-1 text-[13.5px] outline-none text-slate-700 bg-white"
                     value={limit}
                     onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  >
                     <option value={10}>10</option>
                     <option value={20}>20</option>
                     <option value={50}>50</option>
                  </select>
               </div>
               <div className="flex items-center gap-1">
                  <button 
                     disabled={page === 1}
                     onClick={() => setPage(p => p - 1)}
                     className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                     <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white font-semibold text-[13.5px]">
                     {page}
                  </button>
                  <button 
                     disabled={page >= Math.ceil(filteredProducts.length / limit) || filteredProducts.length === 0}
                     onClick={() => setPage(p => p + 1)}
                     className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  >
                     <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </div>
        </div>

        {isModalOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[3px] z-[100] flex items-center justify-center p-4 sm:p-6"
            onClick={() => setIsModalOpen(false)}
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          >
            <style>{`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
            `}</style>
            
            <div 
              className="w-full max-w-[800px] max-h-[90vh] bg-slate-50 rounded-2xl shadow-2xl z-[101] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: 'scaleIn 0.2s ease-out' }}
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3 text-slate-900">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-700 shadow-sm">
                    <Package2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Product Detail</div>
                    <div className="text-[20px] font-bold text-slate-900 leading-tight">{selectedProduct?.name || 'N/A'}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                {/* Top Section: Image & Info Side-by-Side */}
                <div className="flex flex-col md:flex-row gap-5">
                  <div className="w-full md:w-[220px] shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-center min-h-[160px] p-4">
                    <Package2 className="h-16 w-16 text-slate-300" />
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">SKU</div>
                        <div className="mt-0.5 text-[13px] font-bold text-slate-800">{selectedProduct?.id || 'N/A'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Barcode</div>
                        <div className="mt-0.5 text-[13px] font-bold text-slate-800">{selectedProduct?.barcode || 'N/A'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Category</div>
                        <div className="mt-0.5 text-[13px] font-bold text-slate-800">{selectedProduct?.category || 'N/A'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Brand</div>
                        <div className="mt-0.5 text-[13px] font-bold text-slate-800">{selectedProduct?.brand || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 h-full">
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm h-full">
                        <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Selling Price</span>
                        <span className="font-bold text-slate-900 text-[15px]">{selectedProduct ? money.format(Number(selectedProduct.price)) : 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm h-full">
                        <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Cost Price</span>
                        <span className="font-bold text-slate-900 text-[15px]">{selectedProduct ? money.format(Number(selectedProduct.price) * 0.7) : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Stock details */}
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900">
                        <Warehouse className="h-4 w-4 text-blue-600" />
                        <span className="text-[14px] font-bold">Stock by Warehouse</span>
                      </div>
                    </div>

                    <div className="space-y-2 flex-1">
                      {selectedProduct ? (
                        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2 text-slate-600 font-medium">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm text-[11px] font-bold text-slate-700">
                              {(selectedProduct.warehouse || 'WH').replace('WH-', '')}
                            </div>
                            <span className="text-[13px]">{selectedProduct.warehouse || 'Current Branch'}</span>
                          </div>
                          <span className="font-bold text-slate-900 text-[15px]">{selectedProduct.stock || 0}</span>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-center py-2 text-[13px]">No product selected</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <span className="text-[14px] font-bold text-slate-900">Stock Movement</span>
                      </div>
                    </div>

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <span className="text-slate-500 text-[11px] font-semibold">27 Nov 2024</span>
                        <span className="text-slate-700 font-medium text-[12px]">Sale</span>
                        <span className="font-bold text-red-500 text-[13px]">-2</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <span className="text-slate-500 text-[11px] font-semibold">26 Nov 2024</span>
                        <span className="text-slate-700 font-medium text-[12px]">Sale</span>
                        <span className="font-bold text-red-500 text-[13px]">-1</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <span className="text-slate-500 text-[11px] font-semibold">25 Nov 2024</span>
                        <span className="text-slate-700 font-medium text-[12px]">Purchase</span>
                        <span className="font-bold text-emerald-600 text-[13px]">+50</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white p-5 flex justify-end">
                <button className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
                  Adjust Stock
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

type StatCardProps = {
  title: string;
  value: string;
  change: string;
  trend: 'positive' | 'warning' | 'negative';
  icon: ReactNode;
  tone: 'blue' | 'amber' | 'red' | 'emerald';
  metadata: string;
};

const toneClasses: Record<StatCardProps['tone'], string> = {
  blue: 'from-blue-600 to-blue-300',
  amber: 'from-amber-500 to-orange-300',
  red: 'from-red-500 to-pink-300',
  emerald: 'from-emerald-500 to-emerald-300',
};

const trendClasses: Record<StatCardProps['trend'], string> = {
  positive: 'bg-emerald-50 text-emerald-700',
  warning:  'bg-amber-50 text-amber-700',
  negative: 'bg-red-50 text-red-600',
};

const StatCard = ({ title, value, change, trend, icon, tone, metadata }: StatCardProps) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_4px_15px_-3px_rgba(6,81,237,0.1)] transition-shadow flex flex-col justify-between gap-4">
    <div className="flex items-start justify-between gap-3">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${toneClasses[tone]} text-white shadow-sm`}>
        {icon}
      </div>
      <div className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold tracking-wide ${trendClasses[trend]}`}>
        {trend === 'positive' ? '+12.5%' : trend === 'warning' ? '-18%' : '-5%'}
      </div>
    </div>

    <div className="mt-3 space-y-1">
      <div className="text-[13px] sm:text-[13.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{title}</div>
      <div className="text-[26px] sm:text-[28px] font-extrabold tracking-tight text-slate-900">{value}</div>
      <div className="text-[12.5px]">
        <span className="text-slate-400 font-medium">{change}</span>
      </div>
    </div>

    <div className="mt-3 text-right text-[12px] font-medium text-slate-500">{metadata}</div>
  </div>
);

export default ProductsStockPage;
