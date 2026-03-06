# Price System - Architecture & Design Document

## Overview

A proof-of-concept pricing platform that models pricing as a **rules and overrides problem** with full explainability. Supports both private/consumer and professional/B2B pricing scenarios.

---

## Bounded Contexts / Modules

```
price-system/
  src/
    domain/          -- Pure domain logic, no dependencies on infra
    application/     -- Use cases / service layer, orchestrates domain + repos
    infrastructure/  -- SQLite repos, PIM adapter, external integrations
    api/             -- Next.js route handlers (thin layer over application)
    admin/           -- Next.js admin UI (App Router pages)
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| **domain** | Entities, value objects, rule engine, precedence logic, price calculation |
| **application** | Use-case orchestration: "calculate price for context", "list rules", "CRUD rules" |
| **infrastructure** | Repository implementations (SQLite), PIM provider (JSON file), DB setup |
| **api** | HTTP route handlers, request validation, response formatting |
| **admin** | React server/client components for the admin interface |

---

## Domain Model

### Core Entities

**Product** (from PIM)
- sku, name, categoryId, brand, outletFlag, basePrice, unit, warehouseIds

**PriceRule**
- id, name, type, priority, conditions[], adjustments, enabled, validFrom?, validTo?, metadata

**Pricelist**
- id, name, type (customer | project | member | outlet | general), customerId?, projectId?, rules[]

### Value Objects

**PriceContext** - The input to price calculation:
- sku, customerId?, customerType (private | professional), membershipTier?, projectId?, quantity, warehouseId?, categoryId?, date

**RuleCondition** - A single condition that must match:
- field (customerType | customerId | projectId | membershipTier | categoryId | sku | warehouseId | quantity | date | brand | outletFlag)
- operator (eq | neq | gt | gte | lt | lte | in | between)
- value (string | number | string[] | [number, number])

**PriceAdjustment** - How a rule modifies price:
- type (fixed | percentage_markup | percentage_discount | absolute_discount | margin)
- value (number)
- baseReference (inPrice | basePrice | listPrice)

**PriceCandidate** - A rule that matched and produced a price:
- ruleId, ruleName, ruleType, priority, calculatedPrice, adjustment, conditionsMatched[]

**EffectivePrice** - The final result:
- sku, productName, basePrice (in-price), finalPrice (out-price), currency, appliedRule (PriceCandidate), allCandidates[], explanation, evaluatedAt

**QuantityBreak**
- minQuantity, maxQuantity?, adjustment (PriceAdjustment)

---

## Pricing Rule Model

### Rule Types (enum)

| Type | Description | Typical Priority |
|------|-------------|-----------------|
| BASE_CATEGORY | Default markup by category | 100 |
| BASE_PRODUCT | Default markup per SKU | 200 |
| MEMBER_CAMPAIGN | Member-tier discount | 300 |
| OUTLET | Outlet clearance price | 350 |
| PROFESSIONAL_GENERAL | General B2B pricing | 400 |
| CUSTOMER_PRICELIST | Customer-specific agreement | 500 |
| PROJECT_PRICELIST | Project-specific pricing | 600 |
| QUANTITY_DISCOUNT | Volume-based discounts | 700 (applied as modifier) |

### Rule Structure

```typescript
interface PriceRule {
  id: string;
  name: string;
  type: RuleType;
  priority: number;         // Higher = takes precedence
  conditions: RuleCondition[];  // ALL must match (AND logic)
  adjustment: PriceAdjustment;
  quantityBreaks?: QuantityBreak[];
  enabled: boolean;
  validFrom?: string;       // ISO date
  validTo?: string;         // ISO date
  pricelistId?: string;     // Links to a pricelist
  metadata?: Record<string, string>;
}
```

---

## Precedence Strategy

### Algorithm

1. Gather all enabled rules
2. Filter rules where ALL conditions match the PriceContext
3. Filter rules within their validity period
4. For quantity discount rules: find the best matching quantity break
5. Sort matching rules by priority (descending)
6. **Highest priority wins** -- this is the applied rule
7. If priorities tie: prefer SKU-specific over category-specific, then prefer the rule with the most conditions (most specific match)
8. Apply the winning adjustment to produce the final price
9. Return the full explanation with all candidates

### Precedence Order (default)

```
PROJECT_PRICELIST (600)     -- most specific B2B
  > CUSTOMER_PRICELIST (500)  -- customer agreement
  > PROFESSIONAL_GENERAL (400) -- general B2B
  > OUTLET (350)              -- clearance
  > MEMBER_CAMPAIGN (300)     -- member discounts
  > BASE_PRODUCT (200)        -- per-SKU markup
  > BASE_CATEGORY (100)       -- category default
```

Quantity discounts (700) are applied as a **modifier on top of the winning base rule** when the quantity threshold is met, not as a competing rule. This avoids quantity discounts overriding customer agreements.

### Tie-Breaking Rules

1. Higher priority number wins
2. If tied: SKU-specific condition beats category-only condition
3. If still tied: rule with more matching conditions wins (more specific)
4. If still tied: rule with later `validFrom` wins (newer)
5. If still tied: alphabetical by rule ID (deterministic)

---

## API Design

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/prices/calculate` | Calculate price for a single product + context |
| POST | `/api/prices/calculate-batch` | Calculate prices for multiple products |
| GET | `/api/prices/rules` | List all price rules (filterable) |
| GET | `/api/prices/rules/:id` | Get a specific rule |
| POST | `/api/prices/rules` | Create a price rule |
| PUT | `/api/prices/rules/:id` | Update a price rule |
| DELETE | `/api/prices/rules/:id` | Delete a price rule |
| GET | `/api/prices/pricelists` | List pricelists |
| GET | `/api/prices/pricelists/:id` | Get pricelist with rules |
| POST | `/api/prices/pricelists` | Create pricelist |
| PUT | `/api/prices/pricelists/:id` | Update pricelist |
| DELETE | `/api/prices/pricelists/:id` | Delete pricelist |
| GET | `/api/products` | List products from PIM |
| GET | `/api/products/:sku` | Get single product |
| GET | `/api/prices/explain/:sku` | Full price explanation for a SKU with context as query params |

