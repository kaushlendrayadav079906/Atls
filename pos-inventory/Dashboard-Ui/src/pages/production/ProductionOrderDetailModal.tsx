import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Factory,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Calendar,
  Layers,
  AlertCircle
} from 'lucide-react';
import { getProductionOrderDetail } from '../../api/production';

interface ModalProps {
  productionOrderNo: number;
  onClose: () => void;
}

export const ProductionOrderDetailModal: React.FC<ModalProps> = ({ productionOrderNo, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'components'>('overview');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['production', 'orderDetail', productionOrderNo],
    queryFn: () => getProductionOrderDetail(productionOrderNo),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Dimmed Background */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-[1100px] max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Factory size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Production Order #{productionOrderNo}
              </h2>
              {data && (
                <div className="text-sm text-slate-500 mt-0.5">
                  {data.item_code} - {data.item_name}
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {isLoading ? (
            <div className="p-6 space-y-6">
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-2 gap-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            </div>
          ) : isError ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <AlertCircle size={48} className="text-red-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900">Unable to load production order details.</h3>
              <button 
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <div className="p-6 flex flex-col gap-6">
              {/* Status & Progress Bar */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
                  <div className="flex items-center gap-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${
                      data.status === 'Closed' ? 'bg-green-100 text-green-700' :
                      data.status === 'Released' ? 'bg-yellow-100 text-yellow-700' :
                      data.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {data.status === 'Closed' && <CheckCircle size={14} className="mr-1.5" />}
                      {data.status === 'Cancelled' && <XCircle size={14} className="mr-1.5" />}
                      {data.status === 'Released' && <Package size={14} className="mr-1.5" />}
                      {data.status === 'Planned' && <Clock size={14} className="mr-1.5" />}
                      {data.status || 'Unknown'}
                    </span>
                    <span className="text-sm text-slate-500 font-medium border-l border-slate-200 pl-4">
                      Type: {data.production_type || 'N/A'}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-700">
                    Production Progress: <span className="text-blue-600">{data.production_percentage}%</span>
                  </div>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(data.production_percentage, 100)}%` }}
                    title={`Produced: ${data.produced_qty}`}
                  />
                  {data.rejection_percentage > 0 && (
                    <div 
                      className="h-full bg-red-400 transition-all"
                      style={{ width: `${Math.min((data.rejected_qty / data.planned_qty) * 100, 100 - Math.min(data.production_percentage, 100))}%` }}
                      title={`Rejected: ${data.rejected_qty}`}
                    />
                  )}
                </div>
                
                <div className="grid grid-cols-4 gap-4 mt-5 text-sm">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-slate-500 mb-1">Planned Qty</div>
                    <div className="font-semibold text-slate-900 text-lg">{data.planned_qty}</div>
                  </div>
                  <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                    <div className="text-blue-600 mb-1">Produced Qty</div>
                    <div className="font-semibold text-blue-900 text-lg">{data.produced_qty}</div>
                  </div>
                  <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                    <div className="text-orange-600 mb-1">Pending Qty</div>
                    <div className="font-semibold text-orange-900 text-lg">{data.pending_qty}</div>
                  </div>
                  <div className="bg-red-50/50 p-3 rounded-lg border border-red-100">
                    <div className="text-red-600 mb-1">Rejected Qty</div>
                    <div className="font-semibold text-red-900 text-lg">{data.rejected_qty}</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    activeTab === 'overview' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileTextIcon size={16} />
                    Overview
                  </div>
                  {activeTab === 'overview' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('components')}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    activeTab === 'components' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers size={16} />
                    Components
                  </div>
                  {activeTab === 'components' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                  )}
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-0 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-100">
                      <DetailRow label="Order Date" value={data.posting_date || 'N/A'} icon={<Calendar size={14}/>} />
                      <DetailRow label="Start Date" value={data.start_date || 'N/A'} icon={<Calendar size={14}/>} />
                      <DetailRow label="Due Date" value={data.due_date || 'N/A'} icon={<Calendar size={14}/>} />
                      <DetailRow label="Creation Date" value={data.creation_date || 'N/A'} icon={<Calendar size={14}/>} />
                      <DetailRow label="Warehouse" value={data.warehouse || 'N/A'} />
                      <DetailRow label="Priority" value={data.priority !== null ? data.priority : 'N/A'} />
                      <DetailRow label="Project" value={data.project || 'N/A'} />
                      <DetailRow label="Rejection %" value={`${data.rejection_percentage}%`} />
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'components' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  {data.components?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                          <tr>
                            <th className="px-5 py-3 w-12">#</th>
                            <th className="px-5 py-3">Component</th>
                            <th className="px-5 py-3 text-right">Base Qty</th>
                            <th className="px-5 py-3 text-right">Planned Qty</th>
                            <th className="px-5 py-3 text-right">Issued Qty</th>
                            <th className="px-5 py-3 text-right text-orange-600">Pending</th>
                            <th className="px-5 py-3">Warehouse</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.components.map((comp, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-5 py-3 text-slate-400">{idx + 1}</td>
                              <td className="px-5 py-3">
                                <div className="font-medium text-slate-800">{comp.item_code}</div>
                                <div className="text-xs text-slate-500 max-w-[200px] truncate" title={comp.item_name || ''}>
                                  {comp.item_name || 'N/A'}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right text-slate-600">{comp.base_qty}</td>
                              <td className="px-5 py-3 text-right font-medium">{comp.planned_qty}</td>
                              <td className="px-5 py-3 text-right text-blue-600 font-medium">{comp.issued_qty}</td>
                              <td className="px-5 py-3 text-right text-orange-600 font-medium">{comp.pending_qty}</td>
                              <td className="px-5 py-3 text-slate-600">{comp.warehouse || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                      <Layers size={32} className="text-slate-300 mb-3" />
                      <p>No component data available for this production order.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const FileTextIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const DetailRow = ({ label, value, icon }: { label: string, value: string | number, icon?: React.ReactNode }) => (
  <tr>
    <td className="px-6 py-3 bg-slate-50/50 text-slate-500 font-medium w-1/3 border-r border-slate-100">
      <div className="flex items-center gap-2">
        {icon} {label}
      </div>
    </td>
    <td className="px-6 py-3 font-medium text-slate-900">{value}</td>
  </tr>
);

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className || ''}`} />
);
