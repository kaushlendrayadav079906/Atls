import { apiClient } from './apiClient';
import { isDemoMode } from '../config';
import { demoLocalizationConfig, demoFiscalYearInfo } from './demoData';
import type { LocalizationConfig, FiscalYearInfo, CompanyUpdatePayload, Company } from '../types';

export const localizationService = {
  getConfig: async (): Promise<LocalizationConfig> => {
    if (isDemoMode()) {
      return Promise.resolve(demoLocalizationConfig);
    }
    return apiClient.get<LocalizationConfig>('/localization/config');
  },

  getCurrentFiscalYear: async (): Promise<FiscalYearInfo> => {
    if (isDemoMode()) {
      return Promise.resolve(demoFiscalYearInfo);
    }
    return apiClient.get<FiscalYearInfo>('/fiscal-year/current');
  },

  getFiscalYearForDate: async (targetDate: string): Promise<FiscalYearInfo> => {
    if (isDemoMode()) {
      return Promise.resolve({
        ...demoFiscalYearInfo,
        as_of_date: targetDate,
      });
    }
    return apiClient.get<FiscalYearInfo>(`/fiscal-year/date-info?target_date=${targetDate}`);
  },

  updateCompanySettings: async (
    companyId: string,
    payload: CompanyUpdatePayload
  ): Promise<Company> => {
    if (isDemoMode()) {
      return Promise.resolve({
        id: companyId,
        name: payload.name || demoLocalizationConfig.name,
        currency_code: payload.currency_code || demoLocalizationConfig.currency_code,
        region: demoLocalizationConfig.state_code || 'NA',
        fiscal_year_start_month:
          payload.fiscal_year_start_month || demoLocalizationConfig.fiscal_year_start_month,
        status: 'active',
        country_code: payload.country_code || demoLocalizationConfig.country_code,
        timezone: payload.timezone || demoLocalizationConfig.timezone,
        locale: payload.locale || demoLocalizationConfig.locale,
        state_code: payload.state_code || demoLocalizationConfig.state_code,
        gstin: payload.gstin || demoLocalizationConfig.gstin,
        tax_id: payload.tax_id || demoLocalizationConfig.tax_id,
        default_tax_rate: payload.default_tax_rate || demoLocalizationConfig.default_tax_rate,
      });
    }
    return apiClient.put<Company>(`/company/settings/${companyId}`, payload);
  },
};

