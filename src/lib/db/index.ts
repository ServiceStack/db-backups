import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { SCHEMA_SQL, DEFAULT_RETENTION_POLICY_SQL } from './schema';

let db: Database | null = null;

/**
 * Get the database path from environment or use default
 */
function getDatabasePath(): string {
  return process.env.DATABASE_PATH || '/app/data/db/app.db';
}

/**
 * Ensure the database directory exists
 */
function ensureDatabaseDirectory(dbPath: string): void {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Initialize the database connection
 */
export function initDatabase(): Database {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();
  ensureDatabaseDirectory(dbPath);

  // Create or open database
  db = new Database(dbPath, { create: true });

  // Enable WAL mode for better concurrency
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  // Run migrations
  db.exec(SCHEMA_SQL);
  db.exec(DEFAULT_RETENTION_POLICY_SQL);

  console.log(`Database initialized at: ${dbPath}`);

  return db;
}

/**
 * Get the database instance (initialize if needed)
 */
export function getDatabase(): Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Execute a query and return all results
 */
export function query<T = any>(sql: string, params?: any[]): T[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.all(...(params || [])) as T[];
}

/**
 * Execute a query and return the first result
 */
export function queryOne<T = any>(sql: string, params?: any[]): T | null {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return (stmt.get(...(params || [])) as T) || null;
}

/**
 * Execute a query and return the number of affected rows
 */
export function execute(sql: string, params?: any[]): number {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  const result = stmt.run(...(params || []));
  return result.changes;
}

/**
 * Execute multiple statements in a transaction
 */
export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
