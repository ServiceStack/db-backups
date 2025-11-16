import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { executeRestore } from '@/lib/restore';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response';
import type { RestoreExecution, RestoreExecutionInput } from '@/types';

/**
 * GET /api/restores
 * List all restore executions
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const databaseId = searchParams.get('databaseId');
    const status = searchParams.get('status');

    let sql = 'SELECT * FROM RestoreExecutions WHERE 1=1';
    const params: any[] = [];

    if (databaseId) {
      sql += ' AND DatabaseConfigId = ?';
      params.push(databaseId);
    }

    if (status) {
      sql += ' AND Status = ?';
      params.push(status);
    }

    sql += ' ORDER BY StartedAt DESC LIMIT 100';

    const restores = query<RestoreExecution>(sql, params);

    return successResponse(restores);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/restores
 * Execute restore operation
 */
export async function POST(request: NextRequest) {
  try {
    const body: RestoreExecutionInput = await request.json();

    if (!body.DatabaseConfigId) {
      return errorResponse('VALIDATION_ERROR', 'DatabaseConfigId is required');
    }

    if (!body.SourceType) {
      return errorResponse('VALIDATION_ERROR', 'SourceType is required');
    }

    const result = await executeRestore(body);

    if (result.success) {
      return successResponse(result);
    } else {
      return errorResponse('RESTORE_ERROR', result.error || 'Restore failed');
    }
  } catch (error) {
    return handleApiError(error);
  }
}
