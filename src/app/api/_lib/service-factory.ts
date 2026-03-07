import { PriceService } from '@/application/price-service';
import { getDatabase } from '@/infrastructure/db/database';
import { SqlitePriceRuleRepository } from '@/infrastructure/db/sqlite-rule-repository';
import { SqlitePricelistRepository } from '@/infrastructure/db/sqlite-pricelist-repository';
import { JsonPimProvider } from '@/infrastructure/pim/json-pim-provider';
import { ImportedPimProvider, readImportedSnapshot } from '@/infrastructure/pim/imported-pim-provider';
import { readIntegratorConfig } from '@/infrastructure/pim/integrator-config-store';
import type { PimProvider } from '@/domain/pim-provider';

function buildPimProvider(): PimProvider {
  const cfg = readIntegratorConfig();
  if (cfg.enabled) {
    const snapshot = readImportedSnapshot();
    if (snapshot) {
      return new ImportedPimProvider(snapshot);
    }
  }
  return new JsonPimProvider();
}

export function getPriceService(): PriceService {
  const db = getDatabase();
  const ruleRepo = new SqlitePriceRuleRepository(db);
  const pricelistRepo = new SqlitePricelistRepository(db);
  return new PriceService(ruleRepo, pricelistRepo, buildPimProvider());
}
