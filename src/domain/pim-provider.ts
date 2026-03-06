import type { Category, Product, ProductFilter, Warehouse } from './types';

/**
 * Product Information Management provider interface.
 * The PIM is the source of truth for product data.
 * For the POC, implemented by a local JSON file adapter.
 */
export interface PimProvider {
  getProduct(sku: string): Promise<Product | null>;
  getProducts(filter?: ProductFilter): Promise<Product[]>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  getCategories(): Promise<Category[]>;
  getWarehouses(): Promise<Warehouse[]>;
}
