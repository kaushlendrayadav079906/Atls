import { apiClient } from './apiClient';
import { isDemoMode } from '../config';
import type {
  ExchangeRate,
  ExchangeRateCreatePayload,
  CurrencyConvertRequestPayload,
  CurrencyConvertResponsePayload,
} from '../types';

export const currencyService = {
  getExchangeRates: async (
    fromCurrency?: string,
    toCurrency?: string,
    effectiveDate?: string
  ): Promise<ExchangeRate[]> => {
    if (isDemoMode()) {
      return Promise.resolve([
        {
          id: 'rate-1',
          company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
          from_currency: 'USD',
          to_currency: 'EUR',
          rate: '0.9200',
          effective_date: '2026-09-01',
        },
        {
          id: 'rate-2',
          company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
          from_currency: 'USD',
          to_currency: 'INR',
          rate: '83.5000',
          effective_date: '2026-09-01',
        },
        {
          id: 'rate-3',
          company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
          from_currency: 'EUR',
          to_currency: 'USD',
          rate: '1.0870',
          effective_date: '2026-09-01',
        },
      ]);
    }

    const params = new URLSearchParams();
    if (fromCurrency) params.append('from_currency', fromCurrency);
    if (toCurrency) params.append('to_currency', toCurrency);
    if (effectiveDate) params.append('effective_date', effectiveDate);
    const query = params.toString() ? `?${params.toString()}` : '';

    return apiClient.get<ExchangeRate[]>(`/currency/rates${query}`);
  },

  createExchangeRate: async (payload: ExchangeRateCreatePayload): Promise<ExchangeRate> => {
    if (isDemoMode()) {
      const newRate: ExchangeRate = {
        id: `rate-demo-${Date.now()}`,
        company_id: '67a70615-5753-489e-b6aa-2c8bd210c4e6',
        from_currency: payload.from_currency.toUpperCase(),
        to_currency: payload.to_currency.toUpperCase(),
        rate: payload.rate,
        effective_date: payload.effective_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return Promise.resolve(newRate);
    }
    return apiClient.post<ExchangeRate>('/currency/rates', payload);
  },

  convertCurrency: async (
    payload: CurrencyConvertRequestPayload
  ): Promise<CurrencyConvertResponsePayload> => {
    if (isDemoMode()) {
      const amount = Number(payload.amount);
      let rate = 1.0;
      if (payload.from_currency === 'USD' && payload.to_currency === 'EUR') rate = 0.92;
      if (payload.from_currency === 'USD' && payload.to_currency === 'INR') rate = 83.5;
      if (payload.from_currency === 'EUR' && payload.to_currency === 'USD') rate = 1.087;
      if (payload.from_currency === 'INR' && payload.to_currency === 'USD') rate = 0.012;

      return Promise.resolve({
        original_amount: payload.amount,
        from_currency: payload.from_currency.toUpperCase(),
        to_currency: payload.to_currency.toUpperCase(),
        target_date: payload.target_date || new Date().toISOString().split('T')[0],
        exchange_rate: rate,
        converted_amount: (amount * rate).toFixed(2),
      });
    }
    return apiClient.post<CurrencyConvertResponsePayload>('/currency/convert', payload);
  },
};
