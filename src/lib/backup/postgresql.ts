import { spawn } from 'child_process';
import { createWriteStream, statSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import type { DatabaseConfig } from '@/types';
import { decrypt } from '../encryption';
import { logger } from '../logger';

export interface PostgresBackupOptions {
  database: DatabaseConfig;
  outputPath: string;
  compress?: boolean;
  onProgress?: (message: string) => void;
}

export interface BackupMetadata {
  filePath: string;
  fileSizeBytes: number;
  checksum: string;
  compressionUsed: string;
}

/**
 * Execute PostgreSQL backup using pg_dump
 */
export async function executePostgresBackup(
  options: PostgresBackupOptions
): Promise<BackupMetadata> {
  const { database, outputPath, compress = true, onProgress } = options;

  const password = await decrypt(database.PasswordEncrypted);

  return new Promise((resolve, reject) => {
    const args = [
      '-h', database.Host,
      '-p', database.Port.toString(),
      '-U', database.Username,
      '-d', database.DatabaseName,
      '-Fc', // Custom format (compressed)
      '--no-password',
      '--clean',
      '--if-exists',
      '--verbose',
    ];

    onProgress?.('Starting PostgreSQL backup with pg_dump...');

    const pgDump = spawn('pg_dump', args, {
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
    });

    let hasError = false;
    let errorMessage = '';

    // Handle stderr for progress and errors
    pgDump.stderr?.on('data', (data) => {
      const message = data.toString();
      if (message.includes('error') || message.includes('ERROR')) {
        hasError = true;
        errorMessage += message;
        logger.error('pg_dump error:', message);
      } else {
        onProgress?.(message.trim());
      }
    });

    // Create write stream
    const outputFile = compress ? `${outputPath}.gz` : outputPath;
    const fileStream = createWriteStream(outputFile);
    const hash = createHash('sha256');

    // Set up pipeline
    const streams: any[] = [pgDump.stdout];

    if (compress) {
      streams.push(createGzip());
    }

    // Hash the data as it's written
    pgDump.stdout?.on('data', (chunk) => {
      hash.update(chunk);
    });

    streams.push(fileStream);

    pipeline(...streams)
      .then(() => {
        if (hasError) {
          reject(new Error(`PostgreSQL backup failed: ${errorMessage}`));
          return;
        }

        const stats = statSync(outputFile);
        const checksum = hash.digest('hex');

        onProgress?.('Backup completed successfully');

        resolve({
          filePath: outputFile,
          fileSizeBytes: stats.size,
          checksum,
          compressionUsed: compress ? 'gzip' : 'none',
        });
      })
      .catch((error) => {
        reject(new Error(`PostgreSQL backup pipeline failed: ${error.message}`));
      });

    pgDump.on('error', (error) => {
      reject(new Error(`Failed to start pg_dump: ${error.message}`));
    });

    pgDump.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`pg_dump exited with code ${code}: ${errorMessage}`));
      }
    });
  });
}

/**
 * Test PostgreSQL connection
 */
export async function testPostgresConnection(
  database: DatabaseConfig
): Promise<{ success: boolean; version?: string; error?: string }> {
  const password = await decrypt(database.PasswordEncrypted);

  return new Promise((resolve) => {
    const args = [
      '-h', database.Host,
      '-p', database.Port.toString(),
      '-U', database.Username,
      '-d', database.DatabaseName,
      '-c', 'SELECT version();',
      '-t',
      '--no-password',
    ];

    const psql = spawn('psql', args, {
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
    });

    let output = '';
    let errorOutput = '';

    psql.stdout?.on('data', (data) => {
      output += data.toString();
    });

    psql.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    psql.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          version: output.trim(),
        });
      } else {
        resolve({
          success: false,
          error: errorOutput || 'Connection failed',
        });
      }
    });

    psql.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
      });
    });
  });
}
