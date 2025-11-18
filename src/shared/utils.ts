/**
 * Shared utilities for the Hansei application
 */

import { ApiResponse, ApplicationError, ValidationError } from './types.js';

/**
 * Creates a successful API response
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates an error API response
 */
export function createErrorResponse(error: string | ApplicationError, statusCode?: number): ApiResponse {
  const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
  
  return {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString()
  };
}

/**
 * Generates a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Validates required string field
 */
export function validateRequiredString(value: any, fieldName: string): string | null {
  if (!value) {
    return `${fieldName} is required`;
  }
  
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  
  if (value.trim().length === 0) {
    return `${fieldName} cannot be empty`;
  }
  
  return null;
}

/**
 * Creates a validation error
 */
export function createValidationError(field: string, message: string): ValidationError {
  return {
    type: 'validation',
    details: [{
      code: 'VALIDATION_ERROR',
      message,
      field
    }]
  };
}

/**
 * Measures execution time of an async function
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      result,
      duration: Date.now() - start
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function (...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Retries an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}