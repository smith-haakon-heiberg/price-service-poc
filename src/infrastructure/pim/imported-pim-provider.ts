/**
 * Reads products and categories that were previously imported via the sync endpoint
 * from data/pim-imported.json. This lets the price engine work without any outbound
 * HTTP calls at calculation time.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Category, Product, ProductFilter, Warehouse } from '@/domain/types';
import type { PimProvider } from '@/domain/pim-provider';

const IMPORT_PATH = join(process.cwd(), 'data', 'pim-imported.json');

export interface ImportedSnapshot {
  products: Product[];
  categories: Category[];
  syncedAt: string;
}

export function readImportedSnapshot(): ImportedSnapshot | null {
  if (!existsSync(IMPORT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(IMPORT_PATH, 'utf-8')) as ImportedSnapshot;
  } catch {
    return null;
  }
}

export class ImportedPimProvider implements PimProvider {
  private readonly products: Product[];
  private readonly categories: Category[];

  constructor(snapshot: ImportedSnapshot) {
    this.products = snapshot.products;
    this.categories = snapshot.categories;
  }

  async getProduct(sku: string): Promise<Product | null> {
    return this.products.find((p) => p.sku === sku) ?? null;
  }

  async getProducts(filter?: ProductFilter): Promise<Product[]> {
    let result = [...this.products];
    if (!filter) return result;

    if (filter.categoryId !== undefined) result = result.filter((p) => p.categoryId === filter.categoryId);
    if (filter.warehouseId !== undefined) result = result.filter((p) => p.warehouseIds.includes(filter.warehouseId!));
    if (filter.brand !== undefined) result = result.filter((p) => p.brand === filter.brand);
    if (filter.outletOnly) result = result.filter((p) => p.outletFlag);
    if (filter.search !== undefined) {
      const q = filter.search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    const offset = filter.offset ?? 0;
    result = result.slice(offset);
    if (filter.limit !== undefined) result = result.slice(0, filter.limit);
    return result;
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return this.products.filter((p) => p.categoryId === categoryId);
  }

  async getCategories(): Promise<Category[]> {
    return [...this.categories];
  }

  async getWarehouses(): Promise<Warehouse[]> {
    return [];
  }
}
