# Price System - API Contract

Complete API contract documentation for the price-system POC.

---

## Conventions

### Authentication
This POC has **no authentication or authorization**. All endpoints are publicly accessible. Production would add API keys or JWT-based auth.

### Content-Type
All requests with a body must use `Content-Type: application/json`. All responses return `Content-Type: application/json`.

### Date Formats
All dates use **ISO-8601** format:
- Date only: `"2026-03-06"`
- Timestamps: `"2026-03-06T14:30:00.000Z"`

### Currency and Price Conventions
- All prices are in **ore** (1/100 of NOK) stored as **integers** to avoid floating-point issues.
- `10000` ore = `100.00` NOK
- The only currency in this POC is `"NOK"`.
- Fields ending in `Price` are always in ore unless documented otherwise.

### Pagination
Product listing supports basic offset/limit pagination via query parameters:
- `limit` - Maximum number of results (integer, > 0)
- `offset` - Number of results to skip (integer, >= 0)

Rule and pricelist endpoints return all results (no pagination in POC).

### Error Response Format

All errors follow this structure:

```typescript
{
  error: {
    message: string;
    code: string;
  }
}
```

Common error codes:

| Code | HTTP Status | Description |
|------|------------|-------------|
| `INVALID_BODY` | 400 | Request body is not valid JSON |
| `MISSING_FIELD` | 400 | A required field is missing or has the wrong type |
| `INVALID_FIELD` | 400 | A field value is not one of the allowed options |
| `PRODUCT_NOT_FOUND` | 404 | The requested SKU does not exist in PIM |
| `NOT_FOUND` | 404 | The requested resource does not exist |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

Example:

```json
{
  "error": {
    "message": "Product not found: PRD-999",
    "code": "PRODUCT_NOT_FOUND"
  }
}
```

---

## Endpoints

### 1. POST /api/prices/calculate

Calculate the effective price for a single product in a given context.

#### Request Body

```typescript
{
  sku: string;              // Required. Product SKU.
  customerType: CustomerType; // Required. "private" | "professional"
  customerId?: string;      // Customer ID for customer-specific pricing
  membershipTier?: MembershipTier; // "none" | "basic" | "premium"
  projectId?: string;       // Project ID for project-specific pricing
  quantity?: number;         // Defaults to 1
  warehouseId?: string;     // Warehouse for warehouse-specific rules
  date?: string;            // ISO date. Defaults to today.
}
```

#### Response Body (200)

```typescript
{
  sku: string;
  productName: string;
  basePrice: number;        // In-price in ore
  finalPrice: number;       // Out-price in ore after all adjustments
  currency: "NOK";
  appliedRule: {
    ruleId: string;
    ruleName: string;
    ruleType: RuleType;
    priority: number;
    calculatedPrice: number;
    adjustment: { type: AdjustmentType; value: number };
    conditionsMatched: RuleCondition[];
  };
  quantityDiscount?: {
    ruleId: string;
    ruleName: string;
    discountedPrice: number;
    quantityBreak: { minQuantity: number; maxQuantity?: number; adjustment: PriceAdjustment };
  };
  allCandidates: PriceCandidate[];
  explanation: string[];
  evaluatedAt: string;      // ISO timestamp
}
```

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Price calculated successfully |
| 400 | Missing required field (sku, customerType) or invalid JSON |
| 404 | Product SKU not found in PIM |
| 500 | Internal server error |

#### Example Request

```bash
curl -X POST http://localhost:3000/api/prices/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "PRD-001",
    "customerType": "private",
    "membershipTier": "premium",
    "quantity": 1,
    "date": "2026-03-06"
  }'
```

#### Example Response

