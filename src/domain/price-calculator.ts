import { matchConditions, isWithinValidityPeriod } from './condition-matcher';
import {
  AdjustmentType,
  Currency,
  RuleType,
  type EffectivePrice,
  type PriceAdjustment,
  type PriceCandidate,
  type PriceContext,
  type PriceRule,
  type Product,
  type QuantityBreak,
  type RuleCondition,
  ConditionField,
} from './types';

/**
 * Apply a price adjustment to a base price, returning the new price in ore.
 */
export function applyAdjustment(basePrice: number, adjustment: PriceAdjustment): number {
  switch (adjustment.type) {
    case AdjustmentType.FIXED:
      // Fixed price replaces base
      return Math.round(adjustment.value);

    case AdjustmentType.PERCENTAGE_MARKUP:
      // e.g., value=25 means 25% markup
      return Math.round(basePrice * (1 + adjustment.value / 100));

    case AdjustmentType.PERCENTAGE_DISCOUNT:
      // e.g., value=10 means 10% off
      return Math.round(basePrice * (1 - adjustment.value / 100));

    case AdjustmentType.ABSOLUTE_DISCOUNT:
      // e.g., value=5000 means 50 NOK off (in ore)
      return Math.max(0, Math.round(basePrice - adjustment.value));

    case AdjustmentType.MARGIN:
      // e.g., value=30 means 30% margin: out = base / (1 - margin/100)
      if (adjustment.value >= 100) return basePrice; // invalid margin
      return Math.round(basePrice / (1 - adjustment.value / 100));

    default:
      return basePrice;
  }
}

/**
 * Find the best matching quantity break for a given quantity.
 * Returns the break with the highest minQuantity that the quantity meets.
 */
function findBestQuantityBreak(
  breaks: QuantityBreak[],
  quantity: number
): QuantityBreak | null {
  const eligible = breaks
    .filter(b => quantity >= b.minQuantity && (b.maxQuantity === undefined || quantity <= b.maxQuantity))
    .sort((a, b) => b.minQuantity - a.minQuantity); // highest threshold first

  return eligible.length > 0 ? eligible[0] : null;
}

/**
 * Specificity score for tie-breaking: SKU-specific > category > brand > global.
 */
function specificityScore(rule: PriceRule): number {
  let score = 0;
  for (const c of rule.conditions) {
    if (c.field === ConditionField.SKU) score += 100;
    else if (c.field === ConditionField.CUSTOMER_ID) score += 80;
    else if (c.field === ConditionField.PROJECT_ID) score += 80;
    else if (c.field === ConditionField.CATEGORY_ID) score += 50;
    else if (c.field === ConditionField.WAREHOUSE_ID) score += 30;
    else score += 10;
  }
  return score;
}

/**
 * Compare two rules for sorting in application order.
 * Lower priority first (applied first), higher priority later (applied on top).
 * Ties broken by specificity, condition count, validFrom, then id.
 */
function compareRulesAscending(a: PriceRule, b: PriceRule): number {
  // 1. Lower priority applied first
  if (a.priority !== b.priority) return a.priority - b.priority;
  // 2. Lower specificity first (more general applied first)
  const specA = specificityScore(a);
  const specB = specificityScore(b);
  if (specA !== specB) return specA - specB;
  // 3. Fewer conditions first (less specific first)
  if (a.conditions.length !== b.conditions.length) return a.conditions.length - b.conditions.length;
  // 4. Earlier validFrom first
  const fromA = a.validFrom ?? '';
  const fromB = b.validFrom ?? '';
  if (fromA !== fromB) return fromA.localeCompare(fromB);
  // 5. Alphabetical by ID (deterministic)
  return a.id.localeCompare(b.id);
}

/**
 * Core price calculation engine.
 *
 * Rules are applied in priority order (lowest first, stacking).
 * Each rule adjusts the running price from the previous step.
 * If a rule has `override: true`, it replaces the running price
 * and stops the chain -- no further rules are applied.
 *
 * Quantity discount rules are always applied last, on top of
 * the final stacked/overridden price.
 */
