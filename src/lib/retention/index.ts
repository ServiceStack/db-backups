import { unlinkSync, existsSync } from 'fs';
import { query, execute } from '../db';
import { deleteFromS3 } from '../s3';
import { logger } from '../logger';
import type { BackupExecution, RetentionPolicy, S3Config } from '@/types';
import { startOfHour, startOfDay, startOfWeek, startOfMonth, startOfYear, parseISO } from 'date-fns';

/**
 * Get retention policy
 */
function getRetentionPolicy(id: string): RetentionPolicy | null {
  const result = query<RetentionPolicy>('SELECT * FROM RetentionPolicies WHERE Id = ?', [id]);
  return result[0] || null;
}

/**
 * Get default S3 config
 */
function getDefaultS3Config(): S3Config | null {
  const result = query<S3Config>('SELECT * FROM S3Configs WHERE Enabled = 1 AND IsDefault = 1');
  return result[0] || null;
}

/**
 * Group backups by time bucket
 */
interface BackupBucket {
  hourly: Map<string, BackupExecution>;
  daily: Map<string, BackupExecution>;
  weekly: Map<string, BackupExecution>;
  monthly: Map<string, BackupExecution>;
  yearly: Map<string, BackupExecution>;
}

function categorizeBackups(backups: BackupExecution[]): BackupBucket {
  const buckets: BackupBucket = {
    hourly: new Map(),
    daily: new Map(),
    weekly: new Map(),
    monthly: new Map(),
    yearly: new Map(),
  };

  for (const backup of backups) {
    const date = parseISO(backup.StartedAt);

    // Hourly bucket (last backup per hour)
    const hourKey = startOfHour(date).toISOString();
    if (!buckets.hourly.has(hourKey) || backup.StartedAt > buckets.hourly.get(hourKey)!.StartedAt) {
      buckets.hourly.set(hourKey, backup);
    }

    // Daily bucket (last backup per day)
    const dayKey = startOfDay(date).toISOString();
    if (!buckets.daily.has(dayKey) || backup.StartedAt > buckets.daily.get(dayKey)!.StartedAt) {
      buckets.daily.set(dayKey, backup);
    }

    // Weekly bucket (last backup per week, starting Sunday)
    const weekKey = startOfWeek(date, { weekStartsOn: 0 }).toISOString();
    if (!buckets.weekly.has(weekKey) || backup.StartedAt > buckets.weekly.get(weekKey)!.StartedAt) {
      buckets.weekly.set(weekKey, backup);
    }

    // Monthly bucket (last backup per month)
    const monthKey = startOfMonth(date).toISOString();
    if (!buckets.monthly.has(monthKey) || backup.StartedAt > buckets.monthly.get(monthKey)!.StartedAt) {
      buckets.monthly.set(monthKey, backup);
    }

    // Yearly bucket (last backup per year)
    const yearKey = startOfYear(date).toISOString();
    if (!buckets.yearly.has(yearKey) || backup.StartedAt > buckets.yearly.get(yearKey)!.StartedAt) {
      buckets.yearly.set(yearKey, backup);
    }
  }

  return buckets;
}

/**
 * Determine which backups to keep based on retention policy
 */
function determineBackupsToKeep(
  backups: BackupExecution[],
  policy: RetentionPolicy
): Set<string> {
  const toKeep = new Set<string>();

  if (backups.length === 0) {
    return toKeep;
  }

  // Sort backups by date descending (newest first)
  const sortedBackups = [...backups].sort((a, b) =>
    new Date(b.StartedAt).getTime() - new Date(a.StartedAt).getTime()
  );

  // Categorize backups into time buckets
  const buckets = categorizeBackups(sortedBackups);

  // Apply retention policy for each bucket
  // Hourly: keep last N hours
  if (policy.KeepHourly > 0) {
    const hourlyBackups = Array.from(buckets.hourly.values())
      .sort((a, b) => new Date(b.StartedAt).getTime() - new Date(a.StartedAt).getTime())
      .slice(0, policy.KeepHourly);
    hourlyBackups.forEach(b => toKeep.add(b.Id));
  }

  // Daily: keep last N days
  if (policy.KeepDaily > 0) {
    const dailyBackups = Array.from(buckets.daily.values())
      .sort((a, b) => new Date(b.StartedAt).getTime() - new Date(a.StartedAt).getTime())
      .slice(0, policy.KeepDaily);
    dailyBackups.forEach(b => toKeep.add(b.Id));
  }

  // Weekly: keep last N weeks
  if (policy.KeepWeekly > 0) {
    const weeklyBackups = Array.from(buckets.weekly.values())
      .sort((a, b) => new Date(b.StartedAt).getTime() - new Date(a.StartedAt).getTime())
      .slice(0, policy.KeepWeekly);
    weeklyBackups.forEach(b => toKeep.add(b.Id));
  }

  // Monthly: keep last N months
  if (policy.KeepMonthly > 0) {
    const monthlyBackups = Array.from(buckets.monthly.values())
      .sort((a, b) => new Date(b.StartedAt).getTime() - new Date(a.StartedAt).getTime())
      .slice(0, policy.KeepMonthly);
    monthlyBackups.forEach(b => toKeep.add(b.Id));
  }

  // Yearly: keep last N years
  if (policy.KeepYearly > 0) {
    const yearlyBackups = Array.from(buckets.yearly.values())
      .sort((a, b) => new Date(b.StartedAt).getTime() - new Date(a.StartedAt).getTime())
      .slice(0, policy.KeepYearly);
    yearlyBackups.forEach(b => toKeep.add(b.Id));
  }

  return toKeep;
}

