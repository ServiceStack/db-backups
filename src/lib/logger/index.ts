import winston from 'winston';
import { getConfig } from '../config';
import { execute, getCurrentTimestamp } from '../db';
import { nanoid } from 'nanoid';
import type { ExecutionType, LogLevel, ExecutionLogInput } from '@/types';

/**
 * Create Winston logger instance
 */
function createLogger() {
  const config = getConfig();

  return winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'db-backup' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}]: ${message}${metaStr}`;
          })
        ),
      }),
    ],
  });
}

// Global logger instance
export const logger = createLogger();

/**
 * Log to execution logs table
 */
export function logExecution(input: ExecutionLogInput): void {
  try {
    const sql = `
      INSERT INTO ExecutionLogs (Id, ExecutionId, ExecutionType, LogLevel, Message, Metadata, Timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const metadata = input.Metadata ? JSON.stringify(input.Metadata) : null;

    execute(sql, [
      nanoid(),
      input.ExecutionId,
      input.ExecutionType,
      input.LogLevel,
      input.Message,
      metadata,
      getCurrentTimestamp(),
    ]);

    // Also log to console
    const logMethod = logger[input.LogLevel as keyof typeof logger] as any;
    if (typeof logMethod === 'function') {
      logMethod.call(logger, `[${input.ExecutionType}:${input.ExecutionId}] ${input.Message}`, input.Metadata || {});
    }
  } catch (error) {
    logger.error('Failed to log execution', { error });
  }
}

/**
 * Helper function to create execution logger
 */
export function createExecutionLogger(executionId: string, executionType: ExecutionType) {
  return {
    debug: (message: string, metadata?: Record<string, any>) => {
      logExecution({
        ExecutionId: executionId,
        ExecutionType: executionType,
        LogLevel: 'debug',
        Message: message,
        Metadata: metadata,
      });
    },
    info: (message: string, metadata?: Record<string, any>) => {
      logExecution({
        ExecutionId: executionId,
        ExecutionType: executionType,
        LogLevel: 'info',
        Message: message,
        Metadata: metadata,
      });
    },
    warn: (message: string, metadata?: Record<string, any>) => {
      logExecution({
        ExecutionId: executionId,
        ExecutionType: executionType,
        LogLevel: 'warn',
        Message: message,
        Metadata: metadata,
      });
    },
    error: (message: string, metadata?: Record<string, any>) => {
      logExecution({
        ExecutionId: executionId,
        ExecutionType: executionType,
        LogLevel: 'error',
        Message: message,
        Metadata: metadata,
      });
    },
  };
}

/**
 * Get execution logs
 */
export function getExecutionLogs(
  executionId: string,
  executionType?: ExecutionType,
  logLevel?: LogLevel
): any[] {
  let sql = `
    SELECT * FROM ExecutionLogs
    WHERE ExecutionId = ?
  `;
  const params: any[] = [executionId];

  if (executionType) {
    sql += ` AND ExecutionType = ?`;
    params.push(executionType);
  }

  if (logLevel) {
    sql += ` AND LogLevel = ?`;
    params.push(logLevel);
  }

  sql += ` ORDER BY Timestamp ASC`;

  const db = require('../db').getDatabase();
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}
