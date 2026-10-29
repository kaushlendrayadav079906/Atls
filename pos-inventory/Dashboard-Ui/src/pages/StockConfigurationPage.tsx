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
  Calendar,
} from 'lucide-react';
import { stockConfigurationApi } from '../api/stockConfiguration';
import type {
  StockConfigurationItem,
  StockQueryParams,
  ImportPreviewResponse,
} from '../api/stockConfiguration';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  resolveDashboardDateRange,
  validateCustomDateRange,
  getDateScopeLabel,
  type QuickFilter,
  type DashboardPeriod,
} from '../utils/date';

export const StockConfigurationPage: React.FC = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Branch & Date Filter States
  const [branchId, setBranchId] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [period, setPeriod] = useState<DashboardPeriod>('all_time');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  // Filter & Pagination States
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageJumpInput, setPageJumpInput] = useState('');

  // Row Edit Buffers (stores modified values keyed by item_code)
  const [editedRows, setEditedRows] = useState<Record<string, Partial<StockConfigurationItem>>>({});
  const [savingItemCode, setSavingItemCode] = useState<string | null>(null);

  // Modals & Banners
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<StockConfigurationItem | null>(null);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Bulk Actions & Dialogs
  const [bulkStatus, setBulkStatus] = useState<{
    successful: number;
    failed: number;
    timestamp: string;
    errors?: Array<{ item_code: string; error: string }>;
  } | null>(null);
  const [confirmSubmitAllOpen, setConfirmSubmitAllOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

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

  // Date Filter & Click Outside Handling
  const applyQuickFilter = (filter: QuickFilter) => {
    if (filter === 'custom') {
      const validation = validateCustomDateRange(customFrom, customTo);
      if (!validation.isValid) {
        setCustomError(validation.error || 'Invalid date range');
        return;
      }
      setCustomError(null);
      const resolved = resolveDashboardDateRange('custom', customFrom, customTo);
      setQuickFilter(resolved.quickFilter);
      setPeriod(resolved.period);
      setDateFrom(resolved.dateFrom);
      setDateTo(resolved.dateTo);
      setIsDateDropdownOpen(false);
      setPage(1);
      return;
    }

    setCustomError(null);
    const resolved = resolveDashboardDateRange(filter);
    setQuickFilter(resolved.quickFilter);
    setPeriod(resolved.period);
    setDateFrom(resolved.dateFrom);
    setDateTo(resolved.dateTo);
    if (!filter) {
      setCustomFrom('');
      setCustomTo('');
    } else {
      setCustomFrom(resolved.dateFrom);
      setCustomTo(resolved.dateTo);
    }
    setIsDateDropdownOpen(false);
    setPage(1);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.stock-date-dropdown-container')) {
        setIsDateDropdownOpen(false);
      }
    };
    if (isDateDropdownOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isDateDropdownOpen]);

  // Query Params
  const queryParams: StockQueryParams = useMemo(() => ({
    page,
    page_size: pageSize,
    search: appliedSearch || undefined,
    vendor: selectedVendor && selectedVendor !== 'All Vendors' ? selectedVendor : undefined,
    group: selectedGroup && selectedGroup !== 'All Groups' ? selectedGroup : undefined,
    warehouse: selectedWarehouse && selectedWarehouse !== 'All Warehouses' ? selectedWarehouse : undefined,
    branch: branchId && branchId !== 'All Branches' ? branchId : undefined,
    period: period && period !== 'all_time' ? period : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }), [page, pageSize, appliedSearch, selectedVendor, selectedGroup, selectedWarehouse, branchId, period, dateFrom, dateTo]);

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
    onSuccess: (res, variables) => {
      setSavingItemCode(null);
      setEditedRows((prev) => {
        const next = { ...prev };
        delete next[variables.itemCode];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['stock-configuration'] });
      if (res.sap_synced) {
        setNotification({
          type: 'success',
          message: `Item ${variables.itemCode} updated in database & synced to SAP Business One!`,
        });
      } else {
        setNotification({
          type: 'success',
          message: `Item ${variables.itemCode} saved to database. ${res.sap_message ? `(${res.sap_message})` : ''}`,
        });
      }
    },
    onError: (err: any) => {
      setSavingItemCode(null);
      setNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to save changes.' });
    },
  });

  // Mutate Bulk Update
  const bulkMutation = useMutation({
    mutationFn: (items: Partial<StockConfigurationItem>[]) => stockConfigurationApi.bulkUpdateItems(items),
    onSuccess: (res) => {
      const successCodes = new Set(res.results.filter((r) => r.success).map((r) => r.item_code));
      setEditedRows((prev) => {
        const next = { ...prev };
        for (const code of successCodes) {
          delete next[code];
        }
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['stock-configuration'] });

      const failedResults = res.results.filter((r) => !r.success);
      setBulkStatus({
        successful: res.successful,
        failed: res.failed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        errors: failedResults.map((r) => ({ item_code: r.item_code, error: r.error || 'Failed to update' })),
      });

      if (res.failed === 0) {
        const sapCount = res.sap_synced_count ?? 0;
        setNotification({
          type: 'success',
          message: `Bulk save successful: ${res.successful} item(s) updated in database${sapCount > 0 ? ` & ${sapCount} synchronized to SAP!` : '!'}`,
        });
      } else {
        setNotification({
          type: 'error',
          message: `Bulk save: ${res.successful} succeeded, ${res.failed} failed. Unsaved edits remain in table.`,
        });
      }
    },
    onError: (err: any) => {
      setNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Bulk update failed.',
      });
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

  // Change Tracking & Modified Status
  const modifiedCount = Object.keys(editedRows).length;

  const handleCellChange = (item: StockConfigurationItem, field: keyof StockConfigurationItem, value: any) => {
    setEditedRows((prev) => {
      const current: Record<string, any> = { ...(prev[item.item_code] || {}) };
      current[field as string] = value;
      // If changed back to original value, clean up from diff
      if (value === item[field]) {
        delete current[field as string];
      }
      if (Object.keys(current).length === 0) {
        const next = { ...prev };
        delete next[item.item_code];
        return next;
      }
      return {
        ...prev,
        [item.item_code]: current as Partial<StockConfigurationItem>,
      };
    });
  };

  const isCellModified = (item: StockConfigurationItem, field: keyof StockConfigurationItem): boolean => {
    const edit = editedRows[item.item_code];
    return Boolean(edit && field in edit && edit[field] !== item[field]);
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

  // Format Entry Date (OITM.CreateDate from SAP Business One in DD-MM-YYYY)
  const formatEntryDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    try {
      const raw = String(dateStr).trim();
      if (!raw) return '—';
      const cleanDate = raw.split('T')[0];
      const parts = cleanDate.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
      }
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '—';
    }
  };

  // Validation
  const validateRow = (item: StockConfigurationItem, updates: Partial<StockConfigurationItem>): string | null => {
    for (const f of ['qty', 'rcvd_qty', 'nt_weight', 'ok_qty', 'rej_qty'] as const) {
      const val = updates[f] !== undefined ? Number(updates[f]) : Number(item[f]);
      if (val < 0) {
        return `Item ${item.item_code}: Field '${f.replace('_', ' ').toUpperCase()}' cannot be negative.`;
      }
    }
    return null;
  };

  // Handle Save / Submit row (syncs to Database & SAP)
  const handleSaveRow = (item: StockConfigurationItem) => {
    const edits = editedRows[item.item_code] || {};
    const effectiveUpdates: Partial<StockConfigurationItem> = {
      qty: edits.qty !== undefined ? edits.qty : item.qty,
      stock_qty: edits.stock_qty !== undefined ? edits.stock_qty : item.stock_qty,
      grpo_no: edits.grpo_no !== undefined ? edits.grpo_no : item.grpo_no,
      rcvd_qty: edits.rcvd_qty !== undefined ? edits.rcvd_qty : item.rcvd_qty,
      nt_weight: edits.nt_weight !== undefined ? edits.nt_weight : item.nt_weight,
      qc: edits.qc !== undefined ? edits.qc : item.qc,
      drw_yn: edits.drw_yn !== undefined ? edits.drw_yn : item.drw_yn,
      v_chk: edits.v_chk !== undefined ? edits.v_chk : item.v_chk,
      ok_qty: edits.ok_qty !== undefined ? edits.ok_qty : item.ok_qty,
      rej_qty: edits.rej_qty !== undefined ? edits.rej_qty : item.rej_qty,
      lm: edits.lm !== undefined ? edits.lm : item.lm,
      olng: edits.olng !== undefined ? edits.olng : item.olng,
      lpk: edits.lpk !== undefined ? edits.lpk : item.lpk,
      lbl: edits.lbl !== undefined ? edits.lbl : item.lbl,
      mc_or_pt: edits.mc_or_pt !== undefined ? edits.mc_or_pt : item.mc_or_pt,
      description: item.description,
    };

    const valError = validateRow(item, effectiveUpdates);
    if (valError) {
      setNotification({ type: 'error', message: valError });
      return;
    }
    saveMutation.mutate({ itemCode: item.item_code, updates: effectiveUpdates });
  };

  // Bulk Actions
  const handleSubmitModified = () => {
    const codes = Object.keys(editedRows);
    if (codes.length === 0) {
      setNotification({ type: 'info', message: 'No modified entries to submit.' });
      return;
    }

    for (const code of codes) {
      const edits = editedRows[code];
      for (const f of ['qty', 'rcvd_qty', 'nt_weight', 'ok_qty', 'rej_qty'] as const) {
        if (edits[f] !== undefined && Number(edits[f]) < 0) {
          setNotification({ type: 'error', message: `Validation error in item ${code}: ${f} cannot be negative.` });
          return;
        }
      }
    }

    const payload = codes.map((code) => ({
      item_code: code,
      ...editedRows[code],
    }));

    bulkMutation.mutate(payload);
  };

  const handleConfirmSubmitAll = async () => {
    setConfirmSubmitAllOpen(false);
    try {
      const allRes = await stockConfigurationApi.getItems({
        ...queryParams,
        page: 1,
        page_size: 10000,
      });

      const payload: Partial<StockConfigurationItem>[] = [];
      for (const it of allRes.items) {
        const edits = editedRows[it.item_code] || {};
        const effQty = edits.qty !== undefined ? edits.qty : it.qty;
        const effRcvd = edits.rcvd_qty !== undefined ? edits.rcvd_qty : it.rcvd_qty;
        const effWeight = edits.nt_weight !== undefined ? edits.nt_weight : it.nt_weight;
        const effOk = edits.ok_qty !== undefined ? edits.ok_qty : it.ok_qty;
        const effRej = edits.rej_qty !== undefined ? edits.rej_qty : it.rej_qty;

        if (effQty < 0 || effRcvd < 0 || effWeight < 0 || effOk < 0 || effRej < 0) {
          setNotification({
            type: 'error',
            message: `Validation error in item ${it.item_code}: Quantities or weights cannot be negative.`,
          });
          return;
        }

        payload.push({
          item_code: it.item_code,
          qty: effQty,
          grpo_no: edits.grpo_no !== undefined ? edits.grpo_no : it.grpo_no,
          rcvd_qty: effRcvd,
          nt_weight: effWeight,
          qc: edits.qc !== undefined ? edits.qc : it.qc,
          drw_yn: edits.drw_yn !== undefined ? edits.drw_yn : it.drw_yn,
          v_chk: edits.v_chk !== undefined ? edits.v_chk : it.v_chk,
          ok_qty: effOk,
          rej_qty: effRej,
          lm: edits.lm !== undefined ? edits.lm : it.lm,
          olng: edits.olng !== undefined ? edits.olng : it.olng,
          lpk: edits.lpk !== undefined ? edits.lpk : it.lpk,
          lbl: edits.lbl !== undefined ? edits.lbl : it.lbl,
          mc_or_pt: edits.mc_or_pt !== undefined ? edits.mc_or_pt : it.mc_or_pt,
        });
      }

      bulkMutation.mutate(payload);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to retrieve all entries for submission.',
      });
    }
  };

  const handleConfirmDiscard = () => {
    setConfirmDiscardOpen(false);
    setEditedRows({});
    setNotification({ type: 'info', message: 'All unsaved modifications have been discarded.' });
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
    setBranchId('');
    applyQuickFilter('');
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

  const getPageNumbers = (current: number, total: number): (number | 'ellipsis')[] => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', total];
    }
    if (current >= total - 3) {
      return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
  };

  return (
    <div className={`w-full max-w-full space-y-3.5 sm:space-y-4 transition-colors duration-200 ${
      isDark ? 'text-slate-100' : 'text-slate-900'
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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Stock Configuration (SAP Items)
          </h1>
          <p className="text-[13.5px] sm:text-[14px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Manage stock items and warehouse configuration from SAP Business One.
          </p>
        </div>

        {/* Top Action Buttons Matching Reference Design */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Sync from SAP */}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[13.5px] font-semibold transition-all cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                : 'bg-white border-blue-200 text-[#155EEF] hover:bg-blue-50/70 hover:border-blue-300'
            }`}
            title="Fetch live updates from SAP Service Layer"
          >
            <RotateCw size={15} className={`text-blue-600 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{syncMutation.isPending ? 'Syncing...' : 'Sync from SAP'}</span>
          </button>

          {/* Import Excel */}
          <button
            onClick={() => setImportModalOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[13.5px] font-semibold transition-all cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                : 'bg-white border-blue-200 text-[#155EEF] hover:bg-blue-50/70 hover:border-blue-300'
            }`}
          >
            <Upload size={15} className="text-blue-600" />
            <span>Import Excel</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExport}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[13.5px] font-semibold transition-all cursor-pointer shadow-2xs ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                : 'bg-white border-blue-200 text-[#155EEF] hover:bg-blue-50/70 hover:border-blue-300'
            }`}
          >
            <Download size={15} className="text-blue-600" />
            <span>Export Excel</span>
          </button>

          {/* + Add New Item */}
          <button
            onClick={() => setAddItemModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#155EEF] hover:bg-blue-700 text-white text-[13.5px] font-semibold transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* ── Top Filters: Branch Selector & Date Filter (Directly above KPI Cards) ── */}
      <div className="flex items-center gap-2.5">
        {/* Branch Selector */}
        <select
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            setPage(1);
          }}
          className={`rounded-xl border px-3.5 py-2 text-[13px] sm:text-[13.5px] font-medium outline-none shadow-2xs transition cursor-pointer ${
            isDark
              ? 'border-slate-700 bg-[#141f32] text-slate-200 hover:border-slate-600'
              : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
          }`}
        >
          <option value="">All Branches</option>
          {user?.branch_id && (
            <option value={user.branch_id}>
              {user.store_name || user.branch_id || 'Main Branch'}
            </option>
          )}
          {data?.filters?.warehouses?.map((wh) => (
            wh !== user?.branch_id && <option key={wh} value={wh}>{wh}</option>
          ))}
        </select>

        {/* Date Range Dropdown Filter */}
        <div className="relative stock-date-dropdown-container">
          <button
            type="button"
            onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-colors font-medium text-[13px] sm:text-[13.5px] shadow-2xs cursor-pointer border ${
              isDark
                ? 'border-slate-700 bg-[#141f32] text-slate-200 hover:bg-slate-800'
                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {getDateScopeLabel(quickFilter, dateFrom, dateTo)}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDateDropdownOpen && (
            <div className={`absolute left-0 mt-2 w-64 border shadow-xl rounded-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100 ${
              isDark ? 'bg-[#1e293b] border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <button
                type="button"
                onClick={() => applyQuickFilter('')}
                className={`w-full text-left px-4 py-2 text-[13.5px] transition-colors cursor-pointer ${
                  quickFilter === ''
                    ? (isDark ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'bg-blue-50 text-blue-700 font-semibold')
                    : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50 font-normal')
                }`}
              >
                All Dates (Total)
              </button>
              <div className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-y ${
                isDark ? 'text-slate-300 border-slate-700 bg-[#141f32]' : 'text-slate-700 border-slate-200 bg-slate-50'
              }`}>
                Quick Filters
              </div>
              {(['today', 'week', 'month', 'year'] as const).map((f) => {
                const label = f === 'today' ? 'Today' : `This ${f.charAt(0).toUpperCase() + f.slice(1)}`;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => applyQuickFilter(f)}
                    className={`w-full text-left px-4 py-2 text-[13.5px] transition-colors cursor-pointer ${
                      quickFilter === f
                        ? (isDark ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'bg-blue-50 text-blue-700 font-semibold')
                        : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50 font-normal')
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <div className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-y mt-1 ${
                isDark ? 'text-slate-300 border-slate-700 bg-[#141f32]' : 'text-slate-700 border-slate-200 bg-slate-50'
              }`}>
                Custom Range
              </div>
              <div className="p-3 flex flex-col gap-2">
                <div>
                  <label className={`text-xs font-semibold mb-1 block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>From</label>
                  <input
                    type="date"
                    className={`w-full text-sm border rounded px-2 py-1 outline-none font-medium ${
                      isDark ? 'border-slate-700 bg-[#141f32] text-slate-200' : 'border-slate-300 bg-white text-slate-800'
                    }`}
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      if (customError) setCustomError(null);
                    }}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold mb-1 block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>To</label>
                  <input
                    type="date"
                    className={`w-full text-sm border rounded px-2 py-1 outline-none font-medium ${
                      isDark ? 'border-slate-700 bg-[#141f32] text-slate-200' : 'border-slate-300 bg-white text-slate-800'
                    }`}
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      if (customError) setCustomError(null);
                    }}
                  />
                </div>
                {customError && (
                  <p className="text-xs text-rose-500 font-semibold">{customError}</p>
                )}
                <button
                  type="button"
                  disabled={!customFrom || !customTo || customFrom > customTo}
                  onClick={() => applyQuickFilter('custom')}
                  className="w-full mt-2 py-1.5 bg-[#155EEF] hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer"
                >
                  Apply Custom
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Summary Cards (4 Cards in a Row) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {/* Total Items */}
        <div className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 shadow-xs flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}>
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Box size={22} className="text-blue-600" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Total Items</p>
            <p className="text-[24px] sm:text-[26px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {isLoading ? (
                <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
              ) : (
                data?.kpis?.total_items ?? 0
              )}
            </p>
            <p className="text-[12px] font-medium text-slate-400 leading-tight">From SAP</p>
          </div>
        </div>

        {/* Active Items */}
        <div className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 shadow-xs flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}>
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} className="text-emerald-600" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Active Items</p>
            <p className="text-[24px] sm:text-[26px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {isLoading ? (
                <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
              ) : (
                data?.kpis?.active_items ?? 0
              )}
            </p>
            <p className="text-[12px] font-medium text-slate-400 leading-tight">Available for sale</p>
          </div>
        </div>

        {/* Inactive Items */}
        <div className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 shadow-xs flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}>
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <XCircle size={22} className="text-rose-500" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Inactive Items</p>
            <p className="text-[24px] sm:text-[26px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {isLoading ? (
                <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
              ) : (
                data?.kpis?.inactive_items ?? 0
              )}
            </p>
            <p className="text-[12px] font-medium text-slate-400 leading-tight">Not available</p>
          </div>
        </div>

        {/* Warehouses */}
        <div className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 shadow-xs flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
        }`}>
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
            <Warehouse size={22} className="text-purple-600" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Warehouses</p>
            <p className="text-[24px] sm:text-[26px] font-bold text-slate-900 dark:text-white leading-none tracking-tight">
              {isLoading ? (
                <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
              ) : (
                data?.kpis?.warehouses_count ?? 0
              )}
            </p>
            <p className="text-[12px] font-medium text-slate-400 leading-tight">Configured in SAP</p>
          </div>
        </div>
      </div>

      {/* ── Search and Filters Card ── */}
      <div className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-200 shadow-xs flex flex-wrap items-center gap-2.5 ${
        isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-white border-slate-200/90'
      }`}>
        {/* Search input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            placeholder="Search by SAP code, description, or vendor name..."
            className={`w-full h-9 pl-9 pr-3.5 text-[13.5px] rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Vendor Dropdown */}
        <div className="relative min-w-[140px] flex-1 sm:flex-none">
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className={`w-full h-9 px-3 pr-8 appearance-none text-[13px] font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
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
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Group Dropdown */}
        <div className="relative min-w-[130px] flex-1 sm:flex-none">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className={`w-full h-9 px-3 pr-8 appearance-none text-[13px] font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
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
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Warehouse Dropdown */}
        <div className="relative min-w-[130px] flex-1 sm:flex-none">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className={`w-full h-9 px-3 pr-8 appearance-none text-[13px] font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
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
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Apply Filters Button */}
        <button
          onClick={handleApplyFilters}
          className="h-9 px-4 rounded-lg bg-[#155EEF] hover:bg-blue-700 text-white text-[13.5px] font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs active:scale-98"
        >
          <Filter size={15} />
          <span>Apply Filters</span>
        </button>

        {/* Reset Button */}
        <button
          onClick={handleResetFilters}
          className={`h-9 px-3 rounded-lg border text-[13.5px] font-semibold flex items-center gap-1.5 cursor-pointer transition ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <RotateCcw size={14} />
          <span>Reset</span>
        </button>
      </div>

      {/* ── Bulk Action Controls Area ── */}
      <div className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-200 shadow-xs flex flex-wrap items-center justify-between gap-3 ${
        modifiedCount > 0
          ? isDark
            ? 'bg-amber-950/20 border-amber-800/60'
            : 'bg-amber-50/70 border-amber-200/90'
          : isDark
          ? 'bg-slate-800/80 border-slate-700/80'
          : 'bg-white border-slate-200/90'
      }`}>
        {/* Status Information */}
        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <Box size={16} className="text-blue-600" />
            <span>Dataset: {isLoading ? 'Loading...' : `${data?.total ?? 0} entries`}</span>
          </div>

          <span className="text-slate-300 dark:text-slate-600">|</span>

          {/* Modified indicator */}
          <div className="flex items-center gap-1.5">
            {modifiedCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold text-[13px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                {modifiedCount} unsaved {modifiedCount === 1 ? 'change' : 'changes'}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 text-[12.5px] font-medium">
                No unsaved changes
              </span>
            )}
          </div>

          {/* Bulk operation outcome status badge */}
          {bulkStatus && (
            <>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${
                bulkStatus.failed === 0
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200'
              }`}>
                {bulkStatus.failed === 0 ? <Check size={13} /> : <AlertCircle size={13} />}
                Saved: {bulkStatus.successful} {bulkStatus.failed > 0 && `| Failed: ${bulkStatus.failed}`} ({bulkStatus.timestamp})
              </span>
            </>
          )}
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Submit Modified Entries */}
          <button
            onClick={handleSubmitModified}
            disabled={modifiedCount === 0 || bulkMutation.isPending}
            className={`h-9 px-3.5 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-all shadow-xs border ${
              modifiedCount > 0 && !bulkMutation.isPending
                ? 'bg-emerald-50 border-emerald-400 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300 cursor-pointer active:scale-98'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed'
            }`}
            title="Save all modified rows across the entire dataset to Database & SAP"
          >
            {bulkMutation.isPending ? (
              <RotateCw size={14} className="animate-spin" />
            ) : (
              <Save size={14} className="text-emerald-600 dark:text-emerald-400" />
            )}
            <span>Submit Modified Entries ({modifiedCount})</span>
          </button>

          {/* Submit All Entries */}
          <button
            onClick={() => setConfirmSubmitAllOpen(true)}
            disabled={bulkMutation.isPending || !data?.total}
            className={`h-9 px-3.5 rounded-lg border text-[13px] font-semibold flex items-center gap-1.5 transition-all shadow-2xs ${
              isDark
                ? 'bg-slate-800 border-blue-500/40 text-blue-400 hover:bg-slate-700'
                : 'bg-white border-blue-400 text-blue-600 hover:bg-blue-50'
            } cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Validate and submit all entries in the dataset to Database & SAP"
          >
            <Upload size={14} />
            <span>Submit All Entries ({data?.total ?? 0})</span>
          </button>

          {/* Discard Unsaved Changes */}
          <button
            onClick={() => setConfirmDiscardOpen(true)}
            disabled={modifiedCount === 0 || bulkMutation.isPending}
            className={`h-9 px-3 rounded-lg border text-[13px] font-semibold flex items-center gap-1.5 transition-all ${
              modifiedCount > 0 && !bulkMutation.isPending
                ? isDark
                  ? 'bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-900/50 cursor-pointer'
                  : 'bg-white border-rose-300 text-rose-600 hover:bg-rose-50 cursor-pointer'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60 text-slate-300 dark:text-slate-600 cursor-not-allowed'
            }`}
            title="Discard all unsaved edits and restore last saved state"
          >
            <RotateCcw size={14} />
            <span>Discard Changes</span>
          </button>
        </div>
      </div>

      {/* ── Table Card: Stock Items ── */}
      <div className={`rounded-xl border transition-all duration-200 shadow-xs overflow-hidden ${
        isDark ? 'bg-slate-800/90 border-slate-700/80' : 'bg-white border-slate-200/90'
      }`}>
        {/* Table Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-700/80 gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
              <Box size={16} />
            </div>
            <h2 className="text-[17px] sm:text-[18px] font-bold text-slate-900 dark:text-white leading-tight">
              Stock Items {isLoading ? '(Loading...)' : `(${data?.total ?? 0})`}
            </h2>
          </div>

          <div className="flex items-center gap-3 text-[13px] text-slate-500 dark:text-slate-400">
            <span>
              {isLoading
                ? 'Loading entries...'
                : !data?.total
                ? 'No entries'
                : `Showing ${startRow} - ${endRow} of ${data?.total}`}
            </span>

            {/* Rows Per Page Dropdown */}
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={`h-8 px-2.5 pr-6 text-[12.5px] font-medium rounded-lg border appearance-none cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={10000}>All entries</option>
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Table View with 21 Business Columns ── */}
        <div className="overflow-x-auto w-full">
          <table className={`w-full border-collapse text-left text-[12.5px] sm:text-[13px] min-w-[1450px] border ${
            isDark ? 'border-slate-600' : 'border-slate-300'
          }`}>
            <thead className="sticky top-0 z-10">
              <tr className={`text-[11px] sm:text-[11.5px] font-bold uppercase tracking-wider ${
                isDark
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-[#EAF2FE] text-[#1E3A8A]'
              }`}>
                <th className="py-2.5 px-2 text-center whitespace-nowrap w-[48px] min-w-[48px] border border-slate-300 dark:border-slate-600">SR. NO.</th>
                <th className="py-2.5 px-2.5 text-left whitespace-nowrap w-[95px] min-w-[95px] border border-slate-300 dark:border-slate-600">SAP CODE</th>
                <th className="py-2.5 px-2.5 text-left whitespace-nowrap min-w-[150px] max-w-[220px] border border-slate-300 dark:border-slate-600">DESCRIPTION</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[72px] min-w-[72px] border border-slate-300 dark:border-slate-600">QTY.</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[72px] min-w-[72px] border border-slate-300 dark:border-slate-600">STOCK QTY.</th>
                <th className="py-2.5 px-2.5 text-left whitespace-nowrap min-w-[120px] max-w-[170px] border border-slate-300 dark:border-slate-600">VENDOR NAME</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[72px] min-w-[72px] border border-slate-300 dark:border-slate-600">GRPO NO.</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[72px] min-w-[72px] border border-slate-300 dark:border-slate-600">RCVD. QTY.</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[72px] min-w-[72px] border border-slate-300 dark:border-slate-600">NT. WEIGHT</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[44px] min-w-[44px] border border-slate-300 dark:border-slate-600">QC</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[54px] min-w-[54px] border border-slate-300 dark:border-slate-600">DRW. Y/N</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[54px] min-w-[54px] border border-slate-300 dark:border-slate-600">V CHK</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[72px] min-w-[72px] border border-slate-300 dark:border-slate-600">OK QTY.</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[72px] min-w-[72px] border border-slate-300 dark:border-slate-600">REJ. QTY.</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[48px] min-w-[48px] border border-slate-300 dark:border-slate-600" title="Laser Marking / Line Marking">LM</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[48px] min-w-[48px] border border-slate-300 dark:border-slate-600" title="Oiling / Loading">OLNG</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[48px] min-w-[48px] border border-slate-300 dark:border-slate-600" title="Loose Packing / Line Packing">LPK</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[48px] min-w-[48px] border border-slate-300 dark:border-slate-600" title="Labeling">LBL</th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap w-[60px] min-w-[60px] border border-slate-300 dark:border-slate-600" title="Machining / Coating / Certificate">MC OR PT</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap w-[100px] min-w-[100px] border border-slate-300 dark:border-slate-600" title="SAP Business One Item Creation Date (OITM.CreateDate)">ENTRY DATE</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap w-[90px] min-w-[90px] border border-slate-300 dark:border-slate-600">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={21} className="py-14 text-center border border-slate-300 dark:border-slate-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
                      <span className="text-[14.5px] font-medium text-slate-500">Loading stock configuration from backend...</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={21} className="py-12 text-center border border-slate-300 dark:border-slate-600">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <AlertCircle className="w-8 h-8 text-rose-500" />
                      <span className="text-slate-600 font-medium">
                        {(error as any)?.message || 'Failed to load stock configuration records.'}
                      </span>
                      <button
                        onClick={() => refetch()}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={21} className="py-12 text-center text-slate-500 border border-slate-300 dark:border-slate-600">
                    No items found matching the selected filters.
                  </td>
                </tr>
              ) : (
                data?.items?.map((item, idx) => {
                  const srNo = (page - 1) * (pageSize >= 10000 ? 0 : pageSize) + idx + 1;
                  const isModified = Boolean(editedRows[item.item_code]);
                  const isSaving = savingItemCode === item.item_code;

                  return (
                    <tr
                      key={item.item_code}
                      className={`transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-750 ${
                        isModified ? 'bg-amber-50/35 dark:bg-amber-950/25' : ''
                      }`}
                    >
                      {/* 1. SR. NO. */}
                      <td className="py-2.5 px-2 text-center align-middle text-slate-500 dark:text-slate-400 font-semibold text-[12px] whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center gap-1">
                          <span>{srNo}</span>
                          {isModified && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Unsaved changes in this row" />
                          )}
                        </div>
                      </td>

                      {/* 2. SAP CODE (Read-only SAP field) */}
                      <td className="py-2.5 px-2.5 text-left align-middle font-bold text-slate-900 dark:text-white text-[12px] whitespace-nowrap border border-slate-300 dark:border-slate-600" title={item.item_code}>
                        {item.item_code}
                      </td>

                      {/* 3. DESCRIPTION (Read-only SAP field) */}
                      <td className="py-2.5 px-2.5 text-left align-middle text-slate-800 dark:text-slate-200 font-medium text-[12px] truncate max-w-[200px] border border-slate-300 dark:border-slate-600" title={item.description}>
                        {item.description}
                      </td>

                      {/* 4. QTY. (Editable number input) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            value={getEffectiveNum(item, 'qty')}
                            onChange={(e) => handleCellChange(item, 'qty', Number(e.target.value))}
                            className={`w-14 h-8 text-center text-[12.5px] font-medium rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                              isCellModified(item, 'qty')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : getEffectiveNum(item, 'qty') < 0
                                ? 'border-rose-500 bg-rose-50/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                      </td>

                      {/* 5. STOCK QTY. (From SAP) */}
                      <td className="py-2.5 px-1 text-center align-middle font-bold text-slate-700 dark:text-slate-300 text-[12.5px] whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        {item.stock_qty}
                      </td>

                      {/* 6. VENDOR NAME (SAP-owned field) */}
                      <td className="py-2.5 px-2.5 text-left align-middle text-slate-800 dark:text-slate-200 font-medium text-[12px] truncate max-w-[160px] border border-slate-300 dark:border-slate-600" title={item.vendor_name || '—'}>
                        {item.vendor_name || '—'}
                      </td>

                      {/* 7. GRPO NO. (Editable text/number input) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <input
                            type="text"
                            value={getEffectiveStr(item, 'grpo_no')}
                            onChange={(e) => handleCellChange(item, 'grpo_no', e.target.value)}
                            className={`w-14 h-8 text-center text-[12px] font-medium rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                              isCellModified(item, 'grpo_no')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                      </td>

                      {/* 8. RCVD. QTY. (Editable number input) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            value={getEffectiveNum(item, 'rcvd_qty')}
                            onChange={(e) => handleCellChange(item, 'rcvd_qty', Number(e.target.value))}
                            className={`w-14 h-8 text-center text-[12.5px] font-medium rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                              isCellModified(item, 'rcvd_qty')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : getEffectiveNum(item, 'rcvd_qty') < 0
                                ? 'border-rose-500 bg-rose-50/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                      </td>

                      {/* 9. NT. WEIGHT (Editable float input) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={getEffectiveNum(item, 'nt_weight')}
                            onChange={(e) => handleCellChange(item, 'nt_weight', Number(e.target.value))}
                            className={`w-14 h-8 text-center text-[12.5px] font-medium rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                              isCellModified(item, 'nt_weight')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : getEffectiveNum(item, 'nt_weight') < 0
                                ? 'border-rose-500 bg-rose-50/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                      </td>

                      {/* 10. QC (Checkbox) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={getEffectiveBool(item, 'qc')}
                            onChange={(e) => handleCellChange(item, 'qc', e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer transition-colors"
                          />
                        </div>
                      </td>

                      {/* 11. DRW. Y/N (Select Y/N) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <select
                            value={getEffectiveStr(item, 'drw_yn')}
                            onChange={(e) => handleCellChange(item, 'drw_yn', e.target.value)}
                            className={`w-10 h-8 text-center text-[12px] font-semibold rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                              isCellModified(item, 'drw_yn')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </div>
                      </td>

                      {/* 12. V CHK (Select Y/N) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <select
                            value={getEffectiveStr(item, 'v_chk')}
                            onChange={(e) => handleCellChange(item, 'v_chk', e.target.value)}
                            className={`w-10 h-8 text-center text-[12px] font-semibold rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                              isCellModified(item, 'v_chk')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </div>
                      </td>

                      {/* 13. OK QTY. (Editable number input) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            value={getEffectiveNum(item, 'ok_qty')}
                            onChange={(e) => handleCellChange(item, 'ok_qty', Number(e.target.value))}
                            className={`w-14 h-8 text-center text-[12.5px] font-medium rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                              isCellModified(item, 'ok_qty')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : getEffectiveNum(item, 'ok_qty') < 0
                                ? 'border-rose-500 bg-rose-50/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                      </td>

                      {/* 14. REJ. QTY. (Editable number input) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            value={getEffectiveNum(item, 'rej_qty')}
                            onChange={(e) => handleCellChange(item, 'rej_qty', Number(e.target.value))}
                            className={`w-14 h-8 text-center text-[12.5px] font-medium rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                              isCellModified(item, 'rej_qty')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : getEffectiveNum(item, 'rej_qty') < 0
                                ? 'border-rose-500 bg-rose-50/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </div>
                      </td>

                      {/* 15. LM (Select Y/N) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <select
                            value={getEffectiveStr(item, 'lm')}
                            onChange={(e) => handleCellChange(item, 'lm', e.target.value)}
                            className={`w-9.5 h-8 text-center text-[12px] font-semibold rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                              isCellModified(item, 'lm')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </div>
                      </td>

                      {/* 16. OLNG (Select Y/N) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <select
                            value={getEffectiveStr(item, 'olng')}
                            onChange={(e) => handleCellChange(item, 'olng', e.target.value)}
                            className={`w-9.5 h-8 text-center text-[12px] font-semibold rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                              isCellModified(item, 'olng')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </div>
                      </td>

                      {/* 17. LPK (Select Y/N) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <select
                            value={getEffectiveStr(item, 'lpk')}
                            onChange={(e) => handleCellChange(item, 'lpk', e.target.value)}
                            className={`w-9.5 h-8 text-center text-[12px] font-semibold rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                              isCellModified(item, 'lpk')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </div>
                      </td>

                      {/* 18. LBL (Select Y/N) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <select
                            value={getEffectiveStr(item, 'lbl')}
                            onChange={(e) => handleCellChange(item, 'lbl', e.target.value)}
                            className={`w-9.5 h-8 text-center text-[12px] font-semibold rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                              isCellModified(item, 'lbl')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </div>
                      </td>

                      {/* 19. MC OR PT (Select Y/N) */}
                      <td className="py-2 px-1 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center">
                          <select
                            value={getEffectiveStr(item, 'mc_or_pt')}
                            onChange={(e) => handleCellChange(item, 'mc_or_pt', e.target.value)}
                            className={`w-10 h-8 text-center text-[12px] font-semibold rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                              isCellModified(item, 'mc_or_pt')
                                ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30'
                                : isDark
                                ? 'bg-slate-900 border-slate-700 text-white'
                                : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </div>
                      </td>

                      {/* 20. ENTRY DATE (Read-only SAP Creation Date: OITM.CreateDate formatted as DD-MM-YYYY) */}
                      <td className="py-2.5 px-2 text-center align-middle whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium text-[12px] border border-slate-300 dark:border-slate-600 bg-slate-50/40 dark:bg-slate-900/20" title={item.entry_date ? `SAP Created: ${item.entry_date}` : 'Not available in SAP'}>
                        {formatEntryDate(item.entry_date)}
                      </td>

                      {/* 21. ACTIONS (Blue Submit button + Red Delete button) */}
                      <td className="py-2 px-1.5 text-center align-middle whitespace-nowrap border border-slate-300 dark:border-slate-600">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Submit Button */}
                          <button
                            onClick={() => handleSaveRow(item)}
                            disabled={isSaving}
                            className={`h-7 px-2.5 rounded-md text-[11.5px] font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs ${
                              isSaving
                                ? 'bg-blue-600 text-white cursor-wait'
                                : 'bg-[#155EEF] hover:bg-blue-700 text-white cursor-pointer active:scale-95'
                            }`}
                            title="Submit row to database and SAP"
                          >
                            {isSaving ? <RotateCw size={12} className="animate-spin" /> : <Save size={12} />}
                            <span>{isSaving ? 'Submitting...' : 'Submit'}</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteConfirmItem(item)}
                            className="w-7 h-7 rounded-md bg-[#EF4444] hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Delete this item"
                          >
                            <Trash2 size={13} />
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
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-t border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Show [10] entries */}
          <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
            <span>Show</span>
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={`h-7.5 px-2.5 pr-6 text-[12.5px] font-medium rounded-md border appearance-none cursor-pointer ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={10000}>All</option>
              </select>
              <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <span>entries</span>

            {/* Jump to Page */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 ml-2.5 pl-2.5 border-l border-slate-200 dark:border-slate-700">
                <span className="text-[12px] text-slate-400">Go to:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageJumpInput}
                  onChange={(e) => setPageJumpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt(pageJumpInput, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setPage(val);
                        setPageJumpInput('');
                      }
                    }
                  }}
                  placeholder={String(page)}
                  className={`w-12 h-7 px-1 text-center text-[12px] font-medium rounded-md border outline-none focus:ring-1 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = parseInt(pageJumpInput, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages) {
                      setPage(val);
                      setPageJumpInput('');
                    }
                  }}
                  className="h-7 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Go
                </button>
              </div>
            )}
          </div>

          {/* Right: < Previous 1 2 3 4 5 ... 101 Next > */}
          <div className="flex items-center gap-1">
            {/* Previous */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-2.5 py-1 rounded-md text-[13px] font-medium flex items-center gap-1 transition ${
                page <= 1
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
              }`}
            >
              <ChevronLeft size={15} />
              <span>Previous</span>
            </button>

            {/* Page Number Buttons */}
            {pageSize < 10000 && getPageNumbers(page, totalPages).map((p, idx) => {
              if (p === 'ellipsis') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-semibold select-none text-[12px]">
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-md text-[12.5px] font-semibold flex items-center justify-center transition cursor-pointer ${
                    page === p
                      ? 'bg-[#155EEF] text-white shadow-2xs'
                      : isDark
                      ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            {/* Next */}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`px-2.5 py-1 rounded-md text-[13px] font-medium flex items-center gap-1 transition ${
                page >= totalPages
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-[#155EEF] font-semibold hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer'
              }`}
            >
              <span>Next</span>
              <ChevronRight size={15} />
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

      {/* ── Submit All Entries Confirmation Modal ── */}
      {confirmSubmitAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
            isDark ? 'bg-slate-850 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Submit All Entries</h3>
                <p className="text-xs text-slate-500">Bulk submit dataset verification</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              You are about to validate and submit all <strong className="text-blue-600 dark:text-blue-400 font-bold">{data?.total ?? 0} entries</strong> in the current dataset to the database.
              Any modified values will be updated and committed.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmSubmitAllOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitAll}
                disabled={bulkMutation.isPending}
                className="px-5 py-2 rounded-xl bg-[#155EEF] hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer shadow-xs active:scale-98"
              >
                {bulkMutation.isPending ? 'Submitting...' : `Yes, Submit All (${data?.total ?? 0})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Discard Changes Confirmation Modal ── */}
      {confirmDiscardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
            isDark ? 'bg-slate-850 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <RotateCcw size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Discard Unsaved Changes</h3>
                <p className="text-xs text-slate-500">Revert modified table rows</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              Are you sure you want to discard unsaved edits for <strong className="text-rose-600 dark:text-rose-400 font-bold">{modifiedCount} modified item(s)</strong>?
              All table cells will revert to their saved database values.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDiscardOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer text-sm font-semibold"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold cursor-pointer shadow-xs active:scale-98"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockConfigurationPage;
