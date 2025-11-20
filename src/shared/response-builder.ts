/**
 * Shared response building utilities for the Hansei system
 */

/**
 * Generates a unique identifier with a given prefix
 */
export const generateId = (prefix: string = 'id'): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `${prefix}-${timestamp}-${randomSuffix}`;
};

/**
 * Base response structure used across components
 */
export interface BaseResponse<T = any> {
  id: string;
  status: 'success' | 'failed' | 'pending';
  result: T;
  processing_time_ms: number;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Creates a success response with timing information
 */
export const createSuccessResponse = <T>(
  result: T,
  startTime: number,
  metadata: Record<string, any> = {},
  idPrefix: string = 'success'
): BaseResponse<T> => {
  const processingTime = Date.now() - startTime;
  const timestamp = new Date().toISOString();
  
  return {
    id: generateId(idPrefix),
    status: 'success',
    result,
    processing_time_ms: processingTime,
    metadata: {
      ...metadata,
      processed_at: timestamp
    },
    created_at: timestamp
  };
};

/**
 * Creates an error response with timing information
 */
export const createErrorResponse = (
  error: Error | string,
  startTime: number,
  metadata: Record<string, any> = {},
  idPrefix: string = 'error'
): BaseResponse<{ error: string }> => {
  const processingTime = Date.now() - startTime;
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : error;
  
  return {
    id: generateId(idPrefix),
    status: 'failed',
    result: { error: errorMessage },
    processing_time_ms: processingTime,
    metadata: {
      ...metadata,
      error_at: timestamp
    },
    created_at: timestamp
  };
};

/**
 * Performance timing utility
 */
export class PerformanceTimer {
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
  }
  
  /**
   * Gets elapsed time in milliseconds since timer creation
   */
  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }
  
  /**
   * Resets the timer to current time
   */
  reset(): void {
    this.startTime = Date.now();
  }
  
  /**
   * Gets the start timestamp
   */
  getStartTime(): number {
    return this.startTime;
  }
}