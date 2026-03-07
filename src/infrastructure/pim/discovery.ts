/**
 * Schema discovery: fetches one product from a remote endpoint and flattens
 * its structure into a list of DiscoveredField paths with sample values.
 */
import type { DiscoveredField, ProviderConfig } from '@/domain/pim-integrator';

function getValueType(value: unknown): DiscoveredField['valueType'] {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  return 'object';
}

function resolveSimplePath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function flattenItem(obj: Record<string, unknown>, prefix = ''): DiscoveredField[] {
  const fields: DiscoveredField[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        fields.push({ path, label: key, sampleValue: [], valueType: 'array' });
        continue;
      }

      const first = value[0];
      if (typeof first !== 'object' || first === null) {
        fields.push({ path, label: key, sampleValue: value, valueType: 'array' });
        continue;
      }

      const firstItem = first as Record<string, unknown>;

      // Detect key/value-pair arrays (attributes[], identifiers[])
      const keyField =
        'key' in firstItem ? 'key' : 'type' in firstItem ? 'type' : null;
      if (keyField && 'value' in firstItem) {
        for (const item of value as Record<string, unknown>[]) {
          const keyVal = String(item[keyField]);
          const itemValue = item['value'];
          const nestedPath = `${path}[${keyField}=${keyVal}].value`;
          fields.push({
            path: nestedPath,
            label: `${key}[${keyVal}]`,
            sampleValue: itemValue,
            valueType: getValueType(itemValue),
          });
        }
        continue;
      }

      // Detect category-style arrays (id + name, optional isPrimary)
      if ('id' in firstItem && 'name' in firstItem) {
        const primary =
          (value as Record<string, unknown>[]).find((i) => i['isPrimary']) ??
          firstItem;

        fields.push({
          path: `${path}[isPrimary=true].id`,
          label: `${key} (primary id)`,
          sampleValue: primary['id'] ?? firstItem['id'],
          valueType: 'string',
        });
        fields.push({
          path: `${path}[isPrimary=true].name`,
          label: `${key} (primary name)`,
          sampleValue: primary['name'] ?? firstItem['name'],
          valueType: 'string',
        });
        if ('slug' in firstItem) {
          fields.push({
            path: `${path}[isPrimary=true].slug`,
            label: `${key} (primary slug)`,
            sampleValue: primary['slug'] ?? firstItem['slug'],
            valueType: 'string',
          });
        }
        continue;
      }

      // Generic object array — show first item's fields
      fields.push({
        path,
        label: key,
        sampleValue: `[${value.length} items]`,
        valueType: 'array',
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recurse into plain objects (limit depth)
      if (prefix.split('.').length < 3) {
        fields.push(...flattenItem(value as Record<string, unknown>, path));
      } else {
        fields.push({ path, label: key, sampleValue: JSON.stringify(value).slice(0, 60), valueType: 'object' });
      }
    } else {
      fields.push({
        path,
        label: prefix ? `${prefix}.${key}` : key,
        sampleValue: value,
        valueType: getValueType(value),
      });
    }
  }

  return fields;
}

function extractItems(json: unknown, dataPath: string): unknown[] {
  if (Array.isArray(json)) return json;
  if (typeof json !== 'object' || json === null) return [];

  if (dataPath) {
    const found = resolveSimplePath(json, dataPath);
    if (Array.isArray(found)) return found;
  }

  // Auto-detect common envelope field names
  for (const key of ['data', 'items', 'products', 'results']) {
    const found = (json as Record<string, unknown>)[key];
    if (Array.isArray(found)) return found;
  }

  return [json];
}

export interface DiscoveryResult {
  fields: DiscoveredField[];
  rawSample: unknown;
  detectedDataPath: string;
  error?: string;
}

export async function discoverSchema(config: ProviderConfig): Promise<DiscoveryResult> {
  const url = `${config.baseUrl.replace(/\/$/, '')}${config.productsPath}?limit=1`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.authType === 'bearer' && config.authValue) {
    headers['Authorization'] = `Bearer ${config.authValue}`;
  } else if (config.authType === 'api-key' && config.authHeader && config.authValue) {
    headers[config.authHeader] = config.authValue;
  }

  let json: unknown;
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      return {
        fields: [],
        rawSample: null,
        detectedDataPath: config.dataPath,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }
    json = await res.json();
  } catch (err) {
    return {
      fields: [],
      rawSample: null,
      detectedDataPath: config.dataPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Detect data path
  let detectedDataPath = config.dataPath;
  if (!detectedDataPath && !Array.isArray(json) && typeof json === 'object' && json !== null) {
    for (const key of ['data', 'items', 'products', 'results']) {
      if (Array.isArray((json as Record<string, unknown>)[key])) {
        detectedDataPath = key;
        break;
      }
    }
  }

  const items = extractItems(json, detectedDataPath);
  if (items.length === 0) {
    return {
      fields: [],
      rawSample: json,
      detectedDataPath,
      error: 'No items found in response',
    };
  }

  const sample = items[0];
  const fields = flattenItem(sample as Record<string, unknown>);

  return { fields, rawSample: sample, detectedDataPath };
}
