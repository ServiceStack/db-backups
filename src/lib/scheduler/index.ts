import cron, { ScheduledTask } from 'node-cron';
import { query } from '../db';
import { executeBackup } from '../backup';
import { applyRetentionPolicy } from '../retention';
import { logger } from '../logger';
import type { BackupSchedule, DatabaseConfig } from '@/types';

// Store active cron jobs
const activeJobs = new Map<string, ScheduledTask>();

/**
 * Get all enabled backup schedules
 */
function getEnabledSchedules(): BackupSchedule[] {
  return query<BackupSchedule>(
    'SELECT * FROM BackupSchedules WHERE Enabled = 1'
  );
}

/**
 * Get database configuration
 */
function getDatabaseConfig(id: string): DatabaseConfig | null {
  const result = query<DatabaseConfig>(
    'SELECT * FROM DatabaseConfigs WHERE Id = ?',
    [id]
  );
  return result[0] || null;
}

/**
 * Execute scheduled backup
 */
async function executeScheduledBackup(schedule: BackupSchedule): Promise<void> {
  logger.info('Executing scheduled backup', {
    scheduleId: schedule.Id,
    databaseConfigId: schedule.DatabaseConfigId,
    scheduleType: schedule.ScheduleType,
  });

  try {
    const database = getDatabaseConfig(schedule.DatabaseConfigId);
    if (!database) {
      logger.error('Database configuration not found', {
        databaseConfigId: schedule.DatabaseConfigId,
      });
      return;
    }

    if (!database.Enabled) {
      logger.warn('Database is disabled, skipping backup', {
        databaseConfigId: schedule.DatabaseConfigId,
      });
      return;
    }

    // Execute backup
    const result = await executeBackup({
      DatabaseConfigId: schedule.DatabaseConfigId,
      BackupScheduleId: schedule.Id,
      BackupType: schedule.ScheduleType === 'custom' ? 'manual' : schedule.ScheduleType,
      S3UploadEnabled: schedule.S3UploadEnabled,
    });

    if (result.success) {
      logger.info('Scheduled backup completed successfully', {
        executionId: result.executionId,
        fileName: result.fileName,
        fileSize: result.fileSizeBytes,
        duration: result.durationSeconds,
      });

      // Apply retention policy if configured
      if (schedule.RetentionPolicyId) {
        logger.info('Applying retention policy', {
          retentionPolicyId: schedule.RetentionPolicyId,
        });

        await applyRetentionPolicy(
          schedule.DatabaseConfigId,
          schedule.RetentionPolicyId
        );
      }
    } else {
      logger.error('Scheduled backup failed', {
        executionId: result.executionId,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Scheduled backup execution error', {
      scheduleId: schedule.Id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Schedule a backup job
 */
export function scheduleBackupJob(schedule: BackupSchedule): void {
  // Validate cron expression
  if (!cron.validate(schedule.CronExpression)) {
    logger.error('Invalid cron expression', {
      scheduleId: schedule.Id,
      cronExpression: schedule.CronExpression,
    });
    return;
  }

  // Stop existing job if present
  if (activeJobs.has(schedule.Id)) {
    const existingJob = activeJobs.get(schedule.Id);
    existingJob?.stop();
    activeJobs.delete(schedule.Id);
  }

  // Create new cron job
  const job = cron.schedule(schedule.CronExpression, () => {
    executeScheduledBackup(schedule);
  }, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC',
  });

  activeJobs.set(schedule.Id, job);

  logger.info('Backup job scheduled', {
    scheduleId: schedule.Id,
    databaseConfigId: schedule.DatabaseConfigId,
    cronExpression: schedule.CronExpression,
    scheduleType: schedule.ScheduleType,
  });
}

/**
 * Unschedule a backup job
 */
export function unscheduleBackupJob(scheduleId: string): void {
  const job = activeJobs.get(scheduleId);
  if (job) {
    job.stop();
    activeJobs.delete(scheduleId);
    logger.info('Backup job unscheduled', { scheduleId });
  }
}

/**
 * Reload schedule (update existing or create new)
 */
export function reloadSchedule(scheduleId: string): void {
  const schedules = query<BackupSchedule>(
    'SELECT * FROM BackupSchedules WHERE Id = ? AND Enabled = 1',
    [scheduleId]
  );

  const schedule = schedules[0];
  if (schedule) {
    scheduleBackupJob(schedule);
  } else {
    unscheduleBackupJob(scheduleId);
  }
}

/**
 * Initialize scheduler with all enabled schedules
 */
export function initializeScheduler(): void {
  logger.info('Initializing backup scheduler');

  // Clear any existing jobs
  activeJobs.forEach((job, id) => {
    job.stop();
    logger.info('Stopped existing job', { scheduleId: id });
  });
  activeJobs.clear();

  // Load all enabled schedules
  const schedules = getEnabledSchedules();

  logger.info(`Found ${schedules.length} enabled schedules`);

  // Schedule each job
  for (const schedule of schedules) {
    try {
      scheduleBackupJob(schedule);
    } catch (error) {
      logger.error('Failed to schedule backup job', {
        scheduleId: schedule.Id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('Backup scheduler initialized', {
    activeJobs: activeJobs.size,
  });
}

/**
 * Shutdown scheduler (stop all jobs)
 */
export function shutdownScheduler(): void {
  logger.info('Shutting down backup scheduler');

  activeJobs.forEach((job, id) => {
    job.stop();
    logger.info('Stopped job', { scheduleId: id });
  });

  activeJobs.clear();
  logger.info('Backup scheduler shutdown complete');
}

/**
 * Get active scheduled jobs
 */
export function getActiveJobs(): Array<{
  scheduleId: string;
  isRunning: boolean;
}> {
  return Array.from(activeJobs.entries()).map(([scheduleId, job]) => ({
    scheduleId,
    isRunning: job ? true : false,
  }));
}

/**
 * Validate cron expression
 */
export function validateCronExpression(expression: string): boolean {
  return cron.validate(expression);
}

/**
 * Get next N execution times for a cron expression
 */
export function getNextExecutionTimes(
  cronExpression: string,
  count: number = 10
): string[] {
  if (!cron.validate(cronExpression)) {
    return [];
  }

  const nextRuns: string[] = [];
  const now = new Date();

  // Simple implementation - for production, consider using a library like cron-parser
  // This is a placeholder that returns formatted timestamps
  try {
    // Note: node-cron doesn't provide a way to get next execution times
    // For a production app, consider using 'cron-parser' library
    // For now, return a note
    return ['Use cron-parser library for accurate next run times'];
  } catch (error) {
    logger.error('Failed to calculate next execution times', { error });
    return [];
  }
}

/**
 * Predefined cron expressions
 */
export const CRON_PRESETS = {
  hourly: '0 * * * *',        // Top of every hour
  daily: '0 2 * * *',          // 2 AM every day
  weekly: '0 3 * * 0',         // 3 AM every Sunday
  monthly: '0 4 1 * *',        // 4 AM on the 1st of every month
};
