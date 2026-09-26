import { apiClient } from './apiClient';
import { isDemoMode } from '../config';
import type {
  TaxCalculationRequestPayload,
  TaxCalculationResponsePayload,
} from '../types';

export const taxService = {
  calculateTax: async (
    payload: TaxCalculationRequestPayload
  ): Promise<TaxCalculationResponsePayload> => {
    if (isDemoMode()) {
      const amount = Number(payload.amount);
      const taxRate = payload.tax_rate !== undefined && payload.tax_rate !== null ? Number(payload.tax_rate) : 18.0;
      const isInclusive = Boolean(payload.is_tax_inclusive);

      let taxable = amount;
      let totalTax = 0;
      if (isInclusive) {
        taxable = amount / (1 + taxRate / 100);
        totalTax = amount - taxable;
      } else {
        totalTax = (amount * taxRate) / 100;
      }

      const isSameState =
        payload.supplier_state &&
        payload.customer_state &&
        payload.supplier_state.toUpperCase() === payload.customer_state.toUpperCase();

      const cgstRate = isSameState ? taxRate / 2 : 0;
      const cgstAmount = isSameState ? totalTax / 2 : 0;
      const sgstRate = isSameState ? taxRate / 2 : 0;
      const sgstAmount = isSameState ? totalTax / 2 : 0;
      const igstRate = !isSameState ? taxRate : 0;
      const igstAmount = !isSameState ? totalTax : 0;

      return Promise.resolve({
        original_amount: payload.amount,
        taxable_amount: taxable.toFixed(2),
        tax_rate: taxRate.toFixed(2),
        total_tax: totalTax.toFixed(2),
        cgst_rate: cgstRate.toFixed(2),
        cgst_amount: cgstAmount.toFixed(2),
        sgst_rate: sgstRate.toFixed(2),
        sgst_amount: sgstAmount.toFixed(2),
        igst_rate: igstRate.toFixed(2),
        igst_amount: igstAmount.toFixed(2),
        total_amount: (taxable + totalTax).toFixed(2),
        is_tax_inclusive: isInclusive,
        jurisdiction_type: isSameState ? 'INTRA_STATE' : 'INTER_STATE',
        supplier_state: payload.supplier_state,
        customer_state: payload.customer_state,
        hsn_sac_code: payload.hsn_sac_code,
      });
    }

    return apiClient.post<TaxCalculationResponsePayload>('/tax/calculate', payload);
  },
};
