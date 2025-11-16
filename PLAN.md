# Database Backup & Restore Web Application - Technical Specification

**Version:** 1.1
**Date:** 2025-11-16
**Status:** Draft

**Changelog:**
- v1.1 (2025-11-16): Updated to use Bun runtime and bun:sqlite instead of Node.js and better-sqlite3
- v1.0 (2025-11-16): Initial technical specification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Data Model](#data-model)
5. [Core Features](#core-features)
6. [API Design](#api-design)
7. [Web UI Design](#web-ui-design)
8. [Docker Architecture](#docker-architecture)
9. [Security](#security)
10. [Performance & Scalability](#performance--scalability)
11. [Monitoring & Logging](#monitoring--logging)
12. [Deployment](#deployment)
13. [Testing Strategy](#testing-strategy)
14. [Future Enhancements](#future-enhancements)

---

## 1. Executive Summary

### 1.1 Purpose
A containerized web application built with Bun runtime that provides automated backup and restore capabilities for PostgreSQL and MySQL databases, designed to run as a companion container in existing Docker Compose environments.

### 1.2 Goals
- Zero-config integration with existing Docker Compose stacks
- Automated, scheduled backups with intelligent retention
- Web-based management interface
- S3 integration for offsite backup storage
- Complete audit trail and logging

### 1.3 Target Users
- DevOps engineers managing containerized applications
- Development teams needing database backup solutions
- Small to medium-sized teams running Docker-based infrastructure

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                    Docker Compose Stack                │
│                                                        │
│  ┌──────────────┐         ┌─────────────────────────┐  │
│  │ PostgreSQL   │         │  DB Backup Web App      │  │
│  │ Container    │◄────────┤                         │  │
│  └──────────────┘         │  ┌──────────────────┐   │  │
│                           │  │   Next.js App    │   │  │
│  ┌──────────────┐         │  │  (React 19+)     │   │  │
│  │    MySQL     │◄────────┤  │  Tailwind v4+    │   │  │
│  │  Container   │         │  └──────────────────┘   │  │
│  └──────────────┘         │                         │  │
│                           │  ┌──────────────────┐   │  │
│                           │  │  Backup Engine   │   │  │
│                           │  │  - Scheduler     │   │  │
│                           │  │  - Executor      │   │  │
│                           │  │  - Retention Mgr │   │  │
│                           │  └──────────────────┘   │  │
│                           │                         │  │
│                           │  ┌──────────────────┐   │  │
│                           │  │ SQLite Database  │   │  │
│                           │  │ (Logs & Config)  │   │  │
│                           │  └──────────────────┘   │  │
│                           └─────────────────────────┘  │
│                                      │                 │
└──────────────────────────────────────┼─────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   Amazon S3     │
                              │ (Backup Storage)│
                              └─────────────────┘
```

### 2.2 Component Breakdown

#### 2.2.1 Frontend Layer
- **Next.js Application**: Server-side rendered React application
- **UI Components**: Tailwind CSS-based component library
- **Client State**: React hooks for local state management
- **API Client**: Fetch-based HTTP client for backend communication

#### 2.2.2 Backend Layer
- **Next.js API Routes**: RESTful API endpoints
- **Backup Engine**: Core backup/restore logic
- **Scheduler**: Cron-based job scheduling system
- **S3 Client**: AWS SDK integration for object storage
- **Database Clients**: PostgreSQL (pg_dump) and MySQL (mysqldump) CLI wrappers

#### 2.2.3 Data Layer
- **SQLite Database**: Persistent storage for:
  - Backup configurations
  - Backup history and metadata
  - Job execution logs
  - System settings
- **Database Driver**: Bun's native `bun:sqlite` module for high-performance database access

#### 2.2.4 Storage Layer
- **Local Storage**: Temporary backup files before S3 upload
- **S3 Storage**: Long-term backup retention

---

## 3. Technology Stack

### 3.1 Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16+ | React framework with SSR/SSG |
| React | 19+ | UI library |
| Tailwind CSS | 4+ | Utility-first CSS framework |
| TypeScript | 5.3+ | Type safety |
| React Hook Form | Latest | Form management |
| Zod | Latest | Schema validation |
| date-fns | Latest | Date manipulation |

### 3.2 Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Bun | 1.1+ | JavaScript runtime environment |
| Next.js API Routes | 16+ | Backend API |
| node-cron | Latest | Job scheduling (Bun compatible) |
| AWS SDK v3 | Latest | S3 integration |
| bun:sqlite | Built-in | SQLite driver (Bun's native module) |
| winston | Latest | Application logging |

### 3.3 Database Tools
| Tool | Purpose |
|------|---------|
| pg_dump / pg_restore | PostgreSQL backup/restore |
| mysqldump / mysql | MySQL backup/restore |
| SQLite 3 | Application database |

### 3.4 Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| Alpine Linux | Base image (minimal footprint) |

### 3.5 Bun Runtime Benefits
- **Performance**: Faster startup times and reduced memory footprint compared to Node.js
- **Native SQLite**: Built-in `bun:sqlite` module with superior performance and type safety
- **TypeScript Support**: Native TypeScript execution without transpilation overhead
- **Next.js Compatibility**: Full compatibility with Next.js 16+ for SSR/SSG
- **Package Management**: Fast dependency installation with `bun install`
- **Bundler**: Built-in bundler for optimized production builds

---

## 4. Data Model

### 4.1 SQLite Schema

#### 4.1.1 DatabaseConfig
Stores database connection configurations.

```sql
CREATE TABLE DatabaseConfig (
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

CREATE INDEX idx_DatabaseConfigs_Enabled ON DatabaseConfigs(Enabled);
```

#### 4.1.2 BackupSchedule
Defines backup schedules for databases.

```sql
CREATE TABLE BackupSchedule (
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

CREATE INDEX idx_BackupSchedules_Database ON BackupSchedules(DatabaseConfigId);
CREATE INDEX idx_BackupSchedules_Enabled ON BackupSchedules(Enabled);
```

#### 4.1.3 RetentionPolicy
Defines hierarchical retention rules.

```sql
CREATE TABLE RetentionPolicy (
  Id TEXT PRIMARY KEY,
  Name TEXT NOT NULL,
  Description TEXT,
  -- Retention counts
  KeepHourly INTEGER DEFAULT 24,
  KeepDaily INTEGER DEFAULT 7,
  KeepWeekly INTEGER DEFAULT 4,
  KeepMonthly INTEGER DEFAULT 12,
  KeepYearly INTEGER DEFAULT 0,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.4 BackupExecutions
Records each backup execution.

```sql
CREATE TABLE BackupExecution (
  Id TEXT PRIMARY KEY,
  DatabaseConfigId TEXT NOT NULL,
  BackupScheduleId TEXT,
  BackupType TEXT NOT NULL CHECK(BackupType IN ('hourly', 'daily', 'weekly', 'monthly', 'manual')),
  Status TEXT NOT NULL CHECK(Status IN ('running', 'completed', 'failed', 'cancelled')),

  -- File information
  FileName TEXT,
  FileSizeBytes INTEGER,
  LocalPath TEXT,

  -- S3 information
  S3Uploaded BOOLEAN DEFAULT 0,
  S3Bucket TEXT,
  S3Key TEXT,
  S3UploadAt DATETIME,

  -- Timing
  StartedAt DATETIME NOT NULL,
  CompletedAt DATETIME,
  DurationSeconds INTEGER,

  -- Error tracking
  ErrorMessage TEXT,
  ErrorStack TEXT,

  -- Metadata
  DatabaseSizeBytes INTEGER,
  CompressionUsed TEXT,
  Checksum TEXT,

  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (DatabaseConfigId) REFERENCES DatabaseConfigs(Id) ON DELETE CASCADE,
  FOREIGN KEY (BackupScheduleId) REFERENCES BackupSchedules(Id) ON DELETE SET NULL
);

CREATE INDEX idx_BackupExecutions_Database ON BackupExecutions(DatabaseConfigId);
CREATE INDEX idx_BackupExecutions_Status ON BackupExecutions(Status);
CREATE INDEX idx_BackupExecutions_Type ON BackupExecutions(BackupType);
CREATE INDEX idx_BackupExecutions_Started ON BackupExecutions(StartedAt DESC);
CREATE INDEX idx_BackupExecutions_S3 ON BackupExecutions(S3Bucket, S3Key) WHERE S3Uploaded = 1;
```

#### 4.1.5 RestoreExecutions
Records database restore operations.

```sql
CREATE TABLE RestoreExecution (
  Id TEXT PRIMARY KEY,
  DatabaseConfigId TEXT NOT NULL,
  BackupExecutionId TEXT,

  Status TEXT NOT NULL CHECK(Status IN ('running', 'completed', 'failed', 'cancelled')),

  -- Source information
  SourceType TEXT NOT NULL CHECK(SourceType IN ('local', 's3', 'upload')),
  SourcePath TEXT,
  S3Bucket TEXT,
  S3Key TEXT,

  -- Restore options
  RestoreOptions TEXT, -- JSON

  -- Timing
  StartedAt DATETIME NOT NULL,
  CompletedAt DATETIME,
  DurationSeconds INTEGER,

  -- Error tracking
  ErrorMessage TEXT,
  ErrorStack TEXT,

  -- User tracking
  InitiatedBy TEXT,

  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (DatabaseConfigId) REFERENCES DatabaseConfigs(Id) ON DELETE CASCADE,
  FOREIGN KEY (BackupExecutionId) REFERENCES BackupExecutions(Id) ON DELETE SET NULL
);

CREATE INDEX idx_RestoreExecutionDatabase ON RestoreExecution(DatabaseConfigId);
CREATE INDEX idx_RestoreExecutionStarted ON RestoreExecution(StartedAt DESC);
```

#### 4.1.6 ExecutionLogs
Detailed logs for backup and restore operations.

```sql
CREATE TABLE ExecutionLog (
  Id TEXT PRIMARY KEY,
  ExecutionId TEXT NOT NULL,
  ExecutionType TEXT NOT NULL CHECK(ExecutionType IN ('backup', 'restore')),
  LogLevel TEXT NOT NULL CHECK(LogLevel IN ('debug', 'info', 'warn', 'error')),
  Message TEXT NOT NULL,
  Metadata TEXT, -- JSON
  Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ExecutionLogExecution ON ExecutionLog(ExecutionId, Timestamp);
CREATE INDEX idx_ExecutionLogLevel ON ExecutionLog(LogLevel);
```

#### 4.1.7 S3Configs

S3 connection configurations.

```sql
CREATE TABLE S3Config (
  Id TEXT PRIMARY KEY,
  Name TEXT NOT NULL,
  Region TEXT NOT NULL,
  Bucket TEXT NOT NULL,
  AccessKeyIdEncrypted TEXT NOT NULL,
  SecretAccessKeyEncrypted TEXT NOT NULL,
  Endpoint TEXT, -- For S3-compatible services
  PathPrefix TEXT DEFAULT '',
  Enabled BOOLEAN DEFAULT 1,
  IsDefault BOOLEAN DEFAULT 0,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_S3ConfigEnabled ON S3Config(Enabled);
CREATE INDEX idx_S3ConfigDefault ON S3Config(IsDefault) WHERE IsDefault = 1;
```

#### 4.1.8 SystemSettings

Application-wide settings.

```sql
CREATE TABLE SystemSettings (
  Key TEXT PRIMARY KEY,
  Value TEXT NOT NULL,
  ValueType TEXT NOT NULL CHECK(ValueType IN ('string', 'number', 'boolean', 'json')),
  Description TEXT,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Core Features

### 5.1 Multi-Database Support

#### 5.1.1 Database Discovery
- **Auto-Discovery**: Scan Docker Compose network for PostgreSQL/MySQL containers
- **Manual Configuration**: Allow manual database connection details
- **Connection Testing**: Validate connectivity before saving configuration
- **Container Detection**: Automatically detect and link Docker container names

#### 5.1.2 Database-Specific Implementations

**PostgreSQL:**
- Use `pg_dump` for backups with custom format (`-Fc`)
- Support for `--clean`, `--if-exists`, `--create` flags
- Schema-only and data-only backup options
- Role and ownership preservation
- Use `pg_restore` for restoration with parallel jobs support

**MySQL:**
- Use `mysqldump` with extended insert and lock tables
- Support for `--single-transaction` (InnoDB)
- Include routines, triggers, and events
- Character set handling
- Use `mysql` CLI for restoration with batch mode

### 5.2 Backup Operations

#### 5.2.1 Backup Types
- **Hourly**: Kept for last 24 hours
- **Daily**: Kept for last 7-30 days
- **Weekly**: Kept for last 4-12 weeks
- **Monthly**: Kept for last 12-24 months
- **Manual**: On-demand backups (custom retention)

#### 5.2.2 Backup Process Flow

```
1. Pre-Backup Validation
   ├─ Check database connectivity
   ├─ Verify disk space (local)
   ├─ Verify S3 connectivity (if enabled)
   └─ Check existing running backups

2. Execution
   ├─ Create execution record (status: running)
   ├─ Generate unique filename: {dbname}_{type}_{timestamp}.{ext}
   ├─ Execute dump command with streaming
   ├─ Log stdout/stderr in real-time
   └─ Calculate file size and checksum

3. Post-Backup
   ├─ Update execution record (status: completed/failed)
   ├─ Compress backup (gzip)
   ├─ Upload to S3 (if enabled)
   ├─ Update S3 metadata in database
   └─ Trigger retention cleanup

4. Cleanup
   ├─ Apply retention policy
   ├─ Delete expired local backups
   └─ Delete expired S3 backups
```

#### 5.2.3 Backup File Naming Convention
```
{database_name}_{backup_type}_{timestamp}_{id}.{extension}

Example:
myapp_db_daily_20251116_143022_abc123.sql.gz
myapp_db_hourly_20251116_150000_def456.dump.gz
```

### 5.3 Restore Operations

#### 5.3.1 Restore Sources
- **Local Backup**: Restore from local filesystem
- **S3 Backup**: Download from S3 and restore
- **File Upload**: Upload backup file via web UI
- **Manual Script**: Execute custom SQL/dump file

#### 5.3.2 Restore Process Flow

```
1. Pre-Restore Validation
   ├─ Verify backup file exists/accessible
   ├─ Check database connectivity
   ├─ Validate file format compatibility
   ├─ Optional: Create safety backup
   └─ Require user confirmation

2. Preparation
   ├─ Download from S3 (if applicable)
   ├─ Decompress file
   ├─ Create restore execution record
   └─ Optionally stop database connections

3. Execution
   ├─ Execute restore command
   ├─ Stream and log output
   ├─ Handle errors gracefully
   └─ Monitor progress

4. Post-Restore
   ├─ Update execution record
   ├─ Verify database integrity
   ├─ Cleanup temporary files
   └─ Notify user of completion
```

#### 5.3.3 Restore Options
- **Drop and recreate**: Full database replacement
- **Clean before restore**: Remove existing objects
- **Schema only**: Restore structure without data
- **Data only**: Restore data without structure
- **Specific tables**: Selective restoration (advanced)

### 5.4 Automated Scheduling

#### 5.4.1 Scheduler Architecture
- **Engine**: `node-cron` for job scheduling
- **Persistence**: Schedule definitions in SQLite
- **Initialization**: Load all enabled schedules on app startup
- **Dynamic Updates**: Hot-reload when schedules change via UI

#### 5.4.2 Cron Expressions

**Predefined Schedules:**
- **Hourly**: `0 * * * *` (top of every hour)
- **Daily**: `0 2 * * *` (2 AM every day)
- **Weekly**: `0 3 * * 0` (3 AM every Sunday)
- **Monthly**: `0 4 1 * *` (4 AM first day of month)
- **Custom**: User-defined cron expression

#### 5.4.3 Scheduler Features
- **Concurrent Execution Control**: Prevent overlapping backups
- **Failure Retry**: Configurable retry with exponential backoff
- **Notifications**: Email/webhook on success/failure
- **Schedule Preview**: Show next 10 execution times
- **Timezone Support**: User-configurable timezone

### 5.5 Intelligent Retention

#### 5.5.1 Retention Strategy
Hierarchical retention based on backup age and type:

```
Retention Tiers:
├─ Hourly: Keep last N hours (default: 24)
├─ Daily: Keep last N days (default: 7)
├─ Weekly: Keep last N weeks (default: 4)
├─ Monthly: Keep last N months (default: 12)
└─ Yearly: Keep last N years (default: 0)
```

#### 5.5.2 Retention Algorithm

```
For each database:
  1. Get all backups ordered by timestamp DESC
  2. Categorize backups into time buckets:
     - Hourly: Last 24 hours → Keep last backup per hour
     - Daily: Last 7 days → Keep last backup per day
     - Weekly: Last 4 weeks → Keep last backup per week (Sunday)
     - Monthly: Last 12 months → Keep last backup per month
     - Yearly: Keep last backup per year
  3. Mark backups not in retention set for deletion
  4. Delete from local storage
  5. Delete from S3
  6. Remove from database
```

#### 5.5.3 Retention Policy Modes
- **Standard**: Fixed retention counts
- **Size-Based**: Keep backups until total size exceeds limit
- **Age-Based**: Delete backups older than N days
- **Hybrid**: Combine count, size, and age limits

### 5.6 S3 Integration

#### 5.6.1 S3 Features
- **Multi-Region Support**: Configure different S3 regions
- **S3-Compatible Services**: Support for MinIO, DigitalOcean Spaces, etc.
- **Path Prefixes**: Organize backups with custom folder structure
- **Server-Side Encryption**: SSE-S3 or SSE-KMS
- **Storage Classes**: Standard, Infrequent Access, Glacier
- **Versioning**: Leverage S3 versioning for additional safety

#### 5.6.2 Upload Process
- **Streaming Upload**: Use multipart upload for large files
- **Progress Tracking**: Real-time upload progress
- **Retry Logic**: Automatic retry on network failures
- **Checksum Validation**: Verify upload integrity
- **Metadata Tagging**: Add custom tags (database, type, timestamp)

#### 5.6.3 Download/Restore from S3
- **Streaming Download**: Download directly to restore process
- **Temporary Caching**: Optional local cache before restore
- **Integrity Check**: Verify checksum before restoration
- **Bandwidth Control**: Optional rate limiting

#### 5.6.4 S3 Object Naming
```
{path_prefix}/{database_name}/{year}/{month}/{filename}

Example:
backups/myapp_db/2025/11/myapp_db_daily_20251116_143022.sql.gz
```

---

## 6. API Design

### 6.1 RESTful API Endpoints

#### 6.1.1 Database Configurations

**GET /api/databases**
- List all database configurations
- Query params: `?type=postgresql|mysql`, `?enabled=true|false`
- Response: Array of database configs

**POST /api/databases**
- Create new database configuration
- Body: Database connection details
- Validates connection before saving

**GET /api/databases/:id**
- Get specific database configuration
- Response: Database config details

**PUT /api/databases/:id**
- Update database configuration
- Body: Updated fields

**DELETE /api/databases/:id**
- Delete database configuration
- Cascades to schedules and backups

**POST /api/databases/:id/test-connection**
- Test database connectivity
- Response: Connection status and version info

**POST /api/databases/discover**
- Auto-discover databases in Docker network
- Response: List of detected databases

#### 6.1.2 Backup Schedules

**GET /api/schedules**
- List all backup schedules
- Query params: `?databaseId=xxx`, `?enabled=true`

**POST /api/schedules**
- Create new backup schedule
- Body: Schedule configuration with cron expression

**GET /api/schedules/:id**
- Get specific schedule

**PUT /api/schedules/:id**
- Update schedule

**DELETE /api/schedules/:id**
- Delete schedule

**POST /api/schedules/:id/enable**
- Enable schedule

**POST /api/schedules/:id/disable**
- Disable schedule

**GET /api/schedules/:id/next-runs**
- Get next N scheduled execution times
- Query param: `?count=10`

#### 6.1.3 Backups

**GET /api/backups**
- List all backup executions
- Query params:
  - `?databaseId=xxx`
  - `?status=completed|failed|running`
  - `?type=hourly|daily|weekly|monthly|manual`
  - `?startDate=ISO8601&endDate=ISO8601`
  - `?page=1&limit=50`

**POST /api/backups**
- Execute manual backup
- Body: `{ databaseId, uploadToS3, retentionPolicyId }`

**GET /api/backups/:id**
- Get specific backup execution details
- Response: Execution record with logs

**DELETE /api/backups/:id**
- Delete backup (local and S3)
- Soft delete with audit trail

**GET /api/backups/:id/download**
- Download backup file
- Streams file from local or S3

**GET /api/backups/:id/logs**
- Get execution logs for backup
- Query param: `?level=error|warn|info|debug`

**POST /api/backups/:id/upload-to-s3**
- Upload local backup to S3 (if not already uploaded)

#### 6.1.4 Restores

**GET /api/restores**
- List all restore executions
- Query params: `?databaseId=xxx`, `?status=xxx`

**POST /api/restores**
- Execute restore operation
- Body: `{ databaseId, backupId, options }`

**GET /api/restores/:id**
- Get specific restore execution details

**GET /api/restores/:id/logs**
- Get execution logs for restore

**POST /api/restores/upload**
- Upload backup file for restoration
- Multipart form data

#### 6.1.5 Retention Policies

**GET /api/retention-policies**
- List all retention policies

**POST /api/retention-policies**
- Create new retention policy

**GET /api/retention-policies/:id**
- Get specific policy

**PUT /api/retention-policies/:id**
- Update policy

**DELETE /api/retention-policies/:id**
- Delete policy (if not in use)

**POST /api/retention-policies/:id/preview**
- Preview which backups would be kept/deleted
- Body: `{ databaseId }`

#### 6.1.6 S3 Configurations

**GET /api/s3-configs**
- List S3 configurations

**POST /api/s3-configs**
- Create S3 configuration

**GET /api/s3-configs/:id**
- Get specific S3 config

**PUT /api/s3-configs/:id**
- Update S3 config

**DELETE /api/s3-configs/:id**
- Delete S3 config

**POST /api/s3-configs/:id/test**
- Test S3 connectivity and permissions

**GET /api/s3-configs/:id/buckets**
- List available buckets

#### 6.1.7 System

**GET /api/system/status**
- Get system status
- Response: Health, version, uptime, disk space

**GET /api/system/settings**
- Get system settings

**PUT /api/system/settings**
- Update system settings

**GET /api/system/stats**
- Get statistics
- Response: Total backups, total size, database counts

**POST /api/system/maintenance**
- Trigger maintenance tasks
- Body: `{ task: 'cleanup' | 'vacuum' | 'verify' }`

### 6.2 Request/Response Formats

#### 6.2.1 Standard Response Envelope
```typescript
{
  success: boolean;
  data?: any;
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
```

#### 6.2.2 Error Codes
- `VALIDATION_ERROR`: Invalid request data
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `CONFLICT`: Resource conflict (e.g., duplicate name)
- `DATABASE_ERROR`: Database operation failed
- `S3_ERROR`: S3 operation failed
- `BACKUP_ERROR`: Backup operation failed
- `RESTORE_ERROR`: Restore operation failed

---

## 7. Web UI Design

### 7.1 Application Structure

#### 7.1.1 Page Routes
```
/                         - Dashboard
/databases               - Database configurations
/databases/new           - Add new database
/databases/:id           - Database details
/databases/:id/edit      - Edit database
/schedules               - Backup schedules
/schedules/new           - Create schedule
/schedules/:id/edit      - Edit schedule
/backups                 - Backup history
/backups/:id             - Backup details
/restores                - Restore history
/restores/:id            - Restore details
/restore/new             - New restore wizard
/retention-policies      - Retention policies
/retention-policies/new  - Create policy
/s3-configs              - S3 configurations
/s3-configs/new          - Add S3 config
/settings                - System settings
/logs                    - System logs
```

### 7.2 Key UI Components

#### 7.2.1 Dashboard (`/`)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ DB Backup & Restore                    [Settings]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Total    │  │ Last 24h │  │ Failed   │           │
│  │ Backups  │  │ Backups  │  │ Backups  │           │
│  │  1,234   │  │    24    │  │    0     │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                     │
│  Recent Backups                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Database    Type    Status    Size    Time    │  │
│  │ myapp_db    Daily   ✓         1.2GB   2m 15s  │  │
│  │ users_db    Hourly  ✓         234MB   45s     │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Upcoming Schedules                                 │
│  ┌───────────────────────────────────────────────┐  │
│  │ Database    Type      Next Run                │  │
│  │ myapp_db    Daily     in 4 hours              │  │
│  │ users_db    Hourly    in 23 minutes           │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Quick Actions                                      │
│  [+ Add Database] [+ Create Schedule] [⟳ Restore]   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Real-time statistics cards
- Recent backup activity table
- Upcoming schedule timeline
- Quick action buttons
- System health indicator

#### 7.2.2 Database Configurations (`/databases`)

**Features:**
- List of all configured databases
- Connection status indicators (online/offline)
- Quick actions: Test connection, Backup now, View backups
- Filter by type (PostgreSQL/MySQL)
- Search by name
- Add new database button

**Database Card:**
```
┌────────────────────────────────────────┐
│ 🟢 myapp_db              [PostgreSQL]  │
│ Container: postgres_main               │
│ Last Backup: 2 hours ago               │
│ Next Backup: in 22 hours               │
│                                        │
│ [Test] [Backup Now] [View] [Edit]      │
└────────────────────────────────────────┘
```

#### 7.2.3 Backup History (`/backups`)

**Features:**
- Filterable/sortable table of all backups
- Filters:
  - Database selection
  - Date range picker
  - Status (completed/failed/running)
  - Type (hourly/daily/weekly/monthly/manual)
  - S3 status (uploaded/not uploaded)
- Actions per backup:
  - View details
  - Download
  - Restore
  - Delete
  - Upload to S3 (if not uploaded)

**Table Columns:**
- Timestamp
- Database name
- Backup type
- Status badge
- File size
- Duration
- S3 status
- Actions dropdown

#### 7.2.4 Restore Wizard (`/restore/new`)

**Multi-Step Form:**

**Step 1: Select Source**
- Select database to restore to
- Choose restore source:
  - [ ] From existing backup (shows list)
  - [ ] From S3 (browse S3 backups)
  - [ ] Upload file

**Step 2: Restore Options**
- Restore mode:
  - [ ] Full restore (drop and recreate)
  - [ ] Clean and restore
  - [ ] Append data
- Advanced options:
  - [ ] Create safety backup first
  - [ ] Stop active connections
  - Schema/data only toggles

**Step 3: Confirmation**
- Summary of restore operation
- Warning messages
- Confirmation checkbox: "I understand this will modify the database"
- [Cancel] [Execute Restore]

**Step 4: Progress**
- Real-time progress indicator
- Live log output
- Cancel button (with confirmation)

#### 7.2.5 Backup Schedules (`/schedules`)

**Features:**
- List of all schedules
- Enable/disable toggle per schedule
- Next run countdown
- Edit/delete actions

**Schedule Form:**
```
┌─────────────────────────────────────────┐
│ Create Backup Schedule                  │
├─────────────────────────────────────────┤
│                                         │
│ Database:                               │
│ [Select database ▼]                     │
│                                         │
│ Schedule Type:                          │
│ ( ) Hourly  ( ) Daily  ( ) Weekly       │
│ ( ) Monthly (•) Custom                  │
│                                         │
│ Cron Expression:                        │
│ [0 2 * * *]                             │
│ Next 5 runs: ...                        │
│                                         │
│ Retention Policy:                       │
│ [Standard (24h/7d/4w/12m) ▼]            │
│                                         │
│ S3 Upload: [✓] Enable                   │
│ S3 Config: [Default S3 ▼]               │
│                                         │
│         [Cancel] [Save Schedule]        │
└─────────────────────────────────────────┘
```

#### 7.2.6 Backup Details (`/backups/:id`)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ ← Back to Backups                                   │
│                                                     │
│ Backup Details                                      │
│ myapp_db - Daily Backup                             │
│ November 16, 2025 at 2:00 AM                        │
│                                                     │
│ Status: ✓ Completed                                 │
│ Duration: 2m 15s                                    │
│ File Size: 1.2 GB                                   │
│ Compression: gzip                                   │
│ Checksum: sha256:abc123...                          │
│                                                     │
│ S3 Details:                                         │
│ Uploaded: ✓ Yes                                     │
│ Bucket: my-backups                                  │
│ Key: backups/myapp_db/2025/11/...                   │
│ Upload Time: 2:02 AM (45s)                          │
│                                                     │
│ Actions:                                            │
│ [Download] [Restore] [Delete]                       │
│                                                     │
│ Execution Logs:                                     │
│ ┌─────────────────────────────────────────────┐     │
│ │ [INFO] Starting backup process...           │     │
│ │ [INFO] Connected to database                │     │
│ │ [INFO] Executing pg_dump...                 │     │
│ │ [INFO] Backup completed successfully        │     │
│ │ [INFO] Compressing backup file...           │     │
│ │ [INFO] Uploading to S3...                   │     │
│ │ [INFO] Upload completed                     │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.3 UI/UX Features

#### 7.3.1 Real-Time Updates
- WebSocket or polling for live backup progress
- Toast notifications for completed/failed operations
- Live log streaming during backup/restore

#### 7.3.2 Responsive Design
- Mobile-friendly layouts
- Collapsible sidebars
- Responsive tables (card view on mobile)

#### 7.3.3 Dark Mode
- System preference detection
- Manual toggle
- Persisted preference

#### 7.3.4 Accessibility
- ARIA labels
- Keyboard navigation
- Screen reader support
- High contrast mode support

#### 7.3.5 Loading States
- Skeleton screens
- Progress indicators
- Optimistic UI updates

#### 7.3.6 Error Handling
- Inline validation errors
- User-friendly error messages
- Retry mechanisms
- Error boundaries

---

## 8. Docker Architecture

### 8.1 Container Structure

#### 8.1.1 Dockerfile

```dockerfile
FROM oven/bun:1-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    postgresql16-client \
    mysql-client \
    gzip \
    curl

# Build stage
FROM base AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 bunuser
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:bunuser /app/.next/standalone ./
COPY --from=builder --chown=nextjs:bunuser /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:bunuser /app/public ./public

# Create directories for data
RUN mkdir -p /app/data/backups /app/data/db && \
    chown -R nextjs:bunuser /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "run", "server.js"]
```

### 8.2 Docker Compose Integration

#### 8.2.1 Example Docker Compose File

```yaml
version: '3.8'

services:
  # User's existing PostgreSQL database
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network

  # User's existing MySQL database
  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: users
      MYSQL_USER: users
      MYSQL_PASSWORD: secret
      MYSQL_ROOT_PASSWORD: rootsecret
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - app_network

  # DB Backup Web App (companion container)
  db-backup:
    image: db-backup-app:latest
    ports:
      - "3000:3000"
    environment:
      # S3 Configuration (optional)
      - S3_REGION=us-east-1
      - S3_BUCKET=my-backups
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}

      # Encryption key for storing passwords
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}

      # Timezone
      - TZ=America/New_York

      # Optional: Auto-discover databases
      - AUTO_DISCOVER=true
    volumes:
      # Persistent storage for database and backups
      - backup_data:/app/data

      # Docker socket for container discovery (optional)
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - app_network
    depends_on:
      - postgres
      - mysql
    restart: unless-stopped

networks:
  app_network:
    driver: bridge

volumes:
  postgres_data:
  mysql_data:
  backup_data:
```

#### 8.2.2 Environment Variables

**Required:**
- `ENCRYPTION_KEY`: Encryption key for storing sensitive data (32+ characters)

**Optional:**
- `S3_REGION`: AWS region (default: us-east-1)
- `S3_BUCKET`: Default S3 bucket
- `S3_ACCESS_KEY_ID`: AWS access key
- `S3_SECRET_ACCESS_KEY`: AWS secret key
- `S3_ENDPOINT`: Custom S3 endpoint for S3-compatible services
- `AUTO_DISCOVER`: Enable automatic database discovery (default: false)
- `TZ`: Timezone for cron schedules (default: UTC)
- `LOG_LEVEL`: Logging level (default: info)
- `MAX_BACKUP_RETENTION_DAYS`: Hard limit for backup retention (default: 365)
- `BACKUP_STORAGE_PATH`: Local backup storage path (default: /app/data/backups)
- `DATABASE_PATH`: SQLite database path (default: /app/data/db/app.db)

### 8.3 Networking

#### 8.3.1 Container Communication
- Join same Docker network as target databases
- Use Docker DNS for service discovery
- Support both container names and hostnames

#### 8.3.2 Network Discovery
- Scan Docker network for database containers
- Detect standard database ports (5432, 3306)
- Parse environment variables for credentials (optional)

### 8.4 Volume Management

#### 8.4.1 Persistent Volumes

**`/app/data/db`**
- SQLite database file
- Must persist across container restarts

**`/app/data/backups`**
- Local backup storage
- Optional if S3-only mode
- Should be backed up separately

#### 8.4.2 Backup Strategy
- Use named volumes for production
- Bind mounts for development
- Regular volume backups recommended

### 8.5 Security Considerations

#### 8.5.1 Docker Socket Access
- Mount Docker socket as read-only
- Only for auto-discovery feature
- Optional (can disable auto-discovery)

#### 8.5.2 Network Isolation
- Run in isolated network with target databases
- Don't expose unnecessary ports
- Use internal DNS

#### 8.5.3 Secret Management
- Use Docker secrets or environment files
- Encrypt sensitive data in SQLite
- Never log credentials

---

## 9. Security

### 9.1 Authentication & Authorization

#### 9.1.1 Authentication Options

**Phase 1: No Authentication (v1.0)**
- For trusted internal networks
- Container-level access control
- Network isolation provides security

**Phase 2: Basic Authentication (v1.1)**
- Username/password protection
- Session-based authentication
- JWT tokens

**Phase 3: Advanced Authentication (v2.0)**
- OAuth 2.0 / OIDC integration
- LDAP/Active Directory
- API keys for programmatic access
- Role-based access control (RBAC)

#### 9.1.2 Authorization Model (Future)

**Roles:**
- **Admin**: Full access
- **Operator**: Backup/restore operations
- **Viewer**: Read-only access

**Permissions:**
- `database.view`: View database configs
- `database.create`: Add databases
- `database.delete`: Remove databases
- `backup.execute`: Run backups
- `backup.view`: View backup history
- `restore.execute`: Perform restores
- `schedule.manage`: Create/edit schedules
- `system.configure`: System settings

### 9.2 Credential Storage

#### 9.2.1 Encryption at Rest
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with salt
- **Storage**: Encrypted fields in SQLite
- **Key Management**: Environment variable (`ENCRYPTION_KEY`)

#### 9.2.2 Sensitive Data
Encrypted fields:
- Database passwords
- S3 access keys
- S3 secret keys
- Any API tokens

#### 9.2.3 Key Rotation
- Support for key rotation
- Re-encrypt all sensitive data
- Maintain key version metadata

### 9.3 Network Security

#### 9.3.1 Database Connections
- Support SSL/TLS connections
- Certificate validation
- Connection pooling with timeouts

#### 9.3.2 S3 Connections
- HTTPS only
- AWS Signature V4
- Server-side encryption

#### 9.3.3 Web Application
- HTTPS recommended (reverse proxy)
- CORS configuration
- Rate limiting
- CSRF protection

### 9.4 Backup Security

#### 9.4.1 Backup Encryption (Future Enhancement)
- Client-side encryption before S3 upload
- GPG encryption support
- Encryption key management

#### 9.4.2 Access Control
- Backup file permissions (600)
- Temporary file cleanup
- Secure deletion

### 9.5 Audit Logging

#### 9.5.1 Audit Events
- User authentication attempts
- Database configuration changes
- Backup/restore operations
- Schedule modifications
- System setting changes
- Failed operations

#### 9.5.2 Log Retention
- Configurable retention period
- Automatic log rotation
- Export to external logging systems

### 9.6 Compliance Considerations

#### 9.6.1 Data Protection
- GDPR compliance support
- Data encryption
- Access logging
- Right to deletion

#### 9.6.2 Security Best Practices
- Regular security updates
- Vulnerability scanning
- Penetration testing
- Security documentation

---

## 10. Performance & Scalability

### 10.1 Performance Targets

#### 10.1.1 Backup Operations
- **Small databases (<1GB)**: <60 seconds
- **Medium databases (1-10GB)**: <10 minutes
- **Large databases (>10GB)**: <60 minutes
- **Compression**: 30-50% size reduction

#### 10.1.2 Restore Operations
- **Small databases**: <2 minutes
- **Medium databases**: <15 minutes
- **Large databases**: <90 minutes

#### 10.1.3 UI Performance
- **Page Load**: <2 seconds
- **API Response**: <500ms
- **Real-time Updates**: <1 second latency

### 10.2 Scalability Considerations

#### 10.2.1 Database Limits
- Support 1-100 databases per instance
- Concurrent backups: 3-5 (configurable)
- Backup history: 10,000+ records

#### 10.2.2 Storage Optimization
- SQLite WAL mode for concurrent reads
- Bun's native `bun:sqlite` module provides superior performance over Node.js drivers
- Index optimization
- Regular VACUUM operations

#### 10.2.3 Resource Management
- Memory limits per backup process
- CPU throttling options
- Disk space monitoring
- Queue management for concurrent operations

### 10.3 Optimization Strategies

#### 10.3.1 Backup Optimization
- Incremental backups (future)
- Parallel dump (PostgreSQL)
- Compression level tuning
- Network bandwidth control

#### 10.3.2 S3 Upload Optimization
- Multipart uploads for large files
- Parallel uploads
- Connection pooling
- Retry with exponential backoff

#### 10.3.3 UI Optimization
- Server-side rendering (Next.js)
- Pagination for large lists
- Virtual scrolling
- Lazy loading
- Image optimization

---

## 11. Monitoring & Logging

### 11.1 Application Logging

#### 11.1.1 Log Levels
- **ERROR**: Critical failures
- **WARN**: Recoverable issues
- **INFO**: Important events
- **DEBUG**: Detailed diagnostics

#### 11.1.2 Log Categories
- **Application**: General app logs
- **Backup**: Backup operation logs
- **Restore**: Restore operation logs
- **Scheduler**: Cron job logs
- **S3**: S3 operation logs
- **Database**: Database connection logs
- **HTTP**: API request logs

#### 11.1.3 Log Storage
- Console output (Docker logs)
- Execution-specific logs in SQLite
- Optional: External log aggregation (future)

### 11.2 Metrics & Monitoring

#### 11.2.1 Key Metrics
- Total backups executed
- Backup success/failure rates
- Average backup duration
- Average backup size
- Disk space utilization
- S3 upload success rate
- Active schedules count
- Next scheduled backup time

#### 11.2.2 Health Checks
- **Liveness**: `/api/health/live`
- **Readiness**: `/api/health/ready`
- Checks:
  - SQLite connectivity
  - Disk space availability
  - Scheduler status
  - S3 connectivity (if configured)

#### 11.2.3 Alerting (Future)
- Email notifications
- Webhook notifications
- Slack integration
- Discord integration
- Failure thresholds
- Disk space warnings

### 11.3 Observability

#### 11.3.1 Tracing
- Request ID tracking
- Operation correlation
- Error stack traces

#### 11.3.2 Dashboards
- Built-in web UI dashboard
- Export Prometheus metrics (future)
- Grafana integration (future)

---

## 12. Deployment

### 12.1 Installation Methods

#### 12.1.1 Docker Compose (Primary)
```bash
# Download docker-compose.yml
curl -o docker-compose.yml https://example.com/docker-compose.yml

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start services
docker-compose up -d

# Access web UI
open http://localhost:3000
```

#### 12.1.2 Docker Run
```bash
docker run -d \
  --name db-backup \
  -p 3000:3000 \
  -e ENCRYPTION_KEY=your-secret-key \
  -v backup_data:/app/data \
  --network your_app_network \
  db-backup-app:latest
```

#### 12.1.3 Kubernetes (Future)
- Helm chart
- StatefulSet for persistence
- ConfigMap for configuration
- Secrets for sensitive data

### 12.2 Configuration

#### 12.2.1 Initial Setup Wizard
On first launch, guide user through:
1. Set encryption key
2. Configure first database
3. Set up S3 (optional)
4. Create first schedule
5. Run test backup

#### 12.2.2 Configuration File
Optional `config.json` for advanced settings:
```json
{
  "server": {
    "port": 3000,
    "hostname": "0.0.0.0"
  },
  "backup": {
    "maxConcurrent": 3,
    "defaultCompression": "gzip",
    "tempDirectory": "/tmp/backups"
  },
  "scheduler": {
    "timezone": "UTC",
    "checkInterval": 60000
  },
  "retention": {
    "maxRetentionDays": 365,
    "cleanupInterval": "0 3 * * *"
  },
  "s3": {
    "uploadTimeout": 3600000,
    "multipartThreshold": 104857600
  }
}
```

### 12.3 Upgrades

#### 12.3.1 Version Management
- Semantic versioning (SemVer)
- Release notes with changelog
- Migration guides

#### 12.3.2 Database Migrations
- Automatic schema migrations on startup
- Backup SQLite database before migration
- Rollback capability

#### 12.3.3 Zero-Downtime Updates
- Rolling updates in Kubernetes
- Graceful shutdown handling
- State persistence

### 12.4 Backup & Recovery

#### 12.4.1 Backup App Data
- SQLite database (`/app/data/db/app.db`)
- Local backups (`/app/data/backups`)
- Configuration files

#### 12.4.2 Disaster Recovery
- Export/import configuration
- S3 as source of truth for backups
- Rebuild from S3 metadata

---

## 13. Testing Strategy

### 13.1 Unit Testing

#### 13.1.1 Frontend
- Component testing with React Testing Library
- Hook testing
- Form validation testing
- Utility function testing

#### 13.1.2 Backend
- API route testing
- Service layer testing
- Database operations testing
- Mock external dependencies (S3, databases)

#### 13.1.3 Coverage Target
- Minimum 80% code coverage
- 100% coverage for critical paths (backup/restore)

### 13.2 Integration Testing

#### 13.2.1 API Testing
- End-to-end API flow testing
- Database integration tests
- S3 integration tests (with LocalStack)

#### 13.2.2 Database Testing
- PostgreSQL backup/restore workflows
- MySQL backup/restore workflows
- Multi-database scenarios

### 13.3 End-to-End Testing

#### 13.3.1 UI Workflows
- Complete backup workflow
- Complete restore workflow
- Schedule creation and execution
- Database configuration

#### 13.3.2 Tools
- Playwright or Cypress
- Docker Compose test environment

### 13.4 Performance Testing

#### 13.4.1 Load Testing
- Concurrent backup operations
- Large database handling
- S3 upload performance
- UI responsiveness under load

#### 13.4.2 Stress Testing
- Maximum database count
- Maximum backup history
- Disk space exhaustion
- Network failure scenarios

### 13.5 Security Testing

#### 13.5.1 Vulnerability Scanning
- Dependency scanning (bun audit or npm audit)
- Container scanning
- OWASP Top 10 testing

#### 13.5.2 Penetration Testing
- Authentication bypass attempts
- SQL injection testing
- XSS testing
- CSRF testing

---

## 14. Future Enhancements

### 14.1 Phase 2 Features

#### 14.1.1 Advanced Backup Types
- **Incremental Backups**: Only backup changes since last full backup
- **Differential Backups**: Backup changes since last full backup
- **Point-in-Time Recovery**: For PostgreSQL WAL archiving
- **Continuous Archiving**: Real-time backup streaming

#### 14.1.2 Additional Database Support
- MongoDB
- Redis
- MariaDB
- Microsoft SQL Server
- Oracle (if licensing permits)
- Cassandra
- Elasticsearch

#### 14.1.3 Backup Encryption
- Client-side encryption before upload
- GPG key management
- Encryption key rotation
- Multiple encryption algorithms

### 14.2 Phase 3 Features

#### 14.2.1 Multi-Tenancy
- Separate namespaces for different teams
- User management
- Role-based access control
- Quota management

#### 14.2.2 Advanced Scheduling
- Backup windows (blackout periods)
- Load-based scheduling
- Dependency chains
- Pre/post-backup hooks

#### 14.2.3 Monitoring & Alerting
- Email notifications
- Slack/Discord webhooks
- PagerDuty integration
- Custom webhook endpoints
- SLA monitoring

### 14.3 Cloud Integrations

#### 14.3.1 Additional Storage Backends
- Google Cloud Storage
- Azure Blob Storage
- Backblaze B2
- Wasabi
- SFTP/FTP servers

#### 14.3.2 Database-as-a-Service
- AWS RDS integration
- Google Cloud SQL
- Azure Database
- DigitalOcean Managed Databases

### 14.4 Advanced Features

#### 14.4.1 Backup Verification
- Automatic restore testing
- Checksum verification
- Database integrity checks
- Automated validation schedules

#### 14.4.2 Disaster Recovery
- Cross-region replication
- Geo-redundant backups
- Automated failover
- Recovery time objectives (RTO/RPO)

#### 14.4.3 Cost Optimization
- S3 lifecycle policies automation
- Storage class optimization
- Compression algorithm selection
- Deduplication

### 14.5 Developer Experience

#### 14.5.1 API & Integrations
- GraphQL API
- Webhooks for events
- CLI tool
- Terraform provider
- Kubernetes operator

#### 14.5.2 Extensibility
- Plugin system
- Custom backup scripts
- Custom retention policies
- Event hooks

---

## 15. Technical Constraints & Assumptions

### 15.1 Constraints

#### 15.1.1 System Requirements
- **Minimum RAM**: 512MB
- **Recommended RAM**: 2GB+
- **Disk Space**: 2x largest database size
- **CPU**: 1+ cores
- **Network**: Reliable internet for S3 uploads

#### 15.1.2 Database Versions
- **PostgreSQL**: 12+
- **MySQL**: 8.0+
- **MariaDB**: 10.5+ (compatible with MySQL mode)

#### 15.1.3 Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### 15.2 Assumptions

#### 15.2.1 Deployment
- Docker and Docker Compose are available
- Network connectivity between containers
- Sufficient disk space for backups
- User has Docker permissions

#### 15.2.2 Usage Patterns
- Databases are <100GB (for optimal performance)
- Backup frequency: hourly to monthly
- Restore frequency: occasional
- Single instance per Docker Compose stack

#### 15.2.3 Security
- Deployment in trusted network environment (v1.0)
- Physical/network security handled externally
- Encryption key securely managed
- S3 credentials have appropriate permissions

---

## 16. Success Criteria

### 16.1 Functional Criteria
- ✅ Successfully backup PostgreSQL databases
- ✅ Successfully backup MySQL databases
- ✅ Restore backups to databases
- ✅ Schedule automated backups
- ✅ Upload backups to S3
- ✅ Apply retention policies
- ✅ Web UI accessible and functional
- ✅ Docker Compose integration working

### 16.2 Performance Criteria
- ✅ Backup 1GB database in <2 minutes
- ✅ Restore 1GB database in <3 minutes
- ✅ UI loads in <2 seconds
- ✅ API responds in <500ms

### 16.3 Reliability Criteria
- ✅ 99% backup success rate
- ✅ Automatic failure retry
- ✅ No data loss during backup
- ✅ No data corruption during restore

### 16.4 Usability Criteria
- ✅ Setup in <10 minutes
- ✅ Create first backup in <5 minutes
- ✅ Intuitive UI (no documentation needed for basic tasks)
- ✅ Clear error messages

---

## 17. Glossary

| Term | Definition |
|------|------------|
| **Backup Execution** | A single run of a backup operation |
| **Retention Policy** | Rules defining how long to keep backups |
| **Cron Expression** | Time-based job scheduling format |
| **pg_dump** | PostgreSQL backup utility |
| **mysqldump** | MySQL backup utility |
| **S3** | Amazon Simple Storage Service (object storage) |
| **SQLite** | Embedded relational database |
| **Docker Compose** | Tool for defining multi-container Docker applications |
| **Companion Container** | Container that runs alongside main application containers |
| **Multipart Upload** | S3 feature for uploading large files in parts |
| **SSR** | Server-Side Rendering |
| **API Route** | Next.js backend endpoint |
| **Hierarchical Retention** | Tiered backup retention (hourly/daily/weekly/monthly) |

---

## 18. References

### 18.1 Technology Documentation
- Next.js 16: https://nextjs.org/docs
- React 19: https://react.dev
- Tailwind CSS v4: https://tailwindcss.com/docs
- Bun Runtime: https://bun.sh/docs
- Bun SQLite: https://bun.sh/docs/api/sqlite
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- MySQL Documentation: https://dev.mysql.com/doc/
- AWS SDK for JavaScript: https://docs.aws.amazon.com/sdk-for-javascript/
- Docker Documentation: https://docs.docker.com/

### 18.2 Best Practices
- 12-Factor App: https://12factor.net/
- Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/
- Next.js Best Practices: https://nextjs.org/docs/app/building-your-application/optimizing
- Database Backup Best Practices
- S3 Best Practices: https://docs.aws.amazon.com/AmazonS3/latest/userguide/best-practices.html

---

**Document Status:** Draft
**Last Updated:** 2025-11-16
**Next Review:** Before implementation kickoff
