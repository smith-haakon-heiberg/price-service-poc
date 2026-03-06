# Price System - Tradeoffs & Architectural Decisions

This document records the key architectural tradeoffs, intentional simplifications, and design rationale for the price-system POC.

---

## 1. SQLite to DynamoDB Migration Path

### Why SQLite for the POC

SQLite provides a zero-infrastructure, embedded database that lets us iterate on the domain model and access patterns without managing a DynamoDB table, dealing with provisioned capacity, or paying for reads/writes during development. The entire database lives in a single file alongside the application.

### How the Repository Interfaces Enable the Swap

The domain and application layers depend only on the `PriceRuleRepository` and `PricelistRepository` interfaces defined in `src/domain/repositories.ts`. These interfaces express **what** data is needed, not **how** it is stored:

```
domain/repositories.ts    <-- Interface contracts (pure TypeScript, no imports from infra)
    |
    +-- infrastructure/db/sqlite-rule-repository.ts      <-- Current: SQLite implementation
    +-- infrastructure/db/sqlite-pricelist-repository.ts  <-- Current: SQLite implementation
    |
    +-- (future) infrastructure/db/dynamodb-rule-repository.ts
    +-- (future) infrastructure/db/dynamodb-pricelist-repository.ts
```

When migrating to DynamoDB, the only files that change are the infrastructure implementations. Everything above the repository boundary stays identical:

- **Domain logic** (`price-calculator.ts`, `condition-matcher.ts`) -- zero changes
- **Application services** (`price-service.ts`) -- zero changes
- **API route handlers** (`src/app/api/...`) -- zero changes
- **Tests for domain logic** -- zero changes
- **Tests for repositories** -- new test file for DynamoDB implementation, SQLite tests remain as regression

### How rule_lookups Mirrors DynamoDB GSI Patterns

The `rule_lookups` table in SQLite was intentionally designed to mirror DynamoDB's composite key access patterns:

| SQLite rule_lookups | DynamoDB Equivalent |
|--------------------|---------------------|
| `pk = 'SKU#PRD-001'`, `sk = 'RULE#abc'` | Item with `PK = 'SKU#PRD-001'`, `SK = 'RULE#abc'` |
| `pk = 'CAT#fasteners'`, `sk = 'RULE#abc'` | Item with `PK = 'CAT#fasteners'`, `SK = 'RULE#abc'` |
| `pk = 'CUST#C001'`, `sk = 'RULE#abc'` | Item with `PK = 'CUST#C001'`, `SK = 'RULE#abc'` |
| `pk = 'GLOBAL'`, `sk = 'RULE#abc'` | Item with `PK = 'GLOBAL'`, `SK = 'RULE#abc'` |

In SQLite, `findMatchingRules` queries the `rule_lookups` table with `WHERE pk IN ('SKU#...', 'CAT#...', 'CUST#...', 'GLOBAL')` and then JOINs to `price_rules` to get the full rule data.

In DynamoDB, the same access pattern would be multiple `Query` operations on the main table (one per PK prefix) or a `BatchGetItem` if the exact keys are known. The rule data would be denormalized into each item, eliminating the JOIN.

### What Changes When Moving to DynamoDB

| Concern | Change Required |
|---------|----------------|
| Repository implementations | Replace SQLite SQL with DynamoDB SDK calls |
| Data serialization | JSON columns become native DynamoDB maps |
| JOINs | Eliminated; rule data denormalized into lookup items |
| Transactions | DynamoDB TransactWriteItems for multi-item writes |
| Connection management | DynamoDB client instead of SQLite connection |
| Schema migrations | Not applicable (schemaless), but item structure must be managed |
| Service factory wiring | Swap which repository class is instantiated |

### What Stays the Same

- All domain types and interfaces
- The price calculation engine
- The condition matcher
- The application service layer
- All API route handlers
- All domain-level tests
- The admin UI

---

## 2. Storage Patterns Aligned with Single-Table Design

### The rule_lookups Table as a PK/SK Lookup Index

The `rule_lookups` table is the central design abstraction that makes the SQLite storage act like a DynamoDB single-table design. Rather than relying on complex SQL queries with multiple WHERE clauses, we pre-compute lookup entries when a rule is saved.

