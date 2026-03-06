import Database from 'better-sqlite3';
import { createSchema } from './schema';

let instance: Database.Database | null = null;

/**
 * Returns the singleton SQLite database instance.
 *
 * - Uses `:memory:` when DB_PATH is unset (test environments).
 * - Uses the path in DB_PATH otherwise; defaults to `./data/price-system.db`.
 * - Enables WAL journal mode for concurrent read performance.
 * - Runs DDL on first call to ensure tables exist.
 */
export function getDatabase(): Database.Database {
  if (instance !== null) {
    return instance;
  }

  const dbPath = process.env['DB_PATH'] ?? './data/price-system.db';
  const isInMemory = dbPath === ':memory:';

  instance = new Database(isInMemory ? ':memory:' : dbPath);

  // WAL mode improves concurrent read throughput and is safe for Lambda
  // single-writer workloads.
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');

  createSchema(instance);

  return instance;
}

/**
 * Closes and forgets the current database instance.
 * Primarily useful in tests to get a clean slate between suites.
 */
export function closeDatabase(): void {
  if (instance !== null) {
    instance.close();
    instance = null;
  }
}
