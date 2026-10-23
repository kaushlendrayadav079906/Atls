import { apiClient } from './client';

export interface CustomerOption {
  code: string;
  name: string;
}

export interface SupplierOption {
  code: string;
  name: string;
}

export interface BuyerOption {
  code: string;
  name: string;
}

export interface WarehouseOption {
  code: string;
  name: string;
  id?: string;
}

export interface BranchOption {
  id: number;
  name: string;
}

export interface StatusOption {
  value: string;
  label: string;
}

export interface FilterOptionsResponse {
  customers: CustomerOption[];
  suppliers: SupplierOption[];
  buyers: BuyerOption[];
  warehouses: WarehouseOption[];
  branches: BranchOption[];
  categories?: { code: string | number; name: string }[];
  statuses: {
    orders: StatusOption[];
    purchase_orders: StatusOption[];
    invoices: StatusOption[];
    production: StatusOption[];
  };
}

export const commonApi = {
  getFilterOptions: async (): Promise<FilterOptionsResponse> => {
    const res = await apiClient.get<FilterOptionsResponse>('/common/filter-options');
    return res.data;
  }
};