When a rule with conditions `[{field: "sku", value: "PRD-001"}, {field: "customerType", value: "professional"}]` is saved, the following lookup entries are created:

```
pk = 'SKU#PRD-001',  sk = 'RULE#<id>',  rule_id = '<id>'
pk = 'GLOBAL',        sk = 'RULE#<id>',  rule_id = '<id>'
```

The SKU condition generates a specific lookup. The rule also gets a GLOBAL entry because it could match other contexts where the SKU condition happens to match. The actual condition-matching logic still runs in the application layer after fetching candidates.

### Query-First Access Pattern Design

Every query the system needs was identified before the schema was designed:

1. "Get me all rules that might apply to SKU X" -- `pk = 'SKU#X'`
2. "Get me all rules that might apply to category Y" -- `pk = 'CAT#Y'`
3. "Get me all rules for customer Z" -- `pk = 'CUST#Z'`
4. "Get me all rules for project P" -- `pk = 'PROJ#P'`
5. "Get me all global/catch-all rules" -- `pk = 'GLOBAL'`
6. "Get me all rules in pricelist PL" -- `pk = 'PRICELIST#PL'`
7. "Get me all rules of type T" -- `pk = 'RULETYPE#T'`
8. "Get a single rule by ID" -- direct lookup on `price_rules` table

### DynamoDB Translation

The same patterns translate directly:

| Access Pattern | SQLite | DynamoDB |
|---------------|--------|----------|
| Rules for SKU | `SELECT ... FROM rule_lookups JOIN price_rules WHERE pk = 'SKU#X'` | `Query PK = 'SKU#X'` (rule data embedded in item) |
| Rules for category | `SELECT ... WHERE pk = 'CAT#Y'` | `Query PK = 'CAT#Y'` |
| Rules for customer | `SELECT ... WHERE pk = 'CUST#Z'` | `Query PK = 'CUST#Z'` |
| Rule by ID | `SELECT ... FROM price_rules WHERE id = ?` | `GetItem PK = 'RULE#id', SK = 'RULE#id'` |
| Rules by type | `SELECT ... WHERE pk = 'RULETYPE#T'` | `Query PK = 'RULETYPE#T'` |

### Key Difference: JOINs vs. Denormalization

In SQLite, `rule_lookups` stores only the foreign key (`rule_id`) and JOINs to `price_rules` for the full data. In DynamoDB, each item in the table would contain the full rule data (denormalized). This means writes are more expensive (updating a rule requires updating all its lookup items), but reads are single-query with no joins -- which is the correct tradeoff for a read-heavy pricing system.

---

## 3. POC Simplifications

These are intentional shortcuts taken for the proof-of-concept that would need to be addressed for production use.

### findMatchingRules Returns All Enabled Rules

In the current SQLite implementation, `findMatchingRules` fetches all enabled rules and relies on the condition matcher in the domain layer to filter them. In production with thousands of rules, this would be replaced with targeted queries using the `rule_lookups` index to narrow the candidate set before condition matching runs.

### No Authentication or Authorization

All endpoints are publicly accessible. Production would require:
- API key authentication for service-to-service calls
- JWT-based auth for admin UI users
- Role-based access control (who can create/edit/delete rules vs. who can only read)

### Single Currency (NOK)

All prices are in NOK. The `Currency` type exists in the domain model but only has one value. Multi-currency support would require:
- Currency field on rules and pricelists
- Exchange rate handling
- Currency-aware price comparison in the calculator

### Prices in Ore (Integers)

All monetary values are stored as integers in ore (1/100 NOK). This eliminates floating-point precision issues entirely. For example, 149.90 NOK is stored as `14990`. This convention should be maintained in production -- it is not a simplification to remove but rather a best practice to keep.

### No Caching Layer

Every price calculation hits the database for rules and the PIM provider for product data. Production would add:
- In-memory cache for product data (changes infrequently)
- Cached rule sets per SKU/category (invalidated on rule changes)
- Potentially a CDN or API gateway cache for frequently requested prices

### No Rate Limiting

No protection against excessive API calls. Production would add rate limiting at the API gateway level.

### No Audit Trail for Rule Changes

Rule creates, updates, and deletes are not logged. Production would need:
- Who changed what, when
- Before/after snapshots of rule state
- Potentially event sourcing for full history

