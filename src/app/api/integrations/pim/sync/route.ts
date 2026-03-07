import { NextResponse } from 'next/server';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { readIntegratorConfig, writeIntegratorConfig } from '@/infrastructure/pim/integrator-config-store';
import { HttpPimProvider } from '@/infrastructure/pim/http-pim-provider';
import type { ImportedSnapshot } from '@/infrastructure/pim/imported-pim-provider';

const IMPORT_PATH = join(process.cwd(), 'data', 'pim-imported.json');

export async function POST() {
  const cfg = readIntegratorConfig();

  if (!cfg.enabled || !cfg.provider) {
    return NextResponse.json({ error: 'Integrator is not configured or enabled' }, { status: 400 });
  }

  try {
    const pim = new HttpPimProvider(cfg.provider, cfg.mappings);
    const [products, categories] = await Promise.all([
      pim.fetchAllProducts(),
      pim.getCategories(),
    ]);

    const snapshot: ImportedSnapshot = {
      products,
      categories,
      syncedAt: new Date().toISOString(),
    };

    writeFileSync(IMPORT_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');

    // Stamp the sync time on the config
    writeIntegratorConfig({ ...cfg, lastSync: snapshot.syncedAt });

    return NextResponse.json({ count: products.length, syncedAt: snapshot.syncedAt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
