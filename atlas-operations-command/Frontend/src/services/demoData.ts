import type {
  OrganicBusinessData,
  TopCustomer,
  SalesByProduct,
  MonthlyRevenueExpenditure,
  Factory,
  ReceivablesSummary,
  PayablesSummary,
  InventorySummary,
  ProductionSummary,
  AiActionItem,
  RealtimeDashboardSummary,
  LocalizationConfig,
  FiscalYearInfo,
} from '../types';

export const demoLocalizationConfig: LocalizationConfig = {
  company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
  name: 'AtlasOps Demo Enterprise',
  country_code: 'US',
  timezone: 'UTC',
  locale: 'en-US',
  currency_code: 'USD',
  state_code: 'CA',
  gstin: null,
  tax_id: 'US-987654321',
  default_tax_rate: '18.00',
  fiscal_year_start_month: 4,
  formatting: {
    currency_symbol: '$',
    currency_decimals: 2,
    date_format: 'YYYY-MM-DD',
    decimal_separator: '.',
    thousands_separator: ',',
  },
};

export const demoFiscalYearInfo: FiscalYearInfo = {
  company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
  fiscal_year_start_month: 4,
  as_of_date: '2026-09-07',
  fiscal_year: 2026,
  fiscal_year_label: 'FY2026-27',
  fiscal_quarter: 2,
  fiscal_quarter_label: 'Q2',
  fiscal_period: 6,
  fiscal_year_start_date: '2026-04-01',
  fiscal_year_end_date: '2027-03-31',
  quarter_start_date: '2026-07-01',
  quarter_end_date: '2026-09-30',
};

export const demoOrganicBusinessData: OrganicBusinessData = {
  total_revenue: 12500000.0,
  total_expenditure: 8900000.0,
  net_profit: 3600000.0,
  active_factories: 4,
};

export const demoFactories: Factory[] = [
  {
    id: 'f1-austin-plant',
    company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
    name: 'Austin Mega-Plant Alpha',
    code: 'PLANT-TX-01',
    location: 'Austin, Texas',
    status: 'active',
  },
  {
    id: 'f2-detroit-plant',
    company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
    name: 'Detroit Precision Assembly',
    code: 'PLANT-MI-02',
    location: 'Detroit, Michigan',
    status: 'active',
  },
  {
    id: 'f3-munich-plant',
    company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
    name: 'Bavaria Robotics Facility',
    code: 'PLANT-DE-03',
    location: 'Munich, Germany',
    status: 'active',
  },
  {
    id: 'f4-tokyo-plant',
    company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
    name: 'Yokohama Semiconductor Unit',
    code: 'PLANT-JP-04',
    location: 'Yokohama, Japan',
    status: 'maintenance',
  },
];

export const demoMonthlyTrend: MonthlyRevenueExpenditure[] = [
  { month: 4, year: 2026, revenue: 1850000, expenditure: 1420000, profit: 430000 },
  { month: 5, year: 2026, revenue: 2100000, expenditure: 1510000, profit: 590000 },
  { month: 6, year: 2026, revenue: 2350000, expenditure: 1680000, profit: 670000 },
  { month: 7, year: 2026, revenue: 1980000, expenditure: 1450000, profit: 530000 },
  { month: 8, year: 2026, revenue: 2420000, expenditure: 1720000, profit: 700000 },
  { month: 9, year: 2026, revenue: 1750000, expenditure: 1150000, profit: 600000 },
];

export const demoTopCustomers: TopCustomer[] = [
  { customer_id: 'c1', customer_name: 'Apex Global Dynamics', total_revenue: 3420000 },
  { customer_id: 'c2', customer_name: 'Nordic Logistics AG', total_revenue: 2890000 },
  { customer_id: 'c3', customer_name: 'Vanguard Aerospace Inc.', total_revenue: 2150000 },
  { customer_id: 'c4', customer_name: 'Pacific Industrial Corp', total_revenue: 1680000 },
  { customer_id: 'c5', customer_name: 'OmniTech Solutions', total_revenue: 1240000 },
];

export const demoSalesByProduct: SalesByProduct[] = [
  { product_id: 'p1', product_name: 'Atlas Turbofan Core V4', total_sales: 4200000 },
  { product_id: 'p2', product_name: 'Precision Hydraulic Actuator', total_sales: 3100000 },
  { product_id: 'p3', product_name: 'Modular Sensor Array G2', total_sales: 2450000 },
  { product_id: 'p4', product_name: 'High-Torque Servomotor 800W', total_sales: 1820000 },
  { product_id: 'p5', product_name: 'Industrial Controller Hub', total_sales: 880000 },
];

export const demoReceivables: ReceivablesSummary = {
  total_receivables: 4850000,
  current: 3620000,
  overdue_30_days: 940000,
  overdue_60_plus_days: 290000,
  currency_code: 'USD',
};

export const demoPayables: PayablesSummary = {
  total_payables: 3120000,
  current: 2480000,
  overdue_30_days: 510000,
  overdue_60_plus_days: 130000,
  currency_code: 'USD',
};

export const demoInventory: InventorySummary = {
  total_inventory_value: 8740000,
  total_skus: 1420,
  low_stock_items: 12,
  stockout_risk_count: 2,
  health_status: 'OPTIMAL',
};

export const demoProduction: ProductionSummary = {
  monthly_output_units: 48500,
  target_units: 52000,
  achievement_rate_pct: 93.27,
  active_lines: 18,
  overall_equipment_effectiveness_pct: 88.4,
};

export const demoAiActions: AiActionItem[] = [
  {
    id: 'act-1',
    company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
    title: 'Expedite Tier-1 Ingot Supply for Plant Detroit',
    severity: 'HIGH',
    category: 'Supply Chain',
    description: 'Lead-time variance increased by 14% on raw titanium alloys. Reallocate buffered reserves from Munich warehouse.',
    cta_label: 'Initiate Transfer',
    status: 'pending',
    created_at: '2026-09-06T10:30:00Z',
  },
  {
    id: 'act-2',
    company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
    title: 'Audit Past-Due Receivables > 60 Days',
    severity: 'MEDIUM',
    category: 'Financial Risk',
    description: '$290,000 overdue aging threshold exceeded for 2 commercial enterprise accounts.',
    cta_label: 'Review Accounts',
    status: 'pending',
    created_at: '2026-09-05T14:15:00Z',
  },
  {
    id: 'act-3',
    company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
    title: 'Yokohama Preventive Calibration Cycle',
    severity: 'LOW',
    category: 'Operations',
    description: 'Semiconductor Unit maintenance cycle scheduled to finish in 36 hours. Line test verified.',
    cta_label: 'View Telemetry',
    status: 'pending',
    created_at: '2026-09-04T08:00:00Z',
  },
];

export const demoRealtimeSummary: RealtimeDashboardSummary = {
  company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
  timestamp: new Date().toISOString(),
  system_status: 'OPERATIONAL',
  operational_pulse: {
    total_factories: 4,
    active_factories: 3,
    inactive_factories: 1,
    operational_health_pct: 92.5,
  },
  financial_pulse: {
    total_revenue: 12450000.0,
    total_expenditure: 8930000.0,
    net_profit: 3520000.0,
    operating_margin_pct: 28.27,
  },
  risk_summary: {
    active_risk_count: 3,
    critical_count: 0,
    high_count: 1,
    medium_count: 1,
    low_count: 1,
    overall_composite_score: 18.5,
    overall_severity: 'LOW',
  },
  pending_actions_count: 3,
  data_version: '2.0.0-demo',
};