```json
{
  "sku": "PRD-001",
  "productName": "Premium Wood Screw 5x60mm",
  "basePrice": 4500,
  "finalPrice": 5625,
  "currency": "NOK",
  "appliedRule": {
    "ruleId": "rule-base-cat-fasteners",
    "ruleName": "Fasteners Category Markup 25%",
    "ruleType": "BASE_CATEGORY",
    "priority": 100,
    "calculatedPrice": 5625,
    "adjustment": {
      "type": "percentage_markup",
      "value": 25
    },
    "conditionsMatched": [
      {
        "field": "categoryId",
        "operator": "eq",
        "value": "fasteners"
      }
    ]
  },
  "allCandidates": [
    {
      "ruleId": "rule-base-cat-fasteners",
      "ruleName": "Fasteners Category Markup 25%",
      "ruleType": "BASE_CATEGORY",
      "priority": 100,
      "calculatedPrice": 5625,
      "adjustment": {
        "type": "percentage_markup",
        "value": 25
      },
      "conditionsMatched": [
        {
          "field": "categoryId",
          "operator": "eq",
          "value": "fasteners"
        }
      ]
    }
  ],
  "explanation": [
    "Base/in-price for PRD-001: 4500 ore (45.00 NOK)",
    "Rule \"Fasteners Category Markup 25%\" (rule-base-cat-fasteners): MATCHED - type=BASE_CATEGORY, priority=100, price=5625 ore",
    "Winner: \"Fasteners Category Markup 25%\" (rule-base-cat-fasteners) with priority 100 -> 5625 ore",
    "Final out-price: 5625 ore (56.25 NOK)"
  ],
  "evaluatedAt": "2026-03-06T10:15:30.000Z"
}
```

---

### 2. POST /api/prices/calculate-batch

Calculate prices for multiple products in a single request. Each item is calculated independently. If one item fails (e.g., product not found), it returns an error object for that item while other items succeed.

#### Request Body

```typescript
{
  items: PriceContext[];  // Required. Array of price contexts.
}
```

Each item in the array follows the same shape as the single-calculate request body.

#### Response Body (200)

```typescript
{
  results: (EffectivePrice | { error: { message: string; code: string }; sku: string })[];
}
```

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Batch processed (individual items may contain errors) |
| 400 | Missing `items` array or invalid JSON |
| 500 | Internal server error |

#### Example Request

```bash
curl -X POST http://localhost:3000/api/prices/calculate-batch \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "sku": "PRD-001",
        "customerType": "private",
        "membershipTier": "premium",
        "quantity": 1,
        "date": "2026-03-06"
      },
      {
        "sku": "PRD-002",
        "customerType": "professional",
        "customerId": "CUST-100",
        "quantity": 50,
        "date": "2026-03-06"
      },
      {
        "sku": "PRD-999",
        "customerType": "private",
        "quantity": 1,
        "date": "2026-03-06"
      }
    ]
  }'
```

#### Example Response

```json
{
  "results": [
    {
      "sku": "PRD-001",
      "productName": "Premium Wood Screw 5x60mm",
      "basePrice": 4500,
      "finalPrice": 5625,
      "currency": "NOK",
      "appliedRule": {
        "ruleId": "rule-base-cat-fasteners",
        "ruleName": "Fasteners Category Markup 25%",
        "ruleType": "BASE_CATEGORY",
        "priority": 100,
        "calculatedPrice": 5625,
        "adjustment": { "type": "percentage_markup", "value": 25 },
        "conditionsMatched": [
          { "field": "categoryId", "operator": "eq", "value": "fasteners" }
        ]
      },
      "allCandidates": [],
      "explanation": [
        "Base/in-price for PRD-001: 4500 ore (45.00 NOK)",
        "Rule \"Fasteners Category Markup 25%\" (rule-base-cat-fasteners): MATCHED - type=BASE_CATEGORY, priority=100, price=5625 ore",
        "Winner: \"Fasteners Category Markup 25%\" (rule-base-cat-fasteners) with priority 100 -> 5625 ore",
        "Final out-price: 5625 ore (56.25 NOK)"
      ],
      "evaluatedAt": "2026-03-06T10:15:30.000Z"
    },
    {
      "sku": "PRD-002",
      "productName": "Copper Pipe 22mm 3m",
      "basePrice": 32000,
      "finalPrice": 28800,
      "currency": "NOK",
      "appliedRule": {
        "ruleId": "rule-cust-100-agreement",
        "ruleName": "Customer CUST-100 Agreement -10%",
        "ruleType": "CUSTOMER_PRICELIST",
        "priority": 500,
        "calculatedPrice": 28800,
        "adjustment": { "type": "percentage_discount", "value": 10 },
        "conditionsMatched": [
          { "field": "customerId", "operator": "eq", "value": "CUST-100" }
        ]
      },
      "quantityDiscount": {
        "ruleId": "rule-qty-pipes",
        "ruleName": "Pipes Bulk Discount",
        "discountedPrice": 25920,
        "quantityBreak": {
          "minQuantity": 50,
          "adjustment": { "type": "percentage_discount", "value": 10 }
        }
      },
      "allCandidates": [],
      "explanation": [],
      "evaluatedAt": "2026-03-06T10:15:30.000Z"
    },
    {
      "error": {
        "message": "Product not found: PRD-999",
        "code": "PRODUCT_NOT_FOUND"
      },
      "sku": "PRD-999"
    }
  ]
}
```

