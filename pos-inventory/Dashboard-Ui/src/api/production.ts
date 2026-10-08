import { apiClient } from './client';
import type {
  ProductionSummaryResponse,
  ProductionOrderListResponse,
  ProductionItemWiseAggregation,
  ProductionDateWiseItem,
  ProductionStatusDistributionItem,
  ProductionWarehouseSummaryItem,
  ProductionFilters,
  ProductionOrderListFilters,
  ProductionOrderDetail,
  ProductionRejectionAggregation,
} from '../types/production';

export const getProductionSummary = async (filters: ProductionFilters): Promise<ProductionSummaryResponse> => {
  const { data } = await apiClient.get<ProductionSummaryResponse>('/production/summary', { params: filters });
  return data;
};

export const getProductionOrders = async (filters: ProductionOrderListFilters): Promise<ProductionOrderListResponse> => {
  const { data } = await apiClient.get<ProductionOrderListResponse>('/production/orders', { params: filters });
  return data;
};

export const getProductionOrderDetail = async (productionOrderNo: number): Promise<ProductionOrderDetail> => {
  const { data } = await apiClient.get<ProductionOrderDetail>(`/production/orders/${productionOrderNo}`);
  return data;
};

export const getItemWiseProduction = async (filters: ProductionFilters): Promise<ProductionItemWiseAggregation[]> => {
  const { data } = await apiClient.get<ProductionItemWiseAggregation[]>('/production/item-wise', { params: filters });
  return data;
};

export const getProductionRejection = async (filters: ProductionFilters): Promise<ProductionRejectionAggregation> => {
  const { data } = await apiClient.get<ProductionRejectionAggregation>('/production/rejection', { params: filters });
  return data;
};

export const getDateWiseProduction = async (
  filters: ProductionFilters & { granularity?: 'daily' | 'weekly' | 'monthly' | 'yearly' }
): Promise<ProductionDateWiseItem[]> => {
  const { data } = await apiClient.get<ProductionDateWiseItem[]>('/production/date-wise', { params: filters });
  return data;
};

export const getStatusDistribution = async (filters: ProductionFilters): Promise<ProductionStatusDistributionItem[]> => {
  const { data } = await apiClient.get<ProductionStatusDistributionItem[]>('/production/status-distribution', { params: filters });
  return data;
};

export const getWarehouseSummary = async (filters: ProductionFilters): Promise<ProductionWarehouseSummaryItem[]> => {
  const { data } = await apiClient.get<ProductionWarehouseSummaryItem[]>('/production/warehouses', { params: filters });
  return data;
};
