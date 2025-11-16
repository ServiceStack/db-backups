import { spawn } from 'child_process';
import { createWriteStream, statSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import type { DatabaseConfig } from '@/types';
import { decrypt } from '../encryption';
import { logger } from '../logger';

export interface MySQLBackupOptions {
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
 * Execute MySQL backup using mysqldump
 */
export async function executeMySQLBackup(
  options: MySQLBackupOptions
): Promise<BackupMetadata> {
  const { database, outputPath, compress = true, onProgress } = options;

  const password = await decrypt(database.PasswordEncrypted);

  return new Promise((resolve, reject) => {
    const args = [
      '-h', database.Host,
      '-P', database.Port.toString(),
      '-u', database.Username,
      `--password=${password}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      '--events',
      '--add-drop-database',
      '--databases', database.DatabaseName,
      '--verbose',
    ];

    onProgress?.('Starting MySQL backup with mysqldump...');

    const mysqldump = spawn('mysqldump', args);

    let hasError = false;
    let errorMessage = '';

    // Handle stderr for progress and errors
    mysqldump.stderr?.on('data', (data) => {
      const message = data.toString();
      if (message.toLowerCase().includes('error')) {
        hasError = true;
        errorMessage += message;
        logger.error('mysqldump error:', message);
      } else {
        onProgress?.(message.trim());
      }
    });

    // Create write stream
    const outputFile = compress ? `${outputPath}.gz` : outputPath;
    const fileStream = createWriteStream(outputFile);
    const hash = createHash('sha256');

    // Set up pipeline
    const streams: any[] = [mysqldump.stdout];

    if (compress) {
      streams.push(createGzip());
    }

    // Hash the data as it's written
    mysqldump.stdout?.on('data', (chunk) => {
      hash.update(chunk);
    });

    streams.push(fileStream);

    pipeline(...streams)
      .then(() => {
        if (hasError) {
          reject(new Error(`MySQL backup failed: ${errorMessage}`));
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
        reject(new Error(`MySQL backup pipeline failed: ${error.message}`));
      });

    mysqldump.on('error', (error) => {
      reject(new Error(`Failed to start mysqldump: ${error.message}`));
    });

    mysqldump.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`mysqldump exited with code ${code}: ${errorMessage}`));
      }
    });
  });
}

/**
 * Test MySQL connection
 */
export async function testMySQLConnection(
  database: DatabaseConfig
): Promise<{ success: boolean; version?: string; error?: string }> {
  const password = await decrypt(database.PasswordEncrypted);

  return new Promise((resolve) => {
    const args = [
      '-h', database.Host,
      '-P', database.Port.toString(),
      '-u', database.Username,
      `--password=${password}`,
      '-e', 'SELECT VERSION();',
      '--batch',
      '--skip-column-names',
    ];

    const mysql = spawn('mysql', args);

    let output = '';
    let errorOutput = '';

    mysql.stdout?.on('data', (data) => {
      output += data.toString();
    });

    mysql.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    mysql.on('close', (code) => {
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

    mysql.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
      });
    });
  });
}