---

### 3. GET /api/prices/explain/:sku

Get a full price explanation for a SKU with context provided as query parameters. Returns the same response shape as the calculate endpoint but is intended for debugging and understanding which rules matched and why.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sku` | string | Product SKU |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `customerType` | string | Yes | - | `"private"` or `"professional"` |
| `customerId` | string | No | - | Customer ID |
| `membershipTier` | string | No | - | `"none"`, `"basic"`, or `"premium"` |
| `projectId` | string | No | - | Project ID |
| `quantity` | integer | No | `1` | Quantity (must be >= 1) |
| `warehouseId` | string | No | - | Warehouse ID |
| `date` | string | No | Today | ISO date (e.g., `"2026-03-06"`) |

#### Response Body (200)

Same as `POST /api/prices/calculate` response (the `EffectivePrice` type).

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Price explained successfully |
| 400 | Missing required query param `customerType` |
| 404 | Product SKU not found in PIM |
| 500 | Internal server error |

#### Example Request

```bash
curl "http://localhost:3000/api/prices/explain/PRD-001?customerType=professional&customerId=CUST-100&membershipTier=premium&quantity=25&warehouseId=WH-OSLO&date=2026-03-06"
```

#### Example Response

```json
{
  "sku": "PRD-001",
  "productName": "Premium Wood Screw 5x60mm",
  "basePrice": 4500,
  "finalPrice": 3600,
  "currency": "NOK",
  "appliedRule": {
    "ruleId": "rule-cust-100-agreement",
    "ruleName": "Customer CUST-100 Agreement -20%",
    "ruleType": "CUSTOMER_PRICELIST",
    "priority": 500,
    "calculatedPrice": 3600,
    "adjustment": { "type": "percentage_discount", "value": 20 },
    "conditionsMatched": [
      { "field": "customerId", "operator": "eq", "value": "CUST-100" },
      { "field": "customerType", "operator": "eq", "value": "professional" }
    ]
  },
  "allCandidates": [
    {
      "ruleId": "rule-cust-100-agreement",
      "ruleName": "Customer CUST-100 Agreement -20%",
      "ruleType": "CUSTOMER_PRICELIST",
      "priority": 500,
      "calculatedPrice": 3600,
      "adjustment": { "type": "percentage_discount", "value": 20 },
      "conditionsMatched": [
        { "field": "customerId", "operator": "eq", "value": "CUST-100" },
        { "field": "customerType", "operator": "eq", "value": "professional" }
      ]
    },
    {
      "ruleId": "rule-pro-general",
      "ruleName": "Professional General -5%",
      "ruleType": "PROFESSIONAL_GENERAL",
      "priority": 400,
      "calculatedPrice": 4275,
      "adjustment": { "type": "percentage_discount", "value": 5 },
      "conditionsMatched": [
        { "field": "customerType", "operator": "eq", "value": "professional" }
      ]
    },
    {
      "ruleId": "rule-member-premium",
      "ruleName": "Premium Member Discount 15%",
      "ruleType": "MEMBER_CAMPAIGN",
      "priority": 300,
      "calculatedPrice": 3825,
      "adjustment": { "type": "percentage_discount", "value": 15 },
      "conditionsMatched": [
        { "field": "membershipTier", "operator": "eq", "value": "premium" }
      ]
    },
    {
      "ruleId": "rule-base-cat-fasteners",
      "ruleName": "Fasteners Category Markup 25%",
      "ruleType": "BASE_CATEGORY",
      "priority": 100,
      "calculatedPrice": 5625,
      "adjustment": { "type": "percentage_markup", "value": 25 },
      "conditionsMatched": [
        { "field": "categoryId", "operator": "eq", "value": "fasteners" }
      ]
    }
  ],
  "explanation": [
    "Base/in-price for PRD-001: 4500 ore (45.00 NOK)",
    "Rule \"Fasteners Category Markup 25%\" (rule-base-cat-fasteners): MATCHED - type=BASE_CATEGORY, priority=100, price=5625 ore",
    "Rule \"Premium Member Discount 15%\" (rule-member-premium): MATCHED - type=MEMBER_CAMPAIGN, priority=300, price=3825 ore",
    "Rule \"Professional General -5%\" (rule-pro-general): MATCHED - type=PROFESSIONAL_GENERAL, priority=400, price=4275 ore",
    "Rule \"Customer CUST-100 Agreement -20%\" (rule-cust-100-agreement): MATCHED - type=CUSTOMER_PRICELIST, priority=500, price=3600 ore",
    "Winner: \"Customer CUST-100 Agreement -20%\" (rule-cust-100-agreement) with priority 500 -> 3600 ore",
    "Final out-price: 3600 ore (36.00 NOK)"
  ],
  "evaluatedAt": "2026-03-06T10:15:30.000Z"
}
```

---

### 4. GET /api/prices/rules

List all price rules, optionally filtered.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | Filter by rule type (e.g., `"CUSTOMER_PRICELIST"`) |
| `pricelistId` | string | No | Filter by pricelist ID |
| `enabled` | string | No | `"true"` or `"false"` |

#### Response Body (200)

```typescript
PriceRule[]
```

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Rules listed successfully |
| 500 | Internal server error |

#### Example Request

```bash
curl "http://localhost:3000/api/prices/rules?type=CUSTOMER_PRICELIST&enabled=true"
```

#### Example Response

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Customer CUST-100 Agreement -20%",
    "type": "CUSTOMER_PRICELIST",
    "priority": 500,
    "conditions": [
      { "field": "customerId", "operator": "eq", "value": "CUST-100" },
      { "field": "customerType", "operator": "eq", "value": "professional" }
    ],
    "adjustment": { "type": "percentage_discount", "value": 20 },
    "enabled": true,
    "validFrom": "2026-01-01",
    "validTo": "2026-12-31",
    "pricelistId": "pl-cust-100",
    "metadata": { "agreementRef": "AGR-2026-001" },
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-15T09:30:00.000Z"
  }
]
```

