import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { testDatabaseConnection } from '@/lib/backup';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response';
import type { DatabaseConfig } from '@/types';

/**
 * POST /api/databases/:id/test-connection
 * Test database connectivity
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const databases = query<DatabaseConfig>(
      'SELECT * FROM DatabaseConfigs WHERE Id = ?',
      [params.id]
    );

    if (databases.length === 0) {
      return errorResponse('NOT_FOUND', 'Database configuration not found', undefined, 404);
    }

    const result = await testDatabaseConnection(databases[0]);

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