/**
 * Delete backup from local filesystem
 */
function deleteLocalBackup(backup: BackupExecution): void {
  if (backup.LocalPath && existsSync(backup.LocalPath)) {
    try {
      unlinkSync(backup.LocalPath);
      logger.info('Deleted local backup file', { path: backup.LocalPath });
    } catch (error) {
      logger.error('Failed to delete local backup file', {
        path: backup.LocalPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Delete backup from S3
 */
async function deleteS3Backup(backup: BackupExecution, s3Config: S3Config): Promise<void> {
  if (backup.S3Uploaded && backup.S3Bucket && backup.S3Key) {
    try {
      const result = await deleteFromS3(s3Config, {
        bucket: backup.S3Bucket,
        key: backup.S3Key,
      });

      if (result.success) {
        logger.info('Deleted S3 backup', {
          bucket: backup.S3Bucket,
          key: backup.S3Key,
        });
      } else {
        logger.error('Failed to delete S3 backup', {
          bucket: backup.S3Bucket,
          key: backup.S3Key,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error('Failed to delete S3 backup', {
        bucket: backup.S3Bucket,
        key: backup.S3Key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Delete backup execution record from database
 */
function deleteBackupRecord(backupId: string): void {
  execute('DELETE FROM BackupExecutions WHERE Id = ?', [backupId]);
}

/**
 * Apply retention policy for a database
 */
export async function applyRetentionPolicy(
  databaseConfigId: string,
  retentionPolicyId?: string
): Promise<{ deleted: number; kept: number }> {
  logger.info('Applying retention policy', {
    databaseConfigId,
    retentionPolicyId,
  });

  // Get retention policy
  const policyId = retentionPolicyId || 'default';
  const policy = getRetentionPolicy(policyId);

  if (!policy) {
    logger.warn('Retention policy not found, using default');
    return { deleted: 0, kept: 0 };
  }

  // Get all completed backups for this database
  const backups = query<BackupExecution>(
    `SELECT * FROM BackupExecutions
     WHERE DatabaseConfigId = ?
     AND Status = 'completed'
     ORDER BY StartedAt DESC`,
    [databaseConfigId]
  );

  if (backups.length === 0) {
    logger.info('No backups found for database');
    return { deleted: 0, kept: 0 };
  }

  logger.info(`Found ${backups.length} backups for database`);

  // Determine which backups to keep
  const toKeep = determineBackupsToKeep(backups, policy);

  logger.info(`Retention policy will keep ${toKeep.size} backups`);

  // Get S3 config if needed
  const s3Config = getDefaultS3Config();

  // Delete backups not in retention set
  let deletedCount = 0;
  for (const backup of backups) {
    if (!toKeep.has(backup.Id)) {
      logger.info(`Deleting backup ${backup.Id}`, {
        fileName: backup.FileName,
        startedAt: backup.StartedAt,
      });

      // Delete local file
      deleteLocalBackup(backup);

      // Delete from S3
      if (s3Config) {
        await deleteS3Backup(backup, s3Config);
      }

      // Delete database record
      deleteBackupRecord(backup.Id);

      deletedCount++;
    }
  }

  logger.info('Retention policy applied', {
    deleted: deletedCount,
    kept: toKeep.size,
  });

  return {
    deleted: deletedCount,
    kept: toKeep.size,
  };
}

/**
 * Apply retention policies for all databases
 */
export async function applyAllRetentionPolicies(): Promise<void> {
  logger.info('Applying retention policies for all databases');

  // Get all active schedules with retention policies
  const schedules = query<any>(
    `SELECT DISTINCT DatabaseConfigId, RetentionPolicyId
     FROM BackupSchedules
     WHERE Enabled = 1 AND RetentionPolicyId IS NOT NULL`
  );

  for (const schedule of schedules) {
    try {
      await applyRetentionPolicy(schedule.DatabaseConfigId, schedule.RetentionPolicyId);
    } catch (error) {
      logger.error('Failed to apply retention policy', {
        databaseConfigId: schedule.DatabaseConfigId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('Finished applying retention policies for all databases');
}

/**
 * Preview retention policy (what would be deleted)
 */
export function previewRetentionPolicy(
  databaseConfigId: string,
  retentionPolicyId?: string
): { toKeep: BackupExecution[]; toDelete: BackupExecution[] } {
  // Get retention policy
  const policyId = retentionPolicyId || 'default';
  const policy = getRetentionPolicy(policyId);

  if (!policy) {
    return { toKeep: [], toDelete: [] };
  }

  // Get all completed backups for this database
  const backups = query<BackupExecution>(
    `SELECT * FROM BackupExecutions
     WHERE DatabaseConfigId = ?
     AND Status = 'completed'
     ORDER BY StartedAt DESC`,
    [databaseConfigId]
  );

  // Determine which backups to keep
  const toKeepIds = determineBackupsToKeep(backups, policy);

  const toKeep = backups.filter(b => toKeepIds.has(b.Id));
  const toDelete = backups.filter(b => !toKeepIds.has(b.Id));

  return { toKeep, toDelete };
}
