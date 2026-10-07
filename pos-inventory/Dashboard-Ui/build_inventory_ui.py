import os
import sys
import re

FRONTEND_DIR = r"c:\Users\A\Documents\IB\Dashboard\New Dashboard\Atls\pos-inventory\Dashboard-Ui"

INVENTORY_API_TS = """
import { apiClient } from './client';

export interface InventoryOverview {
  total_products: number;
  total_stock_value: number;
  low_stock_items: number;
  out_of_stock: number;
  expiring_soon: number;
}

export interface InventoryDistributionStatus {
  status: string;
  count: number;
  percentage: number;
}

export interface InventoryDistribution {
  total: number;
  statuses: InventoryDistributionStatus[];
}

export interface InventoryCategoryValue {
  category: string;
  stock_value: number;
}

export interface InventoryMovement {
  period: string;
  stock_in: number;
  stock_out: number;
}

export interface ProductItem {
  id: string;
  item_code: string;
  name: string;
  sku: string;
  category: string;
  warehouse: string;
  current_stock: number;
  min_stock: number | null;
  stock_value: number;
  status: string;
  last_updated: string | null;
}

export interface ProductsResponse {
  items: ProductItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export const getInventoryOverview = async (warehouse?: string): Promise<InventoryOverview> => {
  const params = new URLSearchParams();
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  return apiClient.get(`/reports/inventory/overview?${params.toString()}`);
};

export const getInventoryDistribution = async (warehouse?: string): Promise<InventoryDistribution> => {
  const params = new URLSearchParams();
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  return apiClient.get(`/reports/inventory/distribution?${params.toString()}`);
};

export const getInventoryValueByCategory = async (limit: number, warehouse?: string): Promise<{categories: InventoryCategoryValue[]}> => {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  return apiClient.get(`/reports/inventory/value-by-category?${params.toString()}`);
};

export const getInventoryMovements = async (days: number, warehouse?: string): Promise<{data: InventoryMovement[], status: string, message?: string}> => {
  const params = new URLSearchParams();
  params.append('days', days.toString());
  if (warehouse && warehouse !== 'All') params.append('warehouse', warehouse);
  return apiClient.get(`/reports/inventory/movements?${params.toString()}`);
};

export const getInventoryProducts = async (
  page: number,
  limit: number,
  filters: { warehouse?: string, category?: string, status?: string, search?: string }
): Promise<ProductsResponse> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters.warehouse && filters.warehouse !== 'All') params.append('warehouse', filters.warehouse);
  if (filters.category && filters.category !== 'All Categories') params.append('category', filters.category);
  if (filters.status && filters.status !== 'All') params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  
  return apiClient.get(`/reports/inventory/products?${params.toString()}`);
};
"""

