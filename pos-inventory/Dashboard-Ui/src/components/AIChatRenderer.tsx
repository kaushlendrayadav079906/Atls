import { useNavigate } from 'react-router-dom';
import {
  TriangleAlert,
  TrendingUp,
  ShoppingCart,
  Package,
  Factory,
  RotateCcw,
  Users,
  CreditCard,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Landmark,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Lock,
  Edit3,
  History,
  Settings,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';
import { RichTableChartRenderer } from './RichTableChartRenderer';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export const AIChatRenderer = ({ structuredData }: { structuredData: any }) => {
  const navigate = useNavigate();

  if (!structuredData) return null;

  // Handle composite cards payload if backend returned multiple cards (excluding finance_summary cards)
  if (structuredData.type !== 'finance_summary' && Array.isArray(structuredData.cards) && structuredData.cards.length > 0) {
    const hasNavInCards = structuredData.cards.some((c: any) => c.type === 'navigation');
    const hasTableInCards = structuredData.cards.some((c: any) => c.type === 'table');
    const shouldRenderRootTable = structuredData.type === 'table' && !hasTableInCards;

    return (
      <div className="flex flex-col gap-2.5 mt-2.5 w-full">
        {shouldRenderRootTable && (
          <SingleCardRenderer card={structuredData} navigate={navigate} />
        )}
        {structuredData.cards.map((card: any, idx: number) => (
          <SingleCardRenderer key={idx} card={card} navigate={navigate} />
        ))}
        {structuredData.navigation && !hasNavInCards && (
          <NavigationActionCard nav={structuredData.navigation} navigate={navigate} />
        )}
      </div>
    );
  }

  return (
    <div className="mt-2.5 w-full">
      <SingleCardRenderer card={structuredData} navigate={navigate} />
      {structuredData.navigation && structuredData.type !== 'navigation' && (
        <div className="mt-2">
          <NavigationActionCard nav={structuredData.navigation} navigate={navigate} />
        </div>
      )}
    </div>
  );
};

const NavigationActionCard = ({ nav, navigate }: { nav: any; navigate: any }) => {
  if (!nav || !nav.route) return null;

  const handleClick = () => {
    let target = nav.route;
    if (nav.params && Object.keys(nav.params).length > 0) {
      const q = new URLSearchParams(nav.params).toString();
      if (q && !target.includes('?')) {
        target = `${target}?${q}`;
      }
    }
    navigate(target);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-indigo-200/90 text-indigo-900 transition-all cursor-pointer shadow-2xs group text-left"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <ExternalLink size={12} />
        </div>
        <div className="truncate">
          <div className="text-[11px] font-bold tracking-tight text-indigo-950">
            {nav.label || 'Open Module'}
          </div>
          <div className="text-[9.5px] text-indigo-600/80 font-mono">
            {nav.route}
          </div>
        </div>
      </div>
      <ChevronRight size={14} className="text-indigo-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
    </button>
  );
};

const SingleCardRenderer = ({ card, navigate }: { card: any; navigate: any }) => {
  if (!card) return null;
  const { type, meta } = card;

  const renderMetaWarnings = () => {
    if (!meta) return null;
    return (
      <div className="mt-2 flex flex-col gap-0.5 rounded-lg bg-amber-50/80 p-2 text-[9px] text-amber-800 border border-amber-200/80">
        {meta.is_partial && (
          <div className="flex items-center gap-1 font-semibold text-amber-900">
            <TriangleAlert className="h-3 w-3 text-amber-600" />
            PARTIAL DATA: Results capped at display limit.
          </div>
        )}
        {meta.is_cached && (
          <div className="flex items-center gap-1 font-semibold text-indigo-900">
            <Sparkles className="h-3 w-3 text-indigo-600" />
            CACHED: Served from high-speed operational cache.
          </div>
        )}
        {meta.date_range && <div>Range: <span className="font-semibold">{meta.date_range}</span></div>}
        {meta.branch_scope && <div>Scope: <span className="font-semibold">{meta.branch_scope}</span></div>}
      </div>
    );
  };

  try {
    switch (type) {
      // ── 0. Generic Structured Analytical Table & Chart ───────────────────
      case 'table': {
        return <RichTableChartRenderer data={card} />;
      }

      // ── 1. Dashboard Summary KPIs ──────────────────────────────────────────
      case 'dashboard_summary': {
        const s = card.summary || {};
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <TrendingUp size={13} className="text-blue-600" />
                Performance Overview
              </span>
              <span className="rounded-full bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 text-[8.5px] font-bold text-indigo-700">
                {s.period || 'Today'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2 text-[10px]">
              <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[8.5px]">Total Sales</div>
                <div className="text-[13px] font-bold text-slate-900 mt-0.5">
                  {money.format(s.total_sales || 0)}
                </div>
                {s.growth_percentage !== undefined && (
                  <div className={`text-[8px] font-semibold mt-0.5 ${s.growth_percentage >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {s.growth_percentage >= 0 ? `+${s.growth_percentage}% growth` : `${s.growth_percentage}% vs prev`}
                  </div>
                )}
              </div>

              <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[8.5px]">Invoices Billed</div>
                <div className="text-[13px] font-bold text-slate-900 mt-0.5">
                  {s.invoice_count || 0}
                </div>
                <div className="text-[8px] text-slate-400 mt-0.5">
                  Avg: {money.format(s.average_order_value || 0)}
                </div>
              </div>

              <div className="bg-amber-50/60 p-2 rounded-lg border border-amber-100/80">
                <div className="text-amber-700 text-[8.5px]">Low Stock Items</div>
                <div className="text-[13px] font-bold text-amber-900 mt-0.5">
                  {s.low_stock_count ?? '-'}
                </div>
                <div className="text-[8px] text-amber-600 mt-0.5">Below minimal threshold</div>
              </div>

              <div className="bg-rose-50/60 p-2 rounded-lg border border-rose-100/80">
                <div className="text-rose-700 text-[8.5px]">Pending Approvals</div>
                <div className="text-[13px] font-bold text-rose-900 mt-0.5">
                  {s.pending_approvals_count ?? 0}
                </div>
                <div className="text-[8px] text-rose-600 mt-0.5">Refund & return requests</div>
              </div>
            </div>

            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 2. Sales Orders ───────────────────────────────────────────────────
      case 'sales_orders': {
        const orders = card.orders || [];
        const summary = card.summary;
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShoppingCart size={13} className="text-blue-600" />
                Sales Orders ({card.total_count ?? orders.length})
              </span>
              <span className="rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[8.5px] font-bold text-blue-700">SAP Orders</span>
            </div>

            {summary && (
              <div className="grid grid-cols-3 gap-1 mb-2 text-[9px]">
                <div className="bg-slate-50 p-1.5 rounded border border-slate-100 text-center">
                  <div className="text-slate-400 text-[8px]">Total</div>
                  <div className="font-bold text-slate-800">{summary.total_orders ?? orders.length}</div>
                </div>
                <div className="bg-amber-50/80 p-1.5 rounded border border-amber-200/60 text-center">
                  <div className="text-amber-700 text-[8px]">Pending</div>
                  <div className="font-bold text-amber-800">{summary.pending_orders ?? '-'}</div>
                </div>
                <div className="bg-emerald-50/80 p-1.5 rounded border border-emerald-200/60 text-center">
                  <div className="text-emerald-700 text-[8px]">Completed</div>
                  <div className="font-bold text-emerald-800">{summary.completed_orders ?? '-'}</div>
                </div>
              </div>
            )}

            {orders.length > 0 && (
              <div className="overflow-x-auto max-h-[160px] scrollbar-thin rounded-lg border border-slate-100">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-1.5">Order #</th>
                      <th className="p-1.5">Customer</th>
                      <th className="p-1.5">Date</th>
                      <th className="p-1.5">Status</th>
                      <th className="p-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 8).map((ord: any, i: number) => {
                      const isCancelled = ord.Cancelled === 'tYES' || ord.cancelled === 'tYES';
                      const isClosed = ord.DocumentStatus === 'bost_Close' || ord.document_status === 'bost_Close';
                      const statusBadge = isCancelled ? (
                        <span className="rounded bg-rose-50 text-rose-600 px-1 py-0.5 text-[8px] font-semibold">Cancelled</span>
                      ) : isClosed ? (
                        <span className="rounded bg-emerald-50 text-emerald-600 px-1 py-0.5 text-[8px] font-semibold">Closed</span>
                      ) : (
                        <span className="rounded bg-amber-50 text-amber-600 px-1 py-0.5 text-[8px] font-semibold">Open</span>
                      );
                      const docDateStr = ord.DocDate ? String(ord.DocDate).split('T')[0] : '-';
                      return (
                        <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="p-1.5 font-bold text-blue-700">{ord.DocNum || ord.doc_num || ord.DocEntry}</td>
                          <td className="p-1.5 truncate max-w-[85px]" title={ord.CardName || ord.card_name}>{ord.CardName || ord.card_name || ord.CardCode}</td>
                          <td className="p-1.5 text-slate-400">{docDateStr}</td>
                          <td className="p-1.5">{statusBadge}</td>
                          <td className="p-1.5 font-bold text-slate-800 text-right">{money.format(ord.DocTotal ?? ord.doc_total ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {orders.length > 8 && <div className="text-[8px] text-slate-400 mt-1 italic">Showing top 8 of {orders.length}</div>}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 3. Purchase Orders ────────────────────────────────────────────────
      case 'purchase_orders': {
        const orders = card.orders || [];
        const summary = card.summary;
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package size={13} className="text-purple-600" />
                Purchase Orders ({card.total_count ?? orders.length})
              </span>
              <span className="rounded-full bg-purple-50 border border-purple-200/80 px-2 py-0.5 text-[8.5px] font-bold text-purple-700">Vendor POs</span>
            </div>

            {summary && (
              <div className="grid grid-cols-3 gap-1 mb-2 text-[9px]">
                <div className="bg-slate-50 p-1.5 rounded border border-slate-100 text-center">
                  <div className="text-slate-400 text-[8px]">Total</div>
                  <div className="font-bold text-slate-800">{summary.total_orders ?? orders.length}</div>
                </div>
                <div className="bg-amber-50/80 p-1.5 rounded border border-amber-200/60 text-center">
                  <div className="text-amber-700 text-[8px]">Pending</div>
                  <div className="font-bold text-amber-800">{summary.pending_orders ?? '-'}</div>
                </div>
                <div className="bg-emerald-50/80 p-1.5 rounded border border-emerald-200/60 text-center">
                  <div className="text-emerald-700 text-[8px]">Received</div>
                  <div className="font-bold text-emerald-800">{summary.received_orders ?? '-'}</div>
                </div>
              </div>
            )}

            {orders.length > 0 && (
              <div className="overflow-x-auto max-h-[160px] scrollbar-thin rounded-lg border border-slate-100">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-1.5">PO #</th>
                      <th className="p-1.5">Supplier</th>
                      <th className="p-1.5">Date</th>
                      <th className="p-1.5">Status</th>
                      <th className="p-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 8).map((ord: any, i: number) => {
                      const isCancelled = ord.Cancelled === 'tYES';
                      const isClosed = ord.DocumentStatus === 'bost_Close';
                      const statusBadge = isCancelled ? (
                        <span className="rounded bg-rose-50 text-rose-600 px-1 py-0.5 text-[8px] font-semibold">Cancelled</span>
                      ) : isClosed ? (
                        <span className="rounded bg-emerald-50 text-emerald-600 px-1 py-0.5 text-[8px] font-semibold">Received</span>
                      ) : (
                        <span className="rounded bg-amber-50 text-amber-600 px-1 py-0.5 text-[8px] font-semibold">Pending</span>
                      );
                      const docDateStr = ord.DocDate ? String(ord.DocDate).split('T')[0] : '-';
                      return (
                        <tr key={i} className="hover:bg-purple-50/30 transition-colors">
                          <td className="p-1.5 font-bold text-purple-700">{ord.DocNum || ord.DocEntry}</td>
                          <td className="p-1.5 truncate max-w-[85px]" title={ord.CardName}>{ord.CardName || ord.CardCode}</td>
                          <td className="p-1.5 text-slate-400">{docDateStr}</td>
                          <td className="p-1.5">{statusBadge}</td>
                          <td className="p-1.5 font-bold text-slate-800 text-right">{money.format(ord.DocTotal || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 4. Sales Invoices ─────────────────────────────────────────────────
      case 'sales_invoices': {
        const invoices = card.orders || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span>Sales Invoices ({card.total_count ?? invoices.length})</span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[8.5px] font-bold text-indigo-600">AR Invoices</span>
            </div>

            {card.total_amount !== undefined && (
              <div className="mb-2 p-1.5 rounded-lg bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-[10px]">
                <span className="text-indigo-800 font-medium">Billed Revenue:</span>
                <span className="text-indigo-950 font-bold">{money.format(card.total_amount)}</span>
              </div>
            )}

            {invoices.length > 0 && (
              <div className="overflow-x-auto max-h-[160px] scrollbar-thin rounded-lg border border-slate-100">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-1.5">Invoice #</th>
                      <th className="p-1.5">Customer</th>
                      <th className="p-1.5">Date</th>
                      <th className="p-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.slice(0, 8).map((inv: any, i: number) => (
                      <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="p-1.5 font-medium text-blue-600">{inv.DocNum || inv.DocEntry}</td>
                        <td className="p-1.5 truncate max-w-[90px]">{inv.CardName || inv.CardCode || 'CASH'}</td>
                        <td className="p-1.5 text-slate-400">{inv.DocDate ? String(inv.DocDate).split('T')[0] : '-'}</td>
                        <td className="p-1.5 font-bold text-slate-800 text-right">{money.format(inv.DocTotal || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {invoices.length > 8 && <div className="text-[8px] text-slate-400 mt-1 italic">Showing top 8 of {invoices.length}</div>}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 5. Inventory Risk & Low Stock ─────────────────────────────────────
      case 'inventory_risk': {
        const items = card.items || [];
        return (
          <div className="rounded-xl border border-amber-200/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-amber-950 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <TriangleAlert size={13} className="text-amber-600" />
                Low Stock Alert ({items.length} items)
              </span>
              <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[8.5px] font-bold">Action Needed</span>
            </div>

            {items.length > 0 && (
              <div className="overflow-x-auto max-h-[160px] scrollbar-thin rounded-lg border border-amber-100">
                <table className="w-full text-left text-[9px] text-slate-700">
                  <thead className="sticky top-0 bg-amber-50 text-amber-900 font-semibold border-b border-amber-200/60">
                    <tr>
                      <th className="p-1.5">Item Code</th>
                      <th className="p-1.5">Name</th>
                      <th className="p-1.5 text-right">In Stock</th>
                      <th className="p-1.5 text-right">Threshold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/60">
                    {items.slice(0, 10).map((itm: any, i: number) => (
                      <tr key={i} className="hover:bg-amber-50/40">
                        <td className="p-1.5 font-bold text-slate-900">{itm.ItemCode || itm.item_code}</td>
                        <td className="p-1.5 truncate max-w-[90px]">{itm.ItemName || itm.name}</td>
                        <td className="p-1.5 text-right font-bold text-rose-600">{itm.QuantityOnStock ?? itm.in_stock ?? 0}</td>
                        <td className="p-1.5 text-right text-slate-500">{itm.MinimalStock ?? itm.minimal_stock ?? 10}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 6. Single Inventory Stock Item ────────────────────────────────────
      case 'inventory_stock': {
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-[11px]">
              <div>
                <span className="font-semibold text-slate-700">Stock for </span>
                <span className="font-bold text-indigo-700">{card.item_code}</span>
              </div>
              <span className="rounded-lg bg-sky-100 border border-sky-200 px-2.5 py-1 text-sky-800 font-bold text-[12px]">
                {card.stock} units
              </span>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 7. Top Selling Products ───────────────────────────────────────────
      case 'top_products': {
        const products = card.products || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                Top Performing Products
              </span>
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 text-[8.5px] font-bold">Velocity</span>
            </div>

            {products.length > 0 && (
              <div className="overflow-x-auto max-h-[160px] scrollbar-thin rounded-lg border border-slate-100">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-1.5">Rank</th>
                      <th className="p-1.5">Product</th>
                      <th className="p-1.5 text-right">Sold Qty</th>
                      <th className="p-1.5 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.slice(0, 8).map((p: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-1.5 font-bold text-indigo-600">#{i + 1}</td>
                        <td className="p-1.5 truncate max-w-[90px]" title={p.itemName}>{p.itemName || p.itemCode}</td>
                        <td className="p-1.5 text-right font-medium text-slate-700">{p.quantitySold}</td>
                        <td className="p-1.5 text-right font-bold text-slate-900">{money.format(p.salesAmount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 8. Production Summary ─────────────────────────────────────────────
      case 'production_summary': {
        const sum = card.summary || {};
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-800 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Factory size={13} className="text-indigo-600" />
                Production Metrics
              </span>
              <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 text-[8.5px] font-bold">SAP Factory</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2 text-[9.5px]">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[8px]">Planned Orders</div>
                <div className="font-bold text-slate-900 text-[12px]">{sum.planned_orders ?? 0}</div>
              </div>
              <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                <div className="text-emerald-700 text-[8px]">Completed Orders</div>
                <div className="font-bold text-emerald-800 text-[12px]">{sum.completed_orders ?? 0}</div>
              </div>
              <div className="bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                <div className="text-blue-700 text-[8px]">Total Produced Qty</div>
                <div className="font-bold text-blue-900 text-[12px]">{sum.total_production ?? 0}</div>
              </div>
              <div className="bg-rose-50/70 p-2 rounded-lg border border-rose-100">
                <div className="text-rose-700 text-[8px]">Rejection Rate</div>
                <div className="font-bold text-rose-800 text-[12px]">{sum.rejection_percentage ?? 0}%</div>
              </div>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 9. Production Orders ──────────────────────────────────────────────
      case 'production_orders': {
        const orders = card.orders || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Factory size={13} className="text-indigo-600" />
                Production Orders ({card.total_count ?? orders.length})
              </span>
              <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 text-[8.5px] font-bold">Batches</span>
            </div>

            {orders.length > 0 && (
              <div className="overflow-x-auto max-h-[160px] scrollbar-thin rounded-lg border border-slate-100">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-1.5">Order #</th>
                      <th className="p-1.5">Item</th>
                      <th className="p-1.5">Status</th>
                      <th className="p-1.5 text-right">Planned</th>
                      <th className="p-1.5 text-right">Produced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 8).map((ord: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-1.5 font-bold text-indigo-700">{ord.production_order_no || ord.docNum || ord.DocNum}</td>
                        <td className="p-1.5 truncate max-w-[85px]">{ord.item_name || ord.item_code || ord.ItemNo}</td>
                        <td className="p-1.5">
                          <span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${ord.status === 'Closed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {ord.status || 'Active'}
                          </span>
                        </td>
                        <td className="p-1.5 text-right text-slate-500">{ord.planned_qty || ord.PlannedQuantity || 0}</td>
                        <td className="p-1.5 text-right font-bold text-emerald-600">{ord.produced_qty || ord.CompletedQuantity || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 10. Production Rejection ──────────────────────────────────────────
      case 'production_rejection': {
        const rej = card.rejection_data || {};
        const items = rej.items || [];
        return (
          <div className="rounded-xl border border-rose-200/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-rose-950 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertCircle size={13} className="text-rose-600" />
                Production Rejection & Scrap
              </span>
              <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[8.5px] font-bold">
                {rej.rejection_percentage ?? 0}% Scrap
              </span>
            </div>

            <div className="mb-2 p-1.5 rounded-lg bg-rose-50/70 border border-rose-100 flex items-center justify-between text-[10px]">
              <span className="text-rose-800">Total Scrapped Quantity:</span>
              <span className="text-rose-950 font-bold">{rej.total_rejection ?? 0} units</span>
            </div>

            {items.length > 0 && (
              <div className="overflow-x-auto max-h-[140px] scrollbar-thin rounded-lg border border-rose-100">
                <table className="w-full text-left text-[9px] text-slate-700">
                  <thead className="sticky top-0 bg-rose-50 text-rose-900 font-semibold border-b border-rose-200/60">
                    <tr>
                      <th className="p-1.5">Item</th>
                      <th className="p-1.5 text-right">Produced</th>
                      <th className="p-1.5 text-right">Rejected</th>
                      <th className="p-1.5 text-right">Scrap %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100/60">
                    {items.slice(0, 8).map((itm: any, i: number) => (
                      <tr key={i} className="hover:bg-rose-50/40">
                        <td className="p-1.5 truncate max-w-[85px] font-medium">{itm.item_name || itm.item_code}</td>
                        <td className="p-1.5 text-right text-slate-500">{itm.produced_qty}</td>
                        <td className="p-1.5 text-right font-bold text-rose-600">{itm.rejected_qty}</td>
                        <td className="p-1.5 text-right font-bold text-rose-700">{itm.rejection_percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 11. Payment Report ────────────────────────────────────────────────
      case 'payment_report': {
        const dist = card.distribution || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CreditCard size={13} className="text-indigo-600" />
                Payment Channels Breakdown
              </span>
              <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 text-[8.5px] font-bold">
                {money.format(card.total_payments || 0)}
              </span>
            </div>

            <div className="space-y-1.5 my-2">
              {dist.map((d: any, i: number) => (
                <div key={i} className="text-[9.5px]">
                  <div className="flex justify-between font-medium text-slate-700 mb-0.5">
                    <span>{d.method}</span>
                    <span className="font-bold text-slate-900">{money.format(d.amount)} ({d.percentage}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, d.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 12. Sales Report with Mini Chart ──────────────────────────────────
      case 'sales_report': {
        const trend = card.trend || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-800 mb-1 flex items-center justify-between">
              <span>Sales Revenue Summary</span>
              <span className="text-indigo-700 font-bold">{money.format(card.total_sales || 0)}</span>
            </div>

            {trend.length > 0 && (
              <div className="h-[90px] w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#64748b' }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`} />
                    <Bar dataKey="sales" fill="#4f46e5" radius={[3, 3, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 13. Customers ─────────────────────────────────────────────────────
      case 'customers': {
        const custs = card.customers || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users size={13} className="text-blue-600" />
                Customer Results ({custs.length})
              </span>
              <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-0.5 text-[8.5px] font-bold">Accounts</span>
            </div>

            {custs.length > 0 && (
              <div className="overflow-x-auto max-h-[150px] scrollbar-thin rounded-lg border border-slate-100">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-1.5">Name</th>
                      <th className="p-1.5">Mobile / Code</th>
                      <th className="p-1.5 text-right">Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {custs.slice(0, 8).map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-1.5 font-bold text-slate-900 truncate max-w-[95px]">{c.name || c.CardName || 'Customer'}</td>
                        <td className="p-1.5 font-mono text-slate-500">{c.mobile || c.CardCode || '-'}</td>
                        <td className="p-1.5 text-right font-medium text-indigo-600">{c.invoiceCount ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 14. Pending Approvals ─────────────────────────────────────────────
      case 'pending_approvals': {
        const apps = card.approvals || [];
        return (
          <div className="rounded-xl border border-rose-200/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-rose-950 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <RotateCcw size={13} className="text-rose-600" />
                Pending Manager Approvals ({apps.length})
              </span>
              <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[8.5px] font-bold">Action Required</span>
            </div>

            {apps.length > 0 && (
              <div className="overflow-x-auto max-h-[140px] scrollbar-thin rounded-lg border border-rose-100">
                <table className="w-full text-left text-[9px] text-slate-700">
                  <thead className="sticky top-0 bg-rose-50 text-rose-900 font-semibold border-b border-rose-200/60">
                    <tr>
                      <th className="p-1.5">Type</th>
                      <th className="p-1.5">Doc #</th>
                      <th className="p-1.5">Reason</th>
                      <th className="p-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100/60">
                    {apps.slice(0, 6).map((a: any, i: number) => (
                      <tr key={i} className="hover:bg-rose-50/40">
                        <td className="p-1.5 font-bold text-rose-700 capitalize">{a.request_type || 'Return'}</td>
                        <td className="p-1.5 font-mono text-slate-600">{a.original_doc_num || a.id?.slice(0, 8)}</td>
                        <td className="p-1.5 truncate max-w-[80px]" title={a.reason}>{a.reason || 'Customer refund'}</td>
                        <td className="p-1.5 text-right font-bold text-slate-900">{money.format(a.amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 15. Standalone Navigation ─────────────────────────────────────────
      case 'navigation': {
        return <NavigationActionCard nav={card.target} navigate={navigate} />;
      }

      // ── 16. SAP Offline Banner ────────────────────────────────────────────
      case 'sap_offline': {
        return (
          <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-rose-900 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-[11px] text-rose-800 mb-1">
              <TriangleAlert className="h-4 w-4 text-rose-600 shrink-0" />
              <span>Live SAP Service Unavailable</span>
            </div>
            <p className="text-[10px] text-rose-700 leading-relaxed">
              {card.message || 'Could not communicate with SAP Service Layer. Displayed figures reflect local cache only where available.'}
            </p>
          </div>
        );
      }

      // ── 17. Finance Summary KPI Grid ───────────────────────────────────────
      case 'finance_summary': {
        const cards = card.cards || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-3 shadow-2xs overflow-hidden">
            <div className="text-[11px] font-bold text-slate-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Landmark size={14} className="text-indigo-600" />
                {card.title || 'Financial Summary Overview'}
              </span>
              <span className="rounded-full bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 text-[8.5px] font-bold text-indigo-700">
                {card.period || 'Live SAP'}
              </span>
            </div>
            {card.summary && (
              <p className="text-[10px] text-slate-600 mb-2.5 leading-relaxed">{card.summary}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {cards.map((c: any, idx: number) => {
                const isCurrency = c.format === 'currency';
                const formattedVal = isCurrency
                  ? money.format(typeof c.value === 'number' ? c.value : parseFloat(c.value || 0))
                  : String(c.value ?? '-');
                return (
                  <div key={idx} className="bg-slate-50/90 p-2 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <div className="text-slate-500 text-[8.5px] truncate font-medium">{c.title}</div>
                      <div className="text-[12px] font-bold text-slate-900 mt-0.5 tracking-tight truncate">
                        {formattedVal}
                      </div>
                    </div>
                    {c.subtitle && (
                      <div className="text-[8px] text-slate-400 mt-1 truncate">{c.subtitle}</div>
                    )}
                  </div>
                );
              })}
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 18. Finance Record Inspection ──────────────────────────────────────
      case 'record_details': {
        const editableFields = Object.entries(card.editable_fields || {});
        const lockedFields = card.locked_fields || [];
        return (
          <div className="rounded-xl border border-blue-200/90 bg-white p-3 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <ShieldCheck size={13} />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-900">
                    {card.entity_type === 'business_partner' ? 'Business Partner' : 'Finance Document'} #{card.doc_num || card.record_id}
                  </div>
                  <div className="text-[8.5px] text-slate-500 capitalize">{card.entity_type?.replace('_', ' ')} • Status: <span className="font-semibold text-slate-700">{card.status || 'Active'}</span></div>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[8.5px] font-bold ${
                card.can_edit ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-slate-100 text-slate-600'
              }`}>
                {card.can_edit ? 'EDITABLE' : 'LOCKED / READ-ONLY'}
              </span>
            </div>

            {/* Editable Fields Summary */}
            <div className="mb-2">
              <div className="text-[9px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Edit3 size={11} className="text-blue-600" /> Permitted Fields ({editableFields.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                {editableFields.map(([key, val]: [string, any]) => (
                  <div key={key} className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[8.5px] text-slate-400 block">{val.label || key}</span>
                    <span className="font-semibold text-slate-800 truncate block">{String(val.current_value ?? '(empty)')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Locked Fields */}
            {lockedFields.length > 0 && (
              <div className="mb-2.5">
                <div className="text-[9px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Lock size={11} className="text-amber-600" /> Locked Accounting Fields ({lockedFields.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {lockedFields.map((f: string) => (
                    <span key={f} className="rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.5 text-[8px] font-medium" title="Immutable to preserve GL audit integrity">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('atls-open-finance-record', {
                  detail: {
                    entity_type: card.entity_type,
                    record_id: card.record_id,
                    doc_num: card.doc_num
                  }
                }));
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-2xs transition cursor-pointer"
            >
              <Edit3 size={12} />
              Open Record Details & Editor
            </button>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 19. Finance Record Update Proposal Diff ─────────────────────────────
      case 'record_proposal': {
        const diff = card.diff || [];
        return (
          <div className="rounded-xl border border-indigo-200/90 bg-white p-3 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <Edit3 size={13} />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-900">
                    Proposed Update: #{card.doc_num || card.record_id}
                  </div>
                  <div className="text-[8.5px] text-slate-500 capitalize">{card.entity_type?.replace('_', ' ')} • Review Required</div>
                </div>
              </div>
              <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 text-[8.5px] font-bold">
                PENDING APPROVAL
              </span>
            </div>

            {/* Diff table */}
            <div className="overflow-x-auto rounded-lg border border-slate-100 mb-2.5">
              <table className="w-full text-left text-[9.5px]">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/70">
                  <tr>
                    <th className="p-1.5">Field</th>
                    <th className="p-1.5">Current Value</th>
                    <th className="p-1.5">Proposed Value</th>
                    <th className="p-1.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {diff.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="p-1.5 font-bold text-slate-800">{item.label || item.field}</td>
                      <td className="p-1.5 text-slate-500 font-mono">{String(item.old_value ?? '—')}</td>
                      <td className="p-1.5 text-blue-700 font-bold font-mono bg-blue-50/40">{String(item.new_value ?? '—')}</td>
                      <td className="p-1.5 text-right">
                        {item.permitted ? (
                          <span className="text-emerald-700 font-bold text-[8.5px] bg-emerald-50 px-1.5 py-0.5 rounded">Permitted</span>
                        ) : (
                          <span className="text-rose-700 font-bold text-[8.5px] bg-rose-50 px-1.5 py-0.5 rounded">Locked / Denied</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {card.has_permitted_changes ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('atls-open-finance-record', {
                      detail: {
                        entity_type: card.entity_type,
                        record_id: card.record_id,
                        doc_num: card.doc_num,
                        proposed_updates: diff.reduce((acc: any, d: any) => ({ ...acc, [d.field]: d.new_value }), {})
                      }
                    }));
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-2xs transition cursor-pointer"
                >
                  <ShieldCheck size={12} />
                  Review & Confirm for SAP
                </button>
              </div>
            ) : (
              <div className="text-[9px] text-rose-600 font-medium bg-rose-50 p-2 rounded-lg border border-rose-100">
                All proposed fields are locked by SAP business rules or restricted for your role.
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 20. Finance Record Submission Result ────────────────────────────────
      case 'record_submission': {
        const isSuccess = card.status === 'success';
        return (
          <div className={`rounded-xl border p-3 shadow-2xs overflow-hidden ${
            isSuccess ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {isSuccess ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                  <CheckCircle2 size={16} />
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">
                  <XCircle size={16} />
                </div>
              )}
              <div>
                <div className={`text-[12px] font-bold ${isSuccess ? 'text-emerald-950' : 'text-rose-950'}`}>
                  {isSuccess ? 'SAP Write-Back Succeeded' : 'SAP Submission Failed'}
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                  Doc: #{card.doc_num || card.record_id} • Audit ID: {card.audit_id || 'N/A'}
                </div>
              </div>
            </div>

            {isSuccess ? (
              <div className="text-[10px] text-emerald-900 space-y-1">
                <p>Changes successfully verified and recorded in SAP Business One Service Layer.</p>
                {Array.isArray(card.fields_updated) && card.fields_updated.length > 0 && (
                  <div className="text-[8.5px] text-emerald-800 font-mono bg-white/80 p-1.5 rounded border border-emerald-100">
                    Updated fields: {card.fields_updated.join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-rose-800 bg-white/90 p-2 rounded border border-rose-100">
                {card.error || 'The update was rejected by SAP Business One Service Layer.'}
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 21. Finance Audit Log ───────────────────────────────────────────────
      case 'audit_log': {
        const entries = card.entries || [];
        return (
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900">
                <History size={13} className="text-indigo-600" />
                Finance Audit Log ({card.total_entries || entries.length} events)
              </span>
              <span className="text-[8.5px] font-mono text-slate-400">Governance & Compliance</span>
            </div>
            <div className="overflow-x-auto max-h-48 rounded-lg border border-slate-100">
              <table className="w-full text-left text-[9px]">
                <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="p-1">Time</th>
                    <th className="p-1">User</th>
                    <th className="p-1">Entity</th>
                    <th className="p-1">Doc #</th>
                    <th className="p-1 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.slice(0, 8).map((e: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-1 font-mono text-slate-500">{e.timestamp?.slice(11, 19) || 'Just now'}</td>
                      <td className="p-1 font-semibold text-slate-800">{e.user_id || 'admin'}</td>
                      <td className="p-1 capitalize text-slate-600">{e.entity_type?.replace('_', ' ')}</td>
                      <td className="p-1 font-mono text-slate-700">{e.doc_num || e.record_id}</td>
                      <td className="p-1 text-right">
                        <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                          e.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 22. Finance Admin Settings ──────────────────────────────────────────
      case 'admin_settings': {
        const s = card.settings || {};
        return (
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900">
                <Settings size={13} className="text-slate-700" />
                Finance Assistant Admin Settings
              </span>
              <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ACTIVE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[9.5px] mb-2">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[8px]">Assistant Status</div>
                <div className="font-bold text-emerald-700">{s.assistant_enabled ? 'Enabled' : 'Disabled'}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[8px]">SAP Connection</div>
                <div className="font-bold text-slate-800">{s.sap_connection?.status || 'Online'}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[8px]">Permitted Roles</div>
                <div className="font-bold text-slate-800">{(s.permitted_roles || []).join(', ')}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[8px]">Audit Logging</div>
                <div className="font-bold text-slate-800">{s.audit_logging_enabled ? 'Strict GL' : 'Off'}</div>
              </div>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 23. Finance Refreshed Notification ──────────────────────────────────
      case 'finance_refreshed': {
        return (
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/80 p-2.5 text-emerald-900 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-emerald-600" />
              <div className="text-[10.5px] font-bold">Finance Data Refreshed</div>
            </div>
            <span className="text-[8.5px] font-mono text-emerald-700">{card.refreshed_at?.slice(11, 19) || 'Just now'}</span>
          </div>
        );
      }

      default:
        return null;
    }
  } catch (err) {
    console.error('Failed to render structured card', err);
    return null;
  }
};
