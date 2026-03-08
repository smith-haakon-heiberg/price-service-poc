/**
 * HTTP PIM Provider — implements PimProvider by fetching from a remote REST API
 * and mapping the response to the local Product shape using user-defined field mappings.
 */
import type { Category, Product, ProductFilter, Warehouse } from '@/domain/types';
import type { PimProvider } from '@/domain/pim-provider';
import type { FieldMappings, ProviderConfig, Transform } from '@/domain/pim-integrator';

// ---------------------------------------------------------------------------
// Value extraction helpers
// ---------------------------------------------------------------------------

function resolveSimplePath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Resolves paths like:
 *   attributes[key=in_price].value
 *   identifiers[type=sku].value
 *   categories[isPrimary=true].id
 *   name                          (simple root field)
 */
export function resolveFieldValue(item: unknown, path: string): unknown {
  // Handle array filter syntax: prefix[filterKey=filterVal].prop
  const arrayFilterRe = /^(.+?)\[(\w+)=(.+?)\]\.(.+)$/;
  const match = path.match(arrayFilterRe);
  if (match) {
    const [, arrayPath, filterKey, filterVal, valueProp] = match;
    const arr = resolveSimplePath(item, arrayPath);
    if (!Array.isArray(arr)) return undefined;
    const found = arr.find(
      (el: unknown) =>
        typeof el === 'object' &&
        el !== null &&
        String((el as Record<string, unknown>)[filterKey]) === filterVal,
    );
    return found ? (found as Record<string, unknown>)[valueProp] : undefined;
  }

  return resolveSimplePath(item, path);
}

