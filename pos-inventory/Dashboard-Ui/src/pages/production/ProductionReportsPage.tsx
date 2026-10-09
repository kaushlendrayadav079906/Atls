import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  RefreshCcw,
  FileText,
  Eye,
  Download,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../api/client';

interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  dataSource: string;
  route: string;
  supportsExport: boolean;
}

const REPORTS: ReportDefinition[] = [
  {
    id: 'summary',
    title: 'Production Summary Report',
    description: 'High-level overview of production KPIs including planned vs produced quantities and efficiency metrics.',
    dataSource: 'SAP Production Orders',
    route: '/production',
    supportsExport: true,
  },
  {
    id: 'orders',
    title: 'Production Order Report',
    description: 'Detailed list of production orders with their current statuses, planned, produced, and pending quantities.',
    dataSource: 'SAP Production Orders',
    route: '/production/orders',
    supportsExport: true,
  },
  {
    id: 'item-wise',
    title: 'Item-wise Production Report',
    description: 'Aggregated production metrics grouped by item code, showing performance and rejection rates per product.',
    dataSource: 'SAP Production Orders',
    route: '/production/item-wise',
    supportsExport: true,
  },
  {
    id: 'rejection',
    title: 'Production Rejection Report',
    description: 'Analysis of rejected quantities and rejection percentages across items to identify quality issues.',
    dataSource: 'SAP Production Orders & Receipts',
    route: '/production/rejection',
    supportsExport: true,
  },
  {
    id: 'date-wise',
    title: 'Date-wise Production Report',
    description: 'Chronological breakdown of production output, allowing for daily, weekly, or monthly trend analysis.',
    dataSource: 'SAP Production Receipts',
    route: '/production/date-wise',
    supportsExport: true,
  }
];

export const ProductionReportsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // States
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const branchId = user?.branch_id || '';

  const { date_from, date_to } = useMemo(() => {
    const today = new Date();
    let from = '';
    const to = today.toISOString().split('T')[0];
    
    if (dateRange === 'today') {
      from = to;
    } else if (dateRange === 'week') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      from = startOfWeek.toISOString().split('T')[0];
    } else if (dateRange === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      from = startOfMonth.toISOString().split('T')[0];
    } else if (dateRange === 'year') {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      from = startOfYear.toISOString().split('T')[0];
    } else if (dateRange === 'custom') {
      return { date_from: customFrom, date_to: customTo };
    }
    
    return { date_from: from, date_to: to };
  }, [dateRange, customFrom, customTo]);

  // Handle filter changes
  const handleDateChange = (range: any) => {
    setDateRange(range);
  };
  
  const handleResetFilters = () => {
    setWarehouseFilter('');
    setDateRange('month');
    setCustomFrom('');
    setCustomTo('');
  };

  const handleRefresh = () => {
    // In a real scenario where reports list comes from backend, we would refetch here.
    // For now, it just resets UI state as reports are static.
  };

  const handlePreview = (route: string) => {
    // Navigate to the respective page to "preview" the report data using the current filters.
    const searchParams = new URLSearchParams();
    if (date_from) searchParams.set('date_from', date_from);
    if (date_to) searchParams.set('date_to', date_to);
    if (warehouseFilter) searchParams.set('warehouse', warehouseFilter);
    navigate(`${route}?${searchParams.toString()}`);
  };

  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleExport = async (reportId: string) => {
    try {
      setExportingId(reportId);
      const params = new URLSearchParams();
      if (date_from) params.set('date_from', date_from);
      if (date_to) params.set('date_to', date_to);
      if (warehouseFilter) params.set('warehouse', warehouseFilter);
      if (branchId) params.set('warehouse', branchId); // override if strict branch

      const response = await apiClient.get(`/production/export/${reportId}?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `production-${reportId}-${date_from || 'all'}-to-${date_to || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export report. Please try again.");
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-900 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-none tracking-tight text-slate-900">Production Reports</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">Generate and export production reports using real SAP data.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700">
            <Factory size={16} />
            {branchId ? `Branch: ${branchId}` : 'All Branches'}
          </div>

          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden text-[13px] font-medium">
            {(['today', 'week', 'month', 'year', 'custom'] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleDateChange(r)}
                className={`px-3 py-2 border-r border-slate-200 last:border-none transition-colors ${
                  dateRange === r ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2 py-1">
              <input 
                type="date" 
                value={customFrom} 
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-[13px] border-none outline-none text-slate-700 bg-transparent"
              />
              <span className="text-slate-400">-</span>
              <input 
                type="date" 
                value={customTo} 
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-[13px] border-none outline-none text-slate-700 bg-transparent"
              />
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition"
            title="Refresh Data"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Warehouse:</label>
          <input
            type="text"
            placeholder="Warehouse filter..."
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>

        <button
          onClick={handleResetFilters}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
        >
          Reset Filters
        </button>

        <div className="ml-auto text-sm text-slate-500 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
          <AlertCircle size={14} className="text-blue-500" />
          <span>Selected range: <strong>{date_from || 'Any'}</strong> to <strong>{date_to || 'Any'}</strong></span>
        </div>
      </div>

      {/* REPORT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {REPORTS.map((report) => (
          <div key={report.id} className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden hover:border-blue-300 transition-colors group">
            <div className="p-5 flex-1">
              <div className="flex items-start gap-4 mb-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{report.title}</h3>
                  <div className="text-[12px] font-medium text-slate-500 mt-0.5">Source: {report.dataSource}</div>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed min-h-[60px]">
                {report.description}
              </p>
            </div>
            
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => handlePreview(report.route)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                >
                  <Eye size={14} />
                  Preview
                </button>
                
                <button
                  onClick={() => handleExport(report.id)}
                  disabled={!report.supportsExport || exportingId === report.id}
                  title={report.supportsExport ? "Export to CSV" : "Export is not currently supported"}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm font-medium transition-colors ${
                    report.supportsExport && exportingId !== report.id
                      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" 
                      : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                  }`}
                >
                  <Download size={14} className={exportingId === report.id ? "animate-bounce" : ""} />
                  {exportingId === report.id ? 'Exporting...' : 'Export'}
                </button>
              </div>
              
              {!report.supportsExport && (
                <span className="text-[11px] text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded">
                  View Only
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
