import { describe, it, expect } from 'vitest';
import { applyAdjustment, calculatePrice } from '@/domain/price-calculator';
import {
  AdjustmentType,
  ConditionField,
  ConditionOperator,
  RuleType,
  type PriceContext,
  type PriceRule,
  type Product,
} from '@/domain/types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const testProduct: Product = {
  sku: 'TEST-001',
  name: 'Test Pipe 50mm',
  categoryId: 'plumbing',
  brand: 'Geberit',
  outletFlag: false,
  basePrice: 10000, // 100 NOK in ore
  unit: 'stk',
  warehouseIds: ['oslo', 'bergen'],
};

const baseContext: PriceContext = {
  sku: 'TEST-001',
  customerType: 'private',
  quantity: 1,
  date: '2025-06-15',
};

// ---------------------------------------------------------------------------
// Helpers for building rules
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
// applyAdjustment
// ---------------------------------------------------------------------------

describe('applyAdjustment', () => {
  const base = 10000; // 100.00 NOK in ore

  describe('FIXED', () => {
    it('returns the fixed value regardless of base price', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.FIXED, value: 7500 })).toBe(7500);
    });

    it('rounds the fixed value', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.FIXED, value: 7500.9 })).toBe(7501);
    });
  });

  describe('PERCENTAGE_MARKUP', () => {
    it('applies 25% markup: 10000 * 1.25 = 12500', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.PERCENTAGE_MARKUP, value: 25 })).toBe(12500);
    });

    it('applies 0% markup: returns base price unchanged', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.PERCENTAGE_MARKUP, value: 0 })).toBe(10000);
    });

    it('applies 100% markup: doubles the price', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.PERCENTAGE_MARKUP, value: 100 })).toBe(20000);
    });

    it('rounds fractional ore result', () => {
      // 10000 * 1.333 = 13330
      expect(applyAdjustment(10000, { type: AdjustmentType.PERCENTAGE_MARKUP, value: 33.3 })).toBe(13330);
    });
  });

  describe('PERCENTAGE_DISCOUNT', () => {
    it('applies 10% discount: 10000 * 0.9 = 9000', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 })).toBe(9000);
    });

    it('applies 0% discount: returns base price unchanged', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 0 })).toBe(10000);
    });

    it('applies 100% discount: returns 0', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 100 })).toBe(0);
    });

    it('applies 50% discount: 10000 * 0.5 = 5000', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 50 })).toBe(5000);
    });
  });

  describe('ABSOLUTE_DISCOUNT', () => {
    it('subtracts the absolute discount amount: 10000 - 5000 = 5000', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.ABSOLUTE_DISCOUNT, value: 5000 })).toBe(5000);
    });

    it('does not go below 0 even if discount exceeds base price', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.ABSOLUTE_DISCOUNT, value: 15000 })).toBe(0);
    });

    it('subtracts 0 discount: returns base price unchanged', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.ABSOLUTE_DISCOUNT, value: 0 })).toBe(10000);
    });

    it('floors at exactly 0 when discount equals base price', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.ABSOLUTE_DISCOUNT, value: 10000 })).toBe(0);
    });
  });

  describe('MARGIN', () => {
    it('applies 30% margin: 10000 / 0.7 = 14286 (rounded)', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.MARGIN, value: 30 })).toBe(14286);
    });

    it('applies 50% margin: 10000 / 0.5 = 20000', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.MARGIN, value: 50 })).toBe(20000);
    });

    it('applies 0% margin: returns base price unchanged', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.MARGIN, value: 0 })).toBe(10000);
    });

    it('returns base price when margin >= 100 (invalid, guard rail)', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.MARGIN, value: 100 })).toBe(10000);
    });

    it('returns base price when margin > 100 (invalid, guard rail)', () => {
      expect(applyAdjustment(base, { type: AdjustmentType.MARGIN, value: 120 })).toBe(10000);
    });
  });
});

// ---------------------------------------------------------------------------
// calculatePrice
// ---------------------------------------------------------------------------

