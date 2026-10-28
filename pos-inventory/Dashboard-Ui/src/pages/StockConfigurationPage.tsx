import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Warehouse,
  Search,
  Filter,
  RotateCcw,
  RotateCw,
  Upload,
  Download,
  Plus,
  Save,
  Trash2,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { stockConfigurationApi } from '../api/stockConfiguration';
import type {
  StockConfigurationItem,
  StockQueryParams,
  ImportPreviewResponse,
} from '../api/stockConfiguration';
import { useTheme } from '../contexts/ThemeContext';

export const StockConfigurationPage: React.FC = () => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  // Filter & Pagination States
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row Edit Buffers (stores modified values keyed by item_code)
  const [editedRows, setEditedRows] = useState<Record<string, Partial<StockConfigurationItem>>>({});
  const [savingItemCode, setSavingItemCode] = useState<string | null>(null);

  // Modals & Banners
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<StockConfigurationItem | null>(null);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Add Item Form State
  const [newItem, setNewItem] = useState({
    item_code: '',
    description: '',
    qty: 0,
    stock_qty: 0,
    vendor_name: '',
    grpo_no: '',
    rcvd_qty: 0,
    nt_weight: 0,
    qc: false,
    drw_yn: 'Y' as 'Y' | 'N',
    v_chk: 'Y' as 'Y' | 'N',
    ok_qty: 0,
    rej_qty: 0,
    lm: 'Y' as 'Y' | 'N',
    olng: 'Y' as 'Y' | 'N',
    lpk: 'Y' as 'Y' | 'N',
    lbl: 'Y' as 'Y' | 'N',
    mc_or_pt: 'Y' as 'Y' | 'N',
    items_group_code: 'Finished Goods',
    warehouse_code: '01',
  });

  // Excel Import States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss notification after 5s
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Query Params
  const queryParams: StockQueryParams = useMemo(() => ({
    page,
    page_size: pageSize,
    search: appliedSearch || undefined,
    vendor: selectedVendor && selectedVendor !== 'All Vendors' ? selectedVendor : undefined,
    group: selectedGroup && selectedGroup !== 'All Groups' ? selectedGroup : undefined,
    warehouse: selectedWarehouse && selectedWarehouse !== 'All Warehouses' ? selectedWarehouse : undefined,
  }), [page, pageSize, appliedSearch, selectedVendor, selectedGroup, selectedWarehouse]);

  // Fetch Data
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stock-configuration', queryParams],
    queryFn: () => stockConfigurationApi.getItems(queryParams),
  });

  // Mutate Row Save
  const saveMutation = useMutation({
    mutationFn: async ({ itemCode, updates }: { itemCode: string; updates: Partial<StockConfigurationItem> }) => {
      setSavingItemCode(itemCode);
      return stockConfigurationApi.updateItem(itemCode, updates);
    },
    onSuccess: (_, variables) => {
      setSavingItemCode(null);
      setEditedRows((prev) => {
        const next = { ...prev };
        delete next[variables.itemCode];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['stock-configuration'] });
      setNotification({ type: 'success', message: `Row ${variables.itemCode} saved successfully.` });
    },
    onError: (err: any) => {
      setSavingItemCode(null);
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to save changes.' });
    },
  });

  // Mutate Delete Item
  const deleteMutation = useMutation({
    mutationFn: (itemCode: string) => stockConfigurationApi.deleteItem(itemCode),
    onSuccess: (_, itemCode) => {
      setDeleteConfirmItem(null);
      queryClient.invalidateQueries({ queryKey: ['stock-configuration'] });
      setNotification({ type: 'success', message: `Item ${itemCode} deleted.` });
    },
    onError: (err: any) => {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to delete item.' });
    },
  });

  // Mutate SAP Sync
  const syncMutation = useMutation({
    mutationFn: () => stockConfigurationApi.syncFromSap(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stock-configuration'] });
      setNotification({
        type: 'success',
        message: `Synced ${res.synced_count} items from SAP Business One.`,
      });
    },
    onError: (err: any) => {
      setNotification({
        type: 'error',
        message: err.response?.data?.detail || 'SAP synchronization failed. Verify SAP Service Layer connection.',
      });
    },
  });

  // Mutate Add Item
  const addMutation = useMutation({
    mutationFn: (itemData: typeof newItem) => stockConfigurationApi.addItem(itemData),
    onSuccess: (res) => {
      setAddItemModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['stock-configuration'] });
      setNotification({ type: 'success', message: `Item ${res.item.item_code} added successfully.` });
      // Reset form
      setNewItem({
        item_code: '',
        description: '',
        qty: 0,
        stock_qty: 0,
        vendor_name: '',
        grpo_no: '',
        rcvd_qty: 0,
        nt_weight: 0,
        qc: false,
        drw_yn: 'Y',
        v_chk: 'Y',
        ok_qty: 0,
        rej_qty: 0,
        lm: 'Y',
        olng: 'Y',
        lpk: 'Y',
        lbl: 'Y',
        mc_or_pt: 'Y',
        items_group_code: 'Finished Goods',
        warehouse_code: '01',
      });
    },
    onError: (err: any) => {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to add item.' });
    },
  });

  // Handle cell edit
  const handleCellChange = (itemCode: string, field: keyof StockConfigurationItem, value: any) => {
    setEditedRows((prev) => ({
      ...prev,
      [itemCode]: {
        ...prev[itemCode],
        [field]: value,
      },
    }));
  };

  // Get effective row values (buffer or original)
  const getEffectiveNum = (item: StockConfigurationItem, field: keyof StockConfigurationItem): number => {
    const edit = editedRows[item.item_code];
    if (edit && field in edit) {
      return Number(edit[field] ?? 0);
    }
    return Number(item[field] ?? 0);
  };

  const getEffectiveStr = (item: StockConfigurationItem, field: keyof StockConfigurationItem): string => {
    const edit = editedRows[item.item_code];
    if (edit && field in edit) {
      return String(edit[field] ?? '');
    }
    return String(item[field] ?? '');
  };

  const getEffectiveBool = (item: StockConfigurationItem, field: keyof StockConfigurationItem): boolean => {
    const edit = editedRows[item.item_code];
    if (edit && field in edit) {
      return Boolean(edit[field]);
    }
    return Boolean(item[field]);
  };

  // Handle Save row
  const handleSaveRow = (item: StockConfigurationItem) => {
    const updates = editedRows[item.item_code];
    if (!updates || Object.keys(updates).length === 0) {
      setNotification({ type: 'info', message: 'No changes detected for this row.' });
      return;
    }
    saveMutation.mutate({ itemCode: item.item_code, updates });
  };

  // Handle Filter Actions
  const handleApplyFilters = () => {
    setAppliedSearch(searchInput);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setSelectedVendor('');
    setSelectedGroup('');
    setSelectedWarehouse('');
    setPage(1);
  };

  // Handle Excel Export
  const handleExport = async () => {
    try {
      const blob = await stockConfigurationApi.exportExcel(queryParams);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Stock_Configuration_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setNotification({ type: 'success', message: 'Excel exported successfully.' });
    } catch (e) {
      setNotification({ type: 'error', message: 'Failed to export Excel file.' });
    }
  };

  // Handle Excel Import Preview
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportLoading(true);
    try {
      const previewRes = await stockConfigurationApi.importExcel(file, true);
      setImportPreview(previewRes);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to read file.' });
      setImportPreview(null);
    } finally {
      setImportLoading(false);
    }
  };

  // Handle Excel Import Confirm
  const handleConfirmImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const result = await stockConfigurationApi.importExcel(importFile, false);
      setImportModalOpen(false);
      setImportFile(null);
      setImportPreview(null);
      queryClient.invalidateQueries({ queryKey: ['stock-configuration'] });
      setNotification({
        type: 'success',
        message: `Successfully imported ${result.imported_count} stock configuration items!`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Import failed.' });
    } finally {
      setImportLoading(false);
    }
  };

  const totalPages = data?.total_pages || 1;
  const startRow = data?.total ? (page - 1) * pageSize + 1 : 0;
  const endRow = data?.total ? Math.min(page * pageSize, data.total) : 0;

  return (
    <div className={`min-h-screen p-6 md:p-8 space-y-7 transition-colors duration-200 ${
      isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
    }`}>
      {/* ── Notification Toast ── */}
      {notification && (
        <div className={`fixed top-20 right-8 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-200 animate-in slide-in-from-top-4 ${
          notification.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : notification.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {notification.type === 'success' && <Check className="w-5 h-5 text-emerald-600 shrink-0" />}
          {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          {notification.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Page Heading & Top Action Buttons ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-[34px] sm:text-[38px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Stock Configuration (SAP Items)
          </h1>
          <p className="text-[17px] sm:text-[18px] text-slate-500 dark:text-slate-400 font-medium mt-1">
            Manage stock items and warehouse configuration from SAP Business One.
          </p>
        </div>

        {/* Top Action Buttons Matching Reference Design */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Sync from SAP */}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[14.5px] font-semibold transition-all cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                : 'bg-white border-blue-200 text-[#155EEF] hover:bg-blue-50/70 hover:border-blue-300'
            }`}
            title="Fetch live updates from SAP Service Layer"
          >
            <RotateCw size={17} className={`text-blue-600 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{syncMutation.isPending ? 'Syncing...' : 'Sync from SAP'}</span>
          </button>

          {/* Import Excel */}
          <button
            onClick={() => setImportModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[14.5px] font-semibold transition-all cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                : 'bg-white border-blue-200 text-[#155EEF] hover:bg-blue-50/70 hover:border-blue-300'
            }`}
          >
            <Upload size={17} className="text-blue-600" />
            <span>Import Excel</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExport}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[14.5px] font-semibold transition-all cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                : 'bg-white border-blue-200 text-[#155EEF] hover:bg-blue-50/70 hover:border-blue-300'
            }`}
          >
            <Download size={17} className="text-blue-600" />
            <span>Export Excel</span>
          </button>

          {/* + Add New Item */}
          <button
            onClick={() => setAddItemModalOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#155EEF] hover:bg-blue-700 text-white text-[14.5px] font-semibold transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards (4 Cards in a Row) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Items */}
        <div className={`p-5 rounded-2xl border transition-all duration-200 shadow-xs flex items-center gap-4 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Box size={28} className="text-blue-600" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[16px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Total Items</p>
            <p className="text-[34px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {data?.kpis?.total_items ?? 26}
            </p>
            <p className="text-[14.5px] font-medium text-slate-400 leading-tight">From SAP</p>
          </div>
        </div>

        {/* Active Items */}
        <div className={`p-5 rounded-2xl border transition-all duration-200 shadow-xs flex items-center gap-4 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[16px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Active Items</p>
            <p className="text-[34px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {data?.kpis?.active_items ?? 24}
            </p>
            <p className="text-[14.5px] font-medium text-slate-400 leading-tight">Available for sale</p>
          </div>
        </div>

        {/* Inactive Items */}
        <div className={`p-5 rounded-2xl border transition-all duration-200 shadow-xs flex items-center gap-4 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <XCircle size={28} className="text-rose-500" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[16px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Inactive Items</p>
            <p className="text-[34px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {data?.kpis?.inactive_items ?? 2}
            </p>
            <p className="text-[14.5px] font-medium text-slate-400 leading-tight">Not available</p>
          </div>
        </div>

        {/* Warehouses */}
        <div className={`p-5 rounded-2xl border transition-all duration-200 shadow-xs flex items-center gap-4 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
            <Warehouse size={28} className="text-purple-600" />
          </div>
          <div className="space-y-0.5">
            <p className="text-[16px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Warehouses</p>
            <p className="text-[34px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {data?.kpis?.warehouses_count ?? 5}
            </p>
            <p className="text-[14.5px] font-medium text-slate-400 leading-tight">Configured in SAP</p>
          </div>
        </div>
      </div>

      {/* ── Search and Filters Card ── */}
      <div className={`p-4 rounded-2xl border transition-all duration-200 shadow-xs flex flex-wrap items-center gap-3 ${
        isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
      }`}>
        {/* Search input */}
        <div className="relative flex-1 min-w-[280px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            placeholder="Search by SAP code, description, or vendor name..."
            className={`w-full h-11 pl-10 pr-4 text-[14.5px] rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Vendor Dropdown */}
        <div className="relative min-w-[170px]">
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className={`w-full h-11 px-3.5 pr-8 appearance-none text-[14.5px] font-medium rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <option value="">All Vendors</option>
            {data?.filters?.vendors?.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Group Dropdown */}
        <div className="relative min-w-[150px]">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className={`w-full h-11 px-3.5 pr-8 appearance-none text-[14.5px] font-medium rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <option value="">All Groups</option>
            {data?.filters?.groups?.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Warehouse Dropdown */}
        <div className="relative min-w-[160px]">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className={`w-full h-11 px-3.5 pr-8 appearance-none text-[14.5px] font-medium rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <option value="">All Warehouses</option>
            {data?.filters?.warehouses?.map((wh) => (
              <option key={wh} value={wh}>{wh}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Apply Filters Button */}
        <button
          onClick={handleApplyFilters}
          className="h-11 px-5 rounded-xl bg-[#155EEF] hover:bg-blue-700 text-white text-[14.5px] font-semibold flex items-center gap-2 cursor-pointer transition shadow-2xs active:scale-98"
        >
          <Filter size={16} />
          <span>Apply Filters</span>
        </button>

        {/* Reset Button */}
        <button
          onClick={handleResetFilters}
          className={`h-11 px-4 rounded-xl border text-[14.5px] font-semibold flex items-center gap-1.5 cursor-pointer transition ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <RotateCcw size={15} />
          <span>Reset</span>
        </button>
      </div>

      {/* ── Table Card: Stock Items (26) ── */}
      <div className={`rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
        isDark ? 'bg-slate-800/90 border-slate-700/80' : 'bg-white border-slate-200/90'
      }`}>
        {/* Table Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700/80 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Box size={20} />
            </div>
            <h2 className="text-[21px] font-bold text-slate-900 dark:text-white leading-tight">
              Stock Items ({data?.total ?? 26})
            </h2>
          </div>

          <div className="flex items-center gap-4 text-[14.5px] text-slate-500 dark:text-slate-400">
            <span>
              Showing {startRow} - {endRow} of {data?.total ?? 0}
            </span>

            {/* Rows Per Page Dropdown */}
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={`h-9 px-3 pr-7 text-[13.5px] font-medium rounded-lg border appearance-none cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Table View with 20 Business Columns ── */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead>
              <tr className={`border-b text-[13.5px] font-bold uppercase tracking-wider ${
                isDark
                  ? 'bg-slate-900/60 text-slate-400 border-slate-700'
                  : 'bg-slate-50/80 text-slate-600 border-slate-200'
              }`}>
                <th className="py-3 px-3 text-center whitespace-nowrap min-w-[50px]">SR. NO.</th>
                <th className="py-3 px-3 text-left whitespace-nowrap min-w-[100px]">SAP CODE</th>
                <th className="py-3 px-3 text-left whitespace-nowrap min-w-[170px]">DESCRIPTION</th>
                <th className="py-3 px-3 text-center whitespace-nowrap min-w-[70px]">QTY.</th>
                <th className="py-3 px-3 text-center whitespace-nowrap min-w-[90px]">STOCK QTY.</th>
                <th className="py-3 px-3 text-left whitespace-nowrap min-w-[150px]">VENDOR NAME</th>
                <th className="py-3 px-3 text-center whitespace-nowrap min-w-[80px]">GRPO NO.</th>
                <th className="py-3 px-3 text-center whitespace-nowrap min-w-[80px]">RCVD. QTY.</th>
                <th className="py-3 px-3 text-center whitespace-nowrap min-w-[80px]">NT. WEIGHT</th>
                <th className="py-3 px-2 text-center whitespace-nowrap min-w-[40px]">QC</th>
                <th className="py-3 px-2 text-center whitespace-nowrap min-w-[60px]">DRW. Y/N</th>
                <th className="py-3 px-2 text-center whitespace-nowrap min-w-[60px]">V CHK</th>
                <th className="py-3 px-3 text-center whitespace-nowrap min-w-[70px]">OK QTY.</th>
                <th className="py-3 px-3 text-center whitespace-nowrap min-w-[70px]">REJ. QTY.</th>
                <th className="py-3 px-2 text-center whitespace-nowrap min-w-[50px]" title="Laser Marking / Line Marking">LM</th>
                <th className="py-3 px-2 text-center whitespace-nowrap min-w-[55px]" title="Oiling / Loading">OLNG</th>
                <th className="py-3 px-2 text-center whitespace-nowrap min-w-[50px]" title="Loose Packing / Line Packing">LPK</th>
                <th className="py-3 px-2 text-center whitespace-nowrap min-w-[50px]" title="Labeling">LBL</th>
                <th className="py-3 px-2 text-center whitespace-nowrap min-w-[70px]" title="Machining / Coating / Certificate">MC OR PT</th>
                <th className="py-3 px-3 text-center whitespace-nowrap min-w-[90px]">ACTIONS</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700/60' : 'divide-slate-200/80'}`}>
              {isLoading ? (
                <tr>
                  <td colSpan={20} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
                      <span className="text-[14.5px] font-medium text-slate-500">Loading stock configuration from backend...</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={20} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <AlertCircle className="w-8 h-8 text-rose-500" />
                      <span className="text-slate-600 font-medium">
                        {(error as any)?.message || 'Failed to load stock configuration records.'}
                      </span>
                      <button
                        onClick={() => refetch()}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={20} className="py-12 text-center text-slate-500">
                    No items found matching the selected filters.
                  </td>
                </tr>
              ) : (
                data?.items?.map((item, idx) => {
                  const srNo = (page - 1) * pageSize + idx + 1;
                  const isModified = Boolean(editedRows[item.item_code]);
                  const isSaving = savingItemCode === item.item_code;

                  return (
                    <tr
                      key={item.item_code}
                      className={`transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-750 ${
                        !item.is_active ? 'opacity-70 bg-slate-50/40' : ''
                      } ${isModified ? 'bg-blue-50/30' : ''}`}
                    >
                      {/* 1. SR. NO. */}
                      <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400 font-medium">
                        {srNo}
                      </td>

                      {/* 2. SAP CODE (Read-only SAP field) */}
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        {item.item_code}
                      </td>

                      {/* 3. DESCRIPTION (Read-only SAP field) */}
                      <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                        {item.description}
                      </td>

                      {/* 4. QTY. (Editable number input) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          value={getEffectiveNum(item, 'qty')}
                          onChange={(e) => handleCellChange(item.item_code, 'qty', Number(e.target.value))}
                          className={`w-16 h-8 text-center text-[14px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 transition ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </td>

                      {/* 5. STOCK QTY. (From SAP) */}
                      <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {item.stock_qty}
                      </td>

                      {/* 6. VENDOR NAME (SAP-owned field) */}
                      <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                        {item.vendor_name || '—'}
                      </td>

                      {/* 7. GRPO NO. (Editable text/number input) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="text"
                          value={getEffectiveStr(item, 'grpo_no')}
                          onChange={(e) => handleCellChange(item.item_code, 'grpo_no', e.target.value)}
                          className={`w-16 h-8 text-center text-[14px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 transition ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </td>

                      {/* 8. RCVD. QTY. (Editable number input) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          value={getEffectiveNum(item, 'rcvd_qty')}
                          onChange={(e) => handleCellChange(item.item_code, 'rcvd_qty', Number(e.target.value))}
                          className={`w-16 h-8 text-center text-[14px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 transition ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </td>

                      {/* 9. NT. WEIGHT (Editable float input) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          step="0.1"
                          value={getEffectiveNum(item, 'nt_weight')}
                          onChange={(e) => handleCellChange(item.item_code, 'nt_weight', Number(e.target.value))}
                          className={`w-16 h-8 text-center text-[14px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 transition ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </td>

                      {/* 10. QC (Checkbox) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={getEffectiveBool(item, 'qc')}
                          onChange={(e) => handleCellChange(item.item_code, 'qc', e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* 11. DRW. Y/N (Select Y/N) */}
                      <td className="py-2 px-1 text-center">
                        <select
                          value={getEffectiveStr(item, 'drw_yn')}
                          onChange={(e) => handleCellChange(item.item_code, 'drw_yn', e.target.value)}
                          className={`w-12 h-8 text-center text-[13.5px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </td>

                      {/* 12. V CHK (Select Y/N) */}
                      <td className="py-2 px-1 text-center">
                        <select
                          value={getEffectiveStr(item, 'v_chk')}
                          onChange={(e) => handleCellChange(item.item_code, 'v_chk', e.target.value)}
                          className={`w-12 h-8 text-center text-[13.5px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </td>

                      {/* 13. OK QTY. (Editable number input) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          value={getEffectiveNum(item, 'ok_qty')}
                          onChange={(e) => handleCellChange(item.item_code, 'ok_qty', Number(e.target.value))}
                          className={`w-16 h-8 text-center text-[14px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 transition ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </td>

                      {/* 14. REJ. QTY. (Editable number input) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          value={getEffectiveNum(item, 'rej_qty')}
                          onChange={(e) => handleCellChange(item.item_code, 'rej_qty', Number(e.target.value))}
                          className={`w-16 h-8 text-center text-[14px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 transition ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </td>

                      {/* 15. LM (Select Y/N) */}
                      <td className="py-2 px-1 text-center">
                        <select
                          value={getEffectiveStr(item, 'lm')}
                          onChange={(e) => handleCellChange(item.item_code, 'lm', e.target.value)}
                          className={`w-12 h-8 text-center text-[13.5px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </td>

                      {/* 16. OLNG (Select Y/N) */}
                      <td className="py-2 px-1 text-center">
                        <select
                          value={getEffectiveStr(item, 'olng')}
                          onChange={(e) => handleCellChange(item.item_code, 'olng', e.target.value)}
                          className={`w-12 h-8 text-center text-[13.5px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </td>

                      {/* 17. LPK (Select Y/N) */}
                      <td className="py-2 px-1 text-center">
                        <select
                          value={getEffectiveStr(item, 'lpk')}
                          onChange={(e) => handleCellChange(item.item_code, 'lpk', e.target.value)}
                          className={`w-12 h-8 text-center text-[13.5px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </td>

                      {/* 18. LBL (Select Y/N) */}
                      <td className="py-2 px-1 text-center">
                        <select
                          value={getEffectiveStr(item, 'lbl')}
                          onChange={(e) => handleCellChange(item.item_code, 'lbl', e.target.value)}
                          className={`w-12 h-8 text-center text-[13.5px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </td>

                      {/* 19. MC OR PT (Select Y/N) */}
                      <td className="py-2 px-1 text-center">
                        <select
                          value={getEffectiveStr(item, 'mc_or_pt')}
                          onChange={(e) => handleCellChange(item.item_code, 'mc_or_pt', e.target.value)}
                          className={`w-12 h-8 text-center text-[13.5px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </td>

                      {/* 20. ACTIONS (Blue Save button + Red Delete button) */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Save Button */}
                          <button
                            onClick={() => handleSaveRow(item)}
                            disabled={isSaving}
                            className="w-8 h-8 rounded-lg bg-[#155EEF] hover:bg-blue-700 text-white flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                            title="Save changes for this row"
                          >
                            <Save size={15} />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteConfirmItem(item)}
                            className="w-8 h-8 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
                            title="Delete this item"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Pagination Bar (Matching Reference Design) ── */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-end gap-3">
          <div className="flex items-center gap-1.5">
            {/* Previous */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-3 py-1.5 rounded-lg text-[14px] font-medium flex items-center gap-1 transition ${
                page <= 1
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
              }`}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            {/* Page Number Buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-[14px] font-semibold flex items-center justify-center transition cursor-pointer ${
                  page === p
                    ? 'bg-[#155EEF] text-white shadow-2xs'
                    : isDark
                    ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}

            {/* Next */}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`px-3 py-1.5 rounded-lg text-[14px] font-medium flex items-center gap-1 transition ${
                page >= totalPages
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-[#155EEF] font-semibold hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer'
              }`}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Add New Item Modal ── */}
      {addItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-slate-850 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-blue-600" />
                <h3 className="text-xl font-bold">Add New Stock Configuration Item</h3>
              </div>
              <button
                onClick={() => setAddItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addMutation.mutate(newItem);
              }}
              className="mt-4 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    SAP Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newItem.item_code}
                    onChange={(e) => setNewItem({ ...newItem, item_code: e.target.value })}
                    placeholder="e.g. FG027"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="e.g. Precision Sensor Unit"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    value={newItem.vendor_name}
                    onChange={(e) => setNewItem({ ...newItem, vendor_name: e.target.value })}
                    placeholder="e.g. Kaushal Supplies"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    GRPO No.
                  </label>
                  <input
                    type="text"
                    value={newItem.grpo_no}
                    onChange={(e) => setNewItem({ ...newItem, grpo_no: e.target.value })}
                    placeholder="e.g. 5025"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Qty.
                  </label>
                  <input
                    type="number"
                    value={newItem.qty}
                    onChange={(e) => setNewItem({ ...newItem, qty: Number(e.target.value) })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Stock Qty.
                  </label>
                  <input
                    type="number"
                    value={newItem.stock_qty}
                    onChange={(e) => setNewItem({ ...newItem, stock_qty: Number(e.target.value) })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    RCVD. Qty.
                  </label>
                  <input
                    type="number"
                    value={newItem.rcvd_qty}
                    onChange={(e) => setNewItem({ ...newItem, rcvd_qty: Number(e.target.value) })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    NT. Weight
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newItem.nt_weight}
                    onChange={(e) => setNewItem({ ...newItem, nt_weight: Number(e.target.value) })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Ok Qty.
                  </label>
                  <input
                    type="number"
                    value={newItem.ok_qty}
                    onChange={(e) => setNewItem({ ...newItem, ok_qty: Number(e.target.value) })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Rej. Qty.
                  </label>
                  <input
                    type="number"
                    value={newItem.rej_qty}
                    onChange={(e) => setNewItem({ ...newItem, rej_qty: Number(e.target.value) })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Quality & Checklist Flags */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Inspection & Packaging Checks (Y/N)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItem.qc}
                      onChange={(e) => setNewItem({ ...newItem, qc: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>QC Passed</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">DRW:</span>
                    <select
                      value={newItem.drw_yn}
                      onChange={(e) => setNewItem({ ...newItem, drw_yn: e.target.value as 'Y' | 'N' })}
                      className="h-8 px-2 rounded border border-slate-300 text-xs dark:bg-slate-900"
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">V CHK:</span>
                    <select
                      value={newItem.v_chk}
                      onChange={(e) => setNewItem({ ...newItem, v_chk: e.target.value as 'Y' | 'N' })}
                      className="h-8 px-2 rounded border border-slate-300 text-xs dark:bg-slate-900"
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">LM:</span>
                    <select
                      value={newItem.lm}
                      onChange={(e) => setNewItem({ ...newItem, lm: e.target.value as 'Y' | 'N' })}
                      className="h-8 px-2 rounded border border-slate-300 text-xs dark:bg-slate-900"
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">OLNG:</span>
                    <select
                      value={newItem.olng}
                      onChange={(e) => setNewItem({ ...newItem, olng: e.target.value as 'Y' | 'N' })}
                      className="h-8 px-2 rounded border border-slate-300 text-xs dark:bg-slate-900"
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">LPK:</span>
                    <select
                      value={newItem.lpk}
                      onChange={(e) => setNewItem({ ...newItem, lpk: e.target.value as 'Y' | 'N' })}
                      className="h-8 px-2 rounded border border-slate-300 text-xs dark:bg-slate-900"
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">LBL:</span>
                    <select
                      value={newItem.lbl}
                      onChange={(e) => setNewItem({ ...newItem, lbl: e.target.value as 'Y' | 'N' })}
                      className="h-8 px-2 rounded border border-slate-300 text-xs dark:bg-slate-900"
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">MC / PT:</span>
                    <select
                      value={newItem.mc_or_pt}
                      onChange={(e) => setNewItem({ ...newItem, mc_or_pt: e.target.value as 'Y' | 'N' })}
                      className="h-8 px-2 rounded border border-slate-300 text-xs dark:bg-slate-900"
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setAddItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer shadow-xs"
                >
                  {addMutation.isPending ? 'Adding Item...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Import Excel Modal with Validation & Preview ── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className={`w-full max-w-3xl rounded-2xl border p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-slate-850 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                <h3 className="text-xl font-bold">Import Stock Items from Excel</h3>
              </div>
              <button
                onClick={() => {
                  setImportModalOpen(false);
                  setImportFile(null);
                  setImportPreview(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-500">
                Upload your verified Excel spreadsheet (.xlsx, .xls, or .csv). The importer validates column mapping,
                verifies numeric fields, and checks for duplicates.
              </p>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  importFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileSpreadsheet size={36} className="mx-auto text-slate-400 mb-2" />
                {importFile ? (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Click to select a different file</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Click to choose an Excel or CSV file
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Supports .xlsx, .xls, or .csv up to 10MB</p>
                  </div>
                )}
              </div>

              {/* Import Preview Feedback */}
              {importLoading && (
                <div className="py-6 text-center">
                  <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Processing and validating records...</p>
                </div>
              )}

              {importPreview && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                      <p className="text-xs font-semibold text-emerald-700">Valid Rows</p>
                      <p className="text-xl font-bold text-emerald-800">{importPreview.valid_count}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-center">
                      <p className="text-xs font-semibold text-rose-700">Invalid Rows</p>
                      <p className="text-xl font-bold text-rose-800">{importPreview.invalid_count}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                      <p className="text-xs font-semibold text-amber-700">Duplicate Codes</p>
                      <p className="text-xl font-bold text-amber-800">{importPreview.duplicates.length}</p>
                    </div>
                  </div>

                  {/* Validation errors summary */}
                  {importPreview.errors.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 max-h-36 overflow-y-auto space-y-1">
                      <p className="font-bold">Validation Warnings / Errors:</p>
                      {importPreview.errors.map((err, i) => (
                        <p key={i}>
                          Row {err.row} ({err.field}): {err.message}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Sample Rows Table */}
                  {importPreview.sample_rows && importPreview.sample_rows.length > 0 && (
                    <div className="border rounded-xl overflow-hidden text-xs max-h-48 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 font-semibold border-b">
                          <tr>
                            <th className="p-2 text-left">Code</th>
                            <th className="p-2 text-left">Description</th>
                            <th className="p-2 text-right">Qty</th>
                            <th className="p-2 text-left">Vendor</th>
                            <th className="p-2 text-center">QC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importPreview.sample_rows.map((r) => (
                            <tr key={r.item_code} className="hover:bg-slate-50/50">
                              <td className="p-2 font-bold">{r.item_code}</td>
                              <td className="p-2">{r.description}</td>
                              <td className="p-2 text-right">{r.qty}</td>
                              <td className="p-2">{r.vendor_name || '—'}</td>
                              <td className="p-2 text-center">{r.qc ? 'Y' : 'N'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportFile(null);
                    setImportPreview(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!importPreview || importPreview.valid_count === 0 || importLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {importLoading ? 'Importing...' : `Confirm Import (${importPreview?.valid_count || 0} items)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
            isDark ? 'bg-slate-850 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertCircle size={28} />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Stock Configuration Item</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to delete item <strong className="text-slate-900 dark:text-white">{deleteConfirmItem.item_code}</strong> ({deleteConfirmItem.description})?
              This action removes the configured row from your local database.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteConfirmItem.item_code)}
                disabled={deleteMutation.isPending}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer shadow-xs"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Row'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockConfigurationPage;