### Request/Response Examples

See API_CONTRACT.md for full details.

---

## Storage Design (DynamoDB Single-Table Thinking)

### Access Patterns

| Access Pattern | PK | SK | Used By |
|---------------|----|----|---------|
| Get rule by ID | `RULE#<id>` | `RULE#<id>` | Rule detail |
| List rules by type | `RULETYPE#<type>` | `RULE#<id>` | Admin filtering |
| List rules by pricelist | `PRICELIST#<plId>` | `RULE#<id>` | Pricelist detail |
| Get pricelist by ID | `PRICELIST#<id>` | `PRICELIST#<id>` | Pricelist detail |
| List pricelists by type | `PLISTTYPE#<type>` | `PRICELIST#<id>` | Admin filtering |
| Rules matching SKU | `SKU#<sku>` | `RULE#<id>` | Price calculation |
| Rules matching category | `CAT#<catId>` | `RULE#<id>` | Price calculation |
| Rules matching customer | `CUST#<custId>` | `RULE#<id>` | Price calculation |
| Rules matching project | `PROJ#<projId>` | `RULE#<id>` | Price calculation |
| Global rules (no specific target) | `GLOBAL` | `RULE#<id>` | Catch-all rules |

### SQLite Implementation Strategy

SQLite tables mirror the access patterns above using indexed columns:

```sql
-- Main rules table
CREATE TABLE price_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  priority INTEGER NOT NULL,
  conditions_json TEXT NOT NULL,  -- JSON array of RuleCondition
  adjustment_json TEXT NOT NULL,  -- JSON PriceAdjustment
  quantity_breaks_json TEXT,      -- JSON array of QuantityBreak
  enabled INTEGER NOT NULL DEFAULT 1,
  valid_from TEXT,
  valid_to TEXT,
  pricelist_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Index tables for access patterns (mirrors DynamoDB GSIs)
CREATE TABLE rule_lookups (
  pk TEXT NOT NULL,    -- e.g., "SKU#ABC123", "CAT#plumbing", "CUST#C001"
  sk TEXT NOT NULL,    -- e.g., "RULE#rule-1"
  rule_id TEXT NOT NULL REFERENCES price_rules(id),
  PRIMARY KEY (pk, sk)
);

CREATE TABLE pricelists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  customer_id TEXT,
  project_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

The `rule_lookups` table is the key abstraction -- it maps directly to how DynamoDB would store items with composite keys. Each rule gets multiple entries in `rule_lookups` based on its conditions, enabling the same query patterns.

### Repository Interfaces

```typescript
interface PriceRuleRepository {
  findById(id: string): Promise<PriceRule | null>;
  findByType(type: RuleType): Promise<PriceRule[]>;
  findMatchingRules(context: PriceContext): Promise<PriceRule[]>;
  findByPricelistId(pricelistId: string): Promise<PriceRule[]>;
  save(rule: PriceRule): Promise<PriceRule>;
  update(id: string, rule: Partial<PriceRule>): Promise<PriceRule>;
  delete(id: string): Promise<void>;
  findAll(filter?: RuleFilter): Promise<PriceRule[]>;
}

interface PricelistRepository {
  findById(id: string): Promise<Pricelist | null>;
  findByType(type: string): Promise<Pricelist[]>;
  findByCustomerId(customerId: string): Promise<Pricelist[]>;
  findByProjectId(projectId: string): Promise<Pricelist[]>;
  save(pricelist: Pricelist): Promise<Pricelist>;
  update(id: string, pricelist: Partial<Pricelist>): Promise<Pricelist>;
  delete(id: string): Promise<void>;
  findAll(): Promise<Pricelist[]>;
}
```

### PIM Abstraction

```typescript
interface PimProvider {
  getProduct(sku: string): Promise<Product | null>;
  getProducts(filter?: ProductFilter): Promise<Product[]>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  getCategories(): Promise<Category[]>;
  getWarehouses(): Promise<Warehouse[]>;
}
```

---

## Testing Strategy

### Priority Order

1. **Rule engine / price calculation** -- The core logic. Test every precedence scenario, condition matching, and edge case.
2. **API contract tests** -- Ensure endpoints return correct shapes and status codes.
3. **Repository contract tests** -- Verify CRUD operations and query patterns work correctly.
4. **Integration tests** -- Full flow from API request to calculated price.
5. **Admin UI behavior** -- Critical user flows only.

### Test Approach

- Use Vitest as test runner (fast, TypeScript-native)
- In-memory SQLite for repository tests
- Mock PIM provider for deterministic test data
- No external dependencies needed for any test

---

## Assumptions

1. Currency is NOK for the POC (single currency)
2. Prices are stored and calculated in ore (integer cents) to avoid floating point
3. A product can only have one base/in-price (from PIM)
4. Quantity discounts stack on top of the winning price rule, not compete with it
5. All timestamps are UTC ISO-8601
6. Rule IDs are UUIDs
7. The admin UI is not authenticated for the POC
