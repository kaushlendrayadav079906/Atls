/**
 * Centralized Financial and Currency Formatting Utility
 * Uses Intl.NumberFormat and respects tenant currency codes and formatting tokens.
 */

export interface CurrencyFormatOptions {
  currencyCode?: string;
  currencySymbol?: string;
  decimals?: number;
  locale?: string;
  compact?: boolean;
}

/**
 * Format a monetary amount using the tenant's currency code and locale.
 * Accepts either an options object or a currencyCode string directly.
 * Never hardcodes USD.
 */
export function formatCurrency(
  value: number | string | null | undefined,
  optionsOrCurrencyCode?: CurrencyFormatOptions | string
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) {
    return '—';
  }

  let options: CurrencyFormatOptions = {};
  if (typeof optionsOrCurrencyCode === 'string') {
    options = { currencyCode: optionsOrCurrencyCode };
  } else if (optionsOrCurrencyCode) {
    options = optionsOrCurrencyCode;
  }

  const {
    currencyCode = 'INR',
    currencySymbol,
    decimals = 2,
    locale = 'en-US',
    compact = false,
  } = options;

  if (compact) {
    const symbol = currencySymbol || currencyCode;
    if (Math.abs(num) >= 1_000_000_000) {
      return `${symbol}${(num / 1_000_000_000).toFixed(decimals)}B`;
    }
    if (Math.abs(num) >= 1_000_000) {
      return `${symbol}${(num / 1_000_000).toFixed(decimals)}M`;
    }
    if (Math.abs(num) >= 1_000) {
      return `${symbol}${(num / 1_000).toFixed(decimals)}k`;
    }
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    // Fallback if locale or currency code is non-standard
    const symbol = currencySymbol || currencyCode;
    return `${symbol} ${num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
}

/**
 * Format a pure decimal number with thousands separators without currency symbol.
 */
export function formatDecimal(
  value: number | string | null | undefined,
  decimals = 2
): string {
  if (value === null || value === undefined || value === '') {
    return '0.00';
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return '0.00';

  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
