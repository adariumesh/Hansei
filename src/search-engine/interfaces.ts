/**
 * Search engine specific interfaces
 */
import { ComponentRequest, ComponentResponse, Environment, SearchResult, SearchOptions } from '../shared/types.js';

// Re-export shared types for backward compatibility
export type { ComponentRequest, ComponentResponse, Environment };

/**
 * Search query interface with enhanced typing
 */
export interface SearchQuery {
  query: string;
  options?: SearchEngineOptions;
}

/**
 * Search engine specific options
 */
export interface SearchEngineOptions extends SearchOptions {
  searchType?: 'keyword' | 'semantic' | 'hybrid' | 'comprehensive';
  includeHighlights?: boolean;
  minScore?: number;
  maxResults?: number;
}

/**
 * Enhanced search result for search engine
 */
export interface EnhancedSearchResult extends SearchResult {
  highlights?: string[];
  relevanceFactors?: {
    keywordMatch: number;
    semanticSimilarity: number;
    contextRelevance: number;
  };
}

/**
 * Search response with metadata
 */
export interface SearchResponse {
  results: EnhancedSearchResult[];
  total: number;
  query: string;
  searchType: string;
  processingTime?: number;
  suggestions?: string[];
}

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