describe('calculatePrice', () => {
  // -------------------------------------------------------------------------
  // No rules
  // -------------------------------------------------------------------------

  describe('no rules', () => {
    it('returns base price when no rules are provided', () => {
      const result = calculatePrice(testProduct, baseContext, []);
      expect(result.finalPrice).toBe(testProduct.basePrice);
      expect(result.appliedRules).toHaveLength(0);
      expect(result.allCandidates).toHaveLength(0);
    });

    it('sets sku and productName on the result', () => {
      const result = calculatePrice(testProduct, baseContext, []);
      expect(result.sku).toBe('TEST-001');
      expect(result.productName).toBe('Test Pipe 50mm');
    });

    it('sets currency to NOK', () => {
      const result = calculatePrice(testProduct, baseContext, []);
      expect(result.currency).toBe('NOK');
    });

    it('includes explanation mentioning base price', () => {
      const result = calculatePrice(testProduct, baseContext, []);
      expect(result.explanation.some(e => e.includes('base') || e.includes('10000'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Single matching rule
  // -------------------------------------------------------------------------

  describe('single matching rule', () => {
    it('applies the matching rule and returns its calculated price', () => {
      const rule = makeRule({
        id: 'rule-1',
        name: 'Category Base Price',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 50 }, // 10000 * 1.5 = 15000
      });

      const result = calculatePrice(testProduct, baseContext, [rule]);
      expect(result.finalPrice).toBe(15000);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].ruleId).toBe('rule-1');
      expect(result.allCandidates).toHaveLength(1);
    });

    it('candidate has correct priceBeforeRule and calculatedPrice', () => {
      const rule = makeRule({
        id: 'rule-1',
        name: 'Category Base Price',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 }, // 10000 -> 14000
      });

      const result = calculatePrice(testProduct, baseContext, [rule]);
      expect(result.appliedRules[0].priceBeforeRule).toBe(10000);
      expect(result.appliedRules[0].calculatedPrice).toBe(14000);
    });

    it('single rule with override: true is applied and override flag is set on candidate', () => {
      const rule = makeRule({
        id: 'override-only',
        name: 'Override Rule',
        type: RuleType.BASE_PRODUCT,
        priority: 200,
        override: true,
        adjustment: { type: AdjustmentType.FIXED, value: 9000 },
      });

      const result = calculatePrice(testProduct, baseContext, [rule]);
      expect(result.finalPrice).toBe(9000);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].override).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Stacking: core new behavior
  // -------------------------------------------------------------------------

  describe('stacking rules', () => {
    it('two rules stack in priority order: markup then discount', () => {
      // base=10000
      // rule1 (pri 100): +40% markup -> 10000 * 1.4 = 14000
      // rule2 (pri 300): -10% discount -> 14000 * 0.9 = 12600
      const markupRule = makeRule({
        id: 'cat-markup',
        name: 'Category Markup',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const discountRule = makeRule({
        id: 'member-discount',
        name: 'Member Discount',
        type: RuleType.MEMBER_CAMPAIGN,
        priority: 300,
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 },
      });

      const result = calculatePrice(testProduct, baseContext, [markupRule, discountRule]);

      expect(result.appliedRules).toHaveLength(2);
      // Applied in ascending priority: pri 100 first, then pri 300
      expect(result.appliedRules[0].ruleId).toBe('cat-markup');
      expect(result.appliedRules[1].ruleId).toBe('member-discount');

      // Prices flow through the chain
      expect(result.appliedRules[0].priceBeforeRule).toBe(10000);
      expect(result.appliedRules[0].calculatedPrice).toBe(14000);
      expect(result.appliedRules[1].priceBeforeRule).toBe(14000);
      expect(result.appliedRules[1].calculatedPrice).toBe(12600);

      expect(result.finalPrice).toBe(12600);
    });

    it('three rules stack: base markup + professional discount + customer discount', () => {
      // base=10000
      // BASE_CATEGORY (pri 100): +40% -> 14000
      // PROFESSIONAL_GENERAL (pri 400): -15% -> 14000 * 0.85 = 11900
      // CUSTOMER_PRICELIST (pri 500): -22% -> 11900 * 0.78 = 9282
      const baseCategoryRule = makeRule({
        id: 'base-cat',
        name: 'Base Category',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const professionalRule = makeRule({
        id: 'prof-general',
        name: 'Professional General',
        type: RuleType.PROFESSIONAL_GENERAL,
        priority: 400,
        conditions: [
          { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 15 },
      });

      const customerRule = makeRule({
        id: 'cust-pricelist',
        name: 'Customer Pricelist',
        type: RuleType.CUSTOMER_PRICELIST,
        priority: 500,
        conditions: [
          { field: ConditionField.CUSTOMER_ID, operator: ConditionOperator.EQ, value: 'CUST-99' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 22 },
      });

      const ctx: PriceContext = {
        ...baseContext,
        customerType: 'professional',
        customerId: 'CUST-99',
      };

      const result = calculatePrice(testProduct, ctx, [baseCategoryRule, professionalRule, customerRule]);

      expect(result.appliedRules).toHaveLength(3);
      expect(result.appliedRules[0].ruleId).toBe('base-cat');
      expect(result.appliedRules[1].ruleId).toBe('prof-general');
      expect(result.appliedRules[2].ruleId).toBe('cust-pricelist');

      expect(result.appliedRules[0].priceBeforeRule).toBe(10000);
      expect(result.appliedRules[0].calculatedPrice).toBe(14000);
      expect(result.appliedRules[1].priceBeforeRule).toBe(14000);
      expect(result.appliedRules[1].calculatedPrice).toBe(11900);
      expect(result.appliedRules[2].priceBeforeRule).toBe(11900);
      expect(result.appliedRules[2].calculatedPrice).toBe(9282);

      expect(result.finalPrice).toBe(9282);
    });

    it('allCandidates contains all matched rules regardless of stack position', () => {
      const rule100 = makeRule({ id: 'r100', name: 'Prio 100', priority: 100 });
      const rule300 = makeRule({ id: 'r300', name: 'Prio 300', priority: 300, type: RuleType.MEMBER_CAMPAIGN });
      const rule500 = makeRule({ id: 'r500', name: 'Prio 500', priority: 500, type: RuleType.CUSTOMER_PRICELIST });

      const result = calculatePrice(testProduct, baseContext, [rule100, rule300, rule500]);
      expect(result.allCandidates).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Override stops chain
  // -------------------------------------------------------------------------

  describe('override stops chain', () => {
    it('override rule stops the chain; rules after it are not in appliedRules', () => {
      // rule A (pri 100): +40% -> 14000
      // rule B (pri 200, override): fixed 8000 -> chain stops
      // rule C (pri 300): -10% -> would further reduce but never applied
      const ruleA = makeRule({
        id: 'rule-a',
        name: 'Rule A Markup',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const ruleB = makeRule({
        id: 'rule-b',
        name: 'Rule B Override',
        type: RuleType.OUTLET,
        priority: 200,
        override: true,
        adjustment: { type: AdjustmentType.FIXED, value: 8000 },
      });

      const ruleC = makeRule({
        id: 'rule-c',
        name: 'Rule C Discount',
        type: RuleType.MEMBER_CAMPAIGN,
        priority: 300,
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 },
      });

      const result = calculatePrice(testProduct, baseContext, [ruleA, ruleB, ruleC]);

      // Only A and B applied; C was matched but chain stopped
      expect(result.appliedRules).toHaveLength(2);
      expect(result.appliedRules[0].ruleId).toBe('rule-a');
      expect(result.appliedRules[1].ruleId).toBe('rule-b');
      expect(result.appliedRules[1].override).toBe(true);

      // All three appear in allCandidates
      expect(result.allCandidates).toHaveLength(3);
      expect(result.allCandidates.some(c => c.ruleId === 'rule-c')).toBe(true);

      expect(result.finalPrice).toBe(8000);
    });

    it('override rule correctly sets priceBeforeRule and calculatedPrice on the override candidate', () => {
      const ruleA = makeRule({
        id: 'rule-a',
        name: 'Rule A Markup',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 }, // 10000 -> 14000
      });

      const ruleB = makeRule({
        id: 'rule-b',
        name: 'Rule B Override',
        type: RuleType.OUTLET,
        priority: 200,
        override: true,
        adjustment: { type: AdjustmentType.FIXED, value: 8000 },
      });

      const result = calculatePrice(testProduct, baseContext, [ruleA, ruleB]);

      expect(result.appliedRules[1].priceBeforeRule).toBe(14000);
      expect(result.appliedRules[1].calculatedPrice).toBe(8000);
    });

    it('candidates after an override store priceBeforeRule as the override price (the running price after the chain stopped)', () => {
      // After override sets price to 8000, any unapplied candidate's
      // priceBeforeRule should reflect the running price at that point (8000)
      const ruleA = makeRule({
        id: 'rule-a',
        name: 'Rule A',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 }, // -> 14000
      });

      const ruleB = makeRule({
        id: 'rule-b',
        name: 'Rule B Override',
        type: RuleType.OUTLET,
        priority: 200,
        override: true,
        adjustment: { type: AdjustmentType.FIXED, value: 8000 }, // -> 8000, stops chain
      });

      const ruleC = makeRule({
        id: 'rule-c',
        name: 'Rule C Discount',
        type: RuleType.MEMBER_CAMPAIGN,
        priority: 300,
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 },
      });

      const result = calculatePrice(testProduct, baseContext, [ruleA, ruleB, ruleC]);

      const candidateC = result.allCandidates.find(c => c.ruleId === 'rule-c');
      expect(candidateC).toBeDefined();
      expect(candidateC!.priceBeforeRule).toBe(8000);
      expect(candidateC!.calculatedPrice).toBe(7200); // 8000 * 0.9
    });
  });

  // -------------------------------------------------------------------------
  // Disabled rules are skipped
  // -------------------------------------------------------------------------

  describe('disabled rules', () => {
    it('skips disabled rules entirely - not in appliedRules or allCandidates', () => {
      const disabledRule = makeRule({
        id: 'disabled',
        name: 'Disabled Rule',
        enabled: false,
        priority: 500,
        adjustment: { type: AdjustmentType.FIXED, value: 5000 },
      });

      const result = calculatePrice(testProduct, baseContext, [disabledRule]);
      expect(result.allCandidates).toHaveLength(0);
      expect(result.appliedRules).toHaveLength(0);
      expect(result.finalPrice).toBe(testProduct.basePrice);
    });

    it('explanation mentions disabled rule was skipped', () => {
      const disabledRule = makeRule({
        id: 'disabled',
        name: 'Disabled Rule',
        enabled: false,
        priority: 500,
        adjustment: { type: AdjustmentType.FIXED, value: 5000 },
      });

      const result = calculatePrice(testProduct, baseContext, [disabledRule]);
      expect(result.explanation.some(e => e.includes('disabled'))).toBe(true);
    });

    it('disabled rule does not interfere with other enabled rules stacking', () => {
      const disabledRule = makeRule({
        id: 'disabled',
        name: 'Disabled Rule',
        enabled: false,
        priority: 150,
        adjustment: { type: AdjustmentType.FIXED, value: 1 }, // would wreck the price
      });

      const enabledRule = makeRule({
        id: 'enabled',
        name: 'Enabled Rule',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 }, // 10000 -> 14000
      });

      const result = calculatePrice(testProduct, baseContext, [disabledRule, enabledRule]);
      expect(result.finalPrice).toBe(14000);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].ruleId).toBe('enabled');
    });
  });

  // -------------------------------------------------------------------------
  // Validity period filtering
  // -------------------------------------------------------------------------

  describe('validity period filtering', () => {
    it('skips rules outside validity period', () => {
      const expiredRule = makeRule({
        id: 'expired',
        name: 'Expired Rule',
        priority: 500,
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
        adjustment: { type: AdjustmentType.FIXED, value: 5000 },
      });

      // baseContext.date is '2025-06-15', which is after validTo
      const result = calculatePrice(testProduct, baseContext, [expiredRule]);
      expect(result.allCandidates).toHaveLength(0);
      expect(result.appliedRules).toHaveLength(0);
      expect(result.finalPrice).toBe(testProduct.basePrice);
    });

    it('applies a rule that is within validity period', () => {
      const activeRule = makeRule({
        id: 'active',
        name: 'Active Rule',
        priority: 500,
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
        adjustment: { type: AdjustmentType.FIXED, value: 8888 },
      });

      const result = calculatePrice(testProduct, baseContext, [activeRule]);
      expect(result.finalPrice).toBe(8888);
    });

    it('skips a future rule not yet valid', () => {
      const futureRule = makeRule({
        id: 'future',
        name: 'Future Rule',
        priority: 500,
        validFrom: '2025-07-01',
        adjustment: { type: AdjustmentType.FIXED, value: 5000 },
      });

      const result = calculatePrice(testProduct, baseContext, [futureRule]);
      expect(result.allCandidates).toHaveLength(0);
    });

    it('expired rule does not appear in the stacking chain', () => {
      const expiredRule = makeRule({
        id: 'expired',
        name: 'Expired Markup',
        priority: 100,
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const activeRule = makeRule({
        id: 'active-discount',
        name: 'Active Discount',
        type: RuleType.MEMBER_CAMPAIGN,
        priority: 300,
        validFrom: '2025-01-01',
        validTo: '2025-12-31',
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 },
      });

      // Only active rule applies; discount is on base price (10000), not on 14000
      const result = calculatePrice(testProduct, baseContext, [expiredRule, activeRule]);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].ruleId).toBe('active-discount');
      expect(result.appliedRules[0].priceBeforeRule).toBe(10000);
      expect(result.finalPrice).toBe(9000); // 10000 * 0.9
    });
  });

  // -------------------------------------------------------------------------
  // Ordering within same priority (tie-breaking)
  // -------------------------------------------------------------------------

  describe('tie-breaking within same priority', () => {
    it('lower specificity (more general) is applied first when priority is equal', () => {
      // Both same priority; cat-rule (score 50) < sku-rule (score 100)
      // In stacking model, lower specificity applies first (more general first)
      const categoryRule = makeRule({
        id: 'cat-rule',
        name: 'Category Rule',
        priority: 200,
        conditions: [
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 }, // 10000 -> 14000
      });

      const skuRule = makeRule({
        id: 'sku-rule',
        name: 'SKU Rule',
        priority: 200,
        conditions: [
          { field: ConditionField.SKU, operator: ConditionOperator.EQ, value: 'TEST-001' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 }, // applied on top -> 12600
      });

      const result = calculatePrice(testProduct, baseContext, [categoryRule, skuRule]);
      expect(result.appliedRules[0].ruleId).toBe('cat-rule');
      expect(result.appliedRules[1].ruleId).toBe('sku-rule');
      expect(result.finalPrice).toBe(12600);
    });

    it('fewer conditions applied first when priority and specificity score are equal', () => {
      // fewerConditions: 1 condition, score 50
      // moreConditions: 2 conditions, score 60 (category 50 + customerType 10)
      // fewerConditions sorts before moreConditions -> applied first
      const fewerConditions = makeRule({
        id: 'fewer',
        name: 'Fewer Conditions',
        priority: 200,
        conditions: [
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 }, // 10000 -> 14000
      });

      const moreConditions = makeRule({
        id: 'more',
        name: 'More Conditions',
        priority: 200,
        conditions: [
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
          { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'private' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 }, // 14000 * 0.9 -> 12600
      });

      const result = calculatePrice(testProduct, baseContext, [fewerConditions, moreConditions]);
      expect(result.appliedRules[0].ruleId).toBe('fewer');
      expect(result.appliedRules[1].ruleId).toBe('more');
      expect(result.finalPrice).toBe(12600);
    });

    it('alphabetically earlier ID applied first when all other tie-breaks are equal', () => {
      // rule-a < rule-b alphabetically -> rule-a applied first
      const ruleA = makeRule({
        id: 'rule-a',
        name: 'Rule A',
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 }, // 10000 -> 14000
      });

      const ruleB = makeRule({
        id: 'rule-b',
        name: 'Rule B',
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 }, // 14000 -> 12600
      });

      const result = calculatePrice(testProduct, baseContext, [ruleA, ruleB]);
      expect(result.appliedRules[0].ruleId).toBe('rule-a');
      expect(result.appliedRules[1].ruleId).toBe('rule-b');
      expect(result.finalPrice).toBe(12600);
    });

    it('rule with later validFrom is applied after rule with earlier validFrom at same priority and specificity', () => {
      const olderRule = makeRule({
        id: 'older',
        name: 'Older Rule',
        priority: 100,
        validFrom: '2024-01-01',
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 }, // 10000 -> 14000
      });

      const newerRule = makeRule({
        id: 'newer',
        name: 'Newer Rule',
        priority: 100,
        validFrom: '2025-01-01',
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 }, // 14000 -> 12600
      });

      const result = calculatePrice(testProduct, baseContext, [olderRule, newerRule]);
      expect(result.appliedRules[0].ruleId).toBe('older');
      expect(result.appliedRules[1].ruleId).toBe('newer');
      expect(result.finalPrice).toBe(12600);
    });
  });

  // -------------------------------------------------------------------------
  // Quantity discounts applied on top of stacked price
  // -------------------------------------------------------------------------

  describe('quantity discounts', () => {
    const markupRule = makeRule({
      id: 'base',
      name: 'Base Category',
      type: RuleType.BASE_CATEGORY,
      priority: 100,
      adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 50 }, // 10000 -> 15000
    });

    const quantityDiscountRule = makeRule({
      id: 'qty-discount',
      name: 'Volume Discount',
      type: RuleType.QUANTITY_DISCOUNT,
      priority: 700,
      adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 0 }, // unused directly
      quantityBreaks: [
        { minQuantity: 5, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 5 } },
        { minQuantity: 10, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 } },
        { minQuantity: 25, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 15 } },
      ],
    });

    it('applies quantity discount on top of stacked price', () => {
      // Stacked price: 15000; qty=10 -> 10% off -> 13500
      const ctx = { ...baseContext, quantity: 10 };
      const result = calculatePrice(testProduct, ctx, [markupRule, quantityDiscountRule]);
      expect(result.quantityDiscount).toBeDefined();
      expect(result.finalPrice).toBe(13500);
    });

    it('picks the highest qualifying break', () => {
      // qty=30 qualifies for 5, 10, and 25 min – should pick 25 (15% off)
      // stacked price: 15000; 15% off -> 12750
      const ctx = { ...baseContext, quantity: 30 };
      const result = calculatePrice(testProduct, ctx, [markupRule, quantityDiscountRule]);
      expect(result.quantityDiscount?.quantityBreak.minQuantity).toBe(25);
      expect(result.finalPrice).toBe(12750);
    });

    it('does not apply quantity discount when quantity is below all thresholds', () => {
      // qty=1 does not meet minQuantity=5
      const ctx = { ...baseContext, quantity: 1 };
      const result = calculatePrice(testProduct, ctx, [markupRule, quantityDiscountRule]);
      expect(result.quantityDiscount).toBeUndefined();
      expect(result.finalPrice).toBe(15000);
    });

    it('applies the lowest price when multiple quantity discount rules match', () => {
      const betterQtyRule = makeRule({
        id: 'better-qty',
        name: 'Better Volume Discount',
        type: RuleType.QUANTITY_DISCOUNT,
        priority: 700,
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 0 },
        quantityBreaks: [
          { minQuantity: 10, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 20 } },
        ],
      });

      const ctx = { ...baseContext, quantity: 10 };
      // stacked price: 15000; betterQtyRule gives 20% off = 12000; quantityDiscountRule gives 10% off = 13500
      const result = calculatePrice(testProduct, ctx, [markupRule, quantityDiscountRule, betterQtyRule]);
      expect(result.finalPrice).toBe(12000);
      expect(result.quantityDiscount?.ruleId).toBe('better-qty');
    });

    it('quantity discount is applied to the final stacked price, not the base price', () => {
      // Two stacking rules: base markup (pri 100) + member discount (pri 300)
      // 10000 -> 14000 -> 12600
      // Then qty discount: 10% off 12600 = 11340
      const memberDiscountRule = makeRule({
        id: 'member-disc',
        name: 'Member Discount',
        type: RuleType.MEMBER_CAMPAIGN,
        priority: 300,
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 }, // 14000 -> 12600
      });

      const qtyRule = makeRule({
        id: 'qty',
        name: 'Qty Discount',
        type: RuleType.QUANTITY_DISCOUNT,
        priority: 700,
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 0 },
        quantityBreaks: [
          { minQuantity: 5, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 } },
        ],
      });

      const baseCatRule = makeRule({
        id: 'base-cat',
        name: 'Base Category',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 }, // 10000 -> 14000
      });

      const ctx = { ...baseContext, quantity: 5 };
      const result = calculatePrice(testProduct, ctx, [baseCatRule, memberDiscountRule, qtyRule]);

      // Stacked: 10000 -> 14000 -> 12600, then qty 10% off: 12600 * 0.9 = 11340
      expect(result.appliedRules).toHaveLength(2);
      expect(result.quantityDiscount).toBeDefined();
      expect(result.finalPrice).toBe(11340);
    });
  });

  // -------------------------------------------------------------------------
  // Explanation array
  // -------------------------------------------------------------------------

  describe('explanation', () => {
    it('contains base price entry', () => {
      const result = calculatePrice(testProduct, baseContext, []);
      expect(result.explanation[0]).toContain('10000 ore');
    });

    it('contains APPLIED entry for each rule in the stack', () => {
      const rule = makeRule({
        id: 'r1',
        name: 'My Rule',
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });
      const result = calculatePrice(testProduct, baseContext, [rule]);
      expect(result.explanation.some(e => e.includes('APPLIED'))).toBe(true);
    });

    it('contains OVERRIDE entry for override rules', () => {
      const rule = makeRule({
        id: 'r1',
        name: 'Override Rule',
        override: true,
        adjustment: { type: AdjustmentType.FIXED, value: 9000 },
      });
      const result = calculatePrice(testProduct, baseContext, [rule]);
      expect(result.explanation.some(e => e.includes('OVERRIDE'))).toBe(true);
    });

    it('contains SKIPPED entry for disabled rules', () => {
      const rule = makeRule({
        id: 'r1',
        name: 'Disabled',
        enabled: false,
        adjustment: { type: AdjustmentType.FIXED, value: 9999 },
      });
      const result = calculatePrice(testProduct, baseContext, [rule]);
      expect(result.explanation.some(e => e.includes('SKIPPED'))).toBe(true);
    });

    it('contains NO MATCH entry for rules with failing conditions', () => {
      const rule = makeRule({
        id: 'r1',
        name: 'Mismatching Rule',
        conditions: [{ field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' }],
        adjustment: { type: AdjustmentType.FIXED, value: 5000 },
      });
      const result = calculatePrice(testProduct, baseContext, [rule]);
      expect(result.explanation.some(e => e.includes('NO MATCH'))).toBe(true);
    });

    it('contains MATCHED entry for rules that match', () => {
      const rule = makeRule({ id: 'r1', name: 'Matching Rule', adjustment: { type: AdjustmentType.FIXED, value: 9500 } });
      const result = calculatePrice(testProduct, baseContext, [rule]);
      expect(result.explanation.some(e => e.includes('MATCHED'))).toBe(true);
    });

    it('contains quantity discount entry when quantity discount applies', () => {
      const baseRule = makeRule({
        id: 'base',
        name: 'Base',
        type: RuleType.BASE_CATEGORY,
        adjustment: { type: AdjustmentType.FIXED, value: 12000 },
      });
      const qtyRule = makeRule({
        id: 'qty',
        name: 'Qty Discount',
        type: RuleType.QUANTITY_DISCOUNT,
        priority: 700,
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 0 },
        quantityBreaks: [
          { minQuantity: 5, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 } },
        ],
      });
      const ctx = { ...baseContext, quantity: 5 };
      const result = calculatePrice(testProduct, ctx, [baseRule, qtyRule]);
      expect(result.explanation.some(e => e.includes('Quantity discount'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Full scenarios
  // -------------------------------------------------------------------------

  describe('full scenario: private member buying plumbing product', () => {
    it('base markup stacks with member campaign discount', () => {
      // BASE_CATEGORY (pri 100): +40% -> 14000
      // MEMBER_CAMPAIGN (pri 300): -12% -> 14000 * 0.88 = 12320
      const baseCategoryRule = makeRule({
        id: 'base-plumbing',
        name: 'Base Category Plumbing',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        conditions: [
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const memberCampaignRule = makeRule({
        id: 'member-pipe-sale',
        name: 'Member Pipe Sale',
        type: RuleType.MEMBER_CAMPAIGN,
        priority: 300,
        conditions: [
          { field: ConditionField.MEMBERSHIP_TIER, operator: ConditionOperator.EQ, value: 'premium' },
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 12 },
      });

      const ctx: PriceContext = { ...baseContext, membershipTier: 'premium' };

      const result = calculatePrice(testProduct, ctx, [baseCategoryRule, memberCampaignRule]);
      expect(result.appliedRules).toHaveLength(2);
      expect(result.appliedRules[0].ruleId).toBe('base-plumbing');
      expect(result.appliedRules[1].ruleId).toBe('member-pipe-sale');
      expect(result.finalPrice).toBe(12320);
    });

    it('only base markup applies when customer has no membership', () => {
      const baseCategoryRule = makeRule({
        id: 'base-plumbing',
        name: 'Base Category Plumbing',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        conditions: [
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const memberCampaignRule = makeRule({
        id: 'member-pipe-sale',
        name: 'Member Pipe Sale',
        type: RuleType.MEMBER_CAMPAIGN,
        priority: 300,
        conditions: [
          { field: ConditionField.MEMBERSHIP_TIER, operator: ConditionOperator.EQ, value: 'premium' },
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 12 },
      });

      // no membershipTier in context
      const result = calculatePrice(testProduct, baseContext, [baseCategoryRule, memberCampaignRule]);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].ruleId).toBe('base-plumbing');
      expect(result.finalPrice).toBe(14000);
    });
  });

  describe('full scenario: professional customer with customer agreement', () => {
    it('three rules stack: category markup + professional discount + customer discount', () => {
      // BASE_CATEGORY (pri 100): +40% -> 14000
      // PROFESSIONAL_GENERAL (pri 400): -15% -> 14000 * 0.85 = 11900
      // CUSTOMER_PRICELIST (pri 500): -22% -> 11900 * 0.78 = 9282
      const baseCategoryRule = makeRule({
        id: 'base-cat',
        name: 'Base Category',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        conditions: [
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const professionalGeneralRule = makeRule({
        id: 'prof-general',
        name: 'Professional General',
        type: RuleType.PROFESSIONAL_GENERAL,
        priority: 400,
        conditions: [
          { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 15 },
      });

      const customerPricelistRule = makeRule({
        id: 'cust-pricelist',
        name: 'Customer Pricelist',
        type: RuleType.CUSTOMER_PRICELIST,
        priority: 500,
        conditions: [
          { field: ConditionField.CUSTOMER_ID, operator: ConditionOperator.EQ, value: 'CUST-99' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 22 },
      });

      const ctx: PriceContext = {
        ...baseContext,
        customerType: 'professional',
        customerId: 'CUST-99',
      };

      const result = calculatePrice(testProduct, ctx, [baseCategoryRule, professionalGeneralRule, customerPricelistRule]);

      expect(result.appliedRules).toHaveLength(3);
      expect(result.appliedRules[0].ruleId).toBe('base-cat');
      expect(result.appliedRules[0].calculatedPrice).toBe(14000);
      expect(result.appliedRules[1].ruleId).toBe('prof-general');
      expect(result.appliedRules[1].calculatedPrice).toBe(11900);
      expect(result.appliedRules[2].ruleId).toBe('cust-pricelist');
      expect(result.appliedRules[2].calculatedPrice).toBe(9282);
      expect(result.finalPrice).toBe(9282);
    });
  });

  describe('full scenario: project pricelist with override', () => {
    it('rules apply in ascending priority order; project pricelist override stops chain', () => {
      // Sorted ascending: base(100) -> customer(500) -> project(600)
      // base(100): +40% -> 14000
      // customer(500): -22% -> 14000 * 0.78 = 10920
      // project(600, override): fixed 8500 -> chain stops
      const baseCategoryRule = makeRule({
        id: 'base-cat',
        name: 'Base Category',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        conditions: [
          { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const customerPricelistRule = makeRule({
        id: 'cust-pricelist',
        name: 'Customer Pricelist',
        type: RuleType.CUSTOMER_PRICELIST,
        priority: 500,
        conditions: [
          { field: ConditionField.CUSTOMER_ID, operator: ConditionOperator.EQ, value: 'CUST-99' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 22 },
      });

      const projectPricelistRule = makeRule({
        id: 'proj-pricelist',
        name: 'Project Pricelist',
        type: RuleType.PROJECT_PRICELIST,
        priority: 600,
        override: true,
        conditions: [
          { field: ConditionField.PROJECT_ID, operator: ConditionOperator.EQ, value: 'PROJ-42' },
        ],
        adjustment: { type: AdjustmentType.FIXED, value: 8500 },
      });

      const ctx: PriceContext = {
        ...baseContext,
        customerType: 'professional',
        customerId: 'CUST-99',
        projectId: 'PROJ-42',
      };

      const result = calculatePrice(testProduct, ctx, [baseCategoryRule, customerPricelistRule, projectPricelistRule]);

      expect(result.appliedRules).toHaveLength(3);
      expect(result.appliedRules[0].ruleId).toBe('base-cat');
      expect(result.appliedRules[0].calculatedPrice).toBe(14000);
      expect(result.appliedRules[1].ruleId).toBe('cust-pricelist');
      expect(result.appliedRules[1].priceBeforeRule).toBe(14000);
      expect(result.appliedRules[1].calculatedPrice).toBe(10920);
      expect(result.appliedRules[2].ruleId).toBe('proj-pricelist');
      expect(result.appliedRules[2].priceBeforeRule).toBe(10920);
      expect(result.appliedRules[2].calculatedPrice).toBe(8500);
      expect(result.appliedRules[2].override).toBe(true);
      expect(result.finalPrice).toBe(8500);
    });
  });

  describe('full scenario: outlet product with override', () => {
    it('outlet override stops chain after applying on top of base markup', () => {
      // BASE_CATEGORY (pri 100): +40% -> 14000
      // OUTLET (pri 350, override): -30% on running price -> 14000 * 0.7 = 9800, chain stops
      const baseCategoryRule = makeRule({
        id: 'base-cat',
        name: 'Base Category',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const outletRule = makeRule({
        id: 'outlet',
        name: 'Outlet Discount',
        type: RuleType.OUTLET,
        priority: 350,
        override: true,
        conditions: [
          { field: ConditionField.OUTLET_FLAG, operator: ConditionOperator.EQ, value: true },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 30 },
      });

      const outletProduct = { ...testProduct, outletFlag: true };

      const result = calculatePrice(outletProduct, baseContext, [baseCategoryRule, outletRule]);

      expect(result.appliedRules).toHaveLength(2);
      expect(result.appliedRules[0].ruleId).toBe('base-cat');
      expect(result.appliedRules[0].calculatedPrice).toBe(14000);
      expect(result.appliedRules[1].ruleId).toBe('outlet');
      expect(result.appliedRules[1].priceBeforeRule).toBe(14000);
      expect(result.appliedRules[1].calculatedPrice).toBe(9800);
      expect(result.appliedRules[1].override).toBe(true);
      expect(result.finalPrice).toBe(9800);
    });

    it('outlet rule does NOT apply to non-outlet products', () => {
      const baseCategoryRule = makeRule({
        id: 'base-cat',
        name: 'Base Category',
        type: RuleType.BASE_CATEGORY,
        priority: 100,
        adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
      });

      const outletRule = makeRule({
        id: 'outlet',
        name: 'Outlet Discount',
        type: RuleType.OUTLET,
        priority: 350,
        override: true,
        conditions: [
          { field: ConditionField.OUTLET_FLAG, operator: ConditionOperator.EQ, value: true },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 30 },
      });

      // testProduct.outletFlag is false -> outlet rule does not match
      const result = calculatePrice(testProduct, baseContext, [baseCategoryRule, outletRule]);
      expect(result.appliedRules).toHaveLength(1);
      expect(result.appliedRules[0].ruleId).toBe('base-cat');
      expect(result.finalPrice).toBe(14000);
    });
  });

  describe('full scenario: no matching rules', () => {
    it('appliedRules is empty and finalPrice equals basePrice', () => {
      // Rule with a condition that does not match the context
      const unmatchedRule = makeRule({
        id: 'unmatched',
        name: 'Professional Only',
        type: RuleType.PROFESSIONAL_GENERAL,
        priority: 400,
        conditions: [
          { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
        ],
        adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 20 },
      });

      // baseContext is private customer
      const result = calculatePrice(testProduct, baseContext, [unmatchedRule]);
      expect(result.appliedRules).toHaveLength(0);
      expect(result.allCandidates).toHaveLength(0);
      expect(result.finalPrice).toBe(testProduct.basePrice);
    });
  });
});
