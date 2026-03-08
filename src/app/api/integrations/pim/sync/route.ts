import { NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { readIntegratorConfig, writeIntegratorConfig } from '@/infrastructure/pim/integrator-config-store';
import { HttpPimProvider } from '@/infrastructure/pim/http-pim-provider';
import { readImportedSnapshot } from '@/infrastructure/pim/imported-pim-provider';
import type { ImportedSnapshot } from '@/infrastructure/pim/imported-pim-provider';
import type { Product } from '@/domain/types';

const IMPORT_PATH = join(process.cwd(), 'data', 'pim-imported.json');

interface SyncStats {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
}

/**
 * CRUD-merge incoming products against the existing snapshot.
 * Products are matched by remoteId when available, falling back to sku.
 */
function mergeProducts(existing: Product[], incoming: Product[]): { products: Product[]; stats: SyncStats } {
  const stats: SyncStats = { added: 0, updated: 0, removed: 0, unchanged: 0 };

  // Index existing products by remoteId (or sku if no remoteId)
  const existingByRemoteId = new Map<string, Product>();
  for (const p of existing) {
    existingByRemoteId.set(p.remoteId ?? p.sku, p);
  }

  const incomingByRemoteId = new Map<string, Product>();
  for (const p of incoming) {
    incomingByRemoteId.set(p.remoteId ?? p.sku, p);
  }

  const merged: Product[] = [];

  for (const [key, incomingProduct] of incomingByRemoteId) {
    const existingProduct = existingByRemoteId.get(key);
    if (!existingProduct) {
      stats.added++;
      merged.push(incomingProduct);
    } else if (JSON.stringify(existingProduct) !== JSON.stringify(incomingProduct)) {
      stats.updated++;
      merged.push(incomingProduct);
    } else {
      stats.unchanged++;
      merged.push(existingProduct);
    }
  }

  // Count removed (in existing but not in incoming)
  for (const key of existingByRemoteId.keys()) {
    if (!incomingByRemoteId.has(key)) {
      stats.removed++;
    }
  }

  return { products: merged, stats };
}

export async function POST() {
  const cfg = readIntegratorConfig();

  if (!cfg.enabled || !cfg.provider) {
    return NextResponse.json({ error: 'Integrator is not configured or enabled' }, { status: 400 });
  }

  try {
    const pim = new HttpPimProvider(cfg.provider, cfg.mappings);
    const [incomingProducts, categories] = await Promise.all([
      pim.fetchAllProducts(),
      pim.getCategories(),
    ]);

    const existing = readImportedSnapshot();
    const { products, stats } = mergeProducts(existing?.products ?? [], incomingProducts);

    const snapshot: ImportedSnapshot = {
      products,
      categories,
      syncedAt: new Date().toISOString(),
    };

    writeFileSync(IMPORT_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');

    // Stamp the sync time on the config
    writeIntegratorConfig({ ...cfg, lastSync: snapshot.syncedAt });

    return NextResponse.json({
      count: products.length,
      syncedAt: snapshot.syncedAt,
      stats,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
