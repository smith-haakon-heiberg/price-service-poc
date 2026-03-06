import type Database from 'better-sqlite3';
import type { Pricelist } from '@/domain/types';
import type { PricelistRepository } from '@/domain/repositories';
import { getDatabase } from './database';

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

interface PricelistRow {
  id: string;
  name: string;
  type: string;
  customer_id: string | null;
  project_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

function rowToPricelist(row: PricelistRow): Pricelist {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Pricelist['type'],
    customerId: row.customer_id ?? undefined,
    projectId: row.project_id ?? undefined,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function pricelistToParams(pricelist: Pricelist): Record<string, unknown> {
  return {
    id: pricelist.id,
    name: pricelist.name,
    type: pricelist.type,
    customer_id: pricelist.customerId ?? null,
    project_id: pricelist.projectId ?? null,
    description: pricelist.description ?? null,
    created_at: pricelist.createdAt,
    updated_at: pricelist.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class SqlitePricelistRepository implements PricelistRepository {
  private readonly db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase();
  }

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  async findById(id: string): Promise<Pricelist | null> {
    const row = this.db
      .prepare<[string], PricelistRow>('SELECT * FROM pricelists WHERE id = ?')
      .get(id);

    return row !== undefined ? rowToPricelist(row) : null;
  }

  // -------------------------------------------------------------------------
  // findByType
  // -------------------------------------------------------------------------

  async findByType(type: string): Promise<Pricelist[]> {
    const rows = this.db
      .prepare<[string], PricelistRow>(
        'SELECT * FROM pricelists WHERE type = ? ORDER BY name ASC',
      )
      .all(type);

    return rows.map(rowToPricelist);
  }

  // -------------------------------------------------------------------------
  // findByCustomerId
  // -------------------------------------------------------------------------

  async findByCustomerId(customerId: string): Promise<Pricelist[]> {
    const rows = this.db
      .prepare<[string], PricelistRow>(
        'SELECT * FROM pricelists WHERE customer_id = ? ORDER BY name ASC',
      )
      .all(customerId);

    return rows.map(rowToPricelist);
  }

  // -------------------------------------------------------------------------
  // findByProjectId
  // -------------------------------------------------------------------------

  async findByProjectId(projectId: string): Promise<Pricelist[]> {
    const rows = this.db
      .prepare<[string], PricelistRow>(
        'SELECT * FROM pricelists WHERE project_id = ? ORDER BY name ASC',
      )
      .all(projectId);

    return rows.map(rowToPricelist);
  }

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  async findAll(): Promise<Pricelist[]> {
    const rows = this.db
      .prepare<[], PricelistRow>('SELECT * FROM pricelists ORDER BY name ASC')
      .all();

    return rows.map(rowToPricelist);
  }

  // -------------------------------------------------------------------------
  // save
  // -------------------------------------------------------------------------

  async save(pricelist: Pricelist): Promise<Pricelist> {
    const params = pricelistToParams(pricelist);

    this.db
      .prepare(`
        INSERT INTO pricelists (
          id, name, type, customer_id, project_id, description,
          created_at, updated_at
        ) VALUES (
          @id, @name, @type, @customer_id, @project_id, @description,
          @created_at, @updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
          name        = excluded.name,
          type        = excluded.type,
          customer_id = excluded.customer_id,
          project_id  = excluded.project_id,
          description = excluded.description,
          updated_at  = excluded.updated_at
      `)
      .run(params);

    return pricelist;
  }

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  async update(
    id: string,
    updates: Partial<Omit<Pricelist, 'id' | 'createdAt'>>,
  ): Promise<Pricelist> {
    const existing = await this.findById(id);

    if (existing === null) {
      throw new Error(`Pricelist not found: ${id}`);
    }

    const merged: Pricelist = {
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
    this.db.prepare('DELETE FROM pricelists WHERE id = ?').run(id);
  }
}
