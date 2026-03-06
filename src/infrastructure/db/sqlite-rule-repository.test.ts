import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, closeDatabase } from '@/infrastructure/db';
import { SqlitePriceRuleRepository } from '@/infrastructure/db';
import {
  AdjustmentType,
  ConditionField,
  ConditionOperator,
  RuleType,
  type PriceRule,
  type PriceContext,
} from '@/domain/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRule(overrides: Partial<PriceRule> & { id: string; name: string }): PriceRule {
  return {
    type: RuleType.BASE_CATEGORY,
    priority: 100,
    conditions: [],
    adjustment: { type: AdjustmentType.FIXED, value: 10000 },
    enabled: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let repo: SqlitePriceRuleRepository;

beforeEach(() => {
  // Each test gets a fresh in-memory database because closeDatabase() sets
  // the module-level instance to null and the next getDatabase() call opens
  // a new :memory: database.
  const db = getDatabase();
  repo = new SqlitePriceRuleRepository(db);
});

afterEach(() => {
  closeDatabase();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SqlitePriceRuleRepository', () => {
  // -------------------------------------------------------------------------
  // save / findById round-trip
  // -------------------------------------------------------------------------

  describe('save() and findById() round-trip', () => {
    it('saves a minimal rule and retrieves it by id', async () => {
      const rule = makeRule({ id: 'r-1', name: 'Minimal Rule' });
      await repo.save(rule);

      const found = await repo.findById('r-1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('r-1');
      expect(found!.name).toBe('Minimal Rule');
    });

    it('preserves all scalar fields', async () => {
      const rule = makeRule({
        id: 'r-scalar',
        name: 'Scalar Fields Rule',
        type: RuleType.CUSTOMER_PRICELIST,
        priority: 500,
        enabled: false,
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
        pricelistId: 'pl-cust-1',
        createdAt: '2025-03-01T10:00:00.000Z',
        updatedAt: '2025-03-01T10:00:00.000Z',
      });

      await repo.save(rule);
      const found = await repo.findById('r-scalar');

      expect(found!.type).toBe(RuleType.CUSTOMER_PRICELIST);
      expect(found!.priority).toBe(500);
      expect(found!.enabled).toBe(false);
      expect(found!.validFrom).toBe('2025-01-01');
      expect(found!.validTo).toBe('2025-12-31');
      expect(found!.pricelistId).toBe('pl-cust-1');
      expect(found!.createdAt).toBe('2025-03-01T10:00:00.000Z');
    });

    it('preserves conditions array (JSON round-trip)', async () => {
      const rule = makeRule({
        id: 'r-conditions',
        name: 'Conditions Rule',
        conditions: [
          { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'private' },
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
        ],
      });

      await repo.save(rule);
      const found = await repo.findById('r-conditions');

      expect(found!.conditions).toHaveLength(2);
      expect(found!.conditions[0].field).toBe(ConditionField.CUSTOMER_TYPE);
      expect(found!.conditions[1].field).toBe(ConditionField.CATEGORY_ID);
    });

    it('preserves adjustment (JSON round-trip)', async () => {
      const rule = makeRule({
        id: 'r-adj',
        name: 'Adjustment Rule',
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 35 },
      });

      await repo.save(rule);
      const found = await repo.findById('r-adj');

      expect(found!.adjustment.type).toBe(AdjustmentType.PERCENTAGE_MARKUP);
      expect(found!.adjustment.value).toBe(35);
    });

    it('saves and retrieves quantityBreaks (JSON round-trip)', async () => {
      const rule = makeRule({
        id: 'r-qty',
        name: 'Quantity Breaks Rule',
        type: RuleType.QUANTITY_DISCOUNT,
        priority: 700,
        quantityBreaks: [
          { minQuantity: 5, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 5 } },
          { minQuantity: 10, maxQuantity: 50, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 } },
        ],
      });

      await repo.save(rule);
      const found = await repo.findById('r-qty');

      expect(found!.quantityBreaks).toHaveLength(2);
      expect(found!.quantityBreaks![0].minQuantity).toBe(5);
      expect(found!.quantityBreaks![1].minQuantity).toBe(10);
      expect(found!.quantityBreaks![1].maxQuantity).toBe(50);
    });

    it('saves and retrieves metadata (JSON round-trip)', async () => {
      const rule = makeRule({
        id: 'r-meta',
        name: 'Metadata Rule',
        metadata: { source: 'import', campaign: 'spring-2025' },
      });

      await repo.save(rule);
      const found = await repo.findById('r-meta');

      expect(found!.metadata).toEqual({ source: 'import', campaign: 'spring-2025' });
    });

    it('returns null when id does not exist', async () => {
      const found = await repo.findById('non-existent');
      expect(found).toBeNull();
    });

    it('returns undefined optional fields as undefined (not null)', async () => {
      const rule = makeRule({ id: 'r-optional', name: 'Optional Fields Rule' });
      await repo.save(rule);

      const found = await repo.findById('r-optional');
      expect(found!.validFrom).toBeUndefined();
      expect(found!.validTo).toBeUndefined();
      expect(found!.pricelistId).toBeUndefined();
      expect(found!.metadata).toBeUndefined();
      expect(found!.quantityBreaks).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll()', () => {
    it('returns all saved rules when no filter is applied', async () => {
      await repo.save(makeRule({ id: 'all-1', name: 'Rule 1' }));
      await repo.save(makeRule({ id: 'all-2', name: 'Rule 2', type: RuleType.MEMBER_CAMPAIGN }));
      await repo.save(makeRule({ id: 'all-3', name: 'Rule 3', type: RuleType.CUSTOMER_PRICELIST }));

      const all = await repo.findAll();
      expect(all).toHaveLength(3);
    });

    it('filters by type', async () => {
      await repo.save(makeRule({ id: 'ft-1', name: 'Base Rule', type: RuleType.BASE_CATEGORY }));
      await repo.save(makeRule({ id: 'ft-2', name: 'Member Rule', type: RuleType.MEMBER_CAMPAIGN }));
      await repo.save(makeRule({ id: 'ft-3', name: 'Another Base', type: RuleType.BASE_CATEGORY }));

      const baseCategoryRules = await repo.findAll({ type: RuleType.BASE_CATEGORY });
      expect(baseCategoryRules).toHaveLength(2);
      expect(baseCategoryRules.every(r => r.type === RuleType.BASE_CATEGORY)).toBe(true);
    });

    it('filters by enabled = true', async () => {
      await repo.save(makeRule({ id: 'en-1', name: 'Enabled Rule', enabled: true }));
      await repo.save(makeRule({ id: 'en-2', name: 'Disabled Rule', enabled: false }));

      const enabledRules = await repo.findAll({ enabled: true });
      expect(enabledRules).toHaveLength(1);
      expect(enabledRules[0].id).toBe('en-1');
    });

    it('filters by enabled = false', async () => {
      await repo.save(makeRule({ id: 'dis-1', name: 'Enabled Rule', enabled: true }));
      await repo.save(makeRule({ id: 'dis-2', name: 'Disabled Rule', enabled: false }));

      const disabledRules = await repo.findAll({ enabled: false });
      expect(disabledRules).toHaveLength(1);
      expect(disabledRules[0].id).toBe('dis-2');
    });

    it('returns empty array when no rules match the filter', async () => {
      await repo.save(makeRule({ id: 'nomatch-1', name: 'Some Rule', type: RuleType.BASE_CATEGORY }));

      const result = await repo.findAll({ type: RuleType.PROJECT_PRICELIST });
      expect(result).toHaveLength(0);
    });

    it('returns rules sorted by priority ascending', async () => {
      await repo.save(makeRule({ id: 'sort-3', name: 'High', priority: 500 }));
      await repo.save(makeRule({ id: 'sort-1', name: 'Low', priority: 100 }));
      await repo.save(makeRule({ id: 'sort-2', name: 'Mid', priority: 300 }));

      const all = await repo.findAll();
      expect(all[0].priority).toBe(100);
      expect(all[1].priority).toBe(300);
      expect(all[2].priority).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // findByType
  // -------------------------------------------------------------------------

  describe('findByType()', () => {
    it('returns rules matching the given type', async () => {
      await repo.save(makeRule({ id: 'bt-1', name: 'Outlet 1', type: RuleType.OUTLET }));
      await repo.save(makeRule({ id: 'bt-2', name: 'Outlet 2', type: RuleType.OUTLET }));
      await repo.save(makeRule({ id: 'bt-3', name: 'Other', type: RuleType.BASE_CATEGORY }));

      const outletRules = await repo.findByType(RuleType.OUTLET);
      expect(outletRules).toHaveLength(2);
      expect(outletRules.every(r => r.type === RuleType.OUTLET)).toBe(true);
    });

    it('returns empty array when no rules match the type', async () => {
      await repo.save(makeRule({ id: 'bt-empty-1', name: 'Base', type: RuleType.BASE_CATEGORY }));

      const result = await repo.findByType(RuleType.PROJECT_PRICELIST);
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // findByPricelistId
  // -------------------------------------------------------------------------

  describe('findByPricelistId()', () => {
    it('returns rules associated with the given pricelist id', async () => {
      await repo.save(makeRule({ id: 'pl-r1', name: 'PL Rule 1', pricelistId: 'pricelist-A', type: RuleType.CUSTOMER_PRICELIST }));
      await repo.save(makeRule({ id: 'pl-r2', name: 'PL Rule 2', pricelistId: 'pricelist-A', type: RuleType.CUSTOMER_PRICELIST }));
      await repo.save(makeRule({ id: 'pl-r3', name: 'PL Rule 3', pricelistId: 'pricelist-B', type: RuleType.CUSTOMER_PRICELIST }));

      const plARules = await repo.findByPricelistId('pricelist-A');
      expect(plARules).toHaveLength(2);
      expect(plARules.every(r => r.pricelistId === 'pricelist-A')).toBe(true);
    });

    it('returns empty array when no rules belong to the pricelist', async () => {
      const result = await repo.findByPricelistId('nonexistent-pricelist');
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe('update()', () => {
    it('updates specified fields and returns the merged rule', async () => {
      const rule = makeRule({ id: 'upd-1', name: 'Original Name', priority: 100, enabled: true });
      await repo.save(rule);

      const updated = await repo.update('upd-1', {
        name: 'Updated Name',
        priority: 250,
        enabled: false,
      });

      expect(updated.id).toBe('upd-1');
      expect(updated.name).toBe('Updated Name');
      expect(updated.priority).toBe(250);
      expect(updated.enabled).toBe(false);
    });

    it('persists the update to the database', async () => {
      const rule = makeRule({ id: 'upd-persist', name: 'Before Update' });
      await repo.save(rule);

      await repo.update('upd-persist', { name: 'After Update' });

      const reloaded = await repo.findById('upd-persist');
      expect(reloaded!.name).toBe('After Update');
    });

    it('sets updatedAt to a new timestamp on update', async () => {
      const rule = makeRule({ id: 'upd-ts', name: 'Timestamp Test', updatedAt: '2025-01-01T00:00:00.000Z' });
      await repo.save(rule);

      const updated = await repo.update('upd-ts', { name: 'New Name' });

      // updatedAt should differ from the original
      expect(updated.updatedAt).not.toBe('2025-01-01T00:00:00.000Z');
    });

    it('preserves createdAt unchanged after update', async () => {
      const rule = makeRule({ id: 'upd-cat', name: 'CreatedAt Preserved', createdAt: '2025-01-15T08:30:00.000Z' });
      await repo.save(rule);

      const updated = await repo.update('upd-cat', { name: 'Updated' });
      expect(updated.createdAt).toBe('2025-01-15T08:30:00.000Z');
    });

    it('throws when updating a non-existent rule', async () => {
      await expect(repo.update('ghost-rule', { name: 'Should Fail' })).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete()', () => {
    it('removes the rule so findById returns null afterwards', async () => {
      const rule = makeRule({ id: 'del-1', name: 'To Be Deleted' });
      await repo.save(rule);

      await repo.delete('del-1');

      const found = await repo.findById('del-1');
      expect(found).toBeNull();
    });

    it('does not affect other rules when deleting one', async () => {
      await repo.save(makeRule({ id: 'del-keep', name: 'Keep Me' }));
      await repo.save(makeRule({ id: 'del-gone', name: 'Delete Me' }));

      await repo.delete('del-gone');

      const keepRule = await repo.findById('del-keep');
      expect(keepRule).not.toBeNull();
    });

    it('does not throw when deleting a non-existent id', async () => {
      // delete is idempotent – should not throw
      await expect(repo.delete('totally-nonexistent')).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // findMatchingRules
  // -------------------------------------------------------------------------

  describe('findMatchingRules()', () => {
    it('returns all enabled rules regardless of context (POC behaviour)', async () => {
      await repo.save(makeRule({ id: 'match-1', name: 'Enabled A', enabled: true }));
      await repo.save(makeRule({ id: 'match-2', name: 'Enabled B', enabled: true }));
      await repo.save(makeRule({ id: 'match-3', name: 'Disabled', enabled: false }));

      const ctx: PriceContext = {
        sku: 'ANY-SKU',
        customerType: 'private',
        quantity: 1,
        date: '2025-06-15',
      };

      const rules = await repo.findMatchingRules(ctx);
      // Only enabled rules are returned
      expect(rules).toHaveLength(2);
      expect(rules.every(r => r.enabled)).toBe(true);
    });

    it('returns no rules when all are disabled', async () => {
      await repo.save(makeRule({ id: 'all-dis-1', name: 'Dis 1', enabled: false }));
      await repo.save(makeRule({ id: 'all-dis-2', name: 'Dis 2', enabled: false }));

      const ctx: PriceContext = {
        sku: 'ANY-SKU',
        customerType: 'private',
        quantity: 1,
        date: '2025-06-15',
      };

      const rules = await repo.findMatchingRules(ctx);
      expect(rules).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // upsert behaviour (save idempotency)
  // -------------------------------------------------------------------------

  describe('save() upsert behaviour', () => {
    it('overwrites an existing rule when saved again with the same id', async () => {
      const original = makeRule({ id: 'upsert-1', name: 'Original', priority: 100 });
      await repo.save(original);

      const updated = makeRule({
        id: 'upsert-1',
        name: 'Upserted',
        priority: 200,
        updatedAt: '2025-06-01T12:00:00.000Z',
      });
      await repo.save(updated);

      const found = await repo.findById('upsert-1');
      expect(found!.name).toBe('Upserted');
      expect(found!.priority).toBe(200);
    });
  });
});
