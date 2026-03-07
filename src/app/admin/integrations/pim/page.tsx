import { readIntegratorConfig } from '@/infrastructure/pim/integrator-config-store';
import IntegratorClient from './IntegratorClient';

export const dynamic = 'force-dynamic';

export default function PimIntegratorPage() {
  const config = readIntegratorConfig();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">PIM Integrator</h1>
        <p className="text-sm text-muted mt-1">
          Connect an external Product Information Management system and map its data to the
          price-system product schema.
        </p>
      </div>

      {config.provider && (
        <div className="mb-4 flex items-center gap-3 bg-card-bg border border-border rounded px-4 py-3 text-sm">
          <span className={`inline-block w-2 h-2 rounded-full ${config.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span>
            Currently configured:{' '}
            <span className="font-mono font-medium">{config.provider.baseUrl}{config.provider.productsPath}</span>
          </span>
          {config.lastSync && (
            <span className="text-muted ml-auto">
              Last saved: {new Date(config.lastSync).toLocaleString()}
            </span>
          )}
        </div>
      )}

      <IntegratorClient initialConfig={config} />
    </div>
  );
}