---

### 5. GET /api/prices/rules/:id

Get a single price rule by ID.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Rule UUID |

#### Response Body (200)

```typescript
PriceRule
```

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Rule found |
| 404 | Rule not found |
| 500 | Internal server error |

#### Example Request

```bash
curl "http://localhost:3000/api/prices/rules/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

#### Example Response

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Customer CUST-100 Agreement -20%",
  "type": "CUSTOMER_PRICELIST",
  "priority": 500,
  "conditions": [
    { "field": "customerId", "operator": "eq", "value": "CUST-100" },
    { "field": "customerType", "operator": "eq", "value": "professional" }
  ],
  "adjustment": { "type": "percentage_discount", "value": 20 },
  "enabled": true,
  "validFrom": "2026-01-01",
  "validTo": "2026-12-31",
  "pricelistId": "pl-cust-100",
  "metadata": { "agreementRef": "AGR-2026-001" },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-15T09:30:00.000Z"
}
```

---

### 6. POST /api/prices/rules

Create a new price rule. The `id`, `createdAt`, and `updatedAt` fields are generated server-side.

#### Request Body

```typescript
{
  name: string;                    // Required
  type: RuleType;                  // Required
  priority: number;                // Required
  conditions: RuleCondition[];     // Required (can be empty array)
  adjustment: PriceAdjustment;     // Required
  quantityBreaks?: QuantityBreak[];
  enabled?: boolean;               // Defaults to true
  validFrom?: string;              // ISO date
  validTo?: string;                // ISO date
  pricelistId?: string;
  metadata?: Record<string, string>;
}
```

