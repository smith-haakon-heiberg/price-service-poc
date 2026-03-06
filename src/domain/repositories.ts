import type {
  PriceContext,
  PriceRule,
  Pricelist,
  RuleFilter,
} from './types';

/**
 * Repository for price rules.
 * Access patterns designed with DynamoDB single-table principles:
 * - findById: PK=RULE#<id>
 * - findMatchingRules: queries multiple lookup keys (SKU#, CAT#, CUST#, PROJ#, GLOBAL)
 * - findByType: PK=RULETYPE#<type>
 * - findByPricelistId: PK=PRICELIST#<id>
 */
export interface PriceRuleRepository {
  findById(id: string): Promise<PriceRule | null>;
  findByType(type: string): Promise<PriceRule[]>;
  findMatchingRules(context: PriceContext): Promise<PriceRule[]>;
  findByPricelistId(pricelistId: string): Promise<PriceRule[]>;
  save(rule: PriceRule): Promise<PriceRule>;
  update(id: string, updates: Partial<Omit<PriceRule, 'id' | 'createdAt'>>): Promise<PriceRule>;
  delete(id: string): Promise<void>;
  findAll(filter?: RuleFilter): Promise<PriceRule[]>;
}

/**
 * Repository for pricelists.
 * Access patterns:
 * - findById: PK=PRICELIST#<id>
 * - findByType: PK=PLISTTYPE#<type>
 * - findByCustomerId: PK=CUST#<custId>, SK begins_with PRICELIST#
 * - findByProjectId: PK=PROJ#<projId>, SK begins_with PRICELIST#
 */
export interface PricelistRepository {
  findById(id: string): Promise<Pricelist | null>;
  findByType(type: string): Promise<Pricelist[]>;
  findByCustomerId(customerId: string): Promise<Pricelist[]>;
  findByProjectId(projectId: string): Promise<Pricelist[]>;
  save(pricelist: Pricelist): Promise<Pricelist>;
  update(id: string, updates: Partial<Omit<Pricelist, 'id' | 'createdAt'>>): Promise<Pricelist>;
  delete(id: string): Promise<void>;
  findAll(): Promise<Pricelist[]>;
}
