import { describe, it, expect } from 'vitest';
import {
  getLocalISODate,
  resolveDashboardDateRange,
  validateCustomDateRange,
  getDateScopeLabel,
} from './date';

describe('Dashboard Date Filter Utilities', () => {
  it('formats local calendar date correctly without UTC offset shifts', () => {
    const fixedDate = new Date(2026, 9, 15); // Oct 15, 2026
    expect(getLocalISODate(fixedDate)).toBe('2026-10-15');

    const singleDigitDate = new Date(2026, 0, 5); // Jan 5, 2026
    expect(getLocalISODate(singleDigitDate)).toBe('2026-01-05');
  });

  describe('resolveDashboardDateRange', () => {
    const fixedNow = new Date(2026, 9, 15); // Thursday Oct 15, 2026

    it('resolves empty / total to all_time with empty dates (no date restriction)', () => {
      const res = resolveDashboardDateRange('', undefined, undefined, fixedNow);
      expect(res).toEqual({
        quickFilter: '',
        period: 'all_time',
        dateFrom: '',
        dateTo: '',
      });
    });

    it('resolves today preset to daily period with today date for both from and to', () => {
      const res = resolveDashboardDateRange('today', undefined, undefined, fixedNow);
      expect(res).toEqual({
        quickFilter: 'today',
        period: 'daily',
        dateFrom: '2026-10-15',
        dateTo: '2026-10-15',
      });
    });

    it('resolves week preset to weekly period starting from Monday', () => {
      // 2026-10-15 is Thursday. Monday of that week is 2026-10-12
      const res = resolveDashboardDateRange('week', undefined, undefined, fixedNow);
      expect(res).toEqual({
        quickFilter: 'week',
        period: 'weekly',
        dateFrom: '2026-10-12',
        dateTo: '2026-10-15',
      });
    });

    it('resolves month preset to monthly period starting from 1st of current month', () => {
      const res = resolveDashboardDateRange('month', undefined, undefined, fixedNow);
      expect(res).toEqual({
        quickFilter: 'month',
        period: 'monthly',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-15',
      });
    });

    it('resolves year preset to yearly period starting from Jan 1st of current year', () => {
      const res = resolveDashboardDateRange('year', undefined, undefined, fixedNow);
      expect(res).toEqual({
        quickFilter: 'year',
        period: 'yearly',
        dateFrom: '2026-01-01',
        dateTo: '2026-10-15',
      });
    });

    it('resolves custom filter with provided start and end dates', () => {
      const res = resolveDashboardDateRange('custom', '2026-09-01', '2026-09-30', fixedNow);
      expect(res).toEqual({
        quickFilter: 'custom',
        period: 'custom',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
      });
    });
  });

  describe('validateCustomDateRange', () => {
    it('accepts valid range where start date is before or equal to end date', () => {
      expect(validateCustomDateRange('2026-05-01', '2026-05-31')).toEqual({ isValid: true });
      expect(validateCustomDateRange('2026-05-01', '2026-05-01')).toEqual({ isValid: true });
    });

    it('rejects missing start or end dates', () => {
      const res1 = validateCustomDateRange('', '2026-05-31');
      expect(res1.isValid).toBe(false);
      expect(res1.error).toContain('Both start and end dates are required');

      const res2 = validateCustomDateRange('2026-05-01', '');
      expect(res2.isValid).toBe(false);
      expect(res2.error).toContain('Both start and end dates are required');
    });

    it('rejects inverted range where start date is after end date', () => {
      const res = validateCustomDateRange('2026-06-10', '2026-06-01');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Start date cannot be after end date');
    });
  });

  describe('getDateScopeLabel', () => {
    it('returns appropriate labels for presets', () => {
      expect(getDateScopeLabel('')).toBe('All Dates (Total)');
      expect(getDateScopeLabel('today')).toBe('Today');
      expect(getDateScopeLabel('week')).toBe('This Week');
      expect(getDateScopeLabel('month')).toBe('This Month');
      expect(getDateScopeLabel('year')).toBe('This Year');
    });

    it('returns formatted range for custom filters', () => {
      expect(getDateScopeLabel('custom', '2026-01-01', '2026-03-31')).toBe('2026-01-01 to 2026-03-31');
      expect(getDateScopeLabel('custom')).toBe('Custom Range');
    });
  });
});
