import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import { existsSync, createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { join } from 'path';
import { downloadFromS3 } from '../s3';
import { createExecutionLogger } from '../logger';
import { execute, queryOne, getCurrentTimestamp } from '../db';
import { getConfig } from '../config';
import { decrypt } from '../encryption';
import type {
  DatabaseConfig,
  RestoreExecutionInput,
  RestoreExecution,
  S3Config,
  RestoreResult,
  RestoreOptions,
} from '@/types';

/**
 * Create restore execution record
 */
function createRestoreExecution(input: RestoreExecutionInput): string {
  const executionId = nanoid();
  const sql = `
    INSERT INTO RestoreExecutions (
      Id, DatabaseConfigId, BackupExecutionId, Status, SourceType,
      SourcePath, S3Bucket, S3Key, RestoreOptions, InitiatedBy,
      StartedAt, CreatedAt
    )
    VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  execute(sql, [
    executionId,
    input.DatabaseConfigId,
    input.BackupExecutionId || null,
    input.SourceType,
    input.SourcePath || null,
    input.S3Bucket || null,
    input.S3Key || null,
    input.RestoreOptions ? JSON.stringify(input.RestoreOptions) : null,
    input.InitiatedBy || null,
    getCurrentTimestamp(),
    getCurrentTimestamp(),
  ]);

  return executionId;
}

/**
 * Update restore execution record
 */
function updateRestoreExecution(executionId: string, updates: Partial<RestoreExecution>): void {
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return;

  values.push(executionId);
  const sql = `UPDATE RestoreExecutions SET ${fields.join(', ')} WHERE Id = ?`;
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
 * Restore PostgreSQL database
 */
async function restorePostgres(
  database: DatabaseConfig,
  backupFilePath: string,
  options: RestoreOptions,
  onProgress?: (message: string) => void
): Promise<void> {
  const password = await decrypt(database.PasswordEncrypted);

  return new Promise((resolve, reject) => {
    const args = [
      '-h', database.Host,
      '-p', database.Port.toString(),
      '-U', database.Username,
      '-d', database.DatabaseName,
      '--no-password',
      '--verbose',
    ];

    if (options.cleanBeforeRestore) {
      args.push('--clean');
    }

    onProgress?.('Starting PostgreSQL restore with pg_restore...');

    const pgRestore = spawn('pg_restore', args, {
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
    });

    let errorMessage = '';

    pgRestore.stderr?.on('data', (data) => {
      const message = data.toString();
      if (message.toLowerCase().includes('error')) {
        errorMessage += message;
      }
      onProgress?.(message.trim());
    });

    pgRestore.stdout?.on('data', (data) => {
      onProgress?.(data.toString().trim());
    });

    // Stream backup file to pg_restore
    const fileStream = createReadStream(backupFilePath);
    const gunzip = createGunzip();

    pipeline(fileStream, gunzip, pgRestore.stdin!).catch((error) => {
      reject(new Error(`Failed to stream backup file: ${error.message}`));
    });

    pgRestore.on('error', (error) => {
      reject(new Error(`Failed to start pg_restore: ${error.message}`));
    });

    pgRestore.on('close', (code) => {
      if (code === 0) {
        onProgress?.('Restore completed successfully');
        resolve();
      } else {
        reject(new Error(`pg_restore exited with code ${code}: ${errorMessage}`));
      }
    });
  });
}

/**
 * Restore MySQL database
 */
async function restoreMySQL(
  database: DatabaseConfig,
  backupFilePath: string,
  options: RestoreOptions,
  onProgress?: (message: string) => void
): Promise<void> {
  const password = await decrypt(database.PasswordEncrypted);

  return new Promise((resolve, reject) => {
    const args = [
      '-h', database.Host,
      '-P', database.Port.toString(),
      '-u', database.Username,
      `--password=${password}`,
      database.DatabaseName,
    ];

    onProgress?.('Starting MySQL restore...');

    const mysql = spawn('mysql', args);

    let errorMessage = '';

    mysql.stderr?.on('data', (data) => {
      const message = data.toString();
      if (message.toLowerCase().includes('error')) {
        errorMessage += message;
      }
      onProgress?.(message.trim());
    });

    mysql.stdout?.on('data', (data) => {
      onProgress?.(data.toString().trim());
    });

    // Stream backup file to mysql
    const fileStream = createReadStream(backupFilePath);
    const gunzip = createGunzip();

    pipeline(fileStream, gunzip, mysql.stdin!).catch((error) => {
      reject(new Error(`Failed to stream backup file: ${error.message}`));
    });

    mysql.on('error', (error) => {
      reject(new Error(`Failed to start mysql: ${error.message}`));
    });

    mysql.on('close', (code) => {
      if (code === 0) {
        onProgress?.('Restore completed successfully');
        resolve();
      } else {
        reject(new Error(`mysql exited with code ${code}: ${errorMessage}`));
      }
    });
  });
}

/**
 * Execute restore for a database
 */
export async function executeRestore(input: RestoreExecutionInput): Promise<RestoreResult> {
  const config = getConfig();
  const executionId = createRestoreExecution(input);
  const logger = createExecutionLogger(executionId, 'restore');

  try {
    logger.info('Starting restore execution', {
      databaseConfigId: input.DatabaseConfigId,
      sourceType: input.SourceType,
    });

    // Get database configuration
    const database = getDatabaseConfig(input.DatabaseConfigId);
    if (!database) {
      throw new Error('Database configuration not found');
    }

    logger.info(`Restoring to ${database.Type} database: ${database.Name}`);

    // Determine backup file path
    let backupFilePath: string;

    if (input.SourceType === 's3') {
      if (!input.S3Bucket || !input.S3Key) {
        throw new Error('S3 bucket and key are required for S3 restore');
      }

      const s3Config = getS3Config();
      if (!s3Config) {
        throw new Error('No S3 configuration found');
      }

      logger.info('Downloading backup from S3', {
        bucket: input.S3Bucket,
        key: input.S3Key,
      });

      const tempFileName = `restore_${executionId}_${input.S3Key.split('/').pop()}`;
      backupFilePath = join(config.backupStoragePath, tempFileName);

      const downloadResult = await downloadFromS3(s3Config, {
        bucket: input.S3Bucket,
        key: input.S3Key,
        destinationPath: backupFilePath,
      });

      if (!downloadResult.success) {
        throw new Error(`Failed to download from S3: ${downloadResult.error}`);
      }

      logger.info('Backup downloaded from S3');
    } else if (input.SourceType === 'local') {
      if (!input.SourcePath) {
        throw new Error('Source path is required for local restore');
      }

      backupFilePath = input.SourcePath;

      if (!existsSync(backupFilePath)) {
        throw new Error(`Backup file not found: ${backupFilePath}`);
      }

      logger.info('Using local backup file', { path: backupFilePath });
    } else {
      throw new Error(`Unsupported source type: ${input.SourceType}`);
    }

    // Parse restore options
    const options: RestoreOptions = input.RestoreOptions || {};

    // Execute database-specific restore
    const startTime = Date.now();

    if (database.Type === 'postgresql') {
      await restorePostgres(
        database,
        backupFilePath,
        options,
        (message) => logger.debug(message)
      );
    } else if (database.Type === 'mysql') {
      await restoreMySQL(
        database,
        backupFilePath,
        options,
        (message) => logger.debug(message)
      );
    } else {
      throw new Error(`Unsupported database type: ${database.Type}`);
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    logger.info('Restore completed', { duration: durationSeconds });

    // Update execution record
    updateRestoreExecution(executionId, {
      Status: 'completed',
      CompletedAt: getCurrentTimestamp(),
      DurationSeconds: durationSeconds,
    });

    logger.info('Restore execution completed successfully');

    return {
      executionId,
      success: true,
      durationSeconds,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Restore execution failed', { error: errorMessage });

    updateRestoreExecution(executionId, {
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
