/**
 * TypeScript types and interfaces for the DB Backup application
 */

// ============================================================================
// Database Types
// ============================================================================

export type DatabaseType = 'postgresql' | 'mysql';
export type BackupType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';
export type ScheduleType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type SourceType = 'local' | 's3' | 'upload';
export type ExecutionType = 'backup' | 'restore';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ValueType = 'string' | 'number' | 'boolean' | 'json';

// ============================================================================
// Database Configuration
// ============================================================================

export interface DatabaseConfig {
  Id: string;
  Name: string;
  Type: DatabaseType;
  Host: string;
  Port: number;
  DatabaseName: string;
  Username: string;
  PasswordEncrypted: string;
  DockerContainerName: string | null;
  Enabled: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface DatabaseConfigInput {
  Name: string;
  Type: DatabaseType;
  Host: string;
  Port: number;
  DatabaseName: string;
  Username: string;
  Password: string; // Plain text password (will be encrypted)
  DockerContainerName?: string;
  Enabled?: boolean;
}

export interface DatabaseConfigUpdate {
  Name?: string;
  Host?: string;
  Port?: number;
  DatabaseName?: string;
  Username?: string;
  Password?: string; // Plain text password (will be encrypted)
  DockerContainerName?: string;
  Enabled?: boolean;
}

// ============================================================================
// Backup Schedule
// ============================================================================

export interface BackupSchedule {
  Id: string;
  DatabaseConfigId: string;
  ScheduleType: ScheduleType;
  CronExpression: string;
  Enabled: boolean;
  S3UploadEnabled: boolean;
  RetentionPolicyId: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface BackupScheduleInput {
  DatabaseConfigId: string;
  ScheduleType: ScheduleType;
  CronExpression: string;
  Enabled?: boolean;
  S3UploadEnabled?: boolean;
  RetentionPolicyId?: string;
}

export interface BackupScheduleUpdate {
  ScheduleType?: ScheduleType;
  CronExpression?: string;
  Enabled?: boolean;
  S3UploadEnabled?: boolean;
  RetentionPolicyId?: string;
}

// ============================================================================
// Retention Policy
// ============================================================================

export interface RetentionPolicy {
  Id: string;
  Name: string;
  Description: string | null;
  KeepHourly: number;
  KeepDaily: number;
  KeepWeekly: number;
  KeepMonthly: number;
  KeepYearly: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface RetentionPolicyInput {
  Name: string;
  Description?: string;
  KeepHourly?: number;
  KeepDaily?: number;
  KeepWeekly?: number;
  KeepMonthly?: number;
  KeepYearly?: number;
}

export interface RetentionPolicyUpdate {
  Name?: string;
  Description?: string;
  KeepHourly?: number;
  KeepDaily?: number;
  KeepWeekly?: number;
  KeepMonthly?: number;
  KeepYearly?: number;
}

// ============================================================================
// Backup Execution
// ============================================================================

export interface BackupExecution {
  Id: string;
  DatabaseConfigId: string;
  BackupScheduleId: string | null;
  BackupType: BackupType;
  Status: ExecutionStatus;
  FileName: string | null;
  FileSizeBytes: number | null;
  LocalPath: string | null;
  S3Uploaded: boolean;
  S3Bucket: string | null;
  S3Key: string | null;
  S3UploadedAt: string | null;
  StartedAt: string;
  CompletedAt: string | null;
  DurationSeconds: number | null;
  ErrorMessage: string | null;
  ErrorStack: string | null;
  DatabaseSizeBytes: number | null;
  CompressionUsed: string | null;
  Checksum: string | null;
  CreatedAt: string;
}

export interface BackupExecutionInput {
  DatabaseConfigId: string;
  BackupScheduleId?: string;
  BackupType: BackupType;
  S3UploadEnabled?: boolean;
}

// ============================================================================
// Restore Execution
// ============================================================================

export interface RestoreExecution {
  Id: string;
  DatabaseConfigId: string;
  BackupExecutionId: string | null;
  Status: ExecutionStatus;
  SourceType: SourceType;
  SourcePath: string | null;
  S3Bucket: string | null;
  S3Key: string | null;
  RestoreOptions: string | null; // JSON string
  StartedAt: string;
  CompletedAt: string | null;
  DurationSeconds: number | null;
  ErrorMessage: string | null;
  ErrorStack: string | null;
  InitiatedBy: string | null;
  CreatedAt: string;
}

export interface RestoreOptions {
  dropAndRecreate?: boolean;
  cleanBeforeRestore?: boolean;
  schemaOnly?: boolean;
  dataOnly?: boolean;
  createSafetyBackup?: boolean;
}

export interface RestoreExecutionInput {
  DatabaseConfigId: string;
  BackupExecutionId?: string;
  SourceType: SourceType;
  SourcePath?: string;
  S3Bucket?: string;
  S3Key?: string;
  RestoreOptions?: RestoreOptions;
  InitiatedBy?: string;
}

// ============================================================================
// Execution Log
// ============================================================================

export interface ExecutionLog {
  Id: string;
  ExecutionId: string;
  ExecutionType: ExecutionType;
  LogLevel: LogLevel;
  Message: string;
  Metadata: string | null; // JSON string
  Timestamp: string;
}

export interface ExecutionLogInput {
  ExecutionId: string;
  ExecutionType: ExecutionType;
  LogLevel: LogLevel;
  Message: string;
  Metadata?: Record<string, any>;
}

// ============================================================================
// S3 Configuration
// ============================================================================

export interface S3Config {
  Id: string;
  Name: string;
  Region: string;
  Bucket: string;
  AccessKeyIdEncrypted: string;
  SecretAccessKeyEncrypted: string;
  Endpoint: string | null;
  PathPrefix: string;
  Enabled: boolean;
  IsDefault: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface S3ConfigInput {
  Name: string;
  Region: string;
  Bucket: string;
  AccessKeyId: string; // Plain text (will be encrypted)
  SecretAccessKey: string; // Plain text (will be encrypted)
  Endpoint?: string;
  PathPrefix?: string;
  Enabled?: boolean;
  IsDefault?: boolean;
}

export interface S3ConfigUpdate {
  Name?: string;
  Region?: string;
  Bucket?: string;
  AccessKeyId?: string; // Plain text (will be encrypted)
  SecretAccessKey?: string; // Plain text (will be encrypted)
  Endpoint?: string;
  PathPrefix?: string;
  Enabled?: boolean;
  IsDefault?: boolean;
}

// ============================================================================
// System Settings
// ============================================================================

export interface SystemSetting {
  Key: string;
  Value: string;
  ValueType: ValueType;
  Description: string | null;
  UpdatedAt: string;
}

export interface SystemSettingInput {
  Key: string;
  Value: string;
  ValueType: ValueType;
  Description?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface BackupFilters extends PaginationParams {
  databaseId?: string;
  status?: ExecutionStatus;
  type?: BackupType;
  startDate?: string;
  endDate?: string;
}

export interface RestoreFilters extends PaginationParams {
  databaseId?: string;
  status?: ExecutionStatus;
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface SystemStats {
  totalBackups: number;
  totalDatabases: number;
  totalSize: number;
  last24hBackups: number;
  failedBackups: number;
  successRate: number;
}

export interface DatabaseStats {
  databaseId: string;
  databaseName: string;
  totalBackups: number;
  lastBackup: string | null;
  totalSize: number;
  successRate: number;
}

// ============================================================================
// Backup/Restore Result Types
// ============================================================================

export interface BackupResult {
  executionId: string;
  success: boolean;
  fileName?: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  s3Uploaded?: boolean;
  error?: string;
}

export interface RestoreResult {
  executionId: string;
  success: boolean;
  durationSeconds?: number;
  error?: string;
}

// ============================================================================
// Scheduler Types
// ============================================================================

export interface ScheduledJob {
  scheduleId: string;
  databaseConfigId: string;
  cronExpression: string;
  nextRun: Date;
}

export interface CronPreview {
  nextRuns: string[];
}

// ============================================================================
// Connection Test Types
// ============================================================================

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  version?: string;
  error?: string;
}

// ============================================================================
// Discovered Database Types
// ============================================================================

export interface DiscoveredDatabase {
  containerName: string;
  type: DatabaseType;
  host: string;
  port: number;
  databaseName?: string;
  username?: string;
}
