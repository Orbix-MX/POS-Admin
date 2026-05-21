import { WidgetType } from '@prisma/client';

export interface WidgetMeta {
  currency?: string;
  unit?: string;
  period?: string;
  comparison?: {
    previousValue: number;
    changePercent: number;
    trend: 'up' | 'down' | 'neutral';
    label: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  empty?: boolean;
  emptyLabel?: string;
}

export interface WidgetDisplayConfig {
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  stacked?: boolean;
  animated?: boolean;
  dateFormat?: string;
  valueFormat?: 'currency' | 'percent' | 'number' | 'compact';
}

export interface AppliedFilter {
  key: string;
  label: string;
  value: string | number | string[];
}

export interface WidgetResponse<TData = unknown> {
  success: boolean;
  widgetType: WidgetType;
  title: string;
  subtitle?: string;
  data: TData;
  meta: WidgetMeta;
  config: WidgetDisplayConfig;
  filters?: AppliedFilter[];
  error?: string;
  lastUpdate: string;
}
