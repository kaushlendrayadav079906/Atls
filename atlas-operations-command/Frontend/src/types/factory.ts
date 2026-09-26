/**
 * Factory Domain Types
 * Exactly mirrors backend Phase 3 schemas:
 * - FactoryResponse: app/schemas/factory.py (FactoryResponse)
 * - FactoryFinancialsResponse: app/schemas/factory.py (FactoryFinancialsResponse)
 */

export interface Factory {
  id: string;
  name: string;
  code?: string | null;
  location?: string | null;
  status: 'active' | 'maintenance' | 'inactive' | string;
  created_at?: string;
  updated_at?: string;
}

export interface FactoryFinancials {
  factory_id: string;
  factory_name: string;
  month: number;
  year: number;
  revenue: number;
  expenditure: number;
  profit: number;
}
