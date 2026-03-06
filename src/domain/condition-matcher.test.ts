import { describe, it, expect } from 'vitest';
import { matchConditions, isWithinValidityPeriod } from '@/domain/condition-matcher';
import {
  ConditionField,
  ConditionOperator,
  type PriceContext,
  type Product,
  type RuleCondition,
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
  basePrice: 10000,
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
// Helper to build a simple condition
// ---------------------------------------------------------------------------

function cond(
  field: ConditionField,
  operator: ConditionOperator,
  value: RuleCondition['value'],
): RuleCondition {
  return { field, operator, value };
}

// ---------------------------------------------------------------------------
// matchConditions
// ---------------------------------------------------------------------------

describe('matchConditions', () => {
  // -------------------------------------------------------------------------
  // Empty conditions
  // -------------------------------------------------------------------------

  describe('empty conditions', () => {
    it('returns empty array when conditions list is empty (global rule always matches)', () => {
      const result = matchConditions([], baseContext, testProduct);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // EQ operator
  // -------------------------------------------------------------------------

  describe('EQ operator', () => {
    it('matches string values that are equal', () => {
      const conditions = [cond(ConditionField.SKU, ConditionOperator.EQ, 'TEST-001')];
      expect(matchConditions(conditions, baseContext, testProduct)).toEqual(conditions);
    });

    it('returns null when string values differ', () => {
      const conditions = [cond(ConditionField.SKU, ConditionOperator.EQ, 'OTHER-SKU')];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });

    it('matches number values that are equal', () => {
      const ctx = { ...baseContext, quantity: 5 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.EQ, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('returns null when number values differ', () => {
      const ctx = { ...baseContext, quantity: 3 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.EQ, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });

    it('matches boolean true value', () => {
      const outletProduct = { ...testProduct, outletFlag: true };
      const conditions = [cond(ConditionField.OUTLET_FLAG, ConditionOperator.EQ, true)];
      expect(matchConditions(conditions, baseContext, outletProduct)).toEqual(conditions);
    });

    it('matches boolean false value', () => {
      const conditions = [cond(ConditionField.OUTLET_FLAG, ConditionOperator.EQ, false)];
      expect(matchConditions(conditions, baseContext, testProduct)).toEqual(conditions);
    });

    it('returns null when boolean values differ', () => {
      const conditions = [cond(ConditionField.OUTLET_FLAG, ConditionOperator.EQ, true)];
      // testProduct.outletFlag is false
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // NEQ operator
  // -------------------------------------------------------------------------

  describe('NEQ operator', () => {
    it('matches when values differ', () => {
      const conditions = [cond(ConditionField.CUSTOMER_TYPE, ConditionOperator.NEQ, 'professional')];
      // baseContext.customerType is 'private'
      expect(matchConditions(conditions, baseContext, testProduct)).toEqual(conditions);
    });

    it('returns null when values are equal', () => {
      const conditions = [cond(ConditionField.CUSTOMER_TYPE, ConditionOperator.NEQ, 'private')];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // GT operator
  // -------------------------------------------------------------------------

  describe('GT operator', () => {
    it('matches when actual is greater than expected', () => {
      const ctx = { ...baseContext, quantity: 10 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.GT, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('returns null when actual equals expected (not strictly greater)', () => {
      const ctx = { ...baseContext, quantity: 5 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.GT, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });

    it('returns null when actual is less than expected', () => {
      const ctx = { ...baseContext, quantity: 3 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.GT, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // GTE operator
  // -------------------------------------------------------------------------

  describe('GTE operator', () => {
    it('matches when actual is greater than expected', () => {
      const ctx = { ...baseContext, quantity: 10 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.GTE, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('matches when actual equals expected (boundary)', () => {
      const ctx = { ...baseContext, quantity: 5 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.GTE, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('returns null when actual is less than expected', () => {
      const ctx = { ...baseContext, quantity: 4 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.GTE, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // LT operator
  // -------------------------------------------------------------------------

  describe('LT operator', () => {
    it('matches when actual is less than expected', () => {
      const ctx = { ...baseContext, quantity: 3 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.LT, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('returns null when actual equals expected (not strictly less)', () => {
      const ctx = { ...baseContext, quantity: 5 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.LT, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });

    it('returns null when actual is greater than expected', () => {
      const ctx = { ...baseContext, quantity: 7 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.LT, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // LTE operator
  // -------------------------------------------------------------------------

  describe('LTE operator', () => {
    it('matches when actual is less than expected', () => {
      const ctx = { ...baseContext, quantity: 3 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.LTE, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('matches when actual equals expected (boundary)', () => {
      const ctx = { ...baseContext, quantity: 5 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.LTE, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('returns null when actual is greater than expected', () => {
      const ctx = { ...baseContext, quantity: 6 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.LTE, 5)];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // IN operator
  // -------------------------------------------------------------------------

  describe('IN operator', () => {
    it('matches when actual value is in the array', () => {
      const conditions = [
        cond(ConditionField.CATEGORY_ID, ConditionOperator.IN, ['plumbing', 'electrical', 'hvac']),
      ];
      expect(matchConditions(conditions, baseContext, testProduct)).toEqual(conditions);
    });

    it('returns null when actual value is not in the array', () => {
      const conditions = [
        cond(ConditionField.CATEGORY_ID, ConditionOperator.IN, ['electrical', 'hvac']),
      ];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });

    it('matches numeric field coerced to string in array', () => {
      const ctx = { ...baseContext, quantity: 5 };
      // IN comparison uses String(actual), so number 5 should match '5'
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.IN, ['3', '5', '10'])];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('returns null when expected is not an array', () => {
      const conditions = [cond(ConditionField.CUSTOMER_TYPE, ConditionOperator.IN, 'private' as unknown as string[])];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // BETWEEN operator
  // -------------------------------------------------------------------------

  describe('BETWEEN operator', () => {
    it('matches when number is within the range', () => {
      const ctx = { ...baseContext, quantity: 7 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.BETWEEN, [5, 10])];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('matches at the lower boundary (inclusive)', () => {
      const ctx = { ...baseContext, quantity: 5 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.BETWEEN, [5, 10])];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('matches at the upper boundary (inclusive)', () => {
      const ctx = { ...baseContext, quantity: 10 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.BETWEEN, [5, 10])];
      expect(matchConditions(conditions, ctx, testProduct)).toEqual(conditions);
    });

    it('returns null when number is below the range', () => {
      const ctx = { ...baseContext, quantity: 4 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.BETWEEN, [5, 10])];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });

    it('returns null when number is above the range', () => {
      const ctx = { ...baseContext, quantity: 11 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.BETWEEN, [5, 10])];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });

    it('matches string/date between comparison', () => {
      const conditions = [
        cond(ConditionField.DATE, ConditionOperator.BETWEEN, ['2025-01-01', '2025-12-31']),
      ];
      // baseContext.date is '2025-06-15'
      expect(matchConditions(conditions, baseContext, testProduct)).toEqual(conditions);
    });

    it('returns null when date is before the range', () => {
      const ctx = { ...baseContext, date: '2024-12-31' };
      const conditions = [
        cond(ConditionField.DATE, ConditionOperator.BETWEEN, ['2025-01-01', '2025-12-31']),
      ];
      expect(matchConditions(conditions, ctx, testProduct)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Field resolution from PriceContext and Product
  // -------------------------------------------------------------------------

  describe('condition field resolution', () => {
    it('resolves SKU from context', () => {
      const conditions = [cond(ConditionField.SKU, ConditionOperator.EQ, 'TEST-001')];
      expect(matchConditions(conditions, baseContext, testProduct)).not.toBeNull();
    });

    it('resolves CUSTOMER_TYPE from context', () => {
      const conditions = [cond(ConditionField.CUSTOMER_TYPE, ConditionOperator.EQ, 'private')];
      expect(matchConditions(conditions, baseContext, testProduct)).not.toBeNull();
    });

    it('resolves CUSTOMER_ID from context', () => {
      const ctx = { ...baseContext, customerId: 'CUST-42' };
      const conditions = [cond(ConditionField.CUSTOMER_ID, ConditionOperator.EQ, 'CUST-42')];
      expect(matchConditions(conditions, ctx, testProduct)).not.toBeNull();
    });

    it('resolves PROJECT_ID from context', () => {
      const ctx = { ...baseContext, projectId: 'PROJ-99' };
      const conditions = [cond(ConditionField.PROJECT_ID, ConditionOperator.EQ, 'PROJ-99')];
      expect(matchConditions(conditions, ctx, testProduct)).not.toBeNull();
    });

    it('resolves MEMBERSHIP_TIER from context', () => {
      const ctx = { ...baseContext, membershipTier: 'premium' as const };
      const conditions = [cond(ConditionField.MEMBERSHIP_TIER, ConditionOperator.EQ, 'premium')];
      expect(matchConditions(conditions, ctx, testProduct)).not.toBeNull();
    });

    it('resolves CATEGORY_ID from product', () => {
      const conditions = [cond(ConditionField.CATEGORY_ID, ConditionOperator.EQ, 'plumbing')];
      expect(matchConditions(conditions, baseContext, testProduct)).not.toBeNull();
    });

    it('resolves BRAND from product', () => {
      const conditions = [cond(ConditionField.BRAND, ConditionOperator.EQ, 'Geberit')];
      expect(matchConditions(conditions, baseContext, testProduct)).not.toBeNull();
    });

    it('resolves OUTLET_FLAG from product', () => {
      const conditions = [cond(ConditionField.OUTLET_FLAG, ConditionOperator.EQ, false)];
      expect(matchConditions(conditions, baseContext, testProduct)).not.toBeNull();
    });

    it('resolves WAREHOUSE_ID from context', () => {
      const ctx = { ...baseContext, warehouseId: 'oslo' };
      const conditions = [cond(ConditionField.WAREHOUSE_ID, ConditionOperator.EQ, 'oslo')];
      expect(matchConditions(conditions, ctx, testProduct)).not.toBeNull();
    });

    it('resolves QUANTITY from context', () => {
      const ctx = { ...baseContext, quantity: 25 };
      const conditions = [cond(ConditionField.QUANTITY, ConditionOperator.EQ, 25)];
      expect(matchConditions(conditions, ctx, testProduct)).not.toBeNull();
    });

    it('resolves DATE from context', () => {
      const conditions = [cond(ConditionField.DATE, ConditionOperator.EQ, '2025-06-15')];
      expect(matchConditions(conditions, baseContext, testProduct)).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Multiple conditions (AND logic)
  // -------------------------------------------------------------------------

  describe('multiple conditions (AND logic)', () => {
    it('returns matched conditions when all conditions match', () => {
      const conditions: RuleCondition[] = [
        cond(ConditionField.CUSTOMER_TYPE, ConditionOperator.EQ, 'private'),
        cond(ConditionField.CATEGORY_ID, ConditionOperator.EQ, 'plumbing'),
        cond(ConditionField.BRAND, ConditionOperator.EQ, 'Geberit'),
      ];
      const result = matchConditions(conditions, baseContext, testProduct);
      expect(result).toEqual(conditions);
    });

    it('returns null when the first condition fails', () => {
      const conditions: RuleCondition[] = [
        cond(ConditionField.CUSTOMER_TYPE, ConditionOperator.EQ, 'professional'), // fails
        cond(ConditionField.CATEGORY_ID, ConditionOperator.EQ, 'plumbing'),
      ];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });

    it('returns null when a middle condition fails', () => {
      const conditions: RuleCondition[] = [
        cond(ConditionField.CUSTOMER_TYPE, ConditionOperator.EQ, 'private'),
        cond(ConditionField.CATEGORY_ID, ConditionOperator.EQ, 'electrical'), // fails
        cond(ConditionField.BRAND, ConditionOperator.EQ, 'Geberit'),
      ];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });

    it('returns null when the last condition fails', () => {
      const conditions: RuleCondition[] = [
        cond(ConditionField.CUSTOMER_TYPE, ConditionOperator.EQ, 'private'),
        cond(ConditionField.BRAND, ConditionOperator.EQ, 'WrongBrand'), // fails
      ];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Undefined / missing field values
  // -------------------------------------------------------------------------

  describe('undefined field values', () => {
    it('returns null when CUSTOMER_ID is not set in context', () => {
      // baseContext has no customerId
      const conditions = [cond(ConditionField.CUSTOMER_ID, ConditionOperator.EQ, 'CUST-99')];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });

    it('returns null when PROJECT_ID is not set in context', () => {
      const conditions = [cond(ConditionField.PROJECT_ID, ConditionOperator.EQ, 'PROJ-1')];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });

    it('returns null when MEMBERSHIP_TIER is not set in context', () => {
      const conditions = [cond(ConditionField.MEMBERSHIP_TIER, ConditionOperator.EQ, 'basic')];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });

    it('returns null when WAREHOUSE_ID is not set in context', () => {
      const conditions = [cond(ConditionField.WAREHOUSE_ID, ConditionOperator.EQ, 'oslo')];
      expect(matchConditions(conditions, baseContext, testProduct)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// isWithinValidityPeriod
// ---------------------------------------------------------------------------

describe('isWithinValidityPeriod', () => {
  const today = '2025-06-15';

  it('returns true when neither validFrom nor validTo is set (no bounds)', () => {
    expect(isWithinValidityPeriod(undefined, undefined, today)).toBe(true);
  });

  it('returns true when date is exactly at validFrom (inclusive)', () => {
    expect(isWithinValidityPeriod('2025-06-15', undefined, today)).toBe(true);
  });

  it('returns false when date is before validFrom', () => {
    expect(isWithinValidityPeriod('2025-06-16', undefined, today)).toBe(false);
  });

  it('returns true when date is after validFrom', () => {
    expect(isWithinValidityPeriod('2025-01-01', undefined, today)).toBe(true);
  });

  it('returns true when date is exactly at validTo (inclusive)', () => {
    expect(isWithinValidityPeriod(undefined, '2025-06-15', today)).toBe(true);
  });

  it('returns false when date is after validTo', () => {
    expect(isWithinValidityPeriod(undefined, '2025-06-14', today)).toBe(false);
  });

  it('returns true when date is within validFrom and validTo', () => {
    expect(isWithinValidityPeriod('2025-01-01', '2025-12-31', today)).toBe(true);
  });

  it('returns false when date is before validFrom even though before validTo', () => {
    expect(isWithinValidityPeriod('2025-07-01', '2025-12-31', today)).toBe(false);
  });

  it('returns false when date is after validTo even though after validFrom', () => {
    expect(isWithinValidityPeriod('2025-01-01', '2025-05-31', today)).toBe(false);
  });

  it('returns true when validFrom equals validTo and date matches exactly', () => {
    expect(isWithinValidityPeriod('2025-06-15', '2025-06-15', '2025-06-15')).toBe(true);
  });

  it('returns false when validFrom equals validTo and date is one day before', () => {
    expect(isWithinValidityPeriod('2025-06-15', '2025-06-15', '2025-06-14')).toBe(false);
  });

  it('returns false when validFrom equals validTo and date is one day after', () => {
    expect(isWithinValidityPeriod('2025-06-15', '2025-06-15', '2025-06-16')).toBe(false);
  });
});