#### Response Body (201)

The created `PriceRule` with generated `id`, `createdAt`, and `updatedAt`.

#### Status Codes

| Status | Condition |
|--------|-----------|
| 201 | Rule created successfully |
| 400 | Missing required field or invalid JSON |
| 500 | Internal server error |

#### Example Request

```bash
curl -X POST http://localhost:3000/api/prices/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Spring Campaign 2026 - Paint 10% off",
    "type": "MEMBER_CAMPAIGN",
    "priority": 300,
    "conditions": [
      { "field": "categoryId", "operator": "eq", "value": "paint" },
      { "field": "membershipTier", "operator": "in", "value": ["basic", "premium"] },
      { "field": "date", "operator": "between", "value": ["2026-03-01", "2026-05-31"] }
    ],
    "adjustment": {
      "type": "percentage_discount",
      "value": 10
    },
    "enabled": true,
    "validFrom": "2026-03-01",
    "validTo": "2026-05-31",
    "metadata": {
      "campaign": "spring-2026"
    }
  }'
```

#### Example Response

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Spring Campaign 2026 - Paint 10% off",
  "type": "MEMBER_CAMPAIGN",
  "priority": 300,
  "conditions": [
    { "field": "categoryId", "operator": "eq", "value": "paint" },
    { "field": "membershipTier", "operator": "in", "value": ["basic", "premium"] },
    { "field": "date", "operator": "between", "value": ["2026-03-01", "2026-05-31"] }
  ],
  "adjustment": {
    "type": "percentage_discount",
    "value": 10
  },
  "enabled": true,
  "validFrom": "2026-03-01",
  "validTo": "2026-05-31",
  "metadata": {
    "campaign": "spring-2026"
  },
  "createdAt": "2026-03-06T10:15:30.000Z",
  "updatedAt": "2026-03-06T10:15:30.000Z"
}
```

---

### 7. PUT /api/prices/rules/:id

Update an existing price rule. Only the provided fields are updated. The `id` and `createdAt` fields cannot be changed (they are stripped if included). `updatedAt` is set server-side.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Rule UUID |

#### Request Body

```typescript
Partial<Omit<PriceRule, 'id' | 'createdAt'>>
```

Any subset of PriceRule fields except `id` and `createdAt`.

#### Response Body (200)

The full updated `PriceRule`.

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Rule updated successfully |
| 400 | Invalid JSON or service error |
| 404 | Rule not found |
| 500 | Internal server error |

#### Example Request

```bash
curl -X PUT http://localhost:3000/api/prices/rules/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "metadata": {
      "campaign": "spring-2026",
      "disabledReason": "campaign ended early"
    }
  }'
```

#### Example Response

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Spring Campaign 2026 - Paint 10% off",
  "type": "MEMBER_CAMPAIGN",
  "priority": 300,
  "conditions": [
    { "field": "categoryId", "operator": "eq", "value": "paint" },
    { "field": "membershipTier", "operator": "in", "value": ["basic", "premium"] },
    { "field": "date", "operator": "between", "value": ["2026-03-01", "2026-05-31"] }
  ],
  "adjustment": {
    "type": "percentage_discount",
    "value": 10
  },
  "enabled": false,
  "validFrom": "2026-03-01",
  "validTo": "2026-05-31",
  "metadata": {
    "campaign": "spring-2026",
    "disabledReason": "campaign ended early"
  },
  "createdAt": "2026-03-06T10:15:30.000Z",
  "updatedAt": "2026-03-06T14:00:00.000Z"
}
```

---

### 8. DELETE /api/prices/rules/:id

Delete a price rule.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Rule UUID |

#### Response

No body. HTTP 204 on success.

#### Status Codes

| Status | Condition |
|--------|-----------|
| 204 | Rule deleted successfully |
| 404 | Rule not found |
| 500 | Internal server error |

#### Example Request

