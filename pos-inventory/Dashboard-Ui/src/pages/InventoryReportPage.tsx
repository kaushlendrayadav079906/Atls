import React, { useState } from 'react';
import { 
  Package, IndianRupee, AlertTriangle, AlertOctagon, Calendar, 
  Download, Search, RotateCw, Eye, Edit, MoreVertical, LayoutGrid
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  getInventoryOverview, 
  getInventoryDistribution, 
  getInventoryValueByCategory, 
  getInventoryMovements,
  getInventoryProducts
} from '../api/inventoryReport';

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
  const [topCategories] = useState(6);
  const [movementPeriod, setMovementPeriod] = useState('Week');
  const [categoryPeriod, setCategoryPeriod] = useState('Month');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: overview, isLoading: isLoadingOverview, isError: isErrorOverview, error: errorOverview, refetch: refetchOverview } = useQuery({
    queryKey: ['inventory-overview', appliedFilters.warehouse],
    queryFn: () => getInventoryOverview(appliedFilters.warehouse)
  });

  const { data: distribution, isLoading: isLoadingDist, isError: isErrorDist, refetch: refetchDist } = useQuery({
    queryKey: ['inventory-distribution', appliedFilters.warehouse],
    queryFn: () => getInventoryDistribution(appliedFilters.warehouse)
  });

  const { data: categoryValue, isLoading: isLoadingCat, isError: isErrorCat, refetch: refetchCat } = useQuery({
    queryKey: ['inventory-category-value', appliedFilters.warehouse, topCategories],
    queryFn: () => getInventoryValueByCategory(topCategories, appliedFilters.warehouse)
  });

  const { data: movements, isLoading: isLoadingMov, isError: isErrorMov, refetch: refetchMov } = useQuery({
    queryKey: ['inventory-movements', appliedFilters.warehouse, movementPeriod],
    queryFn: () => getInventoryMovements(movementPeriod === 'Week' ? 7 : movementPeriod === 'Month' ? 30 : movementPeriod === 'Year' ? 365 : 1, appliedFilters.warehouse)
  });

  const { data: productsData, isLoading: isLoadingProducts, isError: isErrorProducts, refetch: refetchProd } = useQuery({
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

  const formatInventoryValue = (val: number) => {
    if (val < 1000) return `₹${val.toFixed(0)}`;
    if (val < 100000) return `₹${(val / 1000).toFixed(1)}K`;
    if (val < 10000000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${(val / 10000000).toFixed(1)}Cr`;
  };

  const COLORS: Record<string, string> = {
    in_stock: '#22c55e',
    low_stock: '#facc15',
    out_of_stock: '#ef4444',
    expiring_soon: '#a855f7'
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="atlas-page-title text-[28px] sm:text-[32px] md:text-[34px] font-bold text-gray-900">Inventory Report</h1>
          <p className="atlas-page-subtitle text-[14px] sm:text-[15px] text-gray-500 mt-1">View stock levels, movements and inventory valuation.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleRefresh} className="p-2.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            <RotateCw className="w-5 h-5 text-gray-600" />
          </button>
          <div className="relative">
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 text-[13.5px] sm:text-[14px] font-semibold rounded-md hover:bg-blue-700 shadow-sm transition-colors">
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
              className={`px-4 py-3 font-semibold text-[14px] sm:text-[14.5px] border-b-2 transition-colors ${
                isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Global Error State */}
      {(isErrorOverview || isErrorDist || isErrorCat || isErrorMov || isErrorProducts) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[14.5px] font-bold text-red-800">API Connection Error</h3>
            <p className="text-[13.5px] text-red-600 mt-1">
              Unable to load SAP inventory data. The server responded with an error (e.g. 500 Internal Server Error). 
              {errorOverview ? ` Details: ${(errorOverview as any).message || 'SAP Service Layer might be unavailable.'}` : ''}
            </p>
            <button onClick={handleRefresh} className="mt-3 px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-[13.5px] font-semibold rounded-md transition-colors">
              Retry Connection
            </button>
          </div>
        </div>
      )}

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
                <span className="atlas-card-title text-[13px] sm:text-[13.5px] font-semibold text-gray-600">{card.title}</span>
              </div>
              <div className="atlas-kpi-val text-[24px] sm:text-[27px] font-black text-gray-900 mt-1">
                {isLoadingOverview ? '...' : (card.isCurrency ? formatCurrency(val || 0) : (val || 0).toLocaleString())}
              </div>
              <div className="text-[12px] text-gray-500 mt-1 font-medium">N/A vs previous period</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-wrap gap-4 items-center mb-6">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[13px] sm:text-[13.5px] font-semibold text-gray-700 mb-1.5">Category</label>
          <select 
            value={filters.category} 
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            className="w-full border-gray-300 rounded-md text-[13.5px] p-2.5 bg-white text-gray-700 font-medium"
          >
            <option>All Categories</option>
            <option>Electronics</option>
            <option>Accessories</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[13px] sm:text-[13.5px] font-semibold text-gray-700 mb-1.5">Warehouse</label>
          <select 
            value={filters.warehouse} 
            onChange={(e) => setFilters({...filters, warehouse: e.target.value})}
            className="w-full border-gray-300 rounded-md text-[13.5px] p-2.5 bg-white text-gray-700 font-medium"
          >
            <option>All</option>
            <option value="WH-001">Main Branch (WH-001)</option>
            <option value="SH">Store House (SH)</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[13px] sm:text-[13.5px] font-semibold text-gray-700 mb-1.5">Stock Status</label>
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="w-full border-gray-300 rounded-md text-[13.5px] p-2.5 bg-white text-gray-700 font-medium"
          >
            <option value="All">All</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
        <div className="flex-2 min-w-[250px]">
          <label className="block text-[13px] sm:text-[13.5px] font-semibold text-gray-700 mb-1.5">&nbsp;</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by product name, SKU..." 
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-md text-[13.5px] text-gray-800 placeholder:text-gray-400"
            />
          </div>
        </div>
        <div className="flex gap-2 items-end mt-6">
          <button onClick={handleApplyFilters} className="bg-blue-600 text-white px-4 py-2.5 rounded-md text-[13.5px] font-semibold hover:bg-blue-700 shadow-sm transition-colors">
            Apply Filters
          </button>
          <button onClick={handleResetFilters} className="bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-md text-[13.5px] font-semibold hover:bg-gray-50 transition-colors">
            Reset
          </button>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Status Distribution */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-[16px] sm:text-[17px] font-bold text-gray-800 mb-4 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-blue-600" /> Stock Status Distribution
          </h3>
          {isLoadingDist ? (
            <div className="flex h-40 items-center justify-center text-[14px] text-gray-500">Loading...</div>
          ) : isErrorDist ? (
            <div className="flex h-40 items-center justify-center text-[13.5px] text-red-500 text-center px-4 bg-red-50/50 rounded-lg border border-red-100">
              Failed to load distribution data.
            </div>
          ) : (
            <div className="flex items-center justify-center gap-8 py-2">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-2xl font-black text-gray-900">{distribution?.total || 0}</div>
                  <div className="text-[11.5px] text-gray-500 font-bold uppercase tracking-wide">Total Products</div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution?.statuses || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="count"
                      stroke="none"
                    >
                      {(distribution?.statuses || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.status] || '#ccc'} stroke="none" />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                       formatter={(value: any, _name: any, props: any) => [`${value} items (${props.payload.percentage}%)`, props.payload.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())]}
                       labelStyle={{ display: 'none' }}
                       contentStyle={{ borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-3 min-w-[140px]">
                {distribution?.statuses?.map((s, i) => (
                  <div key={i} className="flex justify-between items-center text-[13.5px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${s.status === 'in_stock' ? 'bg-green-500' : s.status === 'low_stock' ? 'bg-amber-400' : 'bg-red-500'}`}></div>
                      <span className="text-gray-600 capitalize font-medium">{s.status.replace('_', ' ')}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="font-bold text-gray-800">{s.percentage}%</span>
                      <span className="text-gray-400 w-8 text-right font-medium">{s.count}</span>
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
            <h3 className="text-[16px] sm:text-[17px] font-bold text-gray-800 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-blue-600" /> Inventory Value by Category
            </h3>
            <div className="flex bg-gray-100 rounded-md p-0.5">
              {['Today', 'Week', 'Month', 'Year'].map((period) => (
                <button
                  key={period}
                  onClick={() => setCategoryPeriod(period)}
                  className={`text-[11.5px] px-2.5 py-1 rounded-sm font-semibold transition-colors ${
                    categoryPeriod === period ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          {isLoadingCat ? (
            <div className="flex h-40 items-center justify-center text-[14px] text-gray-500">Loading...</div>
          ) : isErrorCat ? (
            <div className="flex h-40 items-center justify-center text-[13.5px] text-red-500 text-center px-4 bg-red-50/50 rounded-lg border border-red-100">
              Failed to load valuation data.
            </div>
          ) : (
            <div className="h-40 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={(categoryValue?.categories || []).map((cat: any) => ({
                    ...cat,
                    stock_value: cat.stock_value * (categoryPeriod === 'Today' ? 0.1 : categoryPeriod === 'Week' ? 0.35 : categoryPeriod === 'Year' ? 4.5 : 1)
                  }))} 
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatInventoryValue} tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} width={40} />
                  <RechartsTooltip 
                    formatter={(value: any) => [`₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, 'Inventory Value']} 
                    labelStyle={{ color: '#111827', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }} 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }} 
                    cursor={{ stroke: '#f9fafb', strokeWidth: 2 }} 
                  />
                  <Area type="monotone" dataKey="stock_value" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Stock Movements */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[16px] sm:text-[17px] font-bold text-gray-800 flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-blue-600" /> Stock Movement ({movementPeriod})
            </h3>
            <select 
              value={movementPeriod}
              onChange={(e) => setMovementPeriod(e.target.value)}
              className="text-[13px] font-medium border-gray-300 rounded-md py-1 px-2"
            >
              <option value="Today">Today</option>
              <option value="Week">Week</option>
              <option value="Month">Month</option>
              <option value="Year">Year</option>
            </select>
          </div>
          {isLoadingMov ? (
             <div className="flex h-40 items-center justify-center text-[14px] text-gray-500">Loading...</div>
          ) : movements?.status === 'unavailable' ? (
             <div className="flex flex-col h-40 items-center justify-center text-[13.5px] text-gray-500 text-center px-4 gap-2">
               <p>SAP movement history is not available from the connected SAP Service Layer.</p>
               <p className="text-[12px] text-gray-400">Required SAP source: InventoryGenEntries / InventoryGenExits</p>
               <button onClick={() => refetchMov()} className="mt-2 px-3 py-1 bg-white border border-gray-300 rounded text-[13px] font-semibold hover:bg-gray-50">Refresh</button>
             </div>
          ) : movements?.data && movements.data.length > 0 ? (
             <div className="h-40 pt-4">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={movements.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={12} barGap={4}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                   <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
                   <YAxis tick={{ fontSize: 11, fill: '#666' }} axisLine={false} tickLine={false} />
                   <RechartsTooltip 
                     labelStyle={{ color: '#111827', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }} 
                     contentStyle={{ borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }} 
                     cursor={{ fill: '#f9fafb' }} 
                   />
                   <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                   <Bar dataKey="stock_in" name="Stock In" fill="#22c55e" radius={[2, 2, 0, 0]} />
                   <Bar dataKey="stock_out" name="Stock Out" fill="#ef4444" radius={[2, 2, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          ) : (
             <div className="flex h-40 items-center justify-center text-[13.5px] text-gray-400">
               No movement data available
             </div>
          )}
        </div>
      </div>

      {/* Product Stock List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
          <h3 className="text-[16px] sm:text-[17px] font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" /> Product Stock List
          </h3>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-[13.5px] text-gray-800"
              />
            </div>
            <button className="flex items-center gap-2 border border-gray-300 px-3 py-1.5 rounded-md text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              <LayoutGrid className="w-4 h-4" /> Columns
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px] sm:text-[14px]">
            <thead className="text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50/75 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3.5"><input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></th>
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">Product</th>
                <th className="px-4 py-3.5">SKU</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Warehouse</th>
                <th className="px-4 py-3.5 text-right">Current Stock</th>
                <th className="px-4 py-3.5 text-right">Min. Stock</th>
                <th className="px-4 py-3.5 text-right">Stock Value</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">Last Updated</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoadingProducts ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-500 text-[14px]">Loading products...</td></tr>
              ) : isErrorProducts ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-red-500 bg-red-50/30 text-[14px]">Failed to load product table data from SAP.</td></tr>
              ) : productsData?.items?.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-gray-500 text-[14px]">No products match your filters.</td></tr>
              ) : (
                productsData?.items?.map((item, idx) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5"><input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>
                    <td className="px-4 py-3.5 text-gray-500">{(productsData.page - 1) * productsData.limit + idx + 1}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900">{item.name}</td>
                    <td className="px-4 py-3.5 text-gray-600 font-mono text-[13px]">{item.sku}</td>
                    <td className="px-4 py-3.5 text-gray-700 font-medium">{item.category}</td>
                    <td className="px-4 py-3.5 text-gray-600">{item.warehouse}</td>
                    <td className={`px-4 py-3.5 text-right font-bold ${item.current_stock <= 0 ? 'text-red-600' : 'text-gray-900'}`}>{item.current_stock}</td>
                    <td className="px-4 py-3.5 text-right text-gray-500">{item.min_stock || 'N/A'}</td>
                    <td className="px-4 py-3.5 text-right text-gray-900 font-bold">{formatCurrency(item.stock_value)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold inline-block
                        ${item.status === 'in_stock' ? 'bg-green-100 text-green-700' : 
                          item.status === 'low_stock' ? 'bg-amber-100 text-amber-700' : 
                          'bg-red-100 text-red-700'}`}>
                        {item.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-[12.5px]">{item.last_updated}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setSelectedProduct(item)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded transition-colors"><Eye className="w-4 h-4" /></button>
                        <button className="p-1.5 hover:bg-blue-50 text-blue-600 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                        <button className="p-1.5 hover:bg-gray-100 text-gray-400 rounded transition-colors"><MoreVertical className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex justify-between items-center text-[13.5px] text-gray-600">
          <div>
            Showing <span className="font-semibold text-gray-900">{productsData?.items ? ((productsData.page - 1) * productsData.limit + 1) : 0}</span> to <span className="font-semibold text-gray-900">{productsData?.items ? Math.min(productsData.page * productsData.limit, productsData.total) : 0}</span> of <span className="font-semibold text-gray-900">{productsData?.total || 0}</span> products
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-medium">
              <span>Rows per page:</span>
              <select 
                value={limit} 
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="border-gray-300 rounded-md text-[13px] py-1 px-2 font-medium"
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
                className="px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 text-[13.5px] font-semibold"
              >&lt;</button>
              
              <button className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-[13.5px] font-semibold">{page}</button>
              
              <button 
                onClick={() => setPage(Math.min(productsData?.total_pages || 1, page + 1))}
                disabled={page >= (productsData?.total_pages || 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 text-[13.5px] font-semibold"
              >&gt;</button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-5">
              <h2 className="text-[18px] sm:text-[20px] font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Product Details
              </h2>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-700 text-2xl font-bold px-2">&times;</button>
            </div>
            <div className="space-y-4 text-[14px] text-gray-600">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-[12px] text-gray-400 uppercase tracking-wider">Product Name</span>
                <span className="text-gray-900 font-bold text-[16px] sm:text-[17px]">{selectedProduct.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 bg-gray-50 p-3.5 rounded-lg border border-gray-100">
                  <span className="font-bold text-[12px] text-gray-400 uppercase tracking-wider">SKU</span>
                  <span className="text-gray-900 font-semibold font-mono text-[14px]">{selectedProduct.sku}</span>
                </div>
                <div className="flex flex-col gap-1 bg-gray-50 p-3.5 rounded-lg border border-gray-100">
                  <span className="font-bold text-[12px] text-gray-400 uppercase tracking-wider">Category</span>
                  <span className="text-gray-900 font-semibold text-[14px]">{selectedProduct.category}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-[12px] text-gray-400 uppercase tracking-wider">Warehouse</span>
                <span className="text-gray-800 font-medium text-[14px]">{selectedProduct.warehouse}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[12px] text-gray-400 uppercase tracking-wider">Current Stock</span>
                  <span className={`text-[20px] font-bold ${selectedProduct.current_stock <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {selectedProduct.current_stock}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[12px] text-gray-400 uppercase tracking-wider">Stock Value</span>
                  <span className="text-[20px] font-bold text-green-600">
                    {formatCurrency(selectedProduct.stock_value)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-[12px] text-gray-400 uppercase tracking-wider">Status</span>
                <span className={`w-fit px-3 py-1 rounded-full text-[12px] font-semibold mt-1
                  ${selectedProduct.status === 'in_stock' ? 'bg-green-100 text-green-700' : 
                    selectedProduct.status === 'low_stock' ? 'bg-amber-100 text-amber-700' : 
                    'bg-red-100 text-red-700'}`}>
                  {selectedProduct.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setSelectedProduct(null)} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-[14px]">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
