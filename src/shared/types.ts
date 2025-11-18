/**
 * Shared types for the Hansei application
 */

// Common API response structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

// Common error types
export interface ErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationError {
  type: 'validation';
  message?: string;
  details: ErrorDetail[];
}

export interface ProcessingError {
  type: 'processing';
  message: string;
  cause?: string;
}

export interface NetworkError {
  type: 'network';
  message: string;
  statusCode?: number;
}

export type ApplicationError = ValidationError | ProcessingError | NetworkError;

// Search related types
export interface SearchOptions {
  limit?: number;
  offset?: number;
  filter?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  id: string | number;
  title: string;
  score: number;
  type: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface PaginatedResults<T = any> {
  results: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Common request/response interfaces
export interface ComponentRequest {
  input: string;
  options?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ComponentResponse {
  id: string;
  status: 'success' | 'failed' | 'pending';
  result: any;
  processing_time_ms: number;
  metadata: Record<string, any>;
  created_at: string;
}

// Environment interface
export interface Environment {
  DATABASE: any | null;
  logger: {
    debug(message: string, fields?: Record<string, any>): void;
    info(message: string, fields?: Record<string, any>): void;
    warn(message: string, fields?: Record<string, any>): void;
    error(message: string, fields?: Record<string, any>): void;
  };
}