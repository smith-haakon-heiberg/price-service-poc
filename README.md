# EAS Price Service

A pricing engine that acts as a **connector between your business systems**. It pulls product, customer, warehouse, and project data from external sources — PIM, CRM, ERP/OMS — and uses that data to evaluate configurable pricing rules in response to real-time price requests.

---

## What it does

Given a request like:

```
What is the price for SKU X?
  — for customer C
  — in warehouse W
  — on project P
  — quantity 10
```

The service evaluates all matching pricing rules and returns the final price with a full explanation of which rules applied and why.

The minimum required input is a **single SKU**. Customer, warehouse, project, and quantity are all optional — they unlock more specific rule matching when present.

---

## Architecture: a connector service

The price service does not own product, customer, warehouse, or project data. It integrates with the systems that do.

```
┌─────────────────────────────────────────────────────────────────┐
│                      EAS Price Service                          │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │    PIM     │  │    CRM     │  │  ERP / OMS │  │ ERP/OMS  │ │
│  │ Integrator │  │ Integrator │  │ Warehouses │  │ Projects │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────┬─────┘ │
│        │               │               │               │       │
│        └───────────────┴───────────────┴───────────────┘       │
│                                    │                           │
│                          ┌─────────▼──────────┐               │
│                          │   Pricing Engine    │               │
│                          │   (rules + context) │               │
│                          └─────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
          ▲ price requests                   ▼ price responses
    (SKU + optional context)          (price + explanation)
```

### Data sources

| Data | Source | Integration type |
|------|--------|-----------------|
| **Products** (SKU, in-price, category, brand) | PIM | Field-mapping wizard → local snapshot |
| **Customers** (ID, type, membership tier) | CRM | Integration + standalone fallback |
| **Warehouses** (ID, name, location) | ERP / OMS | Integration |
| **Projects** (ID, customer link) | ERP / OMS | Integration |

All integrations follow the same pattern: an adapter fetches data from the external system and maps it to the internal domain type. Standalone/fallback implementations (e.g. JSON fixtures) are used when no integration is configured, keeping the engine runnable in isolation.

---

## Price calculation

### Request context

| Field | Required | Description |
|-------|----------|-------------|
| `sku` | **Yes** | The product to price |
| `customerId` | No | Unlocks customer-specific and project pricelists |
| `customerType` | No (default: `private`) | `private` or `professional` |
| `membershipTier` | No | `none`, `basic`, or `premium` |
| `projectId` | No | Unlocks project-specific pricelists |
| `warehouseId` | No | Unlocks warehouse-specific rules |
| `quantity` | No (default: `1`) | Enables quantity-break discounts |
| `date` | No (default: today) | Used to evaluate rule validity windows |

### Rule evaluation

1. All enabled rules whose conditions match the context are collected
2. Rules outside their `validFrom`/`validTo` window are discarded
3. The highest-priority matching rule wins
4. Quantity discount rules are applied as a second-pass modifier on top of the winning price
5. The response includes the final price, every rule that was evaluated, and a plain-language explanation

### Rule types (default priority order)

| Priority | Type | Typical use |
|----------|------|-------------|
| 100 | `BASE_CATEGORY` | Default markup for a category |
| 200 | `BASE_PRODUCT` | Per-SKU markup |
| 300 | `MEMBER_CAMPAIGN` | Member-tier discounts |
| 350 | `OUTLET` | Clearance pricing |
| 400 | `PROFESSIONAL_GENERAL` | General B2B price level |
| 500 | `CUSTOMER_PRICELIST` | Negotiated customer agreement |
| 600 | `PROJECT_PRICELIST` | Project-specific deal |
| 700 | `QUANTITY_DISCOUNT` | Volume modifier (stacks on top of winning rule) |

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/prices/calculate` | Price a single SKU |
| `POST` | `/api/prices/calculate-batch` | Price multiple SKUs |
| `GET` | `/api/prices/explain/:sku` | Full explanation for a SKU + context |
| `GET/POST` | `/api/prices/rules` | List / create rules |
| `GET/PUT/DELETE` | `/api/prices/rules/:id` | Get / update / delete a rule |
| `GET/POST` | `/api/prices/pricelists` | List / create pricelists |
| `GET/PUT/DELETE` | `/api/prices/pricelists/:id` | Get / update / delete a pricelist |
| `GET` | `/api/products` | List products (from active PIM source) |
| `GET` | `/api/products/:sku` | Get a single product |

See [API_CONTRACT.md](./API_CONTRACT.md) for full request/response shapes.

---

## PIM integrator

Products are the foundation of every price calculation. The PIM integrator connects the price service to any REST-based Product Information Management system.

**Admin UI → PIM Integrator** (`/admin/integrations/pim`)

1. **Configure provider** — enter the remote PIM's base URL and authentication
2. **Discover schema** — the service fetches one product from the endpoint and maps its structure into typed field paths (`attributes[key=in_price].value`, `identifiers[type=sku].value`, etc.)
3. **Map fields** — for each required Product field (SKU, name, category, base price, …) select the remote field and any value transform (e.g. `× 100` to convert a price string to ore)
4. **Save & Import** — saves the mapping and runs a full paginated import of all products into a local snapshot (`data/pim-imported.json`)

Once imported, the price engine reads exclusively from the local snapshot — no outbound HTTP calls during price calculations. Re-run the import whenever the PIM catalog changes.

---

## Running locally

```bash
pnpm install
pnpm dev          # starts on http://localhost:3030
```

The admin UI is available at `http://localhost:3030/admin`.

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3030` | Base URL used by server components for internal fetches |
| `PORT` | `3030` | Port to listen on |

### Database

SQLite. The database file is created automatically at `data/price-system.db` on first run. Seed with:

```bash
pnpm db:seed
```

---

## Project structure

```
src/
  domain/          Pure domain logic — types, rule engine, condition matcher
  application/     Use-case orchestration — PriceService
  infrastructure/  Adapters — SQLite repos, PIM provider, integrator config
  app/
    api/           Next.js route handlers (thin wrappers over application layer)
    admin/         Admin UI pages and components
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design rationale and storage design.
