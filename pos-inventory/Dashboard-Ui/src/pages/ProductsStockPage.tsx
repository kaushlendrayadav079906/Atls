import { useQuery } from '@tanstack/react-query';
import {
    AlertTriangle,
    Boxes,
    ChevronDown,
    Package2,
    Search,
    ShieldAlert,
    TrendingUp,
    Warehouse,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { posApi } from '../api/pos';
import { useDebounce } from '../hooks/useDebounce';
import type { Product } from '../types/pos';

const fallbackProducts: Product[] = [
  { id: 'P-1001', name: 'Wireless Headphones', category: 'Electronics', warehouse: 'WH-001', barcode: '8901234567890', stock: 245, price: 12990 },
  { id: 'P-1002', name: 'Smart Watch', category: 'Electronics', warehouse: 'WH-001', barcode: '8901234567891', stock: 189, price: 8999 },
  { id: 'P-1003', name: 'Laptop Stand', category: 'Accessories', warehouse: 'WH-001', barcode: '8901234567892', stock: 156, price: 1999 },
  { id: 'P-1004', name: 'USB-C Cable', category: 'Accessories', warehouse: 'WH-002', barcode: '8901234567893', stock: 432, price: 1499 },
  { id: 'P-1005', name: 'Bluetooth Speaker', category: 'Electronics', warehouse: 'WH-001', barcode: '8901234567894', stock: 128, price: 3499 },
  { id: 'P-1006', name: 'Wireless Mouse', category: 'Accessories', warehouse: 'WH-002', barcode: '8901234567895', stock: 18, price: 1299 },
  { id: 'P-1007', name: 'Mechanical Keyboard', category: 'Accessories', warehouse: 'WH-001', barcode: '8901234567896', stock: 8, price: 4999 },
  { id: 'P-1008', name: 'Monitor', category: 'Electronics', warehouse: 'WH-001', barcode: '8901234567897', stock: 0, price: 12999 },
  { id: 'P-1009', name: 'Office Chair', category: 'Furniture', warehouse: 'WH-002', barcode: '8901234567898', stock: 56, price: 10999 },
  { id: 'P-1010', name: 'Table Top', category: 'Electronics', warehouse: 'WH-001', barcode: '8901234567899', stock: 22, price: 8999 },
];

const statusTone = (stock?: number | null) => {
  if (typeof stock !== 'number') return 'border border-sky-700/60 bg-sky-500/10 text-sky-200';
  if (stock <= 0) return 'border border-red-500/30 bg-red-500/12 text-red-300';
  if (stock <= 10) return 'border border-amber-500/30 bg-amber-500/12 text-amber-300';
  return 'border border-emerald-500/30 bg-emerald-500/12 text-emerald-300';
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'healthy'>('all');
  const [selectedId, setSelectedId] = useState<string>('P-1001');
  const debouncedSearch = useDebounce(search, 300);

  const { data: products = fallbackProducts, isLoading, isError, error, refetch } = useQuery<Product[]>({
    queryKey: ['products-stock', debouncedSearch],
    queryFn: () => posApi.searchProducts(debouncedSearch),
    staleTime: 60_000,
  });

  const baseProducts = Array.isArray(products) && products.length > 0 ? products : fallbackProducts;

  const filteredProducts = useMemo(() => {
    return baseProducts.filter((product) => {
      const matchesSearch =
        !debouncedSearch ||
        product.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        product.id?.toLowerCase().includes(debouncedSearch.toLowerCase());

      if (!matchesSearch) return false;

      const stock = Number(product.stock ?? 0);
      if (filter === 'low') return stock <= 10;
      if (filter === 'healthy') return stock > 10;
      return true;
    });
  }, [baseProducts, debouncedSearch, filter]);

  const selectedProduct = filteredProducts.find((product) => product.id === selectedId) ?? filteredProducts[0] ?? baseProducts[0];

  const totalProducts = baseProducts.length;
  const lowStock = baseProducts.filter((product) => Number(product.stock ?? 0) <= 10).length;
  const outOfStock = baseProducts.filter((product) => Number(product.stock ?? 0) <= 0).length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-8 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300/80">Products & Stock</div>
          <h1 className="text-[42px] font-black leading-none tracking-[-0.06em] text-white">Products & Stock</h1>
          <p className="mt-2 text-[14px] text-sky-100/75">Manage your product catalog and monitor stock across warehouses</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-sky-700/80 bg-[#0d2341] px-4 py-2.5 text-sm font-medium text-sky-100">
            <Boxes className="h-4 w-4 text-sky-300" />
            <span>Import Products</span>
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-sky-700/80 bg-[#0d2341] px-4 py-2.5 text-sm font-medium text-sky-100">
            <TrendingUp className="h-4 w-4 text-sky-300" />
            <span>Export</span>
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_25px_rgba(59,130,246,0.5)]">
            <Package2 className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Products" value={`${totalProducts}`} change="vs. last month" trend="positive" icon={<Package2 className="h-5 w-5" />} tone="blue" metadata="1,248" />
        <StatCard title="In Stock" value={`${Math.max(totalProducts - lowStock - outOfStock, 0)}`} change="vs. last month" trend="positive" icon={<Boxes className="h-5 w-5" />} tone="emerald" metadata="892" />
        <StatCard title="Low Stock" value={`${lowStock}`} change="vs. last month" trend="warning" icon={<AlertTriangle className="h-5 w-5" />} tone="amber" metadata="47" />
        <StatCard title="Out of Stock" value={`${outOfStock}`} change="vs. last month" trend="negative" icon={<ShieldAlert className="h-5 w-5" />} tone="red" metadata="12" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <div className="rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-3 border-b border-sky-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products, SKU, barcode, or ask AI..."
                className="block w-full rounded-xl border border-sky-800 bg-[#0d2341] py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-[170px]">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as 'all' | 'low' | 'healthy')}
                  className="block w-full appearance-none rounded-xl border border-sky-800 bg-[#0d2341] px-3 py-2.5 pr-9 text-sm text-sky-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Categories</option>
                  <option value="low">Low Stock</option>
                  <option value="healthy">Healthy Stock</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-200" />
              </div>
              <button className="rounded-xl border border-sky-700/80 bg-[#0d2341] px-3 py-2 text-sm font-medium text-sky-100">Clear Filters</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-sky-100">
              <thead className="bg-[#0b1d38] text-[11px] uppercase tracking-[0.12em] text-sky-200/70">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    <input type="checkbox" className="h-4 w-4 rounded border-sky-700 bg-[#0d2341] accent-blue-500" />
                  </th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Warehouse</th>
                  <th className="px-4 py-3 font-medium text-right">Available</th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sky-100/65">Loading products...</td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-red-300">Could not load products</p>
                        <p className="text-xs text-sky-100/60">{(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Backend unavailable.'}</p>
                        <button onClick={() => refetch()} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200">
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sky-100/65">No products match your current search or filter.</td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className={`cursor-pointer border-t border-sky-900/70 hover:bg-[#102949] ${selectedProduct?.id === product.id ? 'bg-[#102949]' : ''}`} onClick={() => setSelectedId(String(product.id))}>
                      <td className="px-4 py-3 text-sky-100/80">
                        <input type="checkbox" className="h-4 w-4 rounded border-sky-700 bg-[#0d2341] accent-blue-500" />
                      </td>
                      <td className="px-4 py-3 font-semibold text-sky-100">{product.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-700/80 bg-[linear-gradient(135deg,#dfe9f5,#cbd5e1)] text-slate-700 shadow-inner shadow-sky-900/20">
                            <Package2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium text-white">{product.name || 'Unnamed item'}</div>
                            <div className="text-[11px] text-sky-100/60">{product.barcode || 'No barcode'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sky-100/80">{product.category || 'General'}</td>
                      <td className="px-4 py-3 text-sky-100/80">{product.warehouse || 'WH-001'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-sky-100">{Number(product.stock ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone(Number(product.stock ?? 0))}`}>
                          {stockLabel(Number(product.stock ?? 0))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="rounded-lg border border-sky-700/80 bg-[#0d2341] px-2 py-1 text-xs text-sky-100">•••</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-sky-900/80 px-4 py-3 text-sm text-sky-100/70">
            <span>Showing 1 to 10 of {filteredProducts.length} products</span>
            <div className="flex items-center gap-2">
              <button className="h-8 w-8 rounded-lg border border-sky-700/80 bg-[#0d2341] text-sky-100">1</button>
              <button className="h-8 w-8 rounded-lg border border-sky-700/80 bg-transparent text-sky-100/70">2</button>
              <button className="h-8 w-8 rounded-lg border border-sky-700/80 bg-transparent text-sky-100/70">3</button>
            </div>
          </div>
        </div>

        <aside className="rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between border-b border-sky-900/80 pb-3">
            <div className="flex items-center gap-2 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[radial-gradient(circle_at_top,#dfe9f5,#bfd7f4_60%,#8aa7d4)] text-slate-700 shadow-inner shadow-sky-500/20">
                <Package2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[12px] text-sky-200/75">Product</div>
                <div className="text-[20px] font-semibold text-white">{selectedProduct?.name || 'Wireless Headphones'}</div>
              </div>
            </div>
            <button className="rounded-xl border border-sky-700/80 bg-[#0d2341] p-2 text-sky-100">×</button>
          </div>

          <div className="mt-4 rounded-2xl border border-sky-900/80 bg-[#0d2341] p-3">
            <div className="flex h-32 items-center justify-center rounded-xl bg-[radial-gradient(circle_at_top,#eef5ff,#dfeafc_50%,#c8dafe_100%)]">
              <Package2 className="h-16 w-16 text-slate-700" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] text-sky-100/90">
            <div className="rounded-xl border border-sky-800 bg-[#0d2341] p-2">
              <div className="text-sky-200/60">SKU</div>
              <div className="mt-1 font-semibold text-white">{selectedProduct?.id || 'P-1001'}</div>
            </div>
            <div className="rounded-xl border border-sky-800 bg-[#0d2341] p-2">
              <div className="text-sky-200/60">Barcode</div>
              <div className="mt-1 font-semibold text-white">{selectedProduct?.barcode || '8901234567890'}</div>
            </div>
            <div className="rounded-xl border border-sky-800 bg-[#0d2341] p-2">
              <div className="text-sky-200/60">Category</div>
              <div className="mt-1 font-semibold text-white">{selectedProduct?.category || 'Electronics'}</div>
            </div>
            <div className="rounded-xl border border-sky-800 bg-[#0d2341] p-2">
              <div className="text-sky-200/60">Brand</div>
              <div className="mt-1 font-semibold text-white">Sony</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-sky-800 bg-[#0d2341] px-3 py-2 text-sm text-sky-100/80">
            <span className="font-medium text-white">Selling Price</span>
            <span className="font-bold text-white">{money.format(Number(selectedProduct?.price ?? 12990))}</span>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-sky-800 bg-[#0d2341] px-3 py-2 text-sm text-sky-100/80">
            <span className="font-medium text-white">Cost Price</span>
            <span className="font-bold text-white">{money.format(Number(selectedProduct?.price ?? 12990) * 0.7)}</span>
          </div>

          <div className="mt-5 rounded-2xl border border-sky-800 bg-[#0d2341] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Warehouse className="h-4 w-4 text-sky-300" />
                <span className="text-[16px] font-semibold">Stock by Warehouse</span>
              </div>
              <button className="text-[11px] font-medium text-sky-300">View All</button>
            </div>

            <div className="space-y-2 text-sm">
              {['WH-001', 'WH-002', 'WH-003'].map((warehouse, index) => (
                <div key={warehouse} className="flex items-center justify-between rounded-xl border border-sky-800 bg-[#0c2440] px-3 py-2">
                  <div className="flex items-center gap-2 text-sky-100/80">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-900/60 text-xs font-semibold text-sky-100">{warehouse.replace('WH-', '')}</div>
                    <span>{warehouse}</span>
                  </div>
                  <span className="font-semibold text-white">{[245, 86, 0][index]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-sky-800 bg-[#0d2341] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <TrendingUp className="h-4 w-4 text-sky-300" />
                <span className="text-[16px] font-semibold">Stock Movement History</span>
              </div>
              <button className="text-[11px] font-medium text-sky-300">View All</button>
            </div>

            <div className="space-y-2 text-[12px] text-sky-100/80">
              <div className="flex items-center justify-between rounded-xl border border-sky-800 bg-[#0c2440] px-2 py-2">
                <span>27 Nov 2024</span>
                <span>Sale</span>
                <span className="text-red-300">-2</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-sky-800 bg-[#0c2440] px-2 py-2">
                <span>26 Nov 2024</span>
                <span>Sale</span>
                <span className="text-red-300">-1</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-sky-800 bg-[#0c2440] px-2 py-2">
                <span>25 Nov 2024</span>
                <span>Purchase</span>
                <span className="text-emerald-300">+50</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="rounded-xl border border-sky-700/80 bg-[#0d2341] px-3 py-2.5 text-sm font-medium text-sky-100">Adjust Stock</button>
            <button className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_0_25px_rgba(59,130,246,0.5)]">Create Purchase Order</button>
          </div>
        </aside>
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
  positive: 'bg-emerald-500/12 text-emerald-300',
  warning: 'bg-amber-500/12 text-amber-300',
  negative: 'bg-red-500/12 text-red-300',
};

const StatCard = ({ title, value, change, trend, icon, tone, metadata }: StatCardProps) => (
  <div className="rounded-[22px] border border-sky-900/80 bg-[linear-gradient(180deg,#0b1f3b_0%,#091d36_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
    <div className="flex items-start justify-between gap-3">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${toneClasses[tone]}`}>
        {icon}
      </div>
      <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${trendClasses[trend]}`}>
        {trend === 'positive' ? '+12.5%' : trend === 'warning' ? '-18%' : '-5%'}
      </div>
    </div>

    <div className="mt-6 space-y-1">
      <div className="text-[13px] font-medium text-sky-100/85">{title}</div>
      <div className="text-[28px] font-black leading-none tracking-[-0.06em] text-white">{value}</div>
      <div className="text-[11px] text-sky-100/65">{change}</div>
    </div>

    <div className="mt-3 text-right text-[10px] font-medium text-sky-200/80">{metadata}</div>
  </div>
);

export default ProductsStockPage;
