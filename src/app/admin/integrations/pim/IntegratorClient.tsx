'use client';

import { useState } from 'react';
import type {
  ProviderConfig,
  DiscoveredField,
  FieldMappings,
  ProductFieldKey,
  IntegratorConfig,
  Transform,
} from '@/domain/pim-integrator';
import { PRODUCT_FIELD_DEFS, TRANSFORM_LABELS } from '@/domain/pim-integrator';
import type { Product } from '@/domain/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'provider' | 'discover' | 'map' | 'preview';

interface DiscoverResponse {
  fields: DiscoveredField[];
  rawSample: unknown;
  detectedDataPath: string;
  suggestions: Record<string, string>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'provider', label: '1. Provider' },
    { key: 'discover', label: '2. Discover' },
    { key: 'map', label: '3. Map Fields' },
    { key: 'preview', label: '4. Preview' },
  ];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => {
        const isActive = s.key === current;
        const isDone =
          steps.findIndex((x) => x.key === current) > i;
        return (
          <div key={s.key} className="flex items-center">
            <div
              className={`px-4 py-1.5 text-sm font-medium rounded ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isDone
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-muted'
              }`}
            >
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <span className="mx-1 text-muted text-sm">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Provider configuration
// ---------------------------------------------------------------------------

function ProviderStep({
  initial,
  onNext,
}: {
  initial: ProviderConfig;
  onNext: (c: ProviderConfig) => void;
}) {
  const [cfg, setCfg] = useState<ProviderConfig>(initial);

  const set = (key: keyof ProviderConfig, value: string) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Configure Provider</h2>
      <p className="text-sm text-muted mb-4">
        Enter the base URL and authentication details for the remote PIM.
      </p>

      <LabeledInput
        label="Base URL"
        value={cfg.baseUrl}
        onChange={(v) => set('baseUrl', v)}
        placeholder="http://localhost:3010"
        required
      />
      <LabeledInput
        label="Products endpoint path"
        value={cfg.productsPath}
        onChange={(v) => set('productsPath', v)}
        placeholder="/api/v1/products"
        required
      />
      <LabeledInput
        label="Categories endpoint path"
        value={cfg.categoriesPath}
        onChange={(v) => set('categoriesPath', v)}
        placeholder="/api/v1/categories"
      />
      <LabeledInput
        label="Response data path (leave blank to auto-detect)"
        value={cfg.dataPath}
        onChange={(v) => set('dataPath', v)}
        placeholder="data"
      />

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Authentication</label>
        <select
          value={cfg.authType}
          onChange={(e) => set('authType', e.target.value)}
          className="border border-border rounded px-3 py-1.5 text-sm bg-white"
        >
          <option value="none">None</option>
          <option value="bearer">Bearer token</option>
          <option value="api-key">API key header</option>
        </select>
      </div>

      {cfg.authType === 'api-key' && (
        <LabeledInput
          label="Header name"
          value={cfg.authHeader ?? ''}
          onChange={(v) => set('authHeader', v)}
          placeholder="X-API-Key"
        />
      )}

      {cfg.authType !== 'none' && (
        <LabeledInput
          label={cfg.authType === 'bearer' ? 'Bearer token' : 'Key value'}
          value={cfg.authValue ?? ''}
          onChange={(v) => set('authValue', v)}
          type="password"
        />
      )}

      <button
        onClick={() => onNext(cfg)}
        disabled={!cfg.baseUrl || !cfg.productsPath}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Discover Schema →
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Discovering (loading state between provider and map)
// ---------------------------------------------------------------------------

function DiscoverStep({ error }: { error?: string }) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <strong>Discovery failed:</strong> {error}
      </div>
    );
  }
  return (
    <div className="text-sm text-muted flex items-center gap-2">
      <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      Fetching schema from remote PIM…
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Field mapping
// ---------------------------------------------------------------------------

function MappingStep({
  fields,
  mappings,
  onChange,
  onBack,
  onNext,
}: {
  fields: DiscoveredField[];
  mappings: FieldMappings;
  onChange: (m: FieldMappings) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const pathOptions = fields.map((f) => ({ value: f.path, label: `${f.label} (${String(f.sampleValue ?? '').slice(0, 40)})` }));
  const transforms: Transform[] = ['none', 'multiply100', 'divide100', 'to_boolean', 'split_comma', 'split_pipe', 'wrap_single'];

  const setMapping = (key: ProductFieldKey, sourcePath: string, transform: Transform) => {
    if (!sourcePath) {
      const next = { ...mappings };
      delete next[key];
      onChange(next);
    } else {
      onChange({ ...mappings, [key]: { sourcePath, transform } });
    }
  };

  const requiredMapped = PRODUCT_FIELD_DEFS
    .filter((f) => f.required)
    .every((f) => !!mappings[f.key as ProductFieldKey]?.sourcePath);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Map Fields</h2>
      <p className="text-sm text-muted mb-4">
        For each price-system field, choose which remote field to use and any value transform.
        Fields marked <span className="text-red-500">*</span> are required.
      </p>

      <div className="bg-card-bg border border-border rounded-lg overflow-hidden mb-4">
        <table>
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Price system field</th>
              <th style={{ width: '46%' }}>Remote field</th>
              <th style={{ width: '28%' }}>Transform</th>
              <th style={{ width: '8%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCT_FIELD_DEFS.map((def) => {
              const key = def.key as ProductFieldKey;
              const current = mappings[key];
              return (
                <tr key={key}>
                  <td className="font-medium text-sm">
                    {def.label}
                    {def.required && <span className="text-red-500 ml-1">*</span>}
                    <div className="text-xs text-muted font-normal">{key}</div>
                  </td>
                  <td>
                    <select
                      value={current?.sourcePath ?? ''}
                      onChange={(e) =>
                        setMapping(key, e.target.value, current?.transform ?? 'none')
                      }
                      className="w-full border border-border rounded px-2 py-1 text-xs bg-white"
                    >
                      <option value="">— not mapped —</option>
                      {pathOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={current?.transform ?? 'none'}
                      onChange={(e) =>
                        setMapping(key, current?.sourcePath ?? '', e.target.value as Transform)
                      }
                      disabled={!current?.sourcePath}
                      className="w-full border border-border rounded px-2 py-1 text-xs bg-white disabled:opacity-50"
                    >
                      {transforms.map((t) => (
                        <option key={t} value={t}>
                          {TRANSFORM_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-center">
                    {current?.sourcePath ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Mapped" />
                    ) : def.required ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Required — not mapped" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-gray-300" title="Optional — not mapped" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Discovered fields reference */}
      <details className="mb-4">
        <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
          Show all discovered fields ({fields.length})
        </summary>
        <div className="mt-2 bg-gray-50 border border-border rounded text-xs font-mono p-3 max-h-48 overflow-auto">
          {fields.map((f) => (
            <div key={f.path} className="flex gap-4 py-0.5">
              <span className="text-blue-700 shrink-0">{f.path}</span>
              <span className="text-muted truncate">{String(f.sampleValue ?? 'null')}</span>
            </div>
          ))}
        </div>
      </details>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-border rounded text-sm hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!requiredMapped}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          title={!requiredMapped ? 'Map all required fields first' : ''}
        >
          Preview →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Preview
// ---------------------------------------------------------------------------

function PreviewStep({
  products,
  error,
  saveState,
  onBack,
  onSave,
}: {
  products: Product[];
  error?: string;
  saveState: 'idle' | 'saving' | 'syncing' | 'done' | 'error';
  saveError?: string;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Preview</h2>
      <p className="text-sm text-muted mb-4">
        First {products.length} products mapped from the remote PIM.
        Saving will import all products into the local cache.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {products.length > 0 && (
        <div className="bg-card-bg border border-border rounded-lg overflow-auto mb-4">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Brand</th>
                <th className="text-right">Base Price</th>
                <th>Unit</th>
                <th>Outlet</th>
                <th>Warehouses</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.sku}>
                  <td className="font-mono text-xs">{p.sku}</td>
                  <td className="text-sm">{p.name}</td>
                  <td className="text-xs text-muted">{p.categoryId || '—'}</td>
                  <td className="text-xs">{p.brand || '—'}</td>
                  <td className="text-right font-mono text-xs">
                    {(p.basePrice / 100).toFixed(2)} kr
                  </td>
                  <td className="text-xs text-muted">{p.unit}</td>
                  <td className="text-xs">
                    {p.outletFlag ? (
                      <span className="bg-orange-100 text-orange-700 px-1.5 rounded text-xs">Outlet</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-xs text-muted">{p.warehouseIds.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-3 items-center">
        <button
          onClick={onBack}
          disabled={saveState !== 'idle'}
          className="px-4 py-2 border border-border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          onClick={onSave}
          disabled={saveState !== 'idle'}
          className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {saveState === 'saving'
            ? 'Saving config…'
            : saveState === 'syncing'
            ? 'Importing products…'
            : 'Save & Import'}
        </button>
        {(saveState === 'saving' || saveState === 'syncing') && (
          <span className="inline-block w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        )}
        {saveState === 'done' && (
          <span className="text-sm text-green-600 font-medium">✓ Products imported — integrator is live</span>
        )}
        {saveState === 'error' && (
          <span className="text-sm text-red-600 font-medium">Import failed — check console</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root wizard
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDER: ProviderConfig = {
  baseUrl: '',
  productsPath: '/api/v1/products',
  categoriesPath: '/api/v1/categories',
  dataPath: '',
  authType: 'none',
};

export default function IntegratorClient({
  initialConfig,
}: {
  initialConfig: IntegratorConfig;
}) {
  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<ProviderConfig>(
    initialConfig.provider ?? DEFAULT_PROVIDER,
  );
  const [discoveryResult, setDiscoveryResult] = useState<DiscoverResponse | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | undefined>();
  const [mappings, setMappings] = useState<FieldMappings>(initialConfig.mappings);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'syncing' | 'done' | 'error'>('idle');

  // Step 1 → 2: discover schema
  async function handleDiscover(cfg: ProviderConfig) {
    setProvider(cfg);
    setStep('discover');
    setDiscoveryError(undefined);

    const res = await fetch('/api/integrations/pim/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    const data = await res.json() as DiscoverResponse;

    if (data.error) {
      setDiscoveryError(data.error);
      return;
    }

    setDiscoveryResult(data);

    // Apply auto-suggested mappings (only pre-fill unmapped fields)
    const auto: FieldMappings = { ...mappings };
    for (const [fieldKey, sourcePath] of Object.entries(data.suggestions)) {
      const key = fieldKey as ProductFieldKey;
      if (!auto[key]) {
        auto[key] = { sourcePath, transform: 'none' };
      }
    }
    setMappings(auto);
    setStep('map');
  }

  // Step 3 → 4: preview
  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewError(undefined);
    setStep('preview');

    const res = await fetch('/api/integrations/pim/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, mappings }),
    });
    const data = await res.json() as { products?: Product[]; error?: string };
    setPreviewLoading(false);

    if (data.error) {
      setPreviewError(data.error);
    } else {
      setPreviewProducts(data.products ?? []);
    }
  }

  // Save config then auto-import all products from the remote PIM
  async function handleSave() {
    try {
      setSaveState('saving');
      const config: IntegratorConfig = { provider, mappings, enabled: true };
      await fetch('/api/integrations/pim/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      setSaveState('syncing');
      const syncRes = await fetch('/api/integrations/pim/sync', { method: 'POST' });
      if (!syncRes.ok) throw new Error((await syncRes.json() as { error?: string }).error ?? 'Sync failed');

      setSaveState('done');
    } catch {
      setSaveState('error');
    }
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 'provider' && (
        <ProviderStep initial={provider} onNext={handleDiscover} />
      )}

      {step === 'discover' && <DiscoverStep error={discoveryError} />}

      {step === 'map' && discoveryResult && (
        <MappingStep
          fields={discoveryResult.fields}
          mappings={mappings}
          onChange={setMappings}
          onBack={() => setStep('provider')}
          onNext={handlePreview}
        />
      )}

      {step === 'preview' && (
        previewLoading ? (
          <div className="text-sm text-muted flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Fetching preview from remote PIM…
          </div>
        ) : (
          <PreviewStep
            products={previewProducts}
            error={previewError}
            saveState={saveState}
            onBack={() => setStep('map')}
            onSave={handleSave}
          />
        )
      )}
    </div>
  );
}
