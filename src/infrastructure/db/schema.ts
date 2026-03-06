import type Database from 'better-sqlite3';

/**
 * Creates all tables and indexes required by the price system.
 *
 * Design notes
 * ------------
 * The schema mirrors DynamoDB single-table design principles:
 *
 *   price_rules   – the primary record store (PK = id)
 *   rule_lookups  – a GSI-equivalent keyed by (pk, sk) pairs that map
 *                   lookup patterns (SKU#, CAT#, CUST#, PROJ#, GLOBAL)
 *                   to rule ids, enabling O(log n) pre-filtering without
 *                   scanning the full rule table.
 *   pricelists    – standalone pricelist entities
 *
 * JSON columns (conditions_json, adjustment_json, quantity_breaks_json,
 * metadata_json) store structured sub-objects so the schema stays flat
 * while preserving the full richness of the domain model.
 */
export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_rules (
      id                   TEXT    PRIMARY KEY,
      name                 TEXT    NOT NULL,
      type                 TEXT    NOT NULL,
      priority             INTEGER NOT NULL,
      conditions_json      TEXT    NOT NULL,
      adjustment_json      TEXT    NOT NULL,
      quantity_breaks_json TEXT,
      enabled              INTEGER NOT NULL DEFAULT 1,
      override             INTEGER NOT NULL DEFAULT 0,
      valid_from           TEXT,
      valid_to             TEXT,
      pricelist_id         TEXT,
      metadata_json        TEXT,
      created_at           TEXT    NOT NULL,
      updated_at           TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_price_rules_type
      ON price_rules(type);

    CREATE INDEX IF NOT EXISTS idx_price_rules_pricelist_id
      ON price_rules(pricelist_id);

    CREATE INDEX IF NOT EXISTS idx_price_rules_enabled
      ON price_rules(enabled);

    CREATE TABLE IF NOT EXISTS rule_lookups (
      pk      TEXT NOT NULL,
      sk      TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      PRIMARY KEY (pk, sk)
    );

    CREATE INDEX IF NOT EXISTS idx_rule_lookups_pk
      ON rule_lookups(pk);

    CREATE TABLE IF NOT EXISTS pricelists (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      customer_id TEXT,
      project_id  TEXT,
      description TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pricelists_type
      ON pricelists(type);

    CREATE INDEX IF NOT EXISTS idx_pricelists_customer_id
      ON pricelists(customer_id);

    CREATE INDEX IF NOT EXISTS idx_pricelists_project_id
      ON pricelists(project_id);
  `);

  // Migration: add override column to existing databases that lack it
  const columns = db.pragma('table_info(price_rules)') as { name: string }[];
  if (!columns.some(c => c.name === 'override')) {
    db.exec('ALTER TABLE price_rules ADD COLUMN override INTEGER NOT NULL DEFAULT 0');
  }
}
