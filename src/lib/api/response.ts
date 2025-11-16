import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';

/**
 * Create a success response
 */
export function successResponse<T>(data: T, meta?: ApiResponse['meta']): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
    },
  };

  return NextResponse.json(response);
}

/**
 * Create an error response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: any,
  status: number = 400
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  return NextResponse.json(response, { status });
}

/**
 * Handle API errors
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof Error) {
    return errorResponse('INTERNAL_ERROR', error.message, undefined, 500);
  }

  return errorResponse('UNKNOWN_ERROR', 'An unknown error occurred', undefined, 500);
}
