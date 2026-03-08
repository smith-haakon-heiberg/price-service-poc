import { readIntegratorConfig } from '@/infrastructure/pim/integrator-config-store';
import { readImportedSnapshot } from '@/infrastructure/pim/imported-pim-provider';
import IntegratorClient from './IntegratorClient';

export const dynamic = 'force-dynamic';

export default function PimIntegratorPage() {
  const config = readIntegratorConfig();
  const snapshot = readImportedSnapshot();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">PIM Integrator</h1>
        <p className="text-sm text-muted mt-1">
          Connect an external Product Information Management system and map its data to the
          price-system product schema.
        </p>
        {snapshot && (
          <p className="text-sm text-muted mt-0.5">
            {snapshot.products.length} products in local cache · last synced{' '}
            {new Date(snapshot.syncedAt).toLocaleString()}
          </p>
        )}
      </div>

      <IntegratorClient initialConfig={config} />
    </div>
  );
}
