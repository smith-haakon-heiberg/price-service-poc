import type Database from 'better-sqlite3';
import type { PriceRule, PriceContext, RuleFilter } from '@/domain/types';
import type { PriceRuleRepository } from '@/domain/repositories';
import { getDatabase } from './database';

// ---------------------------------------------------------------------------
// Row type – what SQLite hands back before we deserialise JSON columns
// ---------------------------------------------------------------------------

interface PriceRuleRow {
  id: string;
  name: string;
  type: string;
  priority: number;
  conditions_json: string;
  adjustment_json: string;
  quantity_breaks_json: string | null;
  enabled: number; // 0 | 1
  override: number; // 0 | 1
  valid_from: string | null;
  valid_to: string | null;
  pricelist_id: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

function rowToRule(row: PriceRuleRow): PriceRule {
  return {
    id: row.id,
    name: row.name,
    type: row.type as PriceRule['type'],
    priority: row.priority,
    conditions: JSON.parse(row.conditions_json) as PriceRule['conditions'],
    adjustment: JSON.parse(row.adjustment_json) as PriceRule['adjustment'],
    quantityBreaks:
      row.quantity_breaks_json !== null
        ? (JSON.parse(row.quantity_breaks_json) as PriceRule['quantityBreaks'])
        : undefined,
    enabled: row.enabled === 1,
    override: row.override === 1 ? true : undefined,
    validFrom: row.valid_from ?? undefined,
    validTo: row.valid_to ?? undefined,
    pricelistId: row.pricelist_id ?? undefined,
    metadata:
      row.metadata_json !== null
        ? (JSON.parse(row.metadata_json) as Record<string, string>)
        : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ruleToParams(rule: PriceRule): Record<string, unknown> {
  return {
    id: rule.id,
    name: rule.name,
    type: rule.type,
    priority: rule.priority,
    conditions_json: JSON.stringify(rule.conditions),
    adjustment_json: JSON.stringify(rule.adjustment),
    quantity_breaks_json:
      rule.quantityBreaks !== undefined ? JSON.stringify(rule.quantityBreaks) : null,
    enabled: rule.enabled ? 1 : 0,
    override: rule.override ? 1 : 0,
    valid_from: rule.validFrom ?? null,
    valid_to: rule.validTo ?? null,
    pricelist_id: rule.pricelistId ?? null,
    metadata_json: rule.metadata !== undefined ? JSON.stringify(rule.metadata) : null,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Lookup-key builder (mirrors DynamoDB GSI access patterns)
// ---------------------------------------------------------------------------

/**
 * Returns the set of lookup PKs that should be pre-created whenever a rule
 * is saved, based on the rule's conditions.
 *
 * Supported patterns:
 *   SKU#<sku>       – rules that target a specific product SKU
 *   CAT#<catId>     – rules that target a category
 *   CUST#<custId>   – rules that target a specific customer
 *   PROJ#<projId>   – rules that target a specific project
 *   GLOBAL          – rules that apply to everything (no entity-level conditions)
 */
function buildLookupKeysForRule(rule: PriceRule): string[] {
  const keys = new Set<string>();

  let hasEntityCondition = false;

  for (const condition of rule.conditions) {
    switch (condition.field) {
      case 'sku':
        if (typeof condition.value === 'string') {
          keys.add(`SKU#${condition.value}`);
          hasEntityCondition = true;
        } else if (Array.isArray(condition.value)) {
          for (const v of condition.value as string[]) {
            keys.add(`SKU#${v}`);
          }
          hasEntityCondition = true;
        }
        break;
      case 'categoryId':
        if (typeof condition.value === 'string') {
          keys.add(`CAT#${condition.value}`);
          hasEntityCondition = true;
        } else if (Array.isArray(condition.value)) {
          for (const v of condition.value as string[]) {
            keys.add(`CAT#${v}`);
          }
          hasEntityCondition = true;
        }
        break;
      case 'customerId':
        if (typeof condition.value === 'string') {
          keys.add(`CUST#${condition.value}`);
          hasEntityCondition = true;
        }
        break;
      case 'projectId':
        if (typeof condition.value === 'string') {
          keys.add(`PROJ#${condition.value}`);
          hasEntityCondition = true;
        }
        break;
      default:
        // customerType, membershipTier, quantity, date, brand, outletFlag, warehouseId
        // are not indexed as lookup keys – they're evaluated by the domain condition-matcher.
        break;
    }
  }

  if (!hasEntityCondition) {
    keys.add('GLOBAL');
  }

  return [...keys];
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class SqlitePriceRuleRepository implements PriceRuleRepository {
  private readonly db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase();
  }

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  async findById(id: string): Promise<PriceRule | null> {
    const row = this.db
      .prepare<[string], PriceRuleRow>('SELECT * FROM price_rules WHERE id = ?')
      .get(id);

    return row !== undefined ? rowToRule(row) : null;
  }

  // -------------------------------------------------------------------------
  // findByType
  // -------------------------------------------------------------------------

  async findByType(type: string): Promise<PriceRule[]> {
    const rows = this.db
      .prepare<[string], PriceRuleRow>('SELECT * FROM price_rules WHERE type = ? ORDER BY priority ASC')
      .all(type);

    return rows.map(rowToRule);
  }

  // -------------------------------------------------------------------------
  // findMatchingRules
  // -------------------------------------------------------------------------

  /**
   * Returns all rules that are candidates for the given PriceContext.
   *
   * POC strategy: return ALL enabled rules and let the domain condition-matcher
   * perform the exact evaluation. This is correct for < ~1 000 rules and avoids
   * false negatives caused by incomplete pre-filtering.
   *
   * TODO (production): pre-filter using rule_lookups. Build lookup keys from the
   * context (SKU#<sku>, CUST#<customerId>, PROJ#<projectId>, GLOBAL), query
   * rule_lookups WHERE pk IN (...), collect distinct rule_ids, then fetch only
   * those rules. This reduces the fetch set dramatically at scale.
   */
  async findMatchingRules(_context: PriceContext): Promise<PriceRule[]> {
    const rows = this.db
      .prepare<[], PriceRuleRow>(
        'SELECT * FROM price_rules WHERE enabled = 1 ORDER BY priority ASC',
      )
      .all();

    return rows.map(rowToRule);
  }

  // -------------------------------------------------------------------------
  // findByPricelistId
  // -------------------------------------------------------------------------

  async findByPricelistId(pricelistId: string): Promise<PriceRule[]> {
    const rows = this.db
      .prepare<[string], PriceRuleRow>(
        'SELECT * FROM price_rules WHERE pricelist_id = ? ORDER BY priority ASC',
      )
      .all(pricelistId);

    return rows.map(rowToRule);
  }

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  async findAll(filter?: RuleFilter): Promise<PriceRule[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.type !== undefined) {
      conditions.push('type = ?');
      params.push(filter.type);
    }

    if (filter?.pricelistId !== undefined) {
      conditions.push('pricelist_id = ?');
      params.push(filter.pricelistId);
    }

    if (filter?.enabled !== undefined) {
      conditions.push('enabled = ?');
      params.push(filter.enabled ? 1 : 0);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM price_rules ${where} ORDER BY priority ASC`;

    const rows = this.db.prepare<unknown[], PriceRuleRow>(sql).all(...params);
    return rows.map(rowToRule);
  }

  // -------------------------------------------------------------------------
  // save
  // -------------------------------------------------------------------------

  async save(rule: PriceRule): Promise<PriceRule> {
    const params = ruleToParams(rule);

    const upsert = this.db.prepare(`
      INSERT INTO price_rules (
        id, name, type, priority,
        conditions_json, adjustment_json, quantity_breaks_json,
        enabled, override, valid_from, valid_to, pricelist_id, metadata_json,
        created_at, updated_at
      ) VALUES (
        @id, @name, @type, @priority,
        @conditions_json, @adjustment_json, @quantity_breaks_json,
        @enabled, @override, @valid_from, @valid_to, @pricelist_id, @metadata_json,
        @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        name                 = excluded.name,
        type                 = excluded.type,
        priority             = excluded.priority,
        conditions_json      = excluded.conditions_json,
        adjustment_json      = excluded.adjustment_json,
        quantity_breaks_json = excluded.quantity_breaks_json,
        enabled              = excluded.enabled,
        override             = excluded.override,
        valid_from           = excluded.valid_from,
        valid_to             = excluded.valid_to,
        pricelist_id         = excluded.pricelist_id,
        metadata_json        = excluded.metadata_json,
        updated_at           = excluded.updated_at
    `);

    const deleteLookups = this.db.prepare(
      'DELETE FROM rule_lookups WHERE rule_id = ?',
    );

    const insertLookup = this.db.prepare(
      'INSERT OR REPLACE INTO rule_lookups (pk, sk, rule_id) VALUES (?, ?, ?)',
    );

    // Run the upsert and lookup refresh inside a single transaction so there is
    // never a window where a rule exists without its lookup entries (or vice versa).
    const saveTransaction = this.db.transaction((r: PriceRule) => {
      upsert.run(params);
      deleteLookups.run(r.id);

      const lookupKeys = buildLookupKeysForRule(r);
      for (const pk of lookupKeys) {
        insertLookup.run(pk, `RULE#${r.id}`, r.id);
      }
    });

    saveTransaction(rule);

    return rule;
  }

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  async update(
    id: string,
    updates: Partial<Omit<PriceRule, 'id' | 'createdAt'>>,
  ): Promise<PriceRule> {
    const existing = await this.findById(id);

    if (existing === null) {
      throw new Error(`PriceRule not found: ${id}`);
    }

    const merged: PriceRule = {
      ...existing,
      ...updates,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    return this.save(merged);
  }

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    const deleteRule = this.db.prepare('DELETE FROM price_rules WHERE id = ?');
    const deleteLookups = this.db.prepare('DELETE FROM rule_lookups WHERE rule_id = ?');

    const deleteTransaction = this.db.transaction((ruleId: string) => {
      deleteLookups.run(ruleId);
      deleteRule.run(ruleId);
    });

    deleteTransaction(id);
  }
}