INVENTORY_PAGE_TSX = """
import React, { useState, useEffect } from 'react';
import { 
  Package, IndianRupee, AlertTriangle, AlertOctagon, Calendar, 
  Download, Filter, Search, RotateCw, Eye, Edit, MoreVertical, LayoutGrid
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { 
  getInventoryOverview, 
  getInventoryDistribution, 
  getInventoryValueByCategory, 
  getInventoryMovements,
  getInventoryProducts
} from '../api/inventoryReport';

// Chart components simplified for this version, in real app use Recharts
const KPI_CARDS = [
  { key: 'total_products', title: 'Total Products', icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
  { key: 'total_stock_value', title: 'Total Stock Value', icon: IndianRupee, color: 'text-green-500', bg: 'bg-green-50', isCurrency: true },
  { key: 'low_stock_items', title: 'Low Stock Items', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
  { key: 'out_of_stock', title: 'Out of Stock', icon: AlertOctagon, color: 'text-red-500', bg: 'bg-red-50' },
  { key: 'expiring_soon', title: 'Expiring Soon', icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-50' },
];

export const InventoryReportPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('summary');
  const [filters, setFilters] = useState({
    warehouse: 'All',
    category: 'All Categories',
    status: 'All',
    brand: 'All Brands',
    search: ''
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [topCategories, setTopCategories] = useState(6);
  const [movementDays, setMovementDays] = useState(7);

  const { data: overview, isLoading: isLoadingOverview, refetch: refetchOverview } = useQuery({
    queryKey: ['inventory-overview', appliedFilters.warehouse],
    queryFn: () => getInventoryOverview(appliedFilters.warehouse)
  });

  const { data: distribution, isLoading: isLoadingDist, refetch: refetchDist } = useQuery({
    queryKey: ['inventory-distribution', appliedFilters.warehouse],
    queryFn: () => getInventoryDistribution(appliedFilters.warehouse)
  });

  const { data: categoryValue, isLoading: isLoadingCat, refetch: refetchCat } = useQuery({
    queryKey: ['inventory-category-value', appliedFilters.warehouse, topCategories],
    queryFn: () => getInventoryValueByCategory(topCategories, appliedFilters.warehouse)
  });

  const { data: movements, isLoading: isLoadingMov, refetch: refetchMov } = useQuery({
    queryKey: ['inventory-movements', appliedFilters.warehouse, movementDays],
    queryFn: () => getInventoryMovements(movementDays, appliedFilters.warehouse)
  });

  const { data: productsData, isLoading: isLoadingProducts, refetch: refetchProd } = useQuery({
    queryKey: ['inventory-products', page, limit, appliedFilters],
    queryFn: () => getInventoryProducts(page, limit, appliedFilters)
  });

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setPage(1);
  };

  const handleResetFilters = () => {
    const defaultFilters = { warehouse: 'All', category: 'All Categories', status: 'All', brand: 'All Brands', search: '' };
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(1);
  };

  const handleRefresh = () => {
    refetchOverview();
    refetchDist();
    refetchCat();
    refetchMov();
    refetchProd();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Report</h1>
          <p className="text-gray-500 text-sm">View stock levels, movements and inventory valuation.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleRefresh} className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            <RotateCw className="w-5 h-5 text-gray-600" />
          </button>
          <div className="relative">
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {['Stock Summary', 'Stock Movements', 'Stock Valuation', 'Low Stock Report', 'Expiry Report'].map((tab) => {
          const key = tab.toLowerCase().replace(' ', '_');
          const isActive = activeTab === key || (activeTab === 'summary' && key === 'stock_summary');
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-3 font-medium text-sm border-b-2 ${
                isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {KPI_CARDS.map((card) => {
          const Icon = card.icon;
          const val = overview ? (overview as any)[card.key] : 0;
          return (
            <div key={card.title} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <span className="text-sm font-medium text-gray-600">{card.title}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {isLoadingOverview ? '...' : (card.isCurrency ? formatCurrency(val) : val.toLocaleString())}
              </div>
              <div className="text-xs text-gray-500 mt-1">N/A vs previous period</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap gap-4 items-center mb-6">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <select 
            value={filters.category} 
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            className="w-full border-gray-300 rounded-md text-sm p-2"
          >
            <option>All Categories</option>
            <option>Electronics</option>
            <option>Accessories</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Warehouse</label>
          <select 
            value={filters.warehouse} 
            onChange={(e) => setFilters({...filters, warehouse: e.target.value})}
            className="w-full border-gray-300 rounded-md text-sm p-2"
          >
            <option>All</option>
            <option value="WH-001">Main Branch (WH-001)</option>
            <option value="SH">Store House (SH)</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Stock Status</label>
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="w-full border-gray-300 rounded-md text-sm p-2"
          >
            <option value="All">All</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
        <div className="flex-2 min-w-[250px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">&nbsp;</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by product name, SKU..." 
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 items-end mt-5">
          <button onClick={handleApplyFilters} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
            Apply Filters
          </button>
          <button onClick={handleResetFilters} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50">
            Reset
          </button>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Status Distribution */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> Stock Status Distribution
          </h3>
          {isLoadingDist ? (
            <div className="flex h-40 items-center justify-center">Loading...</div>
          ) : (
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32 rounded-full border-[12px] border-green-400 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xl font-bold">{distribution?.total || 0}</div>
                  <div className="text-[10px] text-gray-500">Total Products</div>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                {distribution?.statuses?.map((s, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${s.status === 'in_stock' ? 'bg-green-500' : s.status === 'low_stock' ? 'bg-amber-400' : 'bg-red-500'}`}></div>
                      <span className="text-gray-600 capitalize">{s.status.replace('_', ' ')}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="font-medium">{s.percentage}%</span>
                      <span className="text-gray-400 w-8 text-right">{s.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Value by Category */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <IndianRupee className="w-4 h-4" /> Inventory Value by Category
            </h3>
            <select 
              value={topCategories} 
              onChange={(e) => setTopCategories(Number(e.target.value))}
              className="text-xs border-gray-300 rounded-md"
            >
              <option value={5}>Top 5</option>
              <option value={6}>Top 6</option>
            </select>
          </div>
          {isLoadingCat ? (
            <div className="flex h-40 items-center justify-center">Loading...</div>
          ) : (
            <div className="h-40 flex items-end justify-around gap-2 pt-4">
              {categoryValue?.categories?.map((c, i) => {
                const maxVal = Math.max(...(categoryValue.categories.map(x => x.stock_value) || [1]));
                const height = Math.max((c.stock_value / maxVal) * 100, 5);
                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1">
                    <span className="text-[10px] font-medium text-gray-600">₹{(c.stock_value/100000).toFixed(1)}L</span>
                    <div className="w-full bg-blue-500 rounded-t-sm" style={{ height: `${height}%`, minHeight: '4px' }}></div>
                    <span className="text-[10px] text-gray-500 truncate w-full text-center" title={c.category}>{c.category}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stock Movements */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <RotateCw className="w-4 h-4" /> Stock Movement (Last 7 Days)
            </h3>
            <select 
              value={movementDays}
              onChange={(e) => setMovementDays(Number(e.target.value))}
              className="text-xs border-gray-300 rounded-md"
            >
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
            </select>
          </div>
          {isLoadingMov ? (
             <div className="flex h-40 items-center justify-center">Loading...</div>
          ) : movements?.status === 'unavailable' ? (
             <div className="flex h-40 items-center justify-center text-sm text-gray-400 text-center px-4">
               {movements.message}
             </div>
          ) : (
             <div className="flex h-40 items-center justify-center text-sm text-gray-400">
               No movement data
             </div>
          )}
        </div>
      </div>

      {/* Product Stock List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" /> Product Stock List
          </h3>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <button className="flex items-center gap-2 border border-gray-300 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50">
              <LayoutGrid className="w-4 h-4" /> Columns
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300" /></th>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3 text-right">Current Stock</th>
                <th className="px-4 py-3 text-right">Min. Stock</th>
                <th className="px-4 py-3 text-right">Stock Value</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingProducts ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">Loading products...</td></tr>
              ) : productsData?.items?.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-500">No products match your filters.</td></tr>
              ) : (
                productsData?.items?.map((item, idx) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3"><input type="checkbox" className="rounded border-gray-300" /></td>
                    <td className="px-4 py-3 text-gray-500">{(productsData.page - 1) * productsData.limit + idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-500">{item.sku}</td>
                    <td className="px-4 py-3 text-gray-500">{item.category}</td>
                    <td className="px-4 py-3 text-gray-500">{item.warehouse}</td>
                    <td className={`px-4 py-3 text-right font-medium ${item.current_stock <= 0 ? 'text-red-600' : 'text-gray-900'}`}>{item.current_stock}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{item.min_stock || 'N/A'}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(item.stock_value)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium
                        ${item.status === 'in_stock' ? 'bg-green-100 text-green-700' : 
                          item.status === 'low_stock' ? 'bg-amber-100 text-amber-700' : 
                          'bg-red-100 text-red-700'}`}>
                        {item.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.last_updated}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-1 hover:bg-blue-50 text-blue-600 rounded"><Eye className="w-4 h-4" /></button>
                        <button className="p-1 hover:bg-blue-50 text-blue-600 rounded"><Edit className="w-4 h-4" /></button>
                        <button className="p-1 hover:bg-gray-100 text-gray-400 rounded"><MoreVertical className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-600">
          <div>
            Showing {productsData?.items ? ((productsData.page - 1) * productsData.limit + 1) : 0} to {productsData?.items ? Math.min(productsData.page * productsData.limit, productsData.total) : 0} of {productsData?.total || 0} products
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select 
                value={limit} 
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="border-gray-300 rounded-md text-xs py-1"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >&lt;</button>
              
              <button className="px-3 py-1 bg-blue-600 text-white rounded-md">{page}</button>
              
              <button 
                onClick={() => setPage(Math.min(productsData?.total_pages || 1, page + 1))}
                disabled={page >= (productsData?.total_pages || 1)}
                className="px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >&gt;</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
"""

