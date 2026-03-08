// ============================================================
// Domain Types - Price System POC
// ============================================================
// Prices are stored in ore (1/100 of NOK) as integers to avoid
// floating point issues. All money fields ending in "Price" are
// in ore unless documented otherwise.
// ============================================================

// --- Enums ---

export const RuleType = {
  BASE_CATEGORY: 'BASE_CATEGORY',
  BASE_PRODUCT: 'BASE_PRODUCT',
  MEMBER_CAMPAIGN: 'MEMBER_CAMPAIGN',
  OUTLET: 'OUTLET',
  PROFESSIONAL_GENERAL: 'PROFESSIONAL_GENERAL',
  CUSTOMER_PRICELIST: 'CUSTOMER_PRICELIST',
  PROJECT_PRICELIST: 'PROJECT_PRICELIST',
  QUANTITY_DISCOUNT: 'QUANTITY_DISCOUNT',
} as const;

export type RuleType = (typeof RuleType)[keyof typeof RuleType];

export const DEFAULT_PRIORITY: Record<RuleType, number> = {
  BASE_CATEGORY: 100,
  BASE_PRODUCT: 200,
  MEMBER_CAMPAIGN: 300,
  OUTLET: 350,
  PROFESSIONAL_GENERAL: 400,
  CUSTOMER_PRICELIST: 500,
  PROJECT_PRICELIST: 600,
  QUANTITY_DISCOUNT: 700,
};

export const CustomerType = {
  PRIVATE: 'private',
  PROFESSIONAL: 'professional',
} as const;

export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const MembershipTier = {
  NONE: 'none',
  BASIC: 'basic',
  PREMIUM: 'premium',
} as const;

export type MembershipTier = (typeof MembershipTier)[keyof typeof MembershipTier];

export const ConditionField = {
  CUSTOMER_TYPE: 'customerType',
  CUSTOMER_ID: 'customerId',
  PROJECT_ID: 'projectId',
  MEMBERSHIP_TIER: 'membershipTier',
  CATEGORY_ID: 'categoryId',
  SKU: 'sku',
  WAREHOUSE_ID: 'warehouseId',
  QUANTITY: 'quantity',
  DATE: 'date',
  BRAND: 'brand',
  OUTLET_FLAG: 'outletFlag',
} as const;

export type ConditionField = (typeof ConditionField)[keyof typeof ConditionField];

export const ConditionOperator = {
  EQ: 'eq',
  NEQ: 'neq',
  GT: 'gt',
  GTE: 'gte',
  LT: 'lt',
  LTE: 'lte',
  IN: 'in',
  BETWEEN: 'between',
} as const;

export type ConditionOperator = (typeof ConditionOperator)[keyof typeof ConditionOperator];

export const AdjustmentType = {
  FIXED: 'fixed',
  PERCENTAGE_MARKUP: 'percentage_markup',
  PERCENTAGE_DISCOUNT: 'percentage_discount',
  ABSOLUTE_DISCOUNT: 'absolute_discount',
  MARGIN: 'margin',
} as const;

export type AdjustmentType = (typeof AdjustmentType)[keyof typeof AdjustmentType];

export const Currency = {
  NOK: 'NOK',
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];

// --- Value Objects ---

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | boolean | string[] | [number, number];
}

export interface PriceAdjustment {
  type: AdjustmentType;
  value: number;
}

export interface QuantityBreak {
  minQuantity: number;
  maxQuantity?: number;
  adjustment: PriceAdjustment;
}

// --- Entities ---

export interface Product {
  sku: string;
  name: string;
  categoryId: string;
  brand: string;
  outletFlag: boolean;
  basePrice: number; // in-price in ore
  unit: string;
  warehouseIds: string[];
  /** Stable identifier from the source PIM record — used for CRUD merging on resync. */
  remoteId?: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export interface PriceRule {
  id: string;
  name: string;
  type: RuleType;
  priority: number;
  conditions: RuleCondition[];
  adjustment: PriceAdjustment;
  quantityBreaks?: QuantityBreak[];
  enabled: boolean;
  override?: boolean;   // true = replaces running price and stops the chain
  validFrom?: string;   // ISO date
  validTo?: string;     // ISO date
  pricelistId?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Pricelist {
  id: string;
  name: string;
  type: 'customer' | 'project' | 'member' | 'outlet' | 'general';
  customerId?: string;
  projectId?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Price Calculation Context ---

export interface PriceContext {
  sku: string;
  customerId?: string;
  customerType: CustomerType;
  membershipTier?: MembershipTier;
  projectId?: string;
  quantity: number;
  warehouseId?: string;
  date: string; // ISO date
}

// --- Price Calculation Results ---

export interface PriceCandidate {
  ruleId: string;
  ruleName: string;
  ruleType: RuleType;
  priority: number;
  calculatedPrice: number; // ore - price after this rule's adjustment
  priceBeforeRule: number; // ore - running price before this rule was applied
  adjustment: PriceAdjustment;
  override: boolean;       // did this rule override the chain?
  conditionsMatched: RuleCondition[];
}

export interface EffectivePrice {
  sku: string;
  productName: string;
  basePrice: number;        // in-price in ore
  finalPrice: number;       // out-price in ore
  currency: Currency;
  appliedRules: PriceCandidate[];  // rules applied in order (low priority first)
  quantityDiscount?: {
    ruleId: string;
    ruleName: string;
    discountedPrice: number; // ore, after quantity discount
    quantityBreak: QuantityBreak;
  };
  allCandidates: PriceCandidate[]; // all matched rules sorted by precedence
  explanation: string[];
  evaluatedAt: string; // ISO timestamp
}

// --- Repository Filter Types ---

export interface RuleFilter {
  type?: RuleType;
  pricelistId?: string;
  enabled?: boolean;
}

export interface ProductFilter {
  categoryId?: string;
  warehouseId?: string;
  brand?: string;
  outletOnly?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}
