import { useQuery } from '@tanstack/react-query';
import { getInventoryRisk } from '../services/api';

export interface InventoryRiskItem {
  item_code: string;
  name: string;
  in_stock: number;
  committed: number;
  ordered: number;
  minimal_stock: number;
  warehouse: string;
}

export const useInventoryRisk = () => {
  return useQuery<InventoryRiskItem[]>({
    queryKey: ['inventoryRisk'],
    queryFn: getInventoryRisk,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