def build_frontend():
    api_dir = os.path.join(FRONTEND_DIR, "src", "api")
    pages_dir = os.path.join(FRONTEND_DIR, "src", "pages")
    app_tsx_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
    layout_tsx_path = os.path.join(FRONTEND_DIR, "src", "components", "Layout.tsx")
    
    with open(os.path.join(api_dir, "inventoryReport.ts"), "w") as f:
        f.write(INVENTORY_API_TS)
        
    with open(os.path.join(pages_dir, "InventoryReportPage.tsx"), "w") as f:
        f.write(INVENTORY_PAGE_TSX)
        
    # App.tsx
    with open(app_tsx_path, "r") as f:
        app_content = f.read()
        
    if "InventoryReportPage" not in app_content:
        # insert import
        app_content = app_content.replace(
            "import { CustomersPage } from './pages/CustomersPage';",
            "import { CustomersPage } from './pages/CustomersPage';\nimport { InventoryReportPage } from './pages/InventoryReportPage';"
        )
        # insert route
        app_content = app_content.replace(
            "<Route path=\"/reports/payments\" element={<PaymentReportPage />} />",
            "<Route path=\"/reports/payments\" element={<PaymentReportPage />} />\n              <Route path=\"/reports/inventory\" element={<InventoryReportPage />} />"
        )
        with open(app_tsx_path, "w") as f:
            f.write(app_content)
            
    # Layout.tsx (Sidebar navigation)
    with open(layout_tsx_path, "r") as f:
        layout_content = f.read()
        
    if "/reports/inventory" not in layout_content:
        # Try to find reports submenu and add inventory report
        # The structure is likely: path: '/reports/payments', label: 'Payment Reports'
        replacement = "{ path: '/reports/payments', label: 'Payment Reports' },\n        { path: '/reports/inventory', label: 'Inventory Reports' },"
        if "{ path: '/reports/payments', label: 'Payment Reports' }" in layout_content:
             layout_content = layout_content.replace("{ path: '/reports/payments', label: 'Payment Reports' }", replacement)
             with open(layout_tsx_path, "w") as f:
                 f.write(layout_content)
        
    print("Frontend built successfully")

if __name__ == "__main__":
    build_frontend()
