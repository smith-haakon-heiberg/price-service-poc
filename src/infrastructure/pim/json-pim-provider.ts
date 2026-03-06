import { readFileSync } from 'fs';
import { join } from 'path';
import type { Category, Product, ProductFilter, Warehouse } from '@/domain/types';
import type { PimProvider } from '@/domain/pim-provider';

const DATA_DIR = join(process.cwd(), 'src', 'infrastructure', 'pim', 'data');

export class JsonPimProvider implements PimProvider {
  private readonly products: Product[];
  private readonly categories: Category[];
  private readonly warehouses: Warehouse[];

  constructor() {
    this.products = JSON.parse(
      readFileSync(join(DATA_DIR, 'products.json'), 'utf-8'),
    ) as Product[];

    this.categories = JSON.parse(
      readFileSync(join(DATA_DIR, 'categories.json'), 'utf-8'),
    ) as Category[];

    this.warehouses = JSON.parse(
      readFileSync(join(DATA_DIR, 'warehouses.json'), 'utf-8'),
    ) as Warehouse[];
  }

  async getProduct(sku: string): Promise<Product | null> {
    return this.products.find((p) => p.sku === sku) ?? null;
  }

  async getProducts(filter?: ProductFilter): Promise<Product[]> {
    let result = [...this.products];

    if (!filter) {
      return result;
    }

    if (filter.categoryId !== undefined) {
      result = result.filter((p) => p.categoryId === filter.categoryId);
    }

    if (filter.warehouseId !== undefined) {
      result = result.filter((p) => p.warehouseIds.includes(filter.warehouseId!));
    }

    if (filter.brand !== undefined) {
      result = result.filter((p) => p.brand === filter.brand);
    }

    if (filter.outletOnly === true) {
      result = result.filter((p) => p.outletFlag === true);
    }

    if (filter.search !== undefined) {
      const needle = filter.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.sku.toLowerCase().includes(needle),
      );
    }

    const offset = filter.offset ?? 0;
    result = result.slice(offset);

    if (filter.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return this.products.filter((p) => p.categoryId === categoryId);
  }

  async getCategories(): Promise<Category[]> {
    return [...this.categories];
  }

  async getWarehouses(): Promise<Warehouse[]> {
    return [...this.warehouses];
  }
}
