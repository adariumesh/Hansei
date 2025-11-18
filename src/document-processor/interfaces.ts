import { BaseResponse } from '../shared/response-builder.js';

/**
 * Supported document formats for processing
 */
export type DocumentFormat = 'text' | 'markdown' | 'json' | 'xml' | 'html';

/**
 * Processing options for document handling
 */
export interface ProcessingOptions {
  format?: DocumentFormat;
  encoding?: 'utf-8' | 'ascii' | 'latin1';
  chunk_size?: number;
  trim?: boolean;
  normalize?: boolean;
  skip_optimization?: boolean;
  preserve_structure?: boolean;
}

/**
 * Document processing request structure
 */
export interface DocumentRequest {
  input: string;
  options?: ProcessingOptions;
  metadata?: Record<string, any>;
}

/**
 * Processed document result structure
 */
export interface ProcessedDocument {
  content: any;
  format: DocumentFormat;
  word_count?: number;
  headers?: Array<{ level: number; text: string }>;
  keys?: string[];
  chunks?: string[];
  length?: number;
  encoding?: string;
}

/**
 * Document processing response
 */
export type DocumentResponse = BaseResponse<ProcessedDocument>;

/**
 * Environment configuration for document processing
 */
export interface DocumentProcessorEnvironment {
  DATABASE: any;
  logger: Logger;
}

/**
 * Logger interface for consistent logging across components
 */
export interface Logger {
  debug(message: string, fields?: Record<string, any>): void;
  info(message: string, fields?: Record<string, any>): void;
  warn(message: string, fields?: Record<string, any>): void;
  error(message: string, fields?: Record<string, any>): void;
}

/**
 * Processing context for internal operations
 */
export interface ProcessingContext {
  requestId: string;
  startTime: number;
  format: DocumentFormat;
  options: ProcessingOptions;
}

/**
 * Optimization result containing the optimized request and metadata
 */
export interface OptimizationResult {
  request: DocumentRequest;
  optimizations: string[];
  metadata: Record<string, any>;
}