```bash
curl -X DELETE http://localhost:3000/api/prices/rules/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

---

### 9. GET /api/prices/pricelists

List all pricelists.

#### Query Parameters

None.

#### Response Body (200)

```typescript
Pricelist[]
```

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Pricelists listed successfully |
| 500 | Internal server error |

#### Example Request

```bash
curl "http://localhost:3000/api/prices/pricelists"
```

#### Example Response

```json
[
  {
    "id": "pl-cust-100",
    "name": "Byggmester Hansen AS - Agreement 2026",
    "type": "customer",
    "customerId": "CUST-100",
    "description": "Annual pricing agreement for Byggmester Hansen",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "pl-proj-bridge",
    "name": "Bridge Project Oslo",
    "type": "project",
    "projectId": "PROJ-BRIDGE-001",
    "description": "Special pricing for the Oslo bridge project",
    "createdAt": "2026-02-15T00:00:00.000Z",
    "updatedAt": "2026-02-15T00:00:00.000Z"
  }
]
```

---

### 10. GET /api/prices/pricelists/:id

Get a single pricelist with all its associated rules.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Pricelist ID |

#### Response Body (200)

```typescript
{
  pricelist: Pricelist;
  rules: PriceRule[];
}
```

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Pricelist found |
| 404 | Pricelist not found |
| 500 | Internal server error |

#### Example Request

```bash
curl "http://localhost:3000/api/prices/pricelists/pl-cust-100"
```

#### Example Response

```json
{
  "pricelist": {
    "id": "pl-cust-100",
    "name": "Byggmester Hansen AS - Agreement 2026",
    "type": "customer",
    "customerId": "CUST-100",
    "description": "Annual pricing agreement for Byggmester Hansen",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "rules": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Customer CUST-100 Agreement -20%",
      "type": "CUSTOMER_PRICELIST",
      "priority": 500,
      "conditions": [
        { "field": "customerId", "operator": "eq", "value": "CUST-100" },
        { "field": "customerType", "operator": "eq", "value": "professional" }
      ],
      "adjustment": { "type": "percentage_discount", "value": 20 },
      "enabled": true,
      "validFrom": "2026-01-01",
      "validTo": "2026-12-31",
      "pricelistId": "pl-cust-100",
      "metadata": { "agreementRef": "AGR-2026-001" },
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-15T09:30:00.000Z"
    }
  ]
}
```

---

### 11. POST /api/prices/pricelists

Create a new pricelist. The `id`, `createdAt`, and `updatedAt` fields are generated server-side.

#### Request Body

```typescript
{
  name: string;             // Required
  type: string;             // Required. One of: "customer", "project", "member", "outlet", "general"
  customerId?: string;
  projectId?: string;
  description?: string;
}
```

#### Response Body (201)

The created `Pricelist` with generated `id`, `createdAt`, and `updatedAt`.

#### Status Codes

| Status | Condition |
|--------|-----------|
| 201 | Pricelist created successfully |
| 400 | Missing required field, invalid type, or invalid JSON |
| 500 | Internal server error |

#### Example Request

```bash
curl -X POST http://localhost:3000/api/prices/pricelists \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rorkompaniet AS - Framework Agreement",
    "type": "customer",
    "customerId": "CUST-200",
    "description": "Framework agreement for plumbing supplies"
  }'
```

#### Example Response

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "name": "Rorkompaniet AS - Framework Agreement",
  "type": "customer",
  "customerId": "CUST-200",
  "description": "Framework agreement for plumbing supplies",
  "createdAt": "2026-03-06T10:15:30.000Z",
  "updatedAt": "2026-03-06T10:15:30.000Z"
}
```

---

### 12. PUT /api/prices/pricelists/:id

Update an existing pricelist. Only the provided fields are updated. The `id` and `createdAt` fields cannot be changed. `updatedAt` is set server-side.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Pricelist ID |

#### Request Body

```typescript
Partial<Omit<Pricelist, 'id' | 'createdAt'>>
```

#### Response Body (200)

The full updated `Pricelist`.

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Pricelist updated successfully |
| 400 | Invalid JSON or service error |
| 404 | Pricelist not found |
| 500 | Internal server error |

