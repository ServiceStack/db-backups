# DB Backup & Restore

A containerized web application built with Bun runtime that provides automated backup and restore capabilities for PostgreSQL and MySQL databases, designed to run as a companion container in existing Docker Compose environments.

## Features

- **Multi-Database Support**: PostgreSQL and MySQL backup/restore
- **Automated Scheduling**: Cron-based scheduling with hourly, daily, weekly, and monthly presets
- **Intelligent Retention**: Hierarchical retention policies (hourly, daily, weekly, monthly, yearly)
- **S3 Integration**: Upload backups to Amazon S3 or S3-compatible storage
- **Web UI**: Modern web interface for managing backups and restores (Coming Soon)
- **REST API**: Complete API for programmatic access
- **Secure**: AES-256-GCM encryption for storing credentials
- **Docker Native**: Runs as a companion container in your Docker Compose stack

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Existing PostgreSQL or MySQL databases in Docker containers
- (Optional) AWS S3 bucket for offsite backup storage

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd db-backups
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file**
   ```bash
   # Required: Set a secure encryption key (minimum 32 characters)
   ENCRYPTION_KEY=your-secure-32-character-encryption-key-here

   # Optional: Configure S3
   S3_REGION=us-east-1
   S3_BUCKET=my-backups
   S3_ACCESS_KEY_ID=your-access-key
   S3_SECRET_ACCESS_KEY=your-secret-key
   ```

4. **Add to your docker-compose.yml**
   ```yaml
   services:
     db-backup:
       build: ./db-backups
       ports:
         - "3000:3000"
       environment:
         - ENCRYPTION_KEY=${ENCRYPTION_KEY}
         - S3_REGION=${S3_REGION}
         - S3_BUCKET=${S3_BUCKET}
         - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
         - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
       volumes:
         - backup_data:/app/data
       networks:
         - app_network
       restart: unless-stopped

   volumes:
     backup_data:
   ```

5. **Start the application**
   ```bash
   docker-compose up -d db-backup
   ```

6. **Access the web interface**
   Open http://localhost:3000 in your browser

## API Usage

### Database Configuration

**Create a database configuration**
```bash
curl -X POST http://localhost:3000/api/databases \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "My PostgreSQL Database",
    "Type": "postgresql",
    "Host": "postgres",
    "Port": 5432,
    "DatabaseName": "myapp",
    "Username": "myapp",
    "Password": "secret",
    "DockerContainerName": "postgres",
    "Enabled": true
  }'
```

**List all databases**
```bash
curl http://localhost:3000/api/databases
```

**Test database connection**
```bash
curl -X POST http://localhost:3000/api/databases/{id}/test-connection
```

### Manual Backup

**Execute a manual backup**
```bash
curl -X POST http://localhost:3000/api/backups \
  -H "Content-Type: application/json" \
  -d '{
    "DatabaseConfigId": "database-id-here",
    "BackupType": "manual",
    "S3UploadEnabled": true
  }'
```

**List all backups**
```bash
curl http://localhost:3000/api/backups
```

**List backups for a specific database**
```bash
curl http://localhost:3000/api/backups?databaseId=database-id-here
```

### Restore

**Execute a restore from S3**
```bash
curl -X POST http://localhost:3000/api/restores \
  -H "Content-Type: application/json" \
  -d '{
    "DatabaseConfigId": "database-id-here",
    "SourceType": "s3",
    "S3Bucket": "my-backups",
    "S3Key": "backups/myapp_db/2025/11/myapp_db_daily_20251116.sql.gz",
    "RestoreOptions": {
      "cleanBeforeRestore": true
    }
  }'
```

**Execute a restore from local backup**
```bash
curl -X POST http://localhost:3000/api/restores \
  -H "Content-Type: application/json" \
  -d '{
    "DatabaseConfigId": "database-id-here",
    "SourceType": "local",
    "SourcePath": "/app/data/backups/myapp_db_daily_20251116.sql.gz"
  }'
```

**List all restores**
```bash
curl http://localhost:3000/api/restores
```

## Development

### Running locally with Bun

1. **Install Bun** (if not already installed)
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Run database migrations**
   ```bash
   bun run db:migrate
   ```

