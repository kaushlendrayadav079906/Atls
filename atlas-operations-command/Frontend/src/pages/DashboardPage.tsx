import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory as FactoryIcon,
  TrendingUp,
  CreditCard,
  Layers,
  ShoppingBag,
  Cpu,
  HeartPulse,
  DollarSign,
} from 'lucide-react';

import {
  DemoDataBanner,
  DashboardHeader,
  KpiCard,
  RevenueExpenseChart,
  FactoryPerformanceCard,
  SalesProductCard,
  ActionItemsCard,
  FinancialHealthCard,
  SapWorkCard,
} from '../components/dashboard';
import { ErrorState } from '../components/common/ErrorState';


import { localizationService } from '../services/localizationService';
import { businessDataService } from '../services/businessDataService';
import { factoryService } from '../services/factoryService';
import { reportService } from '../services/reportService';
import { realtimeService } from '../services/realtimeService';
import { aiRiskService } from '../services/aiRiskService';

import type {
  LocalizationConfig,
  FiscalYearInfo,
  OrganicBusinessData,
  Factory,
  TopCustomer,
  SalesByProduct,
  MonthlyRevenueExpenditure,
  ReceivablesSummary,
  PayablesSummary,
  InventorySummary,
  ProductionSummary,
  AiActionItem,
  RealtimeDashboardSummary,
  RealtimeOperationalHealth,
} from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Metadata State
  const [locConfig, setLocConfig] = useState<LocalizationConfig | null>(null);
  const [fiscalYear, setFiscalYear] = useState<FiscalYearInfo | null>(null);
  const [health, setHealth] = useState<RealtimeOperationalHealth | null>(null);

  // Business Data State
  const [businessData, setBusinessData] = useState<OrganicBusinessData | null>(null);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<SalesByProduct[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyRevenueExpenditure[]>([]);
  const [receivables, setReceivables] = useState<ReceivablesSummary | null>(null);
  const [payables, setPayables] = useState<PayablesSummary | null>(null);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [production, setProduction] = useState<ProductionSummary | null>(null);
  const [aiActions, setAiActions] = useState<AiActionItem[]>([]);
  const [realtimeSummary, setRealtimeSummary] = useState<RealtimeDashboardSummary | null>(null);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch Company & Calendar Settings
      const [configRes, fiscalRes, healthRes] = await Promise.allSettled([
        localizationService.getConfig(),
        localizationService.getCurrentFiscalYear(),
        realtimeService.getOperationalHealth(),
      ]);

      if (configRes.status === 'fulfilled') setLocConfig(configRes.value);
      if (fiscalRes.status === 'fulfilled') setFiscalYear(fiscalRes.value);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);

      // Determine months list for chart
      const currentYear = new Date().getFullYear();
      const monthsList = [
        { year: currentYear, month: 4 },
        { year: currentYear, month: 5 },
        { year: currentYear, month: 6 },
        { year: currentYear, month: 7 },
        { year: currentYear, month: 8 },
        { year: currentYear, month: 9 },
      ];

      // 2. Fetch Operational Telemetry
      const [
        bizRes,
        factoryRes,
        customersRes,
        productsRes,
        trendRes,
        receivablesRes,
        payablesRes,
        inventoryRes,
        prodRes,
        actionsRes,
        realtimeRes,
      ] = await Promise.allSettled([
        businessDataService.getOrganicData(),
        factoryService.listFactories(),
        reportService.getTopCustomers(5),
        reportService.getSalesByProduct(5),
        businessDataService.getMonthlyTrend(monthsList),
        businessDataService.getReceivables(),
        businessDataService.getPayables(),
        businessDataService.getInventory(),
        businessDataService.getProduction(),
        aiRiskService.getActions(),
        realtimeService.getSummary(),
      ]);

      if (bizRes.status === 'fulfilled') setBusinessData(bizRes.value);
      if (factoryRes.status === 'fulfilled') setFactories(factoryRes.value);
      if (customersRes.status === 'fulfilled') setTopCustomers(customersRes.value);
      if (productsRes.status === 'fulfilled') setSalesByProduct(productsRes.value);
      if (trendRes.status === 'fulfilled') setMonthlyTrend(trendRes.value);
      if (receivablesRes.status === 'fulfilled') setReceivables(receivablesRes.value);
      if (payablesRes.status === 'fulfilled') setPayables(payablesRes.value);
      if (inventoryRes.status === 'fulfilled') setInventory(inventoryRes.value);
      if (prodRes.status === 'fulfilled') setProduction(prodRes.value);
      if (actionsRes.status === 'fulfilled') setAiActions(actionsRes.value);
      if (realtimeRes.status === 'fulfilled') setRealtimeSummary(realtimeRes.value);

      // If critical operational services reject
      if (
        bizRes.status === 'rejected' ||
        factoryRes.status === 'rejected' ||
        realtimeRes.status === 'rejected'
      ) {
        setError('Unable to reach backend operations command API. Please ensure server is running.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize dashboard telemetry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleResolveAction = async (actionId: string) => {
    try {
      await aiRiskService.resolveAction(actionId);
      setAiActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, status: 'completed' } : a))
      );
    } catch {
      // Re-fetch on conflict
      const updated = await aiRiskService.getActions();
      setAiActions(updated);
    }
  };

  const currencySymbol = locConfig?.formatting?.currency_symbol || '$';

  const formatCurrency = (val: number | string | undefined | null) => {
    if (val === undefined || val === null) return '—';
    const num = Number(val);
    if (isNaN(num)) return '—';
    if (num >= 1000000) return `${currencySymbol}${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${currencySymbol}${(num / 1000).toFixed(1)}k`;
    return `${currencySymbol}${num.toFixed(2)}`;
  };

  const activeFactoryCount =
    businessData?.active_factories ??
    factories.filter((f) => f.status === 'active').length;

  const totalRevenue = businessData?.total_revenue;
  const netProfit = businessData?.net_profit;
  const profitMargin =
    totalRevenue && Number(totalRevenue) > 0
      ? ((Number(netProfit || 0) / Number(totalRevenue)) * 100).toFixed(1)
      : '0.0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Persistent Demo Data Banner */}
      <DemoDataBanner />

      {/* 2. Executive Header */}
      <DashboardHeader
        locConfig={locConfig}
        fiscalYear={fiscalYear}
        health={health}
      />

      {error && (
        <div style={{ padding: '0 4px' }}>
          <ErrorState
            title="Dashboard Sync Notice"
            message={error}
            onRetry={loadDashboardData}
          />
        </div>
      )}

      {/* 3. Executive KPI Row */}
      <section aria-label="Executive KPIs">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Factories */}
          <KpiCard
            title="Operational Factories"
            primaryValue={activeFactoryCount}
            secondaryValue={`of ${factories.length || activeFactoryCount} Total Facilities`}
            icon={<FactoryIcon size={20} color="#3b82f6" />}
            iconBg="rgba(59, 130, 246, 0.15)"
            status="info"
            isLoading={isLoading}
            error={error && !businessData ? error : null}
            onRetry={loadDashboardData}
            action={{
              label: 'View Plants',
              onClick: () => navigate('/factories'),
            }}
          />

          {/* Revenue / P&L */}
          <KpiCard
            title="Revenue & Net P&L"
            primaryValue={formatCurrency(totalRevenue)}
            secondaryValue={`Margin: ${profitMargin}%`}
            trend={{
              direction: Number(netProfit || 0) >= 0 ? 'up' : 'down',
              label: `Net ${formatCurrency(netProfit)}`,
            }}
            icon={<TrendingUp size={20} color="#10b981" />}
            iconBg="rgba(16, 185, 129, 0.15)"
            status={Number(netProfit || 0) >= 0 ? 'success' : 'danger'}
            isLoading={isLoading}
            error={error && !businessData ? error : null}
            onRetry={loadDashboardData}
          />

          {/* Receivables */}
          <KpiCard
            title="Accounts Receivable"
            primaryValue={formatCurrency(receivables?.total_receivables)}
            secondaryValue={`Overdue: ${formatCurrency(receivables?.overdue_30_days)}`}
            trend={{
              direction: (receivables?.overdue_30_days || 0) > 0 ? 'down' : 'neutral',
              label: 'Current 30d cycle',
            }}
            icon={<DollarSign size={20} color="#06b6d4" />}
            iconBg="rgba(6, 182, 212, 0.15)"
            status="info"
            isLoading={isLoading}
            error={error && !receivables ? error : null}
            onRetry={loadDashboardData}
          />

          {/* Payables */}
          <KpiCard
            title="Accounts Payable"
            primaryValue={formatCurrency(payables?.total_payables)}
            secondaryValue={`Overdue: ${formatCurrency(payables?.overdue_30_days)}`}
            icon={<CreditCard size={20} color="#f59e0b" />}
            iconBg="rgba(245, 158, 11, 0.15)"
            status="warning"
            isLoading={isLoading}
            error={error && !payables ? error : null}
            onRetry={loadDashboardData}
          />
        </div>
      </section>

      {/* 4. Operations Row */}
      <section aria-label="Operations Overview">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Stock / Inventory */}
          <KpiCard
            title="Stock & Inventory"
            primaryValue={formatCurrency(inventory?.total_inventory_value)}
            secondaryValue={`${inventory?.low_stock_items || 0} Low Stock SKUs`}
            status={inventory?.stockout_risk_count ? 'danger' : 'success'}
            icon={<Layers size={20} color="#8b5cf6" />}
            iconBg="rgba(139, 92, 246, 0.15)"
            isLoading={isLoading}
            error={error && !inventory ? error : null}
            onRetry={loadDashboardData}
          />

          {/* Sales Summary */}
          <KpiCard
            title="Sales Volume"
            primaryValue={formatCurrency(totalRevenue)}
            secondaryValue={`${topCustomers.length} Active Key Accounts`}
            icon={<ShoppingBag size={20} color="#ec4899" />}
            iconBg="rgba(236, 72, 153, 0.15)"
            status="info"
            isLoading={isLoading}
            error={error && !topCustomers ? error : null}
            onRetry={loadDashboardData}
            action={{
              label: 'Sales Reports',
              onClick: () => navigate('/reports'),
            }}
          />

          {/* Production Output */}
          <KpiCard
            title="Production Output"
            primaryValue={
              production?.monthly_output_units
                ? `${production.monthly_output_units.toLocaleString()} Units`
                : '—'
            }
            secondaryValue={`Target Achievement: ${production?.achievement_rate_pct || 0}%`}
            trend={{
              direction: (production?.achievement_rate_pct || 0) >= 90 ? 'up' : 'down',
              label: `${production?.active_lines || 0} Lines Active`,
            }}
            icon={<Cpu size={20} color="#6366f1" />}
            iconBg="rgba(99, 102, 241, 0.15)"
            status="info"
            isLoading={isLoading}
            error={error && !production ? error : null}
            onRetry={loadDashboardData}
          />

          {/* Operational Efficiency */}
          <KpiCard
            title="Plant Solvency & Health"
            primaryValue={
              realtimeSummary?.operational_pulse?.operational_health_pct
                ? `${realtimeSummary.operational_pulse.operational_health_pct.toFixed(1)}%`
                : '100%'
            }
            secondaryValue="Composite Availability"
            status="success"
            icon={<HeartPulse size={20} color="#14b8a6" />}
            iconBg="rgba(20, 184, 166, 0.15)"
            isLoading={isLoading}
            error={error && !realtimeSummary ? error : null}
            onRetry={loadDashboardData}
            action={{
              label: 'System Health',
              onClick: () => navigate('/realtime'),
            }}
          />
        </div>
      </section>

      {/* 5. Analytics & Visualizations Grid */}
      <section aria-label="Analytics and Deep Dives">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Revenue vs Expenditure Chart */}
          <RevenueExpenseChart
            data={monthlyTrend}
            currencySymbol={currencySymbol}
            isLoading={isLoading}
            error={error && monthlyTrend.length === 0 ? error : null}
            onRetry={loadDashboardData}
          />

          {/* Factory Performance Summary */}
          <FactoryPerformanceCard
            factories={factories}
            isLoading={isLoading}
            error={error && factories.length === 0 ? error : null}
            onRetry={loadDashboardData}
          />

          {/* Commercial Sales / Products */}
          <SalesProductCard
            topCustomers={topCustomers}
            salesByProduct={salesByProduct}
            currencySymbol={currencySymbol}
            isLoading={isLoading}
            error={error && topCustomers.length === 0 && salesByProduct.length === 0 ? error : null}
            onRetry={loadDashboardData}
          />

          {/* Enterprise Financial Health */}
          <FinancialHealthCard
            financialPulse={realtimeSummary?.financial_pulse}
            riskSummary={realtimeSummary?.risk_summary}
            isLoading={isLoading}
            error={error && !realtimeSummary ? error : null}
            onRetry={loadDashboardData}
          />
        </div>
      </section>

      {/* 6. Action Items & SAP Work Area */}
      <section aria-label="Action Items and Integrations">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '20px',
          }}
        >
          <ActionItemsCard
            actions={aiActions}
            onResolve={handleResolveAction}
            isLoading={isLoading}
            error={error && aiActions.length === 0 ? error : null}
            onRetry={loadDashboardData}
          />

          <SapWorkCard />
        </div>
      </section>
    </div>
  );
};
