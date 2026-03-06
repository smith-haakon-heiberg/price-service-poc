import { calculatePrice } from '@/domain/price-calculator';
import type { PimProvider } from '@/domain/pim-provider';
import type { PriceRuleRepository, PricelistRepository } from '@/domain/repositories';
import type {
  EffectivePrice,
  PriceContext,
  PriceRule,
  Pricelist,
  RuleFilter,
  Product,
  Category,
  Warehouse,
  ProductFilter,
} from '@/domain/types';

export class PriceService {
  constructor(
    private readonly ruleRepo: PriceRuleRepository,
    private readonly pricelistRepo: PricelistRepository,
    private readonly pimProvider: PimProvider
  ) {}

  // --- Price Calculation ---

  async calculatePrice(context: PriceContext): Promise<EffectivePrice> {
    const product = await this.pimProvider.getProduct(context.sku);
    if (!product) {
      throw new PriceServiceError(`Product not found: ${context.sku}`, 'PRODUCT_NOT_FOUND');
    }

    const rules = await this.ruleRepo.findMatchingRules(context);
    return calculatePrice(product, context, rules);
  }

  async calculateBatchPrices(
    contexts: PriceContext[]
  ): Promise<EffectivePrice[]> {
    return Promise.all(contexts.map(ctx => this.calculatePrice(ctx)));
  }

  // --- Rule Management ---

  async getRule(id: string): Promise<PriceRule | null> {
    return this.ruleRepo.findById(id);
  }

  async listRules(filter?: RuleFilter): Promise<PriceRule[]> {
    return this.ruleRepo.findAll(filter);
  }

  async createRule(rule: PriceRule): Promise<PriceRule> {
    return this.ruleRepo.save(rule);
  }

  async updateRule(
    id: string,
    updates: Partial<Omit<PriceRule, 'id' | 'createdAt'>>
  ): Promise<PriceRule> {
    return this.ruleRepo.update(id, updates);
  }

  async deleteRule(id: string): Promise<void> {
    return this.ruleRepo.delete(id);
  }

  // --- Pricelist Management ---

  async getPricelist(id: string): Promise<Pricelist | null> {
    return this.pricelistRepo.findById(id);
  }

  async listPricelists(): Promise<Pricelist[]> {
    return this.pricelistRepo.findAll();
  }

  async getPricelistWithRules(id: string): Promise<{ pricelist: Pricelist; rules: PriceRule[] } | null> {
    const pricelist = await this.pricelistRepo.findById(id);
    if (!pricelist) return null;
    const rules = await this.ruleRepo.findByPricelistId(id);
    return { pricelist, rules };
  }

  async createPricelist(pricelist: Pricelist): Promise<Pricelist> {
    return this.pricelistRepo.save(pricelist);
  }

  async updatePricelist(
    id: string,
    updates: Partial<Omit<Pricelist, 'id' | 'createdAt'>>
  ): Promise<Pricelist> {
    return this.pricelistRepo.update(id, updates);
  }

  async deletePricelist(id: string): Promise<void> {
    return this.pricelistRepo.delete(id);
  }

  // --- Product/PIM Access ---

  async getProduct(sku: string): Promise<Product | null> {
    return this.pimProvider.getProduct(sku);
  }

  async listProducts(filter?: ProductFilter): Promise<Product[]> {
    return this.pimProvider.getProducts(filter);
  }

  async getCategories(): Promise<Category[]> {
    return this.pimProvider.getCategories();
  }

  async getWarehouses(): Promise<Warehouse[]> {
    return this.pimProvider.getWarehouses();
  }
}

export class PriceServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'PriceServiceError';
  }
}
