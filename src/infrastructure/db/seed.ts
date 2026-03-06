// ============================================================
// Database Seeder - Price System POC
// ============================================================
// Run with: tsx src/infrastructure/db/seed.ts
// ============================================================

import fs from 'fs';
import path from 'path';

// Set DB_PATH before importing getDatabase so the singleton picks it up.
const dataDir = path.resolve('./data');
const dbPath = path.join(dataDir, 'price-system.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`Created directory: ${dataDir}`);
}

process.env['DB_PATH'] = dbPath;

import { getDatabase, closeDatabase } from '@/infrastructure/db/database';
import { SqlitePriceRuleRepository } from '@/infrastructure/db/sqlite-rule-repository';
import { SqlitePricelistRepository } from '@/infrastructure/db/sqlite-pricelist-repository';
import type { Pricelist, PriceRule } from '@/domain/types';
import { ConditionField, ConditionOperator, AdjustmentType, RuleType } from '@/domain/types';

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

const CREATED_AT = '2025-01-01T00:00:00.000Z';
const UPDATED_AT = '2025-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Pricelists (8 total)
// ---------------------------------------------------------------------------

const pricelists: Pricelist[] = [
  {
    id: 'pl-general',
    name: 'General Consumer Pricelist',
    type: 'general',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'pl-member-basic',
    name: 'Basic Member Pricelist',
    type: 'member',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'pl-member-premium',
    name: 'Premium Member Pricelist',
    type: 'member',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'pl-outlet',
    name: 'Outlet Clearance Pricelist',
    type: 'outlet',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'pl-prof-general',
    name: 'Professional General Pricelist',
    type: 'general',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'pl-cust-c001',
    name: 'Rørlegger Hansen AS Agreement',
    type: 'customer',
    customerId: 'C001',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'pl-cust-c002',
    name: 'Byggmester Berg AS Agreement',
    type: 'customer',
    customerId: 'C002',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'pl-proj-p001',
    name: 'Fjordheim Borettslag Project',
    type: 'project',
    projectId: 'P001',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
];

// ---------------------------------------------------------------------------
// Price Rules (~25 total)
// ---------------------------------------------------------------------------

const rules: PriceRule[] = [
  // -------------------------------------------------------------------------
  // Base category rules
  // -------------------------------------------------------------------------
  {
    id: 'rule-base-plumbing',
    name: 'Base Markup - Plumbing',
    type: RuleType.BASE_CATEGORY,
    priority: 100,
    conditions: [
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-base-electrical',
    name: 'Base Markup - Electrical',
    type: RuleType.BASE_CATEGORY,
    priority: 100,
    conditions: [
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'electrical' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 45 },
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-base-tools',
    name: 'Base Markup - Tools',
    type: RuleType.BASE_CATEGORY,
    priority: 100,
    conditions: [
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'tools' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 35 },
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-base-paint',
    name: 'Base Markup - Paint',
    type: RuleType.BASE_CATEGORY,
    priority: 100,
    conditions: [
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'paint' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 50 },
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-base-flooring',
    name: 'Base Markup - Flooring',
    type: RuleType.BASE_CATEGORY,
    priority: 100,
    conditions: [
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'flooring' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 42 },
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-base-kitchen',
    name: 'Base Markup - Kitchen',
    type: RuleType.BASE_CATEGORY,
    priority: 100,
    conditions: [
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'kitchen' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 38 },
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-base-bathroom',
    name: 'Base Markup - Bathroom',
    type: RuleType.BASE_CATEGORY,
    priority: 100,
    conditions: [
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'bathroom' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 40 },
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-base-outdoor',
    name: 'Base Markup - Outdoor',
    type: RuleType.BASE_CATEGORY,
    priority: 100,
    conditions: [
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'outdoor' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_MARKUP, value: 35 },
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },

  // -------------------------------------------------------------------------
  // Base product override (fixed price for specific SKU)
  // -------------------------------------------------------------------------
  {
    id: 'rule-base-prd005',
    name: 'Fixed Price Override - PRD-005',
    type: RuleType.BASE_PRODUCT,
    priority: 200,
    conditions: [
      { field: ConditionField.SKU, operator: ConditionOperator.EQ, value: 'PRD-005' },
    ],
    adjustment: { type: AdjustmentType.FIXED, value: 15900 },
    pricelistId: 'pl-general',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },

  // -------------------------------------------------------------------------
  // Member campaign rules
  // -------------------------------------------------------------------------
  {
    id: 'rule-member-basic',
    name: 'Basic Member Discount',
    type: RuleType.MEMBER_CAMPAIGN,
    priority: 300,
    conditions: [
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'private' },
      { field: ConditionField.MEMBERSHIP_TIER, operator: ConditionOperator.EQ, value: 'basic' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 5 },
    pricelistId: 'pl-member-basic',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-member-premium',
    name: 'Premium Member Discount',
    type: RuleType.MEMBER_CAMPAIGN,
    priority: 300,
    conditions: [
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'private' },
      { field: ConditionField.MEMBERSHIP_TIER, operator: ConditionOperator.EQ, value: 'premium' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 12 },
    pricelistId: 'pl-member-premium',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-member-premium-tools',
    name: 'Premium Member Tools Discount',
    type: RuleType.MEMBER_CAMPAIGN,
    priority: 310,
    conditions: [
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'private' },
      { field: ConditionField.MEMBERSHIP_TIER, operator: ConditionOperator.EQ, value: 'premium' },
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'tools' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 18 },
    pricelistId: 'pl-member-premium',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },

  // -------------------------------------------------------------------------
  // Outlet rules
  // -------------------------------------------------------------------------
  {
    id: 'rule-outlet-1',
    name: 'Outlet General Discount',
    type: RuleType.OUTLET,
    priority: 350,
    conditions: [
      { field: ConditionField.OUTLET_FLAG, operator: ConditionOperator.EQ, value: true },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 30 },
    pricelistId: 'pl-outlet',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-outlet-paint',
    name: 'Outlet Paint Discount',
    type: RuleType.OUTLET,
    priority: 360,
    conditions: [
      { field: ConditionField.OUTLET_FLAG, operator: ConditionOperator.EQ, value: true },
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'paint' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 40 },
    pricelistId: 'pl-outlet',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },

  // -------------------------------------------------------------------------
  // Professional general
  // -------------------------------------------------------------------------
  {
    id: 'rule-prof-general',
    name: 'Professional General Discount',
    type: RuleType.PROFESSIONAL_GENERAL,
    priority: 400,
    conditions: [
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 15 },
    pricelistId: 'pl-prof-general',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },

  // -------------------------------------------------------------------------
  // Customer-specific pricelists
  // -------------------------------------------------------------------------
  {
    id: 'rule-cust-c001-general',
    name: 'Rørlegger Hansen AS - General Agreement',
    type: RuleType.CUSTOMER_PRICELIST,
    priority: 500,
    conditions: [
      { field: ConditionField.CUSTOMER_ID, operator: ConditionOperator.EQ, value: 'C001' },
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 22 },
    pricelistId: 'pl-cust-c001',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-cust-c001-plumbing',
    name: 'Rørlegger Hansen AS - Plumbing Agreement',
    type: RuleType.CUSTOMER_PRICELIST,
    priority: 510,
    conditions: [
      { field: ConditionField.CUSTOMER_ID, operator: ConditionOperator.EQ, value: 'C001' },
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 28 },
    pricelistId: 'pl-cust-c001',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-cust-c002-general',
    name: 'Byggmester Berg AS - General Agreement',
    type: RuleType.CUSTOMER_PRICELIST,
    priority: 500,
    conditions: [
      { field: ConditionField.CUSTOMER_ID, operator: ConditionOperator.EQ, value: 'C002' },
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 18 },
    pricelistId: 'pl-cust-c002',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },

  // -------------------------------------------------------------------------
  // Project pricelist
  // -------------------------------------------------------------------------
  {
    id: 'rule-proj-p001',
    name: 'Fjordheim Borettslag - Project Agreement',
    type: RuleType.PROJECT_PRICELIST,
    priority: 600,
    conditions: [
      { field: ConditionField.PROJECT_ID, operator: ConditionOperator.EQ, value: 'P001' },
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 25 },
    pricelistId: 'pl-proj-p001',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-proj-p001-bathroom',
    name: 'Fjordheim Borettslag - Bathroom Agreement',
    type: RuleType.PROJECT_PRICELIST,
    priority: 610,
    conditions: [
      { field: ConditionField.PROJECT_ID, operator: ConditionOperator.EQ, value: 'P001' },
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'bathroom' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 32 },
    pricelistId: 'pl-proj-p001',
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },

  // -------------------------------------------------------------------------
  // Quantity discounts
  // -------------------------------------------------------------------------
  {
    id: 'rule-qty-general',
    name: 'Professional Quantity Discount - General',
    type: RuleType.QUANTITY_DISCOUNT,
    priority: 700,
    conditions: [
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 0 },
    quantityBreaks: [
      { minQuantity: 10,  adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 3 } },
      { minQuantity: 50,  adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 7 } },
      { minQuantity: 100, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 12 } },
    ],
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'rule-qty-plumbing',
    name: 'Professional Quantity Discount - Plumbing',
    type: RuleType.QUANTITY_DISCOUNT,
    priority: 710,
    conditions: [
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'professional' },
      { field: ConditionField.CATEGORY_ID, operator: ConditionOperator.EQ, value: 'plumbing' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 0 },
    quantityBreaks: [
      { minQuantity: 25,  adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 5 } },
      { minQuantity: 100, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 10 } },
      { minQuantity: 500, adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 15 } },
    ],
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },

  // -------------------------------------------------------------------------
  // Warehouse-specific campaign
  // -------------------------------------------------------------------------
  {
    id: 'rule-oslo-promo',
    name: 'Oslo Winter Sale',
    type: RuleType.MEMBER_CAMPAIGN,
    priority: 320,
    conditions: [
      { field: ConditionField.WAREHOUSE_ID, operator: ConditionOperator.EQ, value: 'oslo' },
      { field: ConditionField.CUSTOMER_TYPE, operator: ConditionOperator.EQ, value: 'private' },
    ],
    adjustment: { type: AdjustmentType.PERCENTAGE_DISCOUNT, value: 8 },
    validFrom: '2025-01-01',
    validTo: '2025-12-31',
    metadata: { campaign: 'Oslo Winter Sale' },
    enabled: true,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log('Starting database seed...');
  console.log(`Database path: ${dbPath}`);

  const db = getDatabase();
  const ruleRepo = new SqlitePriceRuleRepository(db);
  const pricelistRepo = new SqlitePricelistRepository(db);

  // ---- Clear existing data ----
  console.log('\nClearing existing data...');
  db.prepare('DELETE FROM rule_lookups').run();
  db.prepare('DELETE FROM price_rules').run();
  db.prepare('DELETE FROM pricelists').run();
  console.log('  Cleared rule_lookups, price_rules, pricelists');

  // ---- Pricelists ----
  console.log(`\nInserting ${pricelists.length} pricelists...`);
  for (const pricelist of pricelists) {
    await pricelistRepo.save(pricelist);
    console.log(`  [+] ${pricelist.id} - ${pricelist.name}`);
  }

  // ---- Price Rules ----
  console.log(`\nInserting ${rules.length} price rules...`);
  for (const rule of rules) {
    await ruleRepo.save(rule);
    console.log(`  [+] ${rule.id} (${rule.type}, priority ${rule.priority})`);
  }

  // ---- Summary ----
  const pricelistCount = (db.prepare('SELECT COUNT(*) as n FROM pricelists').get() as { n: number }).n;
  const ruleCount = (db.prepare('SELECT COUNT(*) as n FROM price_rules').get() as { n: number }).n;
  const lookupCount = (db.prepare('SELECT COUNT(*) as n FROM rule_lookups').get() as { n: number }).n;

  console.log('\nSeed complete.');
  console.log(`  Pricelists : ${pricelistCount}`);
  console.log(`  Price rules: ${ruleCount}`);
  console.log(`  Lookups    : ${lookupCount}`);
}

seed()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    closeDatabase();
  });
