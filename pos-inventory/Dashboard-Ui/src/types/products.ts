/**
 * Product & Inventory TypeScript types.
 * Standard product model used across Products & Stock and inventory management.
 */

export interface Product {
  id: string;           // SAP ItemCode
  name: string;
  price: number;
  barcode?: string | null;
  stock?: number | null;
  image?: string | null;
  category?: string | null;
  brand?: string | null;
  size?: string | null;
  color?: string | null;
  warehouse?: string | null;
}
