import { TriangleAlert } from 'lucide-react';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export const AIChatRenderer = ({ structuredData }: { structuredData: any }) => {
  if (!structuredData) return null;

  const { type, meta } = structuredData;

  const renderMetaWarnings = () => {
    if (!meta) return null;
    return (
      <div className="mt-2 flex flex-col gap-1 rounded bg-amber-50 p-2 text-[9px] text-amber-700 border border-amber-200">
        {meta.is_partial && (
          <div className="flex items-center gap-1 font-semibold">
            <TriangleAlert className="h-3 w-3" />
            PARTIAL DATA: Results are truncated. Do not rely on exact counts or aggregates from this list.
          </div>
        )}
        {meta.date_range && <div>Date Range: {meta.date_range}</div>}
        {meta.branch_scope && <div>Scope: {meta.branch_scope}</div>}
        {meta.quantity_semantics && <div><span className="font-semibold">Semantics:</span> {meta.quantity_semantics}</div>}
      </div>
    );
  };

  try {
    switch (type) {
      case 'sales_invoices': {
        const invoices = structuredData.orders || [];
        return (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="text-[10px] font-semibold text-slate-700 mb-1">Sales Invoices ({invoices.length})</div>
            {invoices.length > 0 && (
              <div className="overflow-x-auto max-h-[150px] scrollbar-thin">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-100 text-slate-500 font-medium">
                    <tr>
                      <th className="p-1">Invoice</th>
                      <th className="p-1">Customer</th>
                      <th className="p-1">Date</th>
                      <th className="p-1">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.slice(0, 10).map((inv: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-100">
                        <td className="p-1">{inv.DocNum || inv.DocEntry}</td>
                        <td className="p-1">{inv.CardCode}</td>
                        <td className="p-1">{inv.DocDate}</td>
                        <td className="p-1 font-semibold">{money.format(inv.DocTotal || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {invoices.length > 10 && <div className="text-[8px] text-slate-400 mt-1 italic">Showing top 10 of {invoices.length}</div>}
            {renderMetaWarnings()}
          </div>
        );
      }

      case 'sales_returns': {
        const returns = structuredData.returns || [];
        return (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="text-[10px] font-semibold text-slate-700 mb-1">Sales Returns ({returns.length})</div>
            {returns.length > 0 && (
              <div className="overflow-x-auto max-h-[150px] scrollbar-thin">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-100 text-slate-500 font-medium">
                    <tr>
                      <th className="p-1">Return No.</th>
                      <th className="p-1">Customer</th>
                      <th className="p-1">Date</th>
                      <th className="p-1">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returns.slice(0, 10).map((ret: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-100">
                        <td className="p-1">{ret.DocNum || ret.DocEntry}</td>
                        <td className="p-1">{ret.CardCode}</td>
                        <td className="p-1">{ret.DocDate}</td>
                        <td className="p-1 font-semibold">{money.format(ret.DocTotal || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {returns.length > 10 && <div className="text-[8px] text-slate-400 mt-1 italic">Showing top 10 of {returns.length}</div>}
            {renderMetaWarnings()}
          </div>
        );
      }

      case 'inventory_stock': {
        return (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-700">Stock for {structuredData.item_code}</span>
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700 font-bold">{structuredData.stock} units</span>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      case 'inventory_list': {
        const items = structuredData.items || [];
        return (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="text-[10px] font-semibold text-slate-700 mb-1">Inventory Items ({items.length})</div>
            {items.length > 0 && (
              <div className="overflow-x-auto max-h-[150px] scrollbar-thin">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-100 text-slate-500 font-medium">
                    <tr>
                      <th className="p-1">Item Code</th>
                      <th className="p-1 text-right">On-Hand Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.slice(0, 10).map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-100">
                        <td className="p-1">{item.ItemCode}</td>
                        <td className="p-1 text-right font-semibold">{item.QuantityOnStock || item.OnHand || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {items.length > 10 && <div className="text-[8px] text-slate-400 mt-1 italic">Showing top 10 of {items.length}</div>}
            {renderMetaWarnings()}
          </div>
        );
      }

      case 'customers': {
        const customers = structuredData.customers || [];
        return (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="text-[10px] font-semibold text-slate-700 mb-1">Customers ({customers.length})</div>
            {customers.length > 0 && (
              <div className="overflow-x-auto max-h-[150px] scrollbar-thin">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-100 text-slate-500 font-medium">
                    <tr>
                      <th className="p-1">Name</th>
                      <th className="p-1">Code/Mobile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.slice(0, 10).map((cust: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-100">
                        <td className="p-1">{cust.CardName || cust.name || 'Unknown'}</td>
                        <td className="p-1">{cust.CardCode || cust.mobile || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {customers.length > 10 && <div className="text-[8px] text-slate-400 mt-1 italic">Showing top 10 of {customers.length}</div>}
            {renderMetaWarnings()}
          </div>
        );
      }

      case 'production_orders': {
        const orders = structuredData.orders || [];
        const summary = structuredData.summary || {};
        return (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="text-[10px] font-semibold text-slate-700 mb-1">Production Summary</div>
            <div className="grid grid-cols-2 gap-1 mb-2 text-[9px]">
              <div className="bg-slate-50 p-1 rounded border border-slate-100">Planned: <span className="font-semibold">{summary.total_planned || 0}</span></div>
              <div className="bg-slate-50 p-1 rounded border border-slate-100">Produced: <span className="font-semibold text-emerald-600">{summary.total_produced || 0}</span></div>
            </div>
            {orders.length > 0 && (
              <div className="overflow-x-auto max-h-[150px] scrollbar-thin">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-100 text-slate-500 font-medium">
                    <tr>
                      <th className="p-1">Order #</th>
                      <th className="p-1">Item</th>
                      <th className="p-1">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 5).map((ord: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-100">
                        <td className="p-1">{ord.docNum || ord.DocNum}</td>
                        <td className="p-1 truncate max-w-[80px]">{ord.itemCode || ord.ItemCode}</td>
                        <td className="p-1">{ord.status || 'Unknown'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {orders.length > 5 && <div className="text-[8px] text-slate-400 mt-1 italic">Showing 5 of {orders.length}</div>}
            {renderMetaWarnings()}
          </div>
        );
      }

      default:
        return null;
    }
  } catch (err) {
    console.error("Failed to render structured data", err);
    return (
      <div className="mt-2 text-[9px] text-slate-500 border-t border-slate-200 pt-2 italic">
        Structured rendering failed. View the text summary above.
      </div>
    );
  }
};