5. **Start development server**
   ```bash
   bun run dev
   ```

6. **Access the application**
   Open http://localhost:3000

### Building for production

```bash
bun run build
bun run start
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | Yes | - | Encryption key for storing passwords (min 32 chars) |
| `S3_REGION` | No | `us-east-1` | AWS region |
| `S3_BUCKET` | No | - | S3 bucket name |
| `S3_ACCESS_KEY_ID` | No | - | AWS access key ID |
| `S3_SECRET_ACCESS_KEY` | No | - | AWS secret access key |
| `S3_ENDPOINT` | No | - | Custom S3 endpoint (for MinIO, etc.) |
| `AUTO_DISCOVER` | No | `false` | Enable automatic database discovery |
| `TZ` | No | `UTC` | Timezone for cron schedules |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |
| `MAX_BACKUP_RETENTION_DAYS` | No | `365` | Hard limit for backup retention |
| `BACKUP_STORAGE_PATH` | No | `/app/data/backups` | Local backup storage path |
| `DATABASE_PATH` | No | `/app/data/db/app.db` | SQLite database path |
| `PORT` | No | `3000` | Server port |
| `HOSTNAME` | No | `0.0.0.0` | Server hostname |

### Retention Policies

The default retention policy keeps:
- **24 hourly** backups (last 24 hours)
- **7 daily** backups (last 7 days)
- **4 weekly** backups (last 4 weeks)
- **12 monthly** backups (last 12 months)
- **0 yearly** backups

Retention policies automatically delete older backups while preserving the most recent backups in each time bucket.

## Architecture

### Tech Stack

- **Runtime**: Bun 1.1+
- **Framework**: Next.js 16+ with React 19+
- **Styling**: Tailwind CSS v4+
- **Database**: SQLite (bun:sqlite)
- **Storage**: Amazon S3 or S3-compatible services
- **Scheduling**: node-cron
- **Logging**: Winston

### Components

- **Backup Engine**: Executes pg_dump/mysqldump with streaming compression
- **Restore Engine**: Executes pg_restore/mysql with streaming decompression
- **Scheduler**: Cron-based job scheduling with automatic execution
- **Retention Manager**: Hierarchical retention policy enforcement
- **S3 Client**: Multipart upload/download with retry logic
- **API Server**: RESTful API with Next.js API routes

## Backup File Structure

Local backups are stored in:
```
/app/data/backups/
├── database1_daily_20251116_143022_abc123.dump.gz
├── database1_hourly_20251116_150000_def456.dump.gz
└── database2_daily_20251116_143025_ghi789.sql.gz
```

S3 backups are organized by:
```
{path_prefix}/{database_name}/{year}/{month}/{filename}

Example:
backups/myapp_db/2025/11/myapp_db_daily_20251116_143022.sql.gz
```

## Security

- **Encryption at Rest**: All database passwords and S3 credentials are encrypted using AES-256-GCM
- **Secure Key Storage**: Encryption key must be provided via environment variable
- **Network Isolation**: Runs in same Docker network as target databases
- **No Authentication (v1.0)**: Current version has no built-in authentication - deploy in trusted networks only

## Roadmap

- [ ] Web UI for managing backups and restores
- [ ] Schedule management interface
- [ ] Real-time backup progress tracking
- [ ] Email/webhook notifications
- [ ] Incremental backups
- [ ] Point-in-time recovery
- [ ] Authentication and authorization
- [ ] Multi-user support
- [ ] MongoDB support
- [ ] Kubernetes Helm chart

## Troubleshooting

### Database connection fails

1. Ensure database container is on the same Docker network
2. Check if container name or hostname is correct
3. Verify credentials are correct
4. Test connection using the `/api/databases/{id}/test-connection` endpoint

### Backup fails

1. Check disk space on host system
2. Verify database is accessible
3. Check logs: `docker-compose logs db-backup`
4. Ensure PostgreSQL client version is compatible

### S3 upload fails

1. Verify S3 credentials are correct
2. Check S3 bucket exists and is accessible
3. Ensure IAM permissions allow PutObject operation
4. For S3-compatible services, verify endpoint is correct

## License

See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues and questions, please open an issue on GitHub.