export function calculatePrice(
  product: Product,
  context: PriceContext,
  rules: PriceRule[]
): EffectivePrice {
  const explanation: string[] = [];
  const matchedRules: { rule: PriceRule; conditions: RuleCondition[] }[] = [];
  const quantityDiscountRules: PriceRule[] = [];

  explanation.push(`Base/in-price for ${product.sku}: ${product.basePrice} ore (${(product.basePrice / 100).toFixed(2)} NOK)`);

  // Phase 1: Filter rules into matched + quantity discount buckets
  for (const rule of rules) {
    if (!rule.enabled) {
      explanation.push(`Rule "${rule.name}" (${rule.id}): SKIPPED - disabled`);
      continue;
    }

    if (!isWithinValidityPeriod(rule.validFrom, rule.validTo, context.date)) {
      explanation.push(`Rule "${rule.name}" (${rule.id}): SKIPPED - outside validity period`);
      continue;
    }

    if (rule.type === RuleType.QUANTITY_DISCOUNT) {
      quantityDiscountRules.push(rule);
      continue;
    }

    const matched = matchConditions(rule.conditions, context, product);
    if (matched === null) {
      explanation.push(`Rule "${rule.name}" (${rule.id}): NO MATCH - conditions not met`);
      continue;
    }

    matchedRules.push({ rule, conditions: matched });
    explanation.push(
      `Rule "${rule.name}" (${rule.id}): MATCHED - type=${rule.type}, priority=${rule.priority}, override=${rule.override ?? false}`
    );
  }

  // Sort matched rules in application order: lowest priority first
  matchedRules.sort((a, b) => compareRulesAscending(a.rule, b.rule));

  // Phase 2: Apply rules in order, stacking adjustments
  let runningPrice = product.basePrice;
  const appliedRules: PriceCandidate[] = [];
  const allCandidates: PriceCandidate[] = [];

  if (matchedRules.length === 0) {
    explanation.push(`No matching rules - using base/in-price: ${runningPrice} ore`);
  } else {
    for (const { rule, conditions } of matchedRules) {
      const priceBeforeRule = runningPrice;
      const calculatedPrice = applyAdjustment(runningPrice, rule.adjustment);
      const isOverride = rule.override === true;

      const candidate: PriceCandidate = {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        priority: rule.priority,
        calculatedPrice,
        priceBeforeRule,
        adjustment: rule.adjustment,
        override: isOverride,
        conditionsMatched: conditions,
      };

      allCandidates.push(candidate);

      if (isOverride) {
        // Override: replace running price and stop chain
        runningPrice = calculatedPrice;
        appliedRules.push(candidate);
        explanation.push(
          `Rule "${rule.name}" (${rule.id}): OVERRIDE - ${priceBeforeRule} -> ${calculatedPrice} ore (chain stopped)`
        );
        break;
      } else {
        // Stack: adjust running price and continue
        runningPrice = calculatedPrice;
        appliedRules.push(candidate);
        explanation.push(
          `Rule "${rule.name}" (${rule.id}): APPLIED - ${priceBeforeRule} -> ${calculatedPrice} ore`
        );
      }
    }

    // Add remaining unapplied candidates (after an override stopped the chain)
    for (const { rule, conditions } of matchedRules) {
      if (!allCandidates.some(c => c.ruleId === rule.id)) {
        allCandidates.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.type,
          priority: rule.priority,
          calculatedPrice: applyAdjustment(runningPrice, rule.adjustment),
          priceBeforeRule: runningPrice,
          adjustment: rule.adjustment,
          override: rule.override === true,
          conditionsMatched: conditions,
        });
      }
    }
  }

  let finalPrice = runningPrice;

  // Phase 3: Apply quantity discount on top of final stacked price
  let quantityDiscount: EffectivePrice['quantityDiscount'] = undefined;

  for (const qRule of quantityDiscountRules) {
    if (!qRule.enabled) continue;
    if (!isWithinValidityPeriod(qRule.validFrom, qRule.validTo, context.date)) continue;

    const matched = matchConditions(qRule.conditions, context, product);
    if (matched === null) continue;

    if (qRule.quantityBreaks && qRule.quantityBreaks.length > 0) {
      const bestBreak = findBestQuantityBreak(qRule.quantityBreaks, context.quantity);
      if (bestBreak) {
        const discountedPrice = applyAdjustment(finalPrice, bestBreak.adjustment);
        explanation.push(
          `Quantity discount "${qRule.name}" (${qRule.id}): qty=${context.quantity} meets break min=${bestBreak.minQuantity} -> ${discountedPrice} ore`
        );
        if (!quantityDiscount || discountedPrice < quantityDiscount.discountedPrice) {
          quantityDiscount = {
            ruleId: qRule.id,
            ruleName: qRule.name,
            discountedPrice,
            quantityBreak: bestBreak,
          };
        }
      }
    }
  }

  if (quantityDiscount) {
    finalPrice = quantityDiscount.discountedPrice;
    explanation.push(`Final price after quantity discount: ${finalPrice} ore`);
  }

  explanation.push(`Final out-price: ${finalPrice} ore (${(finalPrice / 100).toFixed(2)} NOK)`);

  return {
    sku: product.sku,
    productName: product.name,
    basePrice: product.basePrice,
    finalPrice,
    currency: Currency.NOK,
    appliedRules,
    quantityDiscount,
    allCandidates,
    explanation,
    evaluatedAt: new Date().toISOString(),
  };
}
