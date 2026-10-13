export type TableColumnType = 'date' | 'string' | 'currency' | 'number' | 'delta' | 'percentage';

export interface TableColumn {
  key: string;
  label: string;
  type: TableColumnType;
}

export type TableChartType = 'bar' | 'line' | 'pie' | 'area';

export interface TableChartConfig {
  type: TableChartType;
  xKey: string;
  series: string[];
}

export interface TableFilters {
  period?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  groupBy?: string[] | null;
  branch?: string | null;
  additional?: Record<string, any> | null;
}

export interface StructuredTableResponse {
  type: 'table';
  title: string;
  summary: string;
  columns: TableColumn[];
  rows: Array<Record<string, any>>;
  filters?: TableFilters | null;
  chart?: TableChartConfig | null;
  meta?: {
    date_range?: string;
    branch_scope?: string;
    is_partial?: boolean;
    row_count?: number;
    error?: string;
    [key: string]: any;
  } | null;
  error?: string | null;
}

export interface NavigationTarget {
  target_module: string;
  label?: string;
  route: string;
  params?: Record<string, string>;
}

export interface NavigationCard {
  type: 'navigation';
  target: NavigationTarget;
}

export interface AIChatResponse {
  answer: string;
  conversation_id?: string;
  branch_context?: string;
  structured_data?: (StructuredTableResponse & {
    cards?: any[];
    navigation?: NavigationTarget;
  }) | any;
}