### Quantity Discounts Are Modifiers, Not Competing Rules

Quantity discount rules (type `QUANTITY_DISCOUNT`, priority 700) are deliberately excluded from the normal precedence competition. Instead, the winning base rule is determined first, and then the best matching quantity discount is applied on top as a modifier. This prevents a volume discount from overriding a customer-specific agreement price.

### PIM Is Read-Only Dummy Data

The PIM provider reads from a static JSON file. There is no real integration with Censhare or any product information system. The `PimProvider` interface abstracts this, so swapping in a real integration requires only a new implementation class.

---

## 4. Rule Precedence Design

### Why Higher Priority Number = Higher Precedence

The convention `higher number wins` was chosen because it maps naturally to how business users think about rule importance: "this rule is more important, give it a higher number." It also aligns with the business reality that more specific agreements (customer/project pricelists at 500-600) should override general rules (category markups at 100).

The default priority assignments form a clear hierarchy:

```
100  BASE_CATEGORY         -- least specific
200  BASE_PRODUCT          -- slightly more specific
300  MEMBER_CAMPAIGN       -- targeted to members
350  OUTLET                -- clearance overrides
400  PROFESSIONAL_GENERAL  -- B2B baseline
500  CUSTOMER_PRICELIST    -- negotiated agreement
600  PROJECT_PRICELIST     -- project-specific deal
700  QUANTITY_DISCOUNT     -- applied as modifier (not competing)
```

Administrators can override the default priority when creating rules (e.g., set a critical campaign to priority 550 to override customer pricelists).

### Why Quantity Discounts Are Layered, Not Competing

If quantity discounts competed with other rules, a customer with a negotiated 20% discount could lose that discount when buying in bulk -- the quantity rule might calculate a lower percentage. Instead, quantity discounts are applied as a second pass on top of whatever price the winning rule produced. This means:

1. The customer's agreement price wins first (e.g., 80% of base)
2. The quantity break discount is applied on top (e.g., additional 10% off the agreement price)
3. The customer always gets at least as good a deal as their agreement

### The Deterministic Tie-Breaking Chain

When two rules have the same priority, the system needs a deterministic way to pick a winner. The chain is:

1. **Priority** (descending) -- Higher number wins. This is the primary sort.
2. **Specificity score** (descending) -- A rule targeting a specific SKU (score +100) beats a rule targeting only a category (score +50). Scores are additive across all conditions.
3. **Condition count** (descending) -- More conditions means a more specific match. A rule that requires both `customerId = X` and `customerType = professional` is preferred over one that only checks `customerType`.
4. **validFrom date** (descending, lexicographic) -- A newer rule beats an older one. This handles the case where a new campaign was created to replace an older one but both happen to have the same priority.
5. **Rule ID** (ascending, lexicographic) -- Final tiebreaker to ensure determinism. UUIDs are compared as strings.

### Edge Cases Handled

- **No rules match**: The product's `basePrice` (in-price) is returned as-is with a synthetic `__BASE__` rule marker.
- **Disabled rules**: Skipped entirely, logged in the explanation.
- **Expired rules**: Checked against `validFrom`/`validTo` and the context `date`. Outside-validity rules are skipped.
- **Multiple quantity discount rules match**: The one producing the lowest price wins.

### Edge Cases Intentionally Left Out

- **Stacking multiple non-quantity rules**: Only the single highest-priority rule wins. There is no mechanism for combining discounts from multiple rules (e.g., "member discount + seasonal discount").
- **Minimum/maximum price guards**: No floor or ceiling price enforcement. A rule could theoretically produce a 0 ore or negative price (absolute_discount clamped to 0, but percentage calculations are not bounded).
- **Currency conversion**: Not applicable in single-currency POC.
- **Time-of-day pricing**: The `date` field is date-only, not a full timestamp.

---

## 5. What Is Next for Production

### Phase 1: Core Infrastructure

1. **Replace PIM adapter with real integration** -- Connect to Censhare or M3 for live product data. Implement caching with TTL-based invalidation.
2. **Replace SQLite with DynamoDB** -- Implement `DynamoDBRuleRepository` and `DynamoDBPricelistRepository` following the access patterns already designed. Use single-table design with the PK/SK patterns documented in ARCHITECTURE.md.
3. **Add caching** -- DAX or ElastiCache for DynamoDB. In-memory LRU cache for product data. Cache-aside pattern for frequently calculated prices.

