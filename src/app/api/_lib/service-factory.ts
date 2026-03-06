import { PriceService } from '@/application/price-service';
import { getDatabase } from '@/infrastructure/db/database';
import { SqlitePriceRuleRepository } from '@/infrastructure/db/sqlite-rule-repository';
import { SqlitePricelistRepository } from '@/infrastructure/db/sqlite-pricelist-repository';
import { JsonPimProvider } from '@/infrastructure/pim/json-pim-provider';

let service: PriceService | null = null;

export function getPriceService(): PriceService {
  if (!service) {
    const db = getDatabase();
    const ruleRepo = new SqlitePriceRuleRepository(db);
    const pricelistRepo = new SqlitePricelistRepository(db);
    const pimProvider = new JsonPimProvider();
    service = new PriceService(ruleRepo, pricelistRepo, pimProvider);
  }
  return service;
}
