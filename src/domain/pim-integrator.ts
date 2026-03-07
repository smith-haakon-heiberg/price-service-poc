// Types for the PIM integrator — provider config, discovery, and field mappings.

export type AuthType = 'none' | 'api-key' | 'bearer';

export interface ProviderConfig {
  /** Base URL of the remote PIM, e.g. "http://localhost:3010" */
  baseUrl: string;
  /** Path to the products endpoint, e.g. "/api/v1/products" */
  productsPath: string;
  /** Path to the categories endpoint, e.g. "/api/v1/categories" */
  categoriesPath: string;
  /**
   * Dot-path within the JSON response where the items array lives.
   * Leave empty if the response is a root array.
   * e.g. "data", "products", "results"
   */
  dataPath: string;
  authType: AuthType;
  /** Header name when authType is "api-key", e.g. "X-API-Key" */
  authHeader?: string;
  /** Token / key value */
  authValue?: string;
}

/** A single field discovered from a remote product item. */
export interface DiscoveredField {
  /** Canonical path used in mappings, e.g. "attributes[key=in_price].value" */
  path: string;
  /** Human-readable label shown in the UI */
  label: string;
  /** Example value taken from the first product returned by the endpoint */
  sampleValue: unknown;
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
}

/** Metadata about each required/optional Product field in this service. */
export const PRODUCT_FIELD_DEFS = [
  { key: 'sku',          label: 'SKU',           required: true,  valueType: 'string'  },
  { key: 'name',         label: 'Product Name',  required: true,  valueType: 'string'  },
  { key: 'categoryId',   label: 'Category ID',   required: true,  valueType: 'string'  },
  { key: 'brand',        label: 'Brand',         required: false, valueType: 'string'  },
  { key: 'outletFlag',   label: 'Outlet Flag',   required: false, valueType: 'boolean' },
  { key: 'basePrice',    label: 'Base Price',    required: true,  valueType: 'number'  },
  { key: 'unit',         label: 'Unit',          required: false, valueType: 'string'  },
  { key: 'warehouseIds', label: 'Warehouse IDs', required: false, valueType: 'array'   },
] as const;

export type ProductFieldKey = typeof PRODUCT_FIELD_DEFS[number]['key'];

/**
 * Transformations applied to a raw source value before it is stored in Product.
 * multiply100 / divide100 handle price unit conversion (e.g. "18.99" → 1899 ore).
 */
export type Transform =
  | 'none'
  | 'multiply100'
  | 'divide100'
  | 'to_boolean'
  | 'split_comma'
  | 'split_pipe'
  | 'wrap_single';

export const TRANSFORM_LABELS: Record<Transform, string> = {
  none:         'As-is',
  multiply100:  '× 100 (price string → ore)',
  divide100:    '÷ 100 (ore → NOK)',
  to_boolean:   'To boolean',
  split_comma:  'Split by comma → array',
  split_pipe:   'Split by pipe → array',
  wrap_single:  'Wrap in array',
};

export interface FieldMappingRule {
  sourcePath: string;
  transform: Transform;
}

export type FieldMappings = Partial<Record<ProductFieldKey, FieldMappingRule>>;

export interface IntegratorConfig {
  provider: ProviderConfig | null;
  mappings: FieldMappings;
  enabled: boolean;
  lastSync?: string;
}

export const DEFAULT_INTEGRATOR_CONFIG: IntegratorConfig = {
  provider: null,
  mappings: {},
  enabled: false,
};

/** Heuristic: guess which Product field a discovered field path might map to. */
export function suggestMapping(path: string): ProductFieldKey | null {
  const p = path.toLowerCase();
  if (p.includes('[type=sku]') || p === 'sku') return 'sku';
  if (p.includes('[key=name]') || p === 'name' || p === 'title') return 'name';
  if (
    p.includes('[key=in_price]') ||
    p.includes('[key=price]') ||
    p.includes('[key=cost]') ||
    p.includes('baseprice') ||
    p.includes('inprice')
  ) return 'basePrice';
  if (p.includes('[key=brand]') || p === 'brand' || p.includes('manufacturer')) return 'brand';
  if (p.includes('[key=unit]') || p === 'unit' || p.includes('uom')) return 'unit';
  if (
    p.includes('categories[isprimary') ||
    p.includes('category[isprimary') ||
    (p.includes('categor') && p.includes('.id'))
  ) return 'categoryId';
  if (p.includes('outlet') || p.includes('[key=outlet]')) return 'outletFlag';
  if (p.includes('warehouse') || p.includes('[key=warehouse]')) return 'warehouseIds';
  return null;
}
