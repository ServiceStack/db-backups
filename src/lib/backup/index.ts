import { nanoid } from 'nanoid';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { executePostgresBackup } from './postgresql';
import { executeMySQLBackup } from './mysql';
import { uploadToS3, generateS3Key } from '../s3';
import { createExecutionLogger } from '../logger';
import { execute, queryOne, getCurrentTimestamp } from '../db';
import { getConfig } from '../config';
import type { DatabaseConfig, BackupExecutionInput, BackupExecution, S3Config, BackupResult } from '@/types';

/**
 * Ensure backup storage directory exists
 */
function ensureBackupDirectory(backupPath: string): void {
  if (!existsSync(backupPath)) {
    mkdirSync(backupPath, { recursive: true });
  }
}

/**
 * Generate backup filename
 */
function generateBackupFileName(
  databaseName: string,
  backupType: string,
  extension: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
  const id = nanoid(8);
  return `${databaseName}_${backupType}_${timestamp}_${id}.${extension}`;
}

/**
 * Create backup execution record
 */
function createBackupExecution(input: BackupExecutionInput): string {
  const executionId = nanoid();
  const sql = `
    INSERT INTO BackupExecutions (
      Id, DatabaseConfigId, BackupScheduleId, BackupType, Status, StartedAt, CreatedAt
    )
    VALUES (?, ?, ?, ?, 'running', ?, ?)
  `;

  execute(sql, [
    executionId,
    input.DatabaseConfigId,
    input.BackupScheduleId || null,
    input.BackupType,
    getCurrentTimestamp(),
    getCurrentTimestamp(),
  ]);

  return executionId;
}

/**
 * Update backup execution record
 */
function updateBackupExecution(executionId: string, updates: Partial<BackupExecution>): void {
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return;

  values.push(executionId);
  const sql = `UPDATE BackupExecutions SET ${fields.join(', ')} WHERE Id = ?`;
  execute(sql, values);
}

/**
 * Get database configuration
 */
function getDatabaseConfig(id: string): DatabaseConfig | null {
  return queryOne<DatabaseConfig>('SELECT * FROM DatabaseConfigs WHERE Id = ?', [id]);
}

/**
 * Get S3 configuration
 */
function getS3Config(): S3Config | null {
  return queryOne<S3Config>('SELECT * FROM S3Configs WHERE Enabled = 1 AND IsDefault = 1');
}

/**
 * Execute backup for a database
 */
export async function executeBackup(input: BackupExecutionInput): Promise<BackupResult> {
  const config = getConfig();
  const executionId = createBackupExecution(input);
  const logger = createExecutionLogger(executionId, 'backup');

  try {
    logger.info('Starting backup execution', {
      databaseConfigId: input.DatabaseConfigId,
      backupType: input.BackupType,
    });

    // Get database configuration
    const database = getDatabaseConfig(input.DatabaseConfigId);
    if (!database) {
      throw new Error('Database configuration not found');
    }

    logger.info(`Backing up ${database.Type} database: ${database.Name}`);

    // Ensure backup directory exists
    ensureBackupDirectory(config.backupStoragePath);

    // Generate filename
    const extension = database.Type === 'postgresql' ? 'dump' : 'sql';
    const fileName = generateBackupFileName(database.Name, input.BackupType, extension);
    const localPath = join(config.backupStoragePath, fileName);

    logger.info(`Backup file: ${fileName}`);

    // Execute database-specific backup
    const startTime = Date.now();
    let metadata;

    if (database.Type === 'postgresql') {
      metadata = await executePostgresBackup({
        database,
        outputPath: localPath,
        compress: true,
        onProgress: (message) => logger.debug(message),
      });
    } else if (database.Type === 'mysql') {
      metadata = await executeMySQLBackup({
        database,
        outputPath: localPath,
        compress: true,
        onProgress: (message) => logger.debug(message),
      });
    } else {
      throw new Error(`Unsupported database type: ${database.Type}`);
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    logger.info('Backup file created', {
      filePath: metadata.filePath,
      fileSize: metadata.fileSizeBytes,
      checksum: metadata.checksum,
      duration: durationSeconds,
    });

    // Upload to S3 if enabled
    let s3Uploaded = false;
    let s3Bucket: string | null = null;
    let s3Key: string | null = null;
    let s3UploadedAt: string | null = null;

    if (input.S3UploadEnabled !== false) {
      const s3Config = getS3Config();
      if (s3Config) {
        logger.info('Uploading backup to S3');

        const s3KeyPath = generateS3Key(
          s3Config.PathPrefix,
          database.Name,
          fileName + '.gz'
        );

        const uploadResult = await uploadToS3(s3Config, {
          bucket: s3Config.Bucket,
          key: s3KeyPath,
          filePath: metadata.filePath,
          metadata: {
            database: database.Name,
            type: input.BackupType,
            executionId,
          },
        });

        if (uploadResult.success) {
          s3Uploaded = true;
          s3Bucket = s3Config.Bucket;
          s3Key = s3KeyPath;
          s3UploadedAt = getCurrentTimestamp();
          logger.info('Backup uploaded to S3', { bucket: s3Bucket, key: s3Key });
        } else {
          logger.warn('S3 upload failed', { error: uploadResult.error });
        }
      } else {
        logger.warn('S3 upload requested but no S3 configuration found');
      }
    }

    // Update execution record
    updateBackupExecution(executionId, {
      Status: 'completed',
      FileName: fileName + '.gz',
      FileSizeBytes: metadata.fileSizeBytes,
      LocalPath: metadata.filePath,
      S3Uploaded: s3Uploaded,
      S3Bucket: s3Bucket,
      S3Key: s3Key,
      S3UploadedAt: s3UploadedAt,
      CompletedAt: getCurrentTimestamp(),
      DurationSeconds: durationSeconds,
      CompressionUsed: metadata.compressionUsed,
      Checksum: metadata.checksum,
    });

    logger.info('Backup execution completed successfully');

    return {
      executionId,
      success: true,
      fileName: fileName + '.gz',
      fileSizeBytes: metadata.fileSizeBytes,
      durationSeconds,
      s3Uploaded,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Backup execution failed', { error: errorMessage });

    updateBackupExecution(executionId, {
      Status: 'failed',
      ErrorMessage: errorMessage,
      ErrorStack: errorStack,
      CompletedAt: getCurrentTimestamp(),
    });

    return {
      executionId,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(
  database: DatabaseConfig
): Promise<{ success: boolean; version?: string; error?: string }> {
  if (database.Type === 'postgresql') {
    const { testPostgresConnection } = await import('./postgresql');
    return testPostgresConnection(database);
  } else if (database.Type === 'mysql') {
    const { testMySQLConnection } = await import('./mysql');
    return testMySQLConnection(database);
  } else {
    return {
      success: false,
      error: `Unsupported database type: ${database.Type}`,
    };
  }
}
