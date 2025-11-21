/**
 * Search engine specific interfaces
 */
import { ComponentRequest, ComponentResponse, SearchResult, SearchOptions } from '../shared/types.js';

// Re-export shared types
export type { ComponentRequest, ComponentResponse };

/**
 * Vector embeddings result
 */
export interface VectorEmbeddings {
  embeddings: number[];
  dimensions: number;
  model: string;
  input_text: string;
}

/**
 * Document indexing result
 */
export interface IndexingResult {
  indexed: boolean;
  document_id: string;
  index_time: string;
  status: 'success' | 'failed';
  chunks?: number;
  metadata?: Record<string, any>;
}

/**
 * Document to be indexed
 */
export interface DocumentToIndex {
  id?: string;
  title?: string;
  content: string;
  metadata?: Record<string, any>;
  type?: string;
}