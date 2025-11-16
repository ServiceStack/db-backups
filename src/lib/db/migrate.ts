#!/usr/bin/env bun

/**
 * Database migration script
 * Run with: bun run src/lib/db/migrate.ts
 */

import { initDatabase } from './index';

console.log('Running database migrations...');

try {
  const db = initDatabase();
  console.log('✓ Database migrations completed successfully');
  db.close();
  process.exit(0);
} catch (error) {
  console.error('✗ Database migration failed:', error);
  process.exit(1);
}
