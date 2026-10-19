export type TableColumnType = 'date' | 'string' | 'currency' | 'number' | 'delta' | 'percentage';

export interface TableColumn {
  key: string;
  label: string;
  type: TableColumnType;
}

export type TableChartType = 'bar' | 'line' | 'pie' | 'area' | 'horizontal_bar';

export interface TableChartSeriesItem {
  dataKey: string;
  name?: string;
  color?: string;
}

export interface TableChartConfig {
  type: TableChartType;
  xKey: string;
  series: (string | TableChartSeriesItem)[];
  defaultView?: 'overview' | 'chart' | 'results' | 'flowchart' | 'both';
  title?: string;
  layout?: 'horizontal' | 'vertical';
}

export interface TableFilters {
  period?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  groupBy?: string[] | null;
  branch?: string | null;
  additional?: Record<string, any> | null;
}

export type FlowchartNodeType = 'start' | 'process' | 'decision' | 'end';

export interface FlowchartNode {
  id: string;
  stepNumber: number;
  title: string;
  type: FlowchartNodeType;
  badge?: string;
  description: string;
  route?: string;
  routeLabel?: string;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  condition?: string;
}

export interface FlowchartData {
  id: string;
  title: string;
  module: string;
  description: string;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

export interface FlowchartCard {
  type: 'flowchart';
  title?: string;
  summary?: string;
  flowchart: FlowchartData;
  meta?: {
    module?: string;
    [key: string]: any;
  };
}

export interface KPICardData {
  label: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  subtext?: string;
}

export interface StructuredTableResponse {
  type: 'table';
  title: string;
  summary: string;
  columns: TableColumn[];
  rows: Array<Record<string, any>>;
  filters?: TableFilters | null;
  chart?: TableChartConfig | null;
  flowchart?: FlowchartData | null;
  insights?: string[] | null;
  kpis?: KPICardData[] | null;
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
