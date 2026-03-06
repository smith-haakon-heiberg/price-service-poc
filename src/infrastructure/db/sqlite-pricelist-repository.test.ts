import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, closeDatabase } from '@/infrastructure/db';
import { SqlitePricelistRepository } from '@/infrastructure/db';
import type { Pricelist } from '@/domain/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePricelist(overrides: Partial<Pricelist> & { id: string; name: string }): Pricelist {
  return {
    type: 'general',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let repo: SqlitePricelistRepository;

beforeEach(() => {
  const db = getDatabase();
  repo = new SqlitePricelistRepository(db);
});

afterEach(() => {
  closeDatabase();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SqlitePricelistRepository', () => {
  // -------------------------------------------------------------------------
  // save / findById round-trip
  // -------------------------------------------------------------------------

  describe('save() and findById() round-trip', () => {
    it('saves a minimal pricelist and retrieves it by id', async () => {
      const pl = makePricelist({ id: 'pl-1', name: 'General Pricelist' });
      await repo.save(pl);

      const found = await repo.findById('pl-1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('pl-1');
      expect(found!.name).toBe('General Pricelist');
    });

    it('preserves all scalar fields', async () => {
      const pl = makePricelist({
        id: 'pl-scalar',
        name: 'Full Pricelist',
        type: 'customer',
        customerId: 'CUST-42',
        description: 'VIP customer pricelist',
        createdAt: '2025-03-01T08:00:00.000Z',
        updatedAt: '2025-03-01T08:00:00.000Z',
      });

      await repo.save(pl);
      const found = await repo.findById('pl-scalar');

      expect(found!.type).toBe('customer');
      expect(found!.customerId).toBe('CUST-42');
      expect(found!.description).toBe('VIP customer pricelist');
      expect(found!.createdAt).toBe('2025-03-01T08:00:00.000Z');
    });

    it('saves a project pricelist with projectId', async () => {
      const pl = makePricelist({
        id: 'pl-proj',
        name: 'Project Pricelist',
        type: 'project',
        projectId: 'PROJ-99',
      });

      await repo.save(pl);
      const found = await repo.findById('pl-proj');

      expect(found!.projectId).toBe('PROJ-99');
      expect(found!.customerId).toBeUndefined();
    });

    it('returns undefined for optional fields not provided', async () => {
      const pl = makePricelist({ id: 'pl-opts', name: 'No Optionals' });
      await repo.save(pl);

      const found = await repo.findById('pl-opts');
      expect(found!.customerId).toBeUndefined();
      expect(found!.projectId).toBeUndefined();
      expect(found!.description).toBeUndefined();
    });

    it('returns null for a non-existent id', async () => {
      const found = await repo.findById('does-not-exist');
      expect(found).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // findByType
  // -------------------------------------------------------------------------

  describe('findByType()', () => {
    it('returns pricelists matching the type', async () => {
      await repo.save(makePricelist({ id: 'ft-1', name: 'Customer A', type: 'customer', customerId: 'C1' }));
      await repo.save(makePricelist({ id: 'ft-2', name: 'Customer B', type: 'customer', customerId: 'C2' }));
      await repo.save(makePricelist({ id: 'ft-3', name: 'General List', type: 'general' }));

      const customerPricelists = await repo.findByType('customer');
      expect(customerPricelists).toHaveLength(2);
      expect(customerPricelists.every(p => p.type === 'customer')).toBe(true);
    });

    it('returns empty array when no pricelists match the type', async () => {
      await repo.save(makePricelist({ id: 'type-miss', name: 'General', type: 'general' }));

      const result = await repo.findByType('outlet');
      expect(result).toHaveLength(0);
    });

    it('returns results sorted by name ascending', async () => {
      await repo.save(makePricelist({ id: 'sort-c', name: 'Zeta', type: 'member' }));
      await repo.save(makePricelist({ id: 'sort-a', name: 'Alpha', type: 'member' }));
      await repo.save(makePricelist({ id: 'sort-b', name: 'Beta', type: 'member' }));

      const result = await repo.findByType('member');
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Beta');
      expect(result[2].name).toBe('Zeta');
    });
  });

  // -------------------------------------------------------------------------
  // findByCustomerId
  // -------------------------------------------------------------------------

  describe('findByCustomerId()', () => {
    it('returns pricelists associated with the given customer id', async () => {
      await repo.save(makePricelist({ id: 'cust-pl-1', name: 'PL 1 for C99', type: 'customer', customerId: 'C99' }));
      await repo.save(makePricelist({ id: 'cust-pl-2', name: 'PL 2 for C99', type: 'customer', customerId: 'C99' }));
      await repo.save(makePricelist({ id: 'cust-pl-other', name: 'Other Customer', type: 'customer', customerId: 'C77' }));

      const result = await repo.findByCustomerId('C99');
      expect(result).toHaveLength(2);
      expect(result.every(p => p.customerId === 'C99')).toBe(true);
    });

    it('returns empty array when customer has no pricelists', async () => {
      const result = await repo.findByCustomerId('C-nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // findByProjectId
  // -------------------------------------------------------------------------

  describe('findByProjectId()', () => {
    it('returns pricelists associated with the given project id', async () => {
      await repo.save(makePricelist({ id: 'proj-pl-1', name: 'Project PL A', type: 'project', projectId: 'P42' }));
      await repo.save(makePricelist({ id: 'proj-pl-2', name: 'Project PL B', type: 'project', projectId: 'P42' }));
      await repo.save(makePricelist({ id: 'proj-pl-other', name: 'Other Project', type: 'project', projectId: 'P99' }));

      const result = await repo.findByProjectId('P42');
      expect(result).toHaveLength(2);
      expect(result.every(p => p.projectId === 'P42')).toBe(true);
    });

    it('returns empty array when project has no pricelists', async () => {
      const result = await repo.findByProjectId('P-nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll()', () => {
    it('returns all saved pricelists', async () => {
      await repo.save(makePricelist({ id: 'all-1', name: 'List 1', type: 'general' }));
      await repo.save(makePricelist({ id: 'all-2', name: 'List 2', type: 'customer', customerId: 'C1' }));
      await repo.save(makePricelist({ id: 'all-3', name: 'List 3', type: 'project', projectId: 'P1' }));

      const all = await repo.findAll();
      expect(all).toHaveLength(3);
    });

    it('returns empty array when no pricelists exist', async () => {
      const all = await repo.findAll();
      expect(all).toHaveLength(0);
    });

    it('returns results sorted by name ascending', async () => {
      await repo.save(makePricelist({ id: 'name-c', name: 'Zebra', type: 'general' }));
      await repo.save(makePricelist({ id: 'name-a', name: 'Apple', type: 'general' }));
      await repo.save(makePricelist({ id: 'name-b', name: 'Mango', type: 'general' }));

      const all = await repo.findAll();
      expect(all[0].name).toBe('Apple');
      expect(all[1].name).toBe('Mango');
      expect(all[2].name).toBe('Zebra');
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe('update()', () => {
    it('updates specified fields and returns the merged pricelist', async () => {
      const pl = makePricelist({ id: 'upd-1', name: 'Original Name', type: 'general' });
      await repo.save(pl);

      const updated = await repo.update('upd-1', {
        name: 'Renamed Pricelist',
        description: 'Now has a description',
      });

      expect(updated.id).toBe('upd-1');
      expect(updated.name).toBe('Renamed Pricelist');
      expect(updated.description).toBe('Now has a description');
    });

    it('persists the update to the database', async () => {
      const pl = makePricelist({ id: 'upd-persist', name: 'Before' });
      await repo.save(pl);

      await repo.update('upd-persist', { name: 'After' });

      const reloaded = await repo.findById('upd-persist');
      expect(reloaded!.name).toBe('After');
    });

    it('sets updatedAt to a new timestamp', async () => {
      const pl = makePricelist({ id: 'upd-ts', name: 'TS Test', updatedAt: '2025-01-01T00:00:00.000Z' });
      await repo.save(pl);

      const updated = await repo.update('upd-ts', { name: 'New Name' });
      expect(updated.updatedAt).not.toBe('2025-01-01T00:00:00.000Z');
    });

    it('preserves createdAt unchanged', async () => {
      const pl = makePricelist({ id: 'upd-cat', name: 'CreatedAt', createdAt: '2025-02-20T12:00:00.000Z' });
      await repo.save(pl);

      const updated = await repo.update('upd-cat', { name: 'Updated' });
      expect(updated.createdAt).toBe('2025-02-20T12:00:00.000Z');
    });

    it('throws when updating a non-existent pricelist', async () => {
      await expect(repo.update('ghost-pl', { name: 'Should Fail' })).rejects.toThrow();
    });

    it('can change the type and associated ids', async () => {
      const pl = makePricelist({ id: 'upd-type', name: 'Type Change', type: 'general' });
      await repo.save(pl);

      const updated = await repo.update('upd-type', { type: 'customer', customerId: 'CUST-1' });
      expect(updated.type).toBe('customer');
      expect(updated.customerId).toBe('CUST-1');
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete()', () => {
    it('removes the pricelist so findById returns null afterwards', async () => {
      const pl = makePricelist({ id: 'del-1', name: 'Delete Me' });
      await repo.save(pl);

      await repo.delete('del-1');

      const found = await repo.findById('del-1');
      expect(found).toBeNull();
    });

    it('does not affect other pricelists when deleting one', async () => {
      await repo.save(makePricelist({ id: 'del-keep', name: 'Keep Me' }));
      await repo.save(makePricelist({ id: 'del-gone', name: 'Gone' }));

      await repo.delete('del-gone');

      const kept = await repo.findById('del-keep');
      expect(kept).not.toBeNull();

      const all = await repo.findAll();
      expect(all).toHaveLength(1);
    });

    it('does not throw when deleting a non-existent id', async () => {
      await expect(repo.delete('nonexistent-pl')).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // upsert behaviour
  // -------------------------------------------------------------------------

  describe('save() upsert behaviour', () => {
    it('overwrites existing pricelist when saved with the same id', async () => {
      const original = makePricelist({ id: 'upsert-pl', name: 'Original', type: 'general' });
      await repo.save(original);

      const replacement = makePricelist({
        id: 'upsert-pl',
        name: 'Replaced',
        type: 'member',
        description: 'Now a member pricelist',
        updatedAt: '2025-06-01T00:00:00.000Z',
      });
      await repo.save(replacement);

      const found = await repo.findById('upsert-pl');
      expect(found!.name).toBe('Replaced');
      expect(found!.type).toBe('member');
      expect(found!.description).toBe('Now a member pricelist');
    });
  });
});
