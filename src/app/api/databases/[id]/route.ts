import { NextRequest } from 'next/server';
import { query, execute, getCurrentTimestamp } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response';
import type { DatabaseConfig, DatabaseConfigUpdate } from '@/types';

/**
 * GET /api/databases/:id
 * Get specific database configuration
 */
export async function GET(
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

    return successResponse(databases[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/databases/:id
 * Update database configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: DatabaseConfigUpdate = await request.json();

    // Check if database exists
    const existing = query<DatabaseConfig>(
      'SELECT * FROM DatabaseConfigs WHERE Id = ?',
      [params.id]
    );

    if (existing.length === 0) {
      return errorResponse('NOT_FOUND', 'Database configuration not found', undefined, 404);
    }

    // Build update query
    const fields: string[] = [];
    const values: any[] = [];

    if (body.Name !== undefined) {
      // Check if new name conflicts with existing
      const nameConflict = query<DatabaseConfig>(
        'SELECT Id FROM DatabaseConfigs WHERE Name = ? AND Id != ?',
        [body.Name, params.id]
      );

      if (nameConflict.length > 0) {
        return errorResponse('CONFLICT', 'Database configuration with this name already exists', undefined, 409);
      }

      fields.push('Name = ?');
      values.push(body.Name);
    }

    if (body.Host !== undefined) {
      fields.push('Host = ?');
      values.push(body.Host);
    }

    if (body.Port !== undefined) {
      fields.push('Port = ?');
      values.push(body.Port);
    }

    if (body.DatabaseName !== undefined) {
      fields.push('DatabaseName = ?');
      values.push(body.DatabaseName);
    }

    if (body.Username !== undefined) {
      fields.push('Username = ?');
      values.push(body.Username);
    }

    if (body.Password !== undefined) {
      const passwordEncrypted = await encrypt(body.Password);
      fields.push('PasswordEncrypted = ?');
      values.push(passwordEncrypted);
    }

    if (body.DockerContainerName !== undefined) {
      fields.push('DockerContainerName = ?');
      values.push(body.DockerContainerName);
    }

    if (body.Enabled !== undefined) {
      fields.push('Enabled = ?');
      values.push(body.Enabled ? 1 : 0);
    }

    if (fields.length === 0) {
      return errorResponse('VALIDATION_ERROR', 'No fields to update');
    }

    fields.push('UpdatedAt = ?');
    values.push(getCurrentTimestamp());
    values.push(params.id);

    const sql = `UPDATE DatabaseConfigs SET ${fields.join(', ')} WHERE Id = ?`;
    execute(sql, values);

    // Fetch updated record
    const updated = query<DatabaseConfig>('SELECT * FROM DatabaseConfigs WHERE Id = ?', [params.id]);

    return successResponse(updated[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/databases/:id
 * Delete database configuration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if database exists
    const existing = query<DatabaseConfig>(
      'SELECT * FROM DatabaseConfigs WHERE Id = ?',
      [params.id]
    );

    if (existing.length === 0) {
      return errorResponse('NOT_FOUND', 'Database configuration not found', undefined, 404);
    }

    // Delete (cascade will handle schedules and backups)
    execute('DELETE FROM DatabaseConfigs WHERE Id = ?', [params.id]);

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
