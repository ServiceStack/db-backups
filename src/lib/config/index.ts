/**
 * Application configuration and environment variable management
 */

export interface AppConfig {
  // Required
  encryptionKey: string;

  // Database
  databasePath: string;

  // S3 Configuration
  s3: {
    region: string;
    bucket: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
    endpoint: string | null;
  };

  // Application Settings
  autoDiscover: boolean;
  timezone: string;
  logLevel: string;
  maxBackupRetentionDays: number;
  backupStoragePath: string;

  // Server Settings
  port: number;
  hostname: string;
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const config: AppConfig = {
    encryptionKey: process.env.ENCRYPTION_KEY || '',

    databasePath: process.env.DATABASE_PATH || '/app/data/db/app.db',

    s3: {
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || null,
      accessKeyId: process.env.S3_ACCESS_KEY_ID || null,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || null,
      endpoint: process.env.S3_ENDPOINT || null,
    },

    autoDiscover: process.env.AUTO_DISCOVER === 'true',
    timezone: process.env.TZ || 'UTC',
    logLevel: process.env.LOG_LEVEL || 'info',
    maxBackupRetentionDays: parseInt(process.env.MAX_BACKUP_RETENTION_DAYS || '365', 10),
    backupStoragePath: process.env.BACKUP_STORAGE_PATH || '/app/data/backups',

    port: parseInt(process.env.PORT || '3000', 10),
    hostname: process.env.HOSTNAME || '0.0.0.0',
  };

  return config;
}

/**
 * Validate required configuration
 */
export function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  // Validate encryption key
  if (!config.encryptionKey) {
    errors.push('ENCRYPTION_KEY environment variable is required');
  } else if (config.encryptionKey.length < 32) {
    errors.push('ENCRYPTION_KEY must be at least 32 characters long');
  }

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  // Validate max retention days
  if (config.maxBackupRetentionDays < 1) {
    errors.push('MAX_BACKUP_RETENTION_DAYS must be at least 1');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get validated application configuration
 */
export function getConfig(): AppConfig {
  const config = loadConfig();
  validateConfig(config);
  return config;
}

/**
 * Check if S3 is configured
 */
export function isS3Configured(): boolean {
  const config = loadConfig();
  return !!(
    config.s3.bucket &&
    config.s3.accessKeyId &&
    config.s3.secretAccessKey
  );
}
