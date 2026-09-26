import React from 'react';
import { useInventoryRisk } from '../../hooks/useInventoryRisk';

const InventoryRiskView: React.FC = () => {
  const { data: riskyItems, isLoading, isError, error, dataUpdatedAt } = useInventoryRisk();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium">Loading SAP Inventory Risk Analysis...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-center gap-3 text-red-700 mb-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="font-bold">Error Fetching Inventory Risk</h3>
        </div>
        <p className="text-red-600 text-sm">{error instanceof Error ? error.message : "Unknown error occurred."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Inventory Risk & Replenishment</h2>
          <p className="text-slate-500 mt-1">Items at or below SAP-defined minimum threshold.</p>
        </div>
        {dataUpdatedAt && (
          <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 whitespace-nowrap">
            Last refreshed: {new Date(dataUpdatedAt).toLocaleTimeString()}
          </div>
        )}
      </div>

      {!riskyItems || riskyItems.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
          <svg className="w-16 h-16 mx-auto text-emerald-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Stock Levels Healthy</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            No items are currently below their minimum threshold at your assigned warehouse.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left font-semibold text-slate-800">Item</th>
                  <th scope="col" className="px-6 py-4 text-right font-semibold text-slate-800">Warehouse</th>
                  <th scope="col" className="px-6 py-4 text-right font-semibold text-slate-800">On Hand</th>
                  <th scope="col" className="px-6 py-4 text-right font-semibold text-slate-800 text-opacity-80">Committed</th>
                  <th scope="col" className="px-6 py-4 text-right font-semibold text-slate-800 text-opacity-80">Ordered</th>
                  <th scope="col" className="px-6 py-4 text-right font-semibold text-slate-800">Min. Threshold</th>
                  <th scope="col" className="px-6 py-4 text-center font-semibold text-slate-800">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {riskyItems.map((item, idx) => {
                  const projected = item.in_stock + item.ordered - item.committed;
                  const deficit = item.minimal_stock - projected;
                  const isCritical = projected <= 0;
                  
                  return (
                    <tr key={`${item.item_code}-${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">{item.name}</span>
                          <span className="text-xs text-slate-500 font-mono">{item.item_code}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-slate-500 font-medium">
                        {item.warehouse}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-800">
                        {item.in_stock.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-amber-600">
                        {item.committed > 0 ? `-${item.committed.toLocaleString()}` : '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-emerald-600">
                        {item.ordered > 0 ? `+${item.ordered.toLocaleString()}` : '0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-800 bg-gray-50/50">
                        {item.minimal_stock.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          isCritical 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isCritical ? 'Critical Stockout' : `Reorder ${deficit}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryRiskView;
