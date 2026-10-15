export const getLocalISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export type QuickFilter = 'today' | 'week' | 'month' | 'year' | 'custom' | '';
export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'all_time';

export interface AuthoritativeDateFilterState {
  quickFilter: QuickFilter;
  period: DashboardPeriod;
  dateFrom: string;
  dateTo: string;
}

export const resolveDashboardDateRange = (
  filter: QuickFilter,
  customFrom?: string,
  customTo?: string,
  currentDate?: Date
): AuthoritativeDateFilterState => {
  if (!filter) {
    return {
      quickFilter: '',
      period: 'all_time',
      dateFrom: '',
      dateTo: '',
    };
  }

  if (filter === 'custom') {
    return {
      quickFilter: 'custom',
      period: 'custom',
      dateFrom: customFrom || '',
      dateTo: customTo || '',
    };
  }

  const now = currentDate || new Date();
  const todayStr = getLocalISODate(now);

  if (filter === 'today') {
    return {
      quickFilter: 'today',
      period: 'daily',
      dateFrom: todayStr,
      dateTo: todayStr,
    };
  }

  if (filter === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);
    return {
      quickFilter: 'week',
      period: 'weekly',
      dateFrom: getLocalISODate(monday),
      dateTo: todayStr,
    };
  }

  if (filter === 'month') {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      quickFilter: 'month',
      period: 'monthly',
      dateFrom: getLocalISODate(firstOfMonth),
      dateTo: todayStr,
    };
  }

  if (filter === 'year') {
    const firstOfYear = new Date(now.getFullYear(), 0, 1);
    return {
      quickFilter: 'year',
      period: 'yearly',
      dateFrom: getLocalISODate(firstOfYear),
      dateTo: todayStr,
    };
  }

  return {
    quickFilter: '',
    period: 'all_time',
    dateFrom: '',
    dateTo: '',
  };
};

export const validateCustomDateRange = (
  from: string,
  to: string
): { isValid: boolean; error?: string } => {
  if (!from || !to) {
    return { isValid: false, error: 'Both start and end dates are required' };
  }
  if (from > to) {
    return { isValid: false, error: 'Start date cannot be after end date' };
  }
  return { isValid: true };
};

export const getDateScopeLabel = (
  filter: QuickFilter,
  dateFrom?: string,
  dateTo?: string
): string => {
  if (filter === 'today') return 'Today';
  if (filter === 'week') return 'This Week';
  if (filter === 'month') return 'This Month';
  if (filter === 'year') return 'This Year';
  if (filter === 'custom') {
    if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
    return 'Custom Range';
  }
  return 'All Dates (Total)';
};
