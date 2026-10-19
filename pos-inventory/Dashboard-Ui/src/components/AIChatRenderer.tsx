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
  FileText,
  FileSpreadsheet,
  UserCheck,
} from 'lucide-react';
import { RichTableChartRenderer } from './RichTableChartRenderer';
import { BusinessFlowchartRenderer } from './BusinessFlowchartRenderer';
import { EmailDraftCard } from './EmailDraftCard';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN');

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
  const actualNav = nav?.target || nav;
  if (!actualNav || !actualNav.route) return null;

  const handleClick = () => {
    let target = actualNav.route;
    if (actualNav.params && Object.keys(actualNav.params).length > 0) {
      const q = new URLSearchParams(actualNav.params).toString();
      if (q) {
        target = target.includes('?') ? `${target}&${q}` : `${target}?${q}`;
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
            {actualNav.label || 'Open Module'}
          </div>
          <div className="text-[9.5px] text-indigo-600/80 font-mono">
            {actualNav.route}
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

      // ── Process Flowchart ────────────────────────────────────────────────
      case 'flowchart': {
        return <BusinessFlowchartRenderer data={card.flowchart || card} />;
      }

      // ── Smart Email Assistant Draft ──────────────────────────────────────
      case 'email_draft': {
        return <EmailDraftCard card={card} />;
      }

      // ── Navigation Action ────────────────────────────────────────────────
      case 'navigation': {
        return <NavigationActionCard nav={card} navigate={navigate} />;
      }

      // ── SAP Offline Status ───────────────────────────────────────────────
      case 'sap_offline': {
        return (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-[11px] text-rose-900 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertCircle size={15} className="text-rose-600" />
              <span>Live SAP Service Unavailable</span>
            </div>
            <p className="mt-1 text-[10.5px] text-rose-700 leading-relaxed">
              {card.message || 'Unable to connect to SAP Business One. Real-time data is currently unavailable. Please check backend SAP connectivity.'}
            </p>
          </div>
        );
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
        const totalCount = card.total_count ?? orders.length;

        const tableData = {
          type: 'table' as const,
          title: `Sales Orders (${totalCount})`,
          summary: card.summary_text || `Live customer commitments from SAP Sales Orders (${orders.length} orders retrieved).`,
          columns: [
            { key: 'docNum', label: 'Order #', type: 'string' as const },
            { key: 'customer', label: 'Customer', type: 'string' as const },
            { key: 'docDate', label: 'Date', type: 'date' as const },
            { key: 'status', label: 'Status', type: 'string' as const },
            { key: 'total', label: 'Total Amount', type: 'currency' as const },
          ],
          rows: orders.map((ord: any) => ({
            docNum: String(ord.DocNum || ord.doc_num || ord.DocEntry || ''),
            customer: ord.CardName || ord.card_name || ord.CardCode || 'CASH',
            docDate: ord.DocDate ? String(ord.DocDate).split('T')[0] : '-',
            status: ord.Cancelled === 'tYES' || ord.cancelled === 'tYES' ? 'Cancelled' : (ord.DocumentStatus === 'bost_Close' || ord.document_status === 'bost_Close' ? 'Closed' : 'Open'),
            total: Number(ord.DocTotal ?? ord.doc_total ?? 0),
          })),
          kpis: summary ? [
            { label: 'Total Orders', value: summary.total_orders ?? totalCount },
            { label: 'Pending Orders', value: summary.pending_orders ?? 0 },
            { label: 'Completed Orders', value: summary.completed_orders ?? 0 },
          ] : [
            { label: 'Total Orders', value: totalCount },
            { label: 'Total Value', value: money.format(orders.reduce((acc: number, o: any) => acc + (Number(o.DocTotal ?? o.doc_total ?? 0) || 0), 0)) }
          ],
          chart: orders.length > 0 ? {
            type: 'bar' as const,
            xKey: 'customer',
            series: [{ dataKey: 'total', name: 'Order Total (₹)', color: '#2563eb' }],
            defaultView: 'both' as const,
          } : undefined,
          insights: card.insights || (orders.length > 0 ? [
            `Evaluated ${orders.length} customer sales orders totaling ${money.format(orders.reduce((acc: number, o: any) => acc + (Number(o.DocTotal ?? o.doc_total ?? 0) || 0), 0))}.`,
            `Leading customer in this batch: ${orders[0].CardName || orders[0].card_name || 'Customer'}.`
          ] : []),
          meta: card.meta,
        };

        return (
          <div className="flex flex-col gap-2">
            <RichTableChartRenderer data={tableData} />
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => navigate('/sales-orders')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/90 hover:bg-blue-100/90 border border-blue-200/80 text-[11px] font-bold text-blue-700 transition cursor-pointer shadow-3xs"
              >
                <ShoppingCart size={12} className="text-blue-600" />
                <span>Open Sales Orders</span>
                <ChevronRight size={11} className="text-blue-500" />
              </button>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 3. Purchase Orders ────────────────────────────────────────────────
      case 'purchase_orders': {
        const orders = card.orders || [];
        const summary = card.summary;
        const totalCount = card.total_count ?? orders.length;

        const tableData = {
          type: 'table' as const,
          title: `Purchase Orders (${totalCount})`,
          summary: card.summary_text || `Live procurement commitments from SAP Purchase Orders (${orders.length} vendor orders retrieved).`,
          columns: [
            { key: 'docNum', label: 'PO #', type: 'string' as const },
            { key: 'supplier', label: 'Supplier', type: 'string' as const },
            { key: 'docDate', label: 'Date', type: 'date' as const },
            { key: 'status', label: 'Status', type: 'string' as const },
            { key: 'total', label: 'Total Amount', type: 'currency' as const },
          ],
          rows: orders.map((ord: any) => ({
            docNum: String(ord.DocNum || ord.DocEntry || ''),
            supplier: ord.CardName || ord.CardCode || 'Supplier',
            docDate: ord.DocDate ? String(ord.DocDate).split('T')[0] : '-',
            status: ord.Cancelled === 'tYES' ? 'Cancelled' : (ord.DocumentStatus === 'bost_Close' ? 'Received' : 'Pending'),
            total: Number(ord.DocTotal || 0),
          })),
          kpis: summary ? [
            { label: 'Total POs', value: summary.total_orders ?? totalCount },
            { label: 'Pending', value: summary.pending_orders ?? 0 },
            { label: 'Received', value: summary.received_orders ?? 0 },
          ] : [
            { label: 'Total POs', value: totalCount },
            { label: 'Total Value', value: money.format(orders.reduce((acc: number, o: any) => acc + (Number(o.DocTotal) || 0), 0)) }
          ],
          chart: orders.length > 0 ? {
            type: 'bar' as const,
            xKey: 'supplier',
            series: [{ dataKey: 'total', name: 'PO Total (₹)', color: '#8b5cf6' }],
            defaultView: 'both' as const,
          } : undefined,
          insights: card.insights || (orders.length > 0 ? [
            `Total vendor procurement in this batch: ${money.format(orders.reduce((acc: number, o: any) => acc + (Number(o.DocTotal) || 0), 0))} across ${orders.length} orders.`,
            `Primary vendor: ${orders[0].CardName || orders[0].CardCode || 'Supplier'}.`
          ] : []),
          meta: card.meta,
        };

        return (
          <div className="flex flex-col gap-2">
            <RichTableChartRenderer data={tableData} />
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => navigate('/purchase-orders')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50/90 hover:bg-purple-100/90 border border-purple-200/80 text-[11px] font-bold text-purple-700 transition cursor-pointer shadow-3xs"
              >
                <Package size={12} className="text-purple-600" />
                <span>Open Purchase Orders</span>
                <ChevronRight size={11} className="text-purple-500" />
              </button>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 4. Sales Invoices ─────────────────────────────────────────────────
      case 'sales_invoices': {
        const invoices = card.orders || [];
        const totalCount = card.total_count ?? invoices.length;
        const totalBilled = card.total_amount !== undefined ? Number(card.total_amount) : invoices.reduce((acc: number, inv: any) => acc + (Number(inv.DocTotal) || 0), 0);

        const tableData = {
          type: 'table' as const,
          title: `Sales Invoices (${totalCount})`,
          summary: `Live Accounts Receivable invoices from SAP (${invoices.length} billed invoices retrieved).`,
          columns: [
            { key: 'docNum', label: 'Invoice #', type: 'string' as const },
            { key: 'customer', label: 'Customer', type: 'string' as const },
            { key: 'docDate', label: 'Date', type: 'date' as const },
            { key: 'total', label: 'Total Amount', type: 'currency' as const },
          ],
          rows: invoices.map((inv: any) => ({
            docNum: String(inv.DocNum || inv.DocEntry || ''),
            customer: inv.CardName || inv.CardCode || 'CASH',
            docDate: inv.DocDate ? String(inv.DocDate).split('T')[0] : '-',
            total: Number(inv.DocTotal || 0),
          })),
          kpis: [
            { label: 'Invoices Count', value: totalCount },
            { label: 'Billed Revenue', value: money.format(totalBilled), isPositive: true },
          ],
          chart: invoices.length > 0 ? {
            type: 'bar' as const,
            xKey: 'customer',
            series: [{ dataKey: 'total', name: 'Invoice Total (₹)', color: '#4f46e5' }],
            defaultView: 'both' as const,
          } : undefined,
          insights: card.insights || (invoices.length > 0 ? [
            `Total billed revenue: ${money.format(totalBilled)} across ${invoices.length} invoices.`,
            `Leading invoice customer: ${invoices[0].CardName || invoices[0].CardCode || 'CASH'}.`
          ] : []),
          meta: card.meta,
        };

        return (
          <div className="flex flex-col gap-2">
            <RichTableChartRenderer data={tableData} />
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => navigate('/sales')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/90 hover:bg-indigo-100/90 border border-indigo-200/80 text-[11px] font-bold text-indigo-700 transition cursor-pointer shadow-3xs"
              >
                <FileSpreadsheet size={12} className="text-indigo-600" />
                <span>Open Sales Invoices</span>
                <ChevronRight size={11} className="text-indigo-500" />
              </button>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 5. Inventory Risk & Low Stock ─────────────────────────────────────
      case 'inventory_risk': {
        const items = card.items || [];
        const count = card.total_count ?? items.length;

        const tableData = {
          type: 'table' as const,
          title: `Low Stock Alert (${count} ${count === 1 ? 'item' : 'items'})`,
          summary: card.summary || `Live stock alert from SAP warehouse records: ${items.length} product(s) at or below safety reorder threshold.`,
          columns: [
            { key: 'itemCode', label: 'Item Code', type: 'string' as const },
            { key: 'name', label: 'Product Name', type: 'string' as const },
            { key: 'inStock', label: 'Current Stock', type: 'number' as const },
            { key: 'minStock', label: 'Min Threshold', type: 'number' as const },
            { key: 'warehouse', label: 'Warehouse', type: 'string' as const },
          ],
          rows: items.map((itm: any) => ({
            itemCode: itm.ItemCode || itm.item_code || '',
            name: itm.ItemName || itm.name || itm.ItemCode || itm.item_code || '',
            inStock: Number(itm.QuantityOnStock ?? itm.in_stock ?? 0),
            minStock: Number(itm.MinimalStock ?? itm.minimal_stock ?? 10),
            warehouse: itm.WarehouseCode || itm.warehouse || card.meta?.warehouse || 'SH',
          })),
          kpis: [
            { label: 'Low Stock Items', value: count, isPositive: false, subtext: 'Action required' },
            { label: 'Out of Stock (0 units)', value: items.filter((i: any) => Number(i.QuantityOnStock ?? i.in_stock ?? 0) <= 0).length, isPositive: false, subtext: 'Stockout risk' },
            { label: 'Warehouse', value: card.meta?.warehouse || 'SH', subtext: 'Scope' }
          ],
          chart: items.length > 0 ? {
            type: 'bar' as const,
            xKey: 'name',
            series: [
              { dataKey: 'inStock', name: 'In Stock (Units)', color: '#ef4444' },
              { dataKey: 'minStock', name: 'Min Threshold', color: '#94a3b8' },
            ],
            defaultView: 'both' as const,
          } : undefined,
          insights: card.insights || (items.length > 0 ? [
            `Identified ${items.length} inventory products requiring replenishment in warehouse ${card.meta?.warehouse || 'SH'}.`,
            `Lowest stock item is ${items[0].ItemName || items[0].name || items[0].ItemCode} with ${items[0].QuantityOnStock ?? items[0].in_stock ?? 0} units available.`
          ] : ['All monitored products are currently above minimum safety stock thresholds.']),
          meta: card.meta,
        };

        return (
          <div className="flex flex-col gap-2">
            <RichTableChartRenderer data={tableData} />
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => navigate('/products?low_stock=true')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/90 hover:bg-amber-100/90 border border-amber-200/80 text-[11px] font-bold text-amber-800 transition cursor-pointer shadow-3xs"
              >
                <TriangleAlert size={12} className="text-amber-600" />
                <span>Open Low Stock Inventory</span>
                <ChevronRight size={11} className="text-amber-500" />
              </button>
            </div>
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
        const isQtyRanking = card.meta?.ranking_by === 'quantity';
        const rankMetricLabel = isQtyRanking ? 'Quantity Sold (Units)' : 'Sales Revenue (₹)';
        const topProduct = products[0];
        const totalTopRevenue = products.reduce((acc: number, p: any) => acc + (Number(p.salesAmount) || 0), 0);
        const totalTopQty = products.reduce((acc: number, p: any) => acc + (Number(p.quantitySold) || 0), 0);
        const leadShare = totalTopRevenue > 0 && topProduct ? Math.round((Number(topProduct.salesAmount) / totalTopRevenue) * 100) : 0;

        const tableData = {
          type: 'table' as const,
          title: card.title || (isQtyRanking ? 'Top Performing Products by Quantity' : 'Top Performing Products by Sales'),
          summary: card.summary || `Top ${products.length} products ranked by ${isQtyRanking ? 'total units sold' : 'total sales revenue'}.`,
          columns: [
            { key: 'rank', label: 'Rank', type: 'string' as const },
            { key: 'itemName', label: 'Product Name', type: 'string' as const },
            { key: 'itemCode', label: 'Item Code', type: 'string' as const },
            { key: 'quantitySold', label: 'Qty Sold', type: 'number' as const },
            { key: 'salesAmount', label: 'Total Revenue', type: 'currency' as const },
          ],
          rows: products.map((p: any, i: number) => ({
            rank: `#${i + 1}`,
            itemName: p.itemName || p.itemCode,
            itemCode: p.itemCode,
            quantitySold: Number(p.quantitySold || 0),
            salesAmount: Number(p.salesAmount || 0),
          })),
          kpis: card.kpis || [
            {
              label: isQtyRanking ? 'Top Product by Units' : 'Top Product by Revenue',
              value: topProduct ? (topProduct.itemName || topProduct.itemCode) : '-',
              subtext: isQtyRanking ? `${topProduct?.quantitySold || 0} units` : money.format(topProduct?.salesAmount || 0),
              isPositive: true,
            },
            {
              label: isQtyRanking ? 'Total Units Sold' : 'Total Top Revenue',
              value: isQtyRanking ? numberFormatter.format(totalTopQty) : money.format(totalTopRevenue),
              subtext: `Top ${products.length} catalog items`,
            },
            {
              label: 'Leading Share',
              value: `${leadShare}%`,
              subtext: 'Of top products total',
              isPositive: true,
            }
          ],
          filters: {
            period: card.meta?.date_range || 'Recent Invoices',
            additional: {
              'Ranking Metric': rankMetricLabel,
              'Branch Scope': card.meta?.branch_scope || 'All Branches',
              'Source': 'SAP Invoices'
            }
          },
          chart: {
            type: 'horizontal_bar' as const,
            xKey: 'itemName',
            series: [{
              dataKey: isQtyRanking ? 'quantitySold' : 'salesAmount',
              name: isQtyRanking ? 'Units Sold' : 'Revenue (₹)',
              color: isQtyRanking ? '#06b6d4' : '#4f46e5'
            }],
            defaultView: 'both' as const
          },
          insights: card.insights || (topProduct ? [
            `Leading item: ${topProduct.itemName || topProduct.itemCode} accounts for ${leadShare}% of top product revenue (${money.format(topProduct.salesAmount || 0)} across ${numberFormatter.format(topProduct.quantitySold || 0)} units).`,
            `Total sales across the top ${products.length} products reached ${money.format(totalTopRevenue)} for ${card.meta?.date_range || 'recent period'}.`
          ] : []),
          meta: card.meta
        };

        return (
          <div className="flex flex-col gap-2">
            <RichTableChartRenderer data={tableData} />
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/90 hover:bg-blue-100/90 border border-blue-200/80 text-[11px] font-bold text-blue-700 transition cursor-pointer shadow-3xs"
              >
                <Package size={12} className="text-blue-600" />
                <span>Open Products Catalog</span>
                <ChevronRight size={11} className="text-blue-500" />
              </button>
            </div>
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
        const summary = card.summary || {};
        const totalCount = card.total_count ?? orders.length;

        const tableData = {
          type: 'table' as const,
          title: `Production Orders (${totalCount})`,
          summary: card.summary_text || `Live SAP batch records: ${orders.length} production order(s) retrieved.`,
          columns: [
            { key: 'orderNo', label: 'Order #', type: 'string' as const },
            { key: 'item', label: 'Item Name', type: 'string' as const },
            { key: 'status', label: 'Status', type: 'string' as const },
            { key: 'planned', label: 'Planned Qty', type: 'number' as const },
            { key: 'produced', label: 'Produced Qty', type: 'number' as const },
            { key: 'pending', label: 'Pending Qty', type: 'number' as const },
            { key: 'dueDate', label: 'Due Date', type: 'date' as const },
          ],
          rows: orders.map((ord: any) => ({
            orderNo: String(ord.production_order_no || ord.docNum || ord.DocNum || ''),
            item: ord.item_name || ord.item_code || ord.ItemNo || 'Batch Item',
            status: ord.status || 'Active',
            planned: Number(ord.planned_qty || ord.PlannedQuantity || 0),
            produced: Number(ord.produced_qty || ord.CompletedQuantity || 0),
            pending: Number(ord.pending_qty ?? Math.max(0, (ord.planned_qty || ord.PlannedQuantity || 0) - (ord.produced_qty || ord.CompletedQuantity || 0))),
            dueDate: ord.due_date ? String(ord.due_date).split('T')[0] : '-',
          })),
          kpis: [
            { label: 'Total Orders', value: totalCount },
            { label: 'Planned Batches', value: summary.planned_orders ?? orders.filter((o: any) => o.status === 'Planned' || o.status === 'Active').length },
            { label: 'Completed', value: summary.completed_orders ?? orders.filter((o: any) => o.status === 'Closed').length },
          ],
          chart: orders.length > 0 ? {
            type: 'bar' as const,
            xKey: 'item',
            series: [
              { dataKey: 'planned', name: 'Planned Qty', color: '#6366f1' },
              { dataKey: 'produced', name: 'Produced Qty', color: '#10b981' },
            ],
            defaultView: 'both' as const,
          } : undefined,
          insights: card.insights || (orders.length > 0 ? [
            `Total planned production volume across these ${orders.length} batches is ${numberFormatter.format(orders.reduce((acc: number, o: any) => acc + Number(o.planned_qty || o.PlannedQuantity || 0), 0))} units.`,
            `Total produced to date: ${numberFormatter.format(orders.reduce((acc: number, o: any) => acc + Number(o.produced_qty || o.CompletedQuantity || 0), 0))} units.`,
          ] : ['No pending production orders found for the applied warehouse.']),
          meta: card.meta,
        };

        return (
          <div className="flex flex-col gap-2">
            <RichTableChartRenderer data={tableData} />
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => navigate('/production/orders')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/90 hover:bg-indigo-100/90 border border-indigo-200/80 text-[11px] font-bold text-indigo-700 transition cursor-pointer shadow-3xs"
              >
                <Factory size={12} className="text-indigo-600" />
                <span>Open Production Orders</span>
                <ChevronRight size={11} className="text-indigo-500" />
              </button>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 10. Production Rejection ──────────────────────────────────────────
      case 'production_rejection': {
        const rej = card.rejection_data || {};
        const items = rej.items || [];

        const tableData = {
          type: 'table' as const,
          title: `Production Rejection & Scrap (${rej.rejection_percentage ?? 0}% Scrap)`,
          summary: `SAP Quality & Scrap records: Total scrapped quantity is ${rej.total_rejection ?? 0} units across ${items.length} manufactured items.`,
          columns: [
            { key: 'item', label: 'Item', type: 'string' as const },
            { key: 'produced', label: 'Produced Qty', type: 'number' as const },
            { key: 'rejected', label: 'Rejected Qty', type: 'number' as const },
            { key: 'scrapRate', label: 'Scrap Rate', type: 'percentage' as const },
          ],
          rows: items.map((itm: any) => ({
            item: itm.item_name || itm.item_code || 'Item',
            produced: Number(itm.produced_qty || 0),
            rejected: Number(itm.rejected_qty || 0),
            scrapRate: Number(itm.rejection_percentage || 0),
          })),
          kpis: [
            { label: 'Overall Scrap Rate', value: `${rej.rejection_percentage ?? 0}%`, isPositive: false, subtext: 'Factory-wide' },
            { label: 'Scrapped Units', value: numberFormatter.format(rej.total_rejection ?? 0), isPositive: false, subtext: 'Lost volume' },
            { label: 'Total Produced', value: numberFormatter.format(rej.total_production ?? 0), subtext: 'Total batch units' },
          ],
          chart: items.length > 0 ? {
            type: 'bar' as const,
            xKey: 'item',
            series: [
              { dataKey: 'scrapRate', name: 'Scrap Rate (%)', color: '#f43f5e' },
              { dataKey: 'rejected', name: 'Rejected Units', color: '#fb7185' },
            ],
            defaultView: 'both' as const,
          } : undefined,
          insights: card.insights || (items.length > 0 ? [
            `Highest scrap rate: ${items[0].item_name || items[0].item_code} with ${items[0].rejection_percentage}% rejection (${items[0].rejected_qty} units lost).`,
            `Overall factory scrap rate stands at ${rej.rejection_percentage ?? 0}%.`,
          ] : ['No rejection or scrap records found.']),
          meta: card.meta,
        };

        return (
          <div className="flex flex-col gap-2">
            <RichTableChartRenderer data={tableData} />
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => navigate('/production/rejection')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50/90 hover:bg-rose-100/90 border border-rose-200/80 text-[11px] font-bold text-rose-800 transition cursor-pointer shadow-3xs"
              >
                <AlertCircle size={12} className="text-rose-600" />
                <span>Open Production Rejection</span>
                <ChevronRight size={11} className="text-rose-500" />
              </button>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 11. Payment Report ────────────────────────────────────────────────
      case 'payment_report': {
        const dist = card.distribution || [];
        const totalPayments = Number(card.total_payments || 0);

        const tableData = {
          type: 'table' as const,
          title: `Payment Channels Breakdown`,
          summary: card.summary || `Live collections distribution from SAP incoming payments totaling ${money.format(totalPayments)}.`,
          columns: [
            { key: 'method', label: 'Payment Method', type: 'string' as const },
            { key: 'amount', label: 'Amount Collected', type: 'currency' as const },
            { key: 'percentage', label: 'Share (%)', type: 'percentage' as const },
          ],
          rows: dist.map((d: any) => ({
            method: d.method,
            amount: Number(d.amount || 0),
            percentage: Number(d.percentage || 0),
          })),
          kpis: [
            { label: 'Total Collections', value: money.format(totalPayments), isPositive: true },
            { label: 'Payment Channels', value: dist.length },
            { label: 'Leading Method', value: dist[0] ? dist[0].method : '-', subtext: dist[0] ? `${dist[0].percentage}% share` : undefined },
          ],
          chart: dist.length > 0 ? {
            type: 'pie' as const,
            xKey: 'method',
            series: ['amount'],
            defaultView: 'both' as const,
          } : undefined,
          insights: card.insights || (dist.length > 0 ? [
            `Top payment method is ${dist[0].method} collecting ${money.format(dist[0].amount)} (${dist[0].percentage}% of total revenue).`,
            `Total payments analyzed: ${money.format(totalPayments)} across ${dist.length} channels.`,
          ] : []),
          meta: card.meta,
        };

        return (
          <div className="flex flex-col gap-2">
            <RichTableChartRenderer data={tableData} />
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => navigate('/reports/payment')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/90 hover:bg-indigo-100/90 border border-indigo-200/80 text-[11px] font-bold text-indigo-700 transition cursor-pointer shadow-3xs"
              >
                <CreditCard size={12} className="text-indigo-600" />
                <span>Open Payment Reports</span>
                <ChevronRight size={11} className="text-indigo-500" />
              </button>
            </div>
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 12. Sales Report with Chart ───────────────────────────────────────
      case 'sales_report': {
        const trend = card.trend || [];
        const totalSales = Number(card.total_sales || 0);

        const tableData = {
          type: 'table' as const,
          title: `Sales Revenue Summary`,
          summary: `Sales revenue totaling ${money.format(totalSales)} across ${card.invoice_count || 0} invoices.`,
          columns: [
            { key: 'label', label: 'Period', type: 'string' as const },
            { key: 'sales', label: 'Sales Revenue', type: 'currency' as const },
          ],
          rows: trend.map((t: any) => ({
            label: t.label,
            sales: Number(t.sales || 0),
          })),
          kpis: [
            { label: 'Total Sales', value: money.format(totalSales), isPositive: true },
            { label: 'Invoice Count', value: card.invoice_count || 0 },
          ],
          chart: trend.length > 0 ? {
            type: 'bar' as const,
            xKey: 'label',
            series: [{ dataKey: 'sales', name: 'Sales Revenue (₹)', color: '#4f46e5' }],
            defaultView: 'both' as const,
          } : undefined,
          insights: card.insights || (trend.length > 0 ? [
            `Analyzed ${trend.length} sales periods totaling ${money.format(totalSales)}.`,
          ] : []),
          meta: card.meta,
        };

        return (
          <div className="flex flex-col gap-2">
            <RichTableChartRenderer data={tableData} />
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => navigate('/reports/sales')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/90 hover:bg-indigo-100/90 border border-indigo-200/80 text-[11px] font-bold text-indigo-700 transition cursor-pointer shadow-3xs"
              >
                <TrendingUp size={12} className="text-indigo-600" />
                <span>Open Sales Reports</span>
                <ChevronRight size={11} className="text-indigo-500" />
              </button>
            </div>
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

      // ── 24. Admin User & Role Intelligence ──────────────────────────────────
      case 'admin_users_info':
      case 'admin_user_info': {
        const users = card.users || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-900 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users size={13} className="text-indigo-600" />
                Administrative User Directory ({card.total_matching ?? users.length})
              </span>
              <span className="rounded-full bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 text-[8.5px] font-bold text-indigo-700">
                RBAC Access
              </span>
            </div>

            {card.query && (
              <div className="text-[9px] text-slate-500 mb-2">
                Matching: <span className="font-semibold text-slate-700">{card.query}</span>
                {card.feature_filter && <span> • Filtered by: <span className="font-semibold text-indigo-600">{card.feature_filter}</span></span>}
              </div>
            )}

            {users.length > 0 ? (
              <div className="overflow-x-auto max-h-[160px] scrollbar-thin rounded-lg border border-slate-100">
                <table className="w-full text-left text-[9px] text-slate-600">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-1.5">User</th>
                      <th className="p-1.5">Role</th>
                      <th className="p-1.5">Branch</th>
                      <th className="p-1.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.slice(0, 10).map((u: any, i: number) => (
                      <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="p-1.5 font-bold text-slate-900">
                          {u.full_name || u.username}
                          <div className="text-[8px] font-normal text-slate-400 font-mono">{u.email || u.username}</div>
                        </td>
                        <td className="p-1.5">
                          <span className="rounded bg-indigo-50 text-indigo-700 px-1 py-0.5 text-[8px] font-bold capitalize">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-1.5 font-mono text-slate-500">{u.branch_id || 'All'}</td>
                        <td className="p-1.5 text-right">
                          <span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-[9.5px] text-slate-500 p-2 text-center bg-slate-50 rounded-lg">
                No employees found matching the specified criteria.
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 25. My Effective Permissions ─────────────────────────────────────────
      case 'my_permissions': {
        const perms = card.permissions || [];
        const modules = card.permitted_modules || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-900 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserCheck size={13} className="text-emerald-600" />
                My Account Authorization
              </span>
              <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[8.5px] font-bold text-emerald-700 uppercase">
                {card.role || 'User'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2 text-[9px]">
              <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                <span className="text-slate-400 block text-[8px]">Username</span>
                <span className="font-bold text-slate-800 truncate block">{card.username}</span>
              </div>
              <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                <span className="text-slate-400 block text-[8px]">Assigned Branch</span>
                <span className="font-bold text-slate-800">{card.branch_id || 'All Branches'}</span>
              </div>
            </div>

            {modules.length > 0 && (
              <div className="mb-2">
                <div className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Permitted Modules ({modules.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {modules.map((m: string) => (
                    <span key={m} className="rounded bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 text-[8px] font-semibold capitalize">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {perms.length > 0 && (
              <div>
                <div className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Effective Permissions ({perms.length})
                </div>
                <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto scrollbar-thin">
                  {perms.map((p: string) => (
                    <span key={p} className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[7.5px] font-mono">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {renderMetaWarnings()}
          </div>
        );
      }

      // ── 26. Reports Hub Catalog ─────────────────────────────────────────────
      case 'report_catalog': {
        const reports = card.reports || [];
        return (
          <div className="rounded-xl border border-indigo-100/90 bg-white p-2.5 shadow-2xs overflow-hidden">
            <div className="text-[10.5px] font-bold text-slate-900 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText size={13} className="text-blue-600" />
                Available Reports ({card.total_reports ?? reports.length})
              </span>
              <span className="rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[8.5px] font-bold text-blue-700">
                Reporting Hub
              </span>
            </div>

            <div className="space-y-1.5 my-2 max-h-[180px] overflow-y-auto scrollbar-thin">
              {reports.map((rep: any, i: number) => (
                <div
                  key={i}
                  onClick={() => rep.route && navigate(rep.route)}
                  className="p-2 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-indigo-50/60 hover:border-indigo-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-900 group-hover:text-indigo-900">
                      {rep.title}
                    </div>
                    <span className="text-[8px] font-mono text-indigo-600 font-semibold group-hover:underline flex items-center gap-0.5">
                      Open <ChevronRight size={10} />
                    </span>
                  </div>
                  <div className="text-[8.5px] text-slate-500 mt-0.5 line-clamp-1">
                    {rep.description}
                  </div>
                </div>
              ))}
            </div>
            {renderMetaWarnings()}
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