### Phase 2: Security and Observability

4. **Add authentication** -- API keys for service-to-service calls. JWT (via Cognito or similar) for admin UI users. CORS configuration for the admin frontend.
5. **Add audit logging** -- Record every rule change with who, what, when, and before/after state. Store in a separate DynamoDB table or CloudWatch Logs.
6. **Add observability** -- Structured logging with correlation IDs. CloudWatch metrics for calculation latency, cache hit rates, rule match rates. X-Ray tracing for end-to-end request tracking.

### Phase 3: Feature Completeness

7. **Add rule versioning** -- Keep historical versions of rules so that past price calculations can be reproduced.
8. **Add bulk import/export** -- CSV/JSON import for large rule sets (e.g., annual customer agreement renewals).
9. **Add time-based rule scheduling (campaigns)** -- Automated enable/disable based on `validFrom`/`validTo` with EventBridge scheduled rules.
10. **Add currency support** -- Multi-currency with exchange rate management.
11. **Add rate limiting** -- API Gateway throttling to protect the service.

### Phase 4: Testing and Quality

12. **Add integration tests against real API** -- End-to-end tests that hit the running service, verify response shapes, and test error scenarios.
13. **Add admin UI behavior tests** -- Playwright or Cypress tests for critical flows: creating a rule, running a price calculation, viewing the explanation.
14. **Add load testing** -- Verify the system meets latency SLAs under expected production load.

---

## 6. TDD Plan (Ordered List of Tests Written)

The tests were written in order of domain criticality, starting with the pure domain logic (no I/O, no infrastructure) and moving outward.

### 1. Condition Matcher (`src/domain/condition-matcher.test.ts`)

The foundation of the rule engine. Tests cover:
- All operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `between`
- Field resolution: mapping `PriceContext` and `Product` fields to condition fields
- AND logic: all conditions in a rule must match for the rule to apply
- Edge cases: null/undefined context values, empty condition arrays, type coercion

### 2. Price Calculator (`src/domain/price-calculator.test.ts`)

The core calculation engine. Tests cover:
- Adjustment math: `fixed`, `percentage_markup`, `percentage_discount`, `absolute_discount`, `margin`
- Precedence: higher priority wins over lower
- Tie-breaking: specificity score, condition count, validFrom, rule ID
- Quantity discounts: applied on top of winning rule, best break selected, multiple quantity rules
- Full scenarios: private customer with member campaign, professional with customer agreement, outlet pricing, no rules matching (fallback to base price)
- Edge cases: disabled rules skipped, expired rules skipped, invalid margin values

### 3. SQLite Rule Repository (`src/infrastructure/db/sqlite-rule-repository.test.ts`)

Storage layer for rules. Tests cover:
- CRUD operations: save, findById, findAll, update, delete
- Filtering: by type, by pricelistId, by enabled status
- Round-trip serialization: conditions, adjustments, quantity breaks, and metadata survive JSON serialization to/from SQLite columns
- Lookup table maintenance: entries created on save, cleaned up on delete
- findMatchingRules: returns rules based on lookup keys

### 4. SQLite Pricelist Repository (`src/infrastructure/db/sqlite-pricelist-repository.test.ts`)

Storage layer for pricelists. Tests cover:
- CRUD operations: save, findById, findAll, update, delete
- Filtering: by type, by customerId, by projectId
- Round-trip serialization: all fields survive storage and retrieval
- Relationship integrity: pricelists can be retrieved with their associated rules

### 5. (Future) API Integration Tests

Not yet written. Would cover:
- Each endpoint returns correct HTTP status codes
- Request validation rejects malformed input
- Response shapes match the API contract
- Error responses use the documented error format
- End-to-end flow: create rule, calculate price, verify rule was applied

### 6. (Future) Admin UI Behavior Tests

Not yet written. Would cover:
- Rule list page loads and displays rules
- Create rule form validates required fields
- Price calculator widget shows results with explanation
- Pricelist detail page shows associated rules
- Delete confirmation prevents accidental deletion
