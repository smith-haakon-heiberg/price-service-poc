import {
  ConditionField,
  ConditionOperator,
  type PriceContext,
  type Product,
  type RuleCondition,
} from './types';

/**
 * Resolves the actual value from the PriceContext + Product for a given condition field.
 */
function resolveFieldValue(
  field: ConditionField,
  context: PriceContext,
  product: Product
): string | number | boolean | string[] | undefined {
  switch (field) {
    case ConditionField.SKU:
      return context.sku;
    case ConditionField.CUSTOMER_TYPE:
      return context.customerType;
    case ConditionField.CUSTOMER_ID:
      return context.customerId;
    case ConditionField.PROJECT_ID:
      return context.projectId;
    case ConditionField.MEMBERSHIP_TIER:
      return context.membershipTier;
    case ConditionField.CATEGORY_ID:
      return product.categoryId;
    case ConditionField.WAREHOUSE_ID:
      return context.warehouseId;
    case ConditionField.QUANTITY:
      return context.quantity;
    case ConditionField.DATE:
      return context.date;
    case ConditionField.BRAND:
      return product.brand;
    case ConditionField.OUTLET_FLAG:
      return product.outletFlag;
    default:
      return undefined;
  }
}

/**
 * Evaluates a single condition against the resolved field value.
 */
function evaluateCondition(
  actual: string | number | boolean | string[] | undefined,
  operator: ConditionOperator,
  expected: string | number | boolean | string[] | [number, number]
): boolean {
  if (actual === undefined || actual === null) {
    return false;
  }

  switch (operator) {
    case ConditionOperator.EQ:
      return actual === expected;

    case ConditionOperator.NEQ:
      return actual !== expected;

    case ConditionOperator.GT:
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;

    case ConditionOperator.GTE:
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;

    case ConditionOperator.LT:
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;

    case ConditionOperator.LTE:
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;

    case ConditionOperator.IN:
      if (Array.isArray(expected)) {
        return (expected as string[]).includes(String(actual));
      }
      return false;

    case ConditionOperator.BETWEEN:
      if (
        Array.isArray(expected) &&
        expected.length === 2 &&
        typeof actual === 'number'
      ) {
        const [min, max] = expected as [number, number];
        return actual >= min && actual <= max;
      }
      // String/date between comparison
      if (
        Array.isArray(expected) &&
        expected.length === 2 &&
        typeof actual === 'string'
      ) {
        const [min, max] = expected as [string, string];
        return actual >= min && actual <= max;
      }
      return false;

    default:
      return false;
  }
}

/**
 * Tests whether ALL conditions in a rule match the given context + product.
 * Returns the list of matched conditions (same as input if all match), or null if any fail.
 */
export function matchConditions(
  conditions: RuleCondition[],
  context: PriceContext,
  product: Product
): RuleCondition[] | null {
  // Empty conditions = global rule, always matches
  if (conditions.length === 0) {
    return [];
  }

  const matched: RuleCondition[] = [];

  for (const condition of conditions) {
    const actual = resolveFieldValue(condition.field, context, product);
    if (evaluateCondition(actual, condition.operator, condition.value)) {
      matched.push(condition);
    } else {
      return null; // AND logic: one failure = no match
    }
  }

  return matched;
}

/**
 * Checks whether a rule is within its validity period.
 */
export function isWithinValidityPeriod(
  validFrom: string | undefined,
  validTo: string | undefined,
  date: string
): boolean {
  if (validFrom && date < validFrom) return false;
  if (validTo && date > validTo) return false;
  return true;
}