#### Example Request

```bash
curl -X PUT http://localhost:3000/api/prices/pricelists/b2c3d4e5-f6a7-8901-bcde-f12345678901 \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Framework agreement for plumbing supplies - extended to 2027"
  }'
```

#### Example Response

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "name": "Rorkompaniet AS - Framework Agreement",
  "type": "customer",
  "customerId": "CUST-200",
  "description": "Framework agreement for plumbing supplies - extended to 2027",
  "createdAt": "2026-03-06T10:15:30.000Z",
  "updatedAt": "2026-03-06T14:00:00.000Z"
}
```

---

### 13. DELETE /api/prices/pricelists/:id

Delete a pricelist.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Pricelist ID |

#### Response

No body. HTTP 204 on success.

#### Status Codes

| Status | Condition |
|--------|-----------|
| 204 | Pricelist deleted successfully |
| 404 | Pricelist not found |
| 500 | Internal server error |

#### Example Request

```bash
curl -X DELETE http://localhost:3000/api/prices/pricelists/b2c3d4e5-f6a7-8901-bcde-f12345678901
```

---

### 14. GET /api/products

List products from PIM with optional filters.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `categoryId` | string | No | Filter by category |
| `warehouseId` | string | No | Filter by warehouse availability |
| `brand` | string | No | Filter by brand name |
| `outletOnly` | string | No | `"true"` to show only outlet products |
| `search` | string | No | Free-text search on name/SKU |
| `limit` | integer | No | Max results to return |
| `offset` | integer | No | Number of results to skip |

#### Response Body (200)

```typescript
Product[]
```

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Products listed successfully |
| 500 | Internal server error |

#### Example Request

```bash
curl "http://localhost:3000/api/products?categoryId=fasteners&brand=Spax&limit=10&offset=0"
```

#### Example Response

```json
[
  {
    "sku": "PRD-001",
    "name": "Premium Wood Screw 5x60mm",
    "categoryId": "fasteners",
    "brand": "Spax",
    "outletFlag": false,
    "basePrice": 4500,
    "unit": "box",
    "warehouseIds": ["WH-OSLO", "WH-BERGEN"]
  },
  {
    "sku": "PRD-005",
    "name": "Deck Screw 4.5x50mm Stainless",
    "categoryId": "fasteners",
    "brand": "Spax",
    "outletFlag": false,
    "basePrice": 6800,
    "unit": "box",
    "warehouseIds": ["WH-OSLO"]
  }
]
```

---

### 15. GET /api/products/:sku

Get a single product by SKU.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sku` | string | Product SKU |

#### Response Body (200)

```typescript
Product
```

#### Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Product found |
| 404 | Product not found |
| 500 | Internal server error |

#### Example Request

```bash
curl "http://localhost:3000/api/products/PRD-001"
```

#### Example Response

```json
{
  "sku": "PRD-001",
  "name": "Premium Wood Screw 5x60mm",
  "categoryId": "fasteners",
  "brand": "Spax",
  "outletFlag": false,
  "basePrice": 4500,
  "unit": "box",
  "warehouseIds": ["WH-OSLO", "WH-BERGEN"]
}
```

---

## Type Reference

### RuleType

```
"BASE_CATEGORY" | "BASE_PRODUCT" | "MEMBER_CAMPAIGN" | "OUTLET" |
"PROFESSIONAL_GENERAL" | "CUSTOMER_PRICELIST" | "PROJECT_PRICELIST" | "QUANTITY_DISCOUNT"
```

### CustomerType

```
"private" | "professional"
```

### MembershipTier

```
"none" | "basic" | "premium"
```

### AdjustmentType

```
"fixed" | "percentage_markup" | "percentage_discount" | "absolute_discount" | "margin"
```

### ConditionField

```
"customerType" | "customerId" | "projectId" | "membershipTier" | "categoryId" |
"sku" | "warehouseId" | "quantity" | "date" | "brand" | "outletFlag"
```

### ConditionOperator

```
"eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "between"
```

### Pricelist Type

```
"customer" | "project" | "member" | "outlet" | "general"
```
