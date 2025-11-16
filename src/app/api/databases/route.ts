import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { query, execute, getCurrentTimestamp } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response';
import type { DatabaseConfig, DatabaseConfigInput } from '@/types';

/**
 * GET /api/databases
 * List all database configurations
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const enabled = searchParams.get('enabled');

    let sql = 'SELECT * FROM DatabaseConfigs WHERE 1=1';
    const params: any[] = [];

    if (type) {
      sql += ' AND Type = ?';
      params.push(type);
    }

    if (enabled !== null) {
      sql += ' AND Enabled = ?';
      params.push(enabled === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY CreatedAt DESC';

    const databases = query<DatabaseConfig>(sql, params);

    return successResponse(databases);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/databases
 * Create new database configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body: DatabaseConfigInput = await request.json();

    // Validate required fields
    if (!body.Name || !body.Type || !body.Host || !body.Port || !body.DatabaseName || !body.Username || !body.Password) {
      return errorResponse('VALIDATION_ERROR', 'Missing required fields');
    }

    // Check if name already exists
    const existing = query<DatabaseConfig>(
      'SELECT Id FROM DatabaseConfigs WHERE Name = ?',
      [body.Name]
    );

    if (existing.length > 0) {
      return errorResponse('CONFLICT', 'Database configuration with this name already exists', undefined, 409);
    }

    // Encrypt password
    const passwordEncrypted = await encrypt(body.Password);

    // Insert new configuration
    const id = nanoid();
    const sql = `
      INSERT INTO DatabaseConfigs (
        Id, Name, Type, Host, Port, DatabaseName, Username, PasswordEncrypted,
        DockerContainerName, Enabled, CreatedAt, UpdatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    execute(sql, [
      id,
      body.Name,
      body.Type,
      body.Host,
      body.Port,
      body.DatabaseName,
      body.Username,
      passwordEncrypted,
      body.DockerContainerName || null,
      body.Enabled !== false ? 1 : 0,
      getCurrentTimestamp(),
      getCurrentTimestamp(),
    ]);

    // Fetch created record
    const created = query<DatabaseConfig>('SELECT * FROM DatabaseConfigs WHERE Id = ?', [id]);

    return successResponse(created[0], undefined);
  } catch (error) {
    return handleApiError(error);
  }
}
