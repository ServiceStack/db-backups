/**
 * Application initialization
 * This module handles startup tasks like database initialization and scheduler setup
 */

import { initDatabase } from './db';
import { validateEncryptionConfig } from './encryption';
import { getConfig } from './config';
import { initializeScheduler } from './scheduler';
import { logger } from './logger';

let initialized = false;

/**
 * Initialize the application
 */
export async function initializeApp(): Promise<void> {
  if (initialized) {
    logger.info('Application already initialized');
    return;
  }

  try {
    logger.info('Initializing application...');

    // Load and validate configuration
    const config = getConfig();
    logger.info('Configuration loaded', {
      port: config.port,
      databasePath: config.databasePath,
      backupStoragePath: config.backupStoragePath,
    });

    // Validate encryption configuration
    validateEncryptionConfig();

    // Initialize database
    initDatabase();
    logger.info('Database initialized');

    // Initialize scheduler
    initializeScheduler();
    logger.info('Scheduler initialized');

    initialized = true;
    logger.info('Application initialization complete');
  } catch (error) {
    logger.error('Application initialization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Check if application is initialized
 */
export function isInitialized(): boolean {
  return initialized;
}
