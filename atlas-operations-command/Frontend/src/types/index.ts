// Authentication & User Types
export interface User {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  status: 'active' | 'inactive';
  role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Role {
  id: string;
  name: string;
  company_id: string;
}

export interface AuthContextResponse {
  user_id: string;
  company_id: string;
  roles: string[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequestPayload {
  company_name: string;
  country_code?: string | null;
  currency_code: string;
  timezone: string;
  locale?: string;
  region?: string;
  fiscal_year_start_month?: number;
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface RegisterResponsePayload {
  message: string;
  company_id: string;
  company_name: string;
  email: string;
  full_name: string;
}

// Company & Localization Types
export interface Company {
  id: string;
  name: string;
  currency_code: string;
  region: string;
  fiscal_year_start_month: number;
  status: 'active' | 'inactive';
  country_code: string | null;
  timezone: string;
  locale: string;
  state_code: string | null;
  gstin: string | null;
  tax_id: string | null;
  default_tax_rate: string | number;
}

export interface FormattingMetadata {
  currency_symbol: string;
  currency_decimals: number;
  date_format: string;
  decimal_separator: string;
  thousands_separator: string;
}

export interface LocalizationConfig {
  company_id: string;
  name: string;
  country_code: string | null;
  timezone: string;
  locale: string;
  currency_code: string;
  state_code: string | null;
  gstin: string | null;
  tax_id: string | null;
  default_tax_rate: string;
  fiscal_year_start_month: number;
  formatting: FormattingMetadata;
}

export interface FiscalYearInfo {
  company_id: string;
  fiscal_year_start_month: number;
  as_of_date: string;
  fiscal_year: number;
  fiscal_year_label: string;
  fiscal_quarter: number;
  fiscal_quarter_label: string;
  fiscal_period: number;
  fiscal_year_start_date: string;
  fiscal_year_end_date: string;
  quarter_start_date: string;
  quarter_end_date: string;
}

export type FiscalYear = FiscalYearInfo;

// Factory & Operational Types
export interface Factory {
  id: string;
  company_id: string;
  name: string;
  code?: string | null;
  location?: string | null;
  status: 'active' | 'maintenance' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface FactoryFinancials {
  factory_id: string;
  factory_name: string;
  month: number;
  year: number;
  revenue: number;
  expenditure: number;
  profit: number;
}

// Business Data & Financial Summary Types
export interface OrganicBusinessData {
  total_revenue: number | string;
  total_expenditure: number | string;
  net_profit: number | string;
  active_factories: number;
}

export interface SapBusinessData {
  status: string;
  message: string;
}

export interface TopCustomer {
  customer_id: string;
  customer_name: string;
  total_revenue: number | string;
}

export interface SalesByProduct {
  product_id: string;
  product_name: string;
  total_sales: number | string;
}

export interface MonthlyRevenueExpenditure {
  month: number;
  year: number;
  revenue: number | string;
  expenditure: number | string;
  profit: number | string;
}

// Receivables, Payables, Inventory, Production
export interface ReceivablesSummary {
  total_receivables: number;
  current: number;
  overdue_30_days: number;
  overdue_60_plus_days: number;
  currency_code: string;
}

export interface PayablesSummary {
  total_payables: number;
  current: number;
  overdue_30_days: number;
  overdue_60_plus_days: number;
  currency_code: string;
}

export interface InventorySummary {
  total_inventory_value: number;
  total_skus: number;
  low_stock_items: number;
  stockout_risk_count: number;
  health_status: 'OPTIMAL' | 'MODERATE' | 'CRITICAL';
}

export interface ProductionSummary {
  monthly_output_units: number;
  target_units: number;
  achievement_rate_pct: number;
  active_lines: number;
  overall_equipment_effectiveness_pct: number;
}

// AI Action Items & Risk Register
export interface AiActionItem {
  id: string;
  company_id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  category: string;
  description: string;
  cta_label?: string;
  status: 'pending' | 'completed' | 'dismissed' | string;
  created_at: string;
  resolved_at?: string | null;
}

export interface RiskItem {
  id: string;
  company_id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  category: string;
  likelihood_pct: number;
  financial_impact: number;
  department: string;
  status: 'active' | 'mitigated' | 'resolved' | string;
  created_at: string;
  resolved_at?: string | null;
}

export interface ExecutiveBriefingEntity {
  id: string;
  company_id: string;
  generated_at: string;
  summary_text: string;
  critical_issues: Array<{ title: string; impact?: string; severity?: string; explanation?: string }>;
  business_impact: string[];
  priority_actions: Array<{ title: string; action?: string; priority?: string; description?: string }>;
  created_at: string;
}

export interface AIAnalysisJob {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  created_at: string;
  completed_at?: string | null;
  error?: string | null;
  result_summary?: Record<string, any> | null;
}

// Realtime & Alert Types
export interface OperationalPulse {
  total_factories: number;
  active_factories: number;
  inactive_factories: number;
  operational_health_pct: number;
}

export interface FinancialPulse {
  total_revenue: number;
  total_expenditure: number;
  net_profit: number;
  operating_margin_pct: number;
}

export interface RiskSummaryPulse {
  active_risk_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  overall_composite_score: number;
  overall_severity: string;
}

export interface RealtimeDashboardSummary {
  company_id: string;
  timestamp: string;
  system_status: string;
  operational_pulse: OperationalPulse;
  financial_pulse: FinancialPulse;
  risk_summary: RiskSummaryPulse;
  pending_actions_count: number;
  latest_briefing_timestamp?: string | null;
  data_version: string;
}

export interface RealtimeOperationalHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | string;
  active_plants: number;
  total_plants: number;
  active_critical_alerts: number;
  last_data_sync?: string | null;
}

export interface RealtimeAlertItem {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  category: string;
  financial_impact: number;
  department?: string | null;
  created_at: string;
}

// Currency & Exchange Rate Types
export interface ExchangeRate {
  id: string;
  company_id?: string | null;
  from_currency: string;
  to_currency: string;
  rate: number | string;
  effective_date: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExchangeRateCreatePayload {
  from_currency: string;
  to_currency: string;
  rate: number | string;
  effective_date: string;
}

export interface CurrencyConvertRequestPayload {
  amount: number | string;
  from_currency: string;
  to_currency: string;
  target_date?: string | null;
}

export interface CurrencyConvertResponsePayload {
  original_amount: number | string;
  from_currency: string;
  to_currency: string;
  target_date: string;
  exchange_rate: number | string;
  converted_amount: number | string;
}

// Tax & GST Types
export interface TaxCalculationRequestPayload {
  amount: number | string;
  tax_rate?: number | string | null;
  is_tax_inclusive?: boolean;
  supplier_state?: string | null;
  customer_state?: string | null;
  is_gst?: boolean;
  hsn_sac_code?: string | null;
}

export interface TaxCalculationResponsePayload {
  original_amount: number | string;
  taxable_amount: number | string;
  tax_rate: number | string;
  total_tax: number | string;
  cgst_rate: number | string;
  cgst_amount: number | string;
  sgst_rate: number | string;
  sgst_amount: number | string;
  igst_rate: number | string;
  igst_amount: number | string;
  total_amount: number | string;
  is_tax_inclusive: boolean;
  jurisdiction_type: string;
  supplier_state?: string | null;
  customer_state?: string | null;
  hsn_sac_code?: string | null;
}

// Company Settings Update Payload
export interface CompanyUpdatePayload {
  name?: string;
  country_code?: string | null;
  timezone?: string;
  locale?: string;
  currency_code?: string;
  state_code?: string | null;
  gstin?: string | null;
  tax_id?: string | null;
  default_tax_rate?: number | string;
  fiscal_year_start_month?: number;
}

// File Upload & Data Ingestion Types (Frontend Unit 8)
export type FileUploadStatus = 'uploaded' | 'processing' | 'completed' | 'failed' | string;

export interface FileUpload {
  id: string;
  original_filename: string;
  stored_filename?: string;
  file_type: string;
  content_type: string;
  file_size: number;
  file_hash: string;
  status: FileUploadStatus;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessUploadPayload {
  target_entity?: string | null;
}

// SAP Work & Data Integration Types (Frontend Unit 9)
export interface SapBusinessDataResponse {
  status: string;
  message: string;
}

export interface SapIntegrationStatus {
  status: 'unavailable' | 'not_configured' | 'connected' | string;
  message: string;
  environment?: string;
  last_sync?: string | null;
  connection_configured?: boolean;
}
