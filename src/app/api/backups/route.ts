import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { executeBackup } from '@/lib/backup';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response';
import type { BackupExecution, BackupExecutionInput } from '@/types';

/**
 * GET /api/backups
 * List all backup executions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const databaseId = searchParams.get('databaseId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    let sql = 'SELECT * FROM BackupExecutions WHERE 1=1';
    const params: any[] = [];

    if (databaseId) {
      sql += ' AND DatabaseConfigId = ?';
      params.push(databaseId);
    }

    if (status) {
      sql += ' AND Status = ?';
      params.push(status);
    }

    if (type) {
      sql += ' AND BackupType = ?';
      params.push(type);
    }

    // Count total
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = query<{ count: number }>(countSql, params);
    const total = countResult[0]?.count || 0;

    // Add pagination
    sql += ' ORDER BY StartedAt DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const backups = query<BackupExecution>(sql, params);

    return successResponse(backups, {
      page,
      limit,
      total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/backups
 * Execute manual backup
 */
export async function POST(request: NextRequest) {
  try {
    const body: BackupExecutionInput = await request.json();

    if (!body.DatabaseConfigId) {
      return errorResponse('VALIDATION_ERROR', 'DatabaseConfigId is required');
    }

    const result = await executeBackup({
      DatabaseConfigId: body.DatabaseConfigId,
      BackupType: body.BackupType || 'manual',
      S3UploadEnabled: body.S3UploadEnabled,
    });

    if (result.success) {
      return successResponse(result);
    } else {
      return errorResponse('BACKUP_ERROR', result.error || 'Backup failed');
    }
  } catch (error) {
    return handleApiError(error);
  }
}
