/**
 * Database schema SQL statements for SQLite
 */

export const SCHEMA_SQL = `
-- DatabaseConfigs table
CREATE TABLE IF NOT EXISTS DatabaseConfigs (
  Id TEXT PRIMARY KEY,
  Name TEXT NOT NULL UNIQUE,
  Type TEXT NOT NULL CHECK(Type IN ('postgresql', 'mysql')),
  Host TEXT NOT NULL,
  Port INTEGER NOT NULL,
  DatabaseName TEXT NOT NULL,
  Username TEXT NOT NULL,
  PasswordEncrypted TEXT NOT NULL,
  DockerContainerName TEXT,
  Enabled BOOLEAN DEFAULT 1,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_DatabaseConfigs_Enabled ON DatabaseConfigs(Enabled);

-- BackupSchedules table
CREATE TABLE IF NOT EXISTS BackupSchedules (
  Id TEXT PRIMARY KEY,
  DatabaseConfigId TEXT NOT NULL,
  ScheduleType TEXT NOT NULL CHECK(ScheduleType IN ('hourly', 'daily', 'weekly', 'monthly', 'custom')),
  CronExpression TEXT NOT NULL,
  Enabled BOOLEAN DEFAULT 1,
  S3UploadEnabled BOOLEAN DEFAULT 1,
  RetentionPolicyId TEXT,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (DatabaseConfigId) REFERENCES DatabaseConfigs(Id) ON DELETE CASCADE,
  FOREIGN KEY (RetentionPolicyId) REFERENCES RetentionPolicies(Id)
);

CREATE INDEX IF NOT EXISTS idx_BackupSchedules_Database ON BackupSchedules(DatabaseConfigId);
CREATE INDEX IF NOT EXISTS idx_BackupSchedules_Enabled ON BackupSchedules(Enabled);

-- RetentionPolicies table
CREATE TABLE IF NOT EXISTS RetentionPolicies (
  Id TEXT PRIMARY KEY,
  Name TEXT NOT NULL,
  Description TEXT,
  KeepHourly INTEGER DEFAULT 24,
  KeepDaily INTEGER DEFAULT 7,
  KeepWeekly INTEGER DEFAULT 4,
  KeepMonthly INTEGER DEFAULT 12,
  KeepYearly INTEGER DEFAULT 0,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- BackupExecutions table
CREATE TABLE IF NOT EXISTS BackupExecutions (
  Id TEXT PRIMARY KEY,
  DatabaseConfigId TEXT NOT NULL,
  BackupScheduleId TEXT,
  BackupType TEXT NOT NULL CHECK(BackupType IN ('hourly', 'daily', 'weekly', 'monthly', 'manual')),
  Status TEXT NOT NULL CHECK(Status IN ('running', 'completed', 'failed', 'cancelled')),

  FileName TEXT,
  FileSizeBytes INTEGER,
  LocalPath TEXT,

  S3Uploaded BOOLEAN DEFAULT 0,
  S3Bucket TEXT,
  S3Key TEXT,
  S3UploadedAt DATETIME,

  StartedAt DATETIME NOT NULL,
  CompletedAt DATETIME,
  DurationSeconds INTEGER,

  ErrorMessage TEXT,
  ErrorStack TEXT,

  DatabaseSizeBytes INTEGER,
  CompressionUsed TEXT,
  Checksum TEXT,

  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (DatabaseConfigId) REFERENCES DatabaseConfigs(Id) ON DELETE CASCADE,
  FOREIGN KEY (BackupScheduleId) REFERENCES BackupSchedules(Id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_BackupExecutions_Database ON BackupExecutions(DatabaseConfigId);
CREATE INDEX IF NOT EXISTS idx_BackupExecutions_Status ON BackupExecutions(Status);
CREATE INDEX IF NOT EXISTS idx_BackupExecutions_Type ON BackupExecutions(BackupType);
CREATE INDEX IF NOT EXISTS idx_BackupExecutions_Started ON BackupExecutions(StartedAt DESC);
CREATE INDEX IF NOT EXISTS idx_BackupExecutions_S3 ON BackupExecutions(S3Bucket, S3Key) WHERE S3Uploaded = 1;

-- RestoreExecutions table
CREATE TABLE IF NOT EXISTS RestoreExecutions (
  Id TEXT PRIMARY KEY,
  DatabaseConfigId TEXT NOT NULL,
  BackupExecutionId TEXT,

  Status TEXT NOT NULL CHECK(Status IN ('running', 'completed', 'failed', 'cancelled')),

  SourceType TEXT NOT NULL CHECK(SourceType IN ('local', 's3', 'upload')),
  SourcePath TEXT,
  S3Bucket TEXT,
  S3Key TEXT,

  RestoreOptions TEXT,

  StartedAt DATETIME NOT NULL,
  CompletedAt DATETIME,
  DurationSeconds INTEGER,

  ErrorMessage TEXT,
  ErrorStack TEXT,

  InitiatedBy TEXT,

  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (DatabaseConfigId) REFERENCES DatabaseConfigs(Id) ON DELETE CASCADE,
  FOREIGN KEY (BackupExecutionId) REFERENCES BackupExecutions(Id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_RestoreExecutions_Database ON RestoreExecutions(DatabaseConfigId);
CREATE INDEX IF NOT EXISTS idx_RestoreExecutions_Started ON RestoreExecutions(StartedAt DESC);

-- ExecutionLogs table
CREATE TABLE IF NOT EXISTS ExecutionLogs (
  Id TEXT PRIMARY KEY,
  ExecutionId TEXT NOT NULL,
  ExecutionType TEXT NOT NULL CHECK(ExecutionType IN ('backup', 'restore')),
  LogLevel TEXT NOT NULL CHECK(LogLevel IN ('debug', 'info', 'warn', 'error')),
  Message TEXT NOT NULL,
  Metadata TEXT,
  Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ExecutionLogs_Execution ON ExecutionLogs(ExecutionId, Timestamp);
CREATE INDEX IF NOT EXISTS idx_ExecutionLogs_Level ON ExecutionLogs(LogLevel);

-- S3Configs table
CREATE TABLE IF NOT EXISTS S3Configs (
  Id TEXT PRIMARY KEY,
  Name TEXT NOT NULL,
  Region TEXT NOT NULL,
  Bucket TEXT NOT NULL,
  AccessKeyIdEncrypted TEXT NOT NULL,
  SecretAccessKeyEncrypted TEXT NOT NULL,
  Endpoint TEXT,
  PathPrefix TEXT DEFAULT '',
  Enabled BOOLEAN DEFAULT 1,
  IsDefault BOOLEAN DEFAULT 0,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_S3Configs_Enabled ON S3Configs(Enabled);
CREATE INDEX IF NOT EXISTS idx_S3Configs_Default ON S3Configs(IsDefault) WHERE IsDefault = 1;

-- SystemSettings table
CREATE TABLE IF NOT EXISTS SystemSettings (
  Key TEXT PRIMARY KEY,
  Value TEXT NOT NULL,
  ValueType TEXT NOT NULL CHECK(ValueType IN ('string', 'number', 'boolean', 'json')),
  Description TEXT,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

/**
 * Default retention policy
 */
export const DEFAULT_RETENTION_POLICY_SQL = `
INSERT OR IGNORE INTO RetentionPolicies (Id, Name, Description, KeepHourly, KeepDaily, KeepWeekly, KeepMonthly, KeepYearly)
VALUES (
  'default',
  'Default Policy',
  'Standard retention: 24 hourly, 7 daily, 4 weekly, 12 monthly backups',
  24,
  7,
  4,
  12,
  0
);
`;