export function applyTransform(value: unknown, transform: Transform): unknown {
  switch (transform) {
    case 'multiply100':
      return Math.round(Number(value) * 100);
    case 'divide100':
      return Math.round(Number(value) / 100);
    case 'to_boolean':
      return value === true || value === 'true' || value === 1 || value === '1';
    case 'split_comma':
      return typeof value === 'string'
        ? value.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    case 'split_pipe':
      return typeof value === 'string'
        ? value.split('|').map((s) => s.trim()).filter(Boolean)
        : [];
    case 'wrap_single':
      return value != null ? [String(value)] : [];
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class HttpPimProvider implements PimProvider {
  constructor(
    private readonly config: ProviderConfig,
    private readonly mappings: FieldMappings,
  ) {}

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.config.authType === 'bearer' && this.config.authValue) {
      headers['Authorization'] = `Bearer ${this.config.authValue}`;
    } else if (
      this.config.authType === 'api-key' &&
      this.config.authHeader &&
      this.config.authValue
    ) {
      headers[this.config.authHeader] = this.config.authValue;
    }
    return headers;
  }

  private extractItems(json: unknown): unknown[] {
    if (Array.isArray(json)) return json;
    if (typeof json !== 'object' || json === null) return [];
    if (this.config.dataPath) {
      const found = resolveSimplePath(json, this.config.dataPath);
      if (Array.isArray(found)) return found;
    }
    for (const key of ['data', 'items', 'products', 'results']) {
      const found = (json as Record<string, unknown>)[key];
      if (Array.isArray(found)) return found;
    }
    return [];
  }

  private extractRemoteId(item: unknown): string | undefined {
    const obj = item as Record<string, unknown>;
    // Use configured idPath first
    if (this.config.idPath) {
      const val = resolveSimplePath(item, this.config.idPath);
      if (val != null) return String(val);
    }
    // Auto-detect common identity fields
    for (const key of ['id', '_id', 'uuid', 'code']) {
      if (obj[key] != null) return String(obj[key]);
    }
    return undefined;
  }

  private mapItem(item: unknown): Product | null {
    const extract = <K extends keyof FieldMappings>(key: K): unknown => {
      const rule = this.mappings[key];
      if (!rule) return undefined;
      const raw = resolveFieldValue(item, rule.sourcePath);
      return applyTransform(raw, rule.transform);
    };

    const sku = String(extract('sku') ?? '');
    const name = String(extract('name') ?? '');
    if (!sku || !name) return null;

    const rawWarehouses = extract('warehouseIds');
    const warehouseIds = Array.isArray(rawWarehouses)
      ? rawWarehouses.map(String)
      : [];

    const remoteId = this.extractRemoteId(item);

    return {
      sku,
      name,
      categoryId: String(extract('categoryId') ?? ''),
      brand: String(extract('brand') ?? ''),
      outletFlag: Boolean(extract('outletFlag') ?? false),
      basePrice: Number(extract('basePrice') ?? 0),
      unit: String(extract('unit') ?? 'stk'),
      warehouseIds,
      ...(remoteId !== undefined ? { remoteId } : {}),
    };
  }

  /**
   * Fetches every product from the remote PIM one page at a time.
   * Keeps going until a page comes back shorter than PAGE_SIZE, which
   * signals there are no more items — no reliance on a `total` field.
   */
  async fetchAllProducts(): Promise<Product[]> {
    const PAGE_SIZE = 100;
    const allItems: unknown[] = [];
    let page = 1;

    while (true) {
      const base = this.config.baseUrl.replace(/\/$/, '');
      const url = `${base}${this.config.productsPath}?page=${page}&limit=${PAGE_SIZE}&status=published`;
      const res = await fetch(url, { headers: this.buildHeaders() });
      if (!res.ok) throw new Error(`PIM fetch failed on page ${page}: ${res.status} ${res.statusText}`);

      const json: unknown = await res.json();
      const items = this.extractItems(json);
      allItems.push(...items);

      if (items.length < PAGE_SIZE) break;
      page++;
    }

    return allItems
      .map((i) => this.mapItem(i))
      .filter((p): p is Product => p !== null);
  }

  async getProduct(sku: string): Promise<Product | null> {
    const all = await this.getProducts();
    return all.find((p) => p.sku === sku) ?? null;
  }

  async getProducts(filter?: ProductFilter): Promise<Product[]> {
    let products = await this.fetchAllProducts();

    if (!filter) return products;
    if (filter.categoryId) products = products.filter((p) => p.categoryId === filter.categoryId);
    if (filter.brand) products = products.filter((p) => p.brand === filter.brand);
    if (filter.warehouseId) products = products.filter((p) => p.warehouseIds.includes(filter.warehouseId!));
    if (filter.outletOnly) products = products.filter((p) => p.outletFlag);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      products = products.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      );
    }
    const offset = filter.offset ?? 0;
    products = products.slice(offset);
    if (filter.limit !== undefined) products = products.slice(0, filter.limit);
    return products;
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return this.getProducts({ categoryId });
  }

  async getCategories(): Promise<Category[]> {
    try {
      const PAGE_SIZE = 200;
      const base = this.config.baseUrl.replace(/\/$/, '');
      const allItems: unknown[] = [];
      let page = 1;

      while (true) {
        const url = `${base}${this.config.categoriesPath}?page=${page}&limit=${PAGE_SIZE}`;
        const res = await fetch(url, { headers: this.buildHeaders() });
        if (!res.ok) break;
        const json: unknown = await res.json();
        const items = this.extractItems(json);
        allItems.push(...items);

        // Stop if we got fewer items than a full page (last page)
        if (items.length < PAGE_SIZE) break;

        // Stop if the response carries a total and we have it all
        if (!Array.isArray(json) && typeof json === 'object' && json !== null) {
          const envelope = json as Record<string, unknown>;
          const rawTotal = envelope['total'] ?? envelope['count'];
          if (typeof rawTotal === 'number' && allItems.length >= rawTotal) break;
        }

        page++;
      }

      return allItems
        .map((item: unknown) => {
          const i = item as Record<string, unknown>;
          return {
            id: String(i['id'] ?? i['code'] ?? ''),
            name: String(i['name'] ?? i['label'] ?? ''),
            parentId: i['parentId'] ? String(i['parentId']) : undefined,
          };
        })
        .filter((c) => c.id);
    } catch {
      return [];
    }
  }

  async getWarehouses(): Promise<Warehouse[]> {
    return [];
  }
}
