/**
 * Shared TypeScript types for HANSEI
 * Consolidated from types.ts and enhanced-types.ts
 */

import { Kysely } from 'kysely';
import { Database } from '../sql/graph-database-vultr';
import { Logger } from './logger';

// ===== API Response Types =====
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    limit: number;
    offset: number;
    total?: number;
  };
}

export interface PaginatedResults<T = any> {
  results: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ===== Error Types =====
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

// ===== Search Types =====
export interface SearchOptions {
  limit?: number;
  offset?: number;
  filter?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  id?: string | number;
  title?: string;
  score?: number;
  type?: string;
  content?: string;
  metadata?: Record<string, any>;
  documentSearchResponse?: {
    results: SearchResultDocument[];
  };
}

export interface SearchResultDocument {
  chunkSignature: string;
  relevance: number;
  text?: string;
  source?: string | { object: string };
}

// ===== Memory Types =====
export interface MemoryDocument {
  id: string;
  content: string;
  user_id: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  extracted?: ExtractedData;
  chunkSignature?: string;
}

export interface ExtractedData {
  entities: Entity[];
  relationships: Relationship[];
}

export interface Entity {
  id: string;
  type: string;
  content: string;
  properties?: Record<string, unknown>;
}

export interface Relationship {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

// ===== SmartMemory Interface =====
export interface SmartMemory {
  put(key: string, value: string, options?: Record<string, unknown>): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  searchSemanticMemory(query: string): Promise<SearchResult>;
  putSemanticMemory(data: Record<string, unknown>): Promise<void>;
  deleteSemanticMemory(key: string): Promise<void>;
}

// ===== KV Store Interface =====
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { ttl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// ===== AI Gateway Types =====
export interface AIGateway {
  chat(params: ChatParams): Promise<ChatResponse>;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ===== Graph Types =====
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  user_id: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ===== Request/Response Types =====
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

// ===== Environment Types =====
export interface ServiceEnv {
  GRAPH_DATABASE: Kysely<Database>;
  AGENT_MEMORY: SmartMemory;
  SESSION_CACHE?: KVStore;
  QUERY_CACHE?: KVStore;
  logger?: Logger;
  AI_GATEWAY: AIGateway;
}

export interface Environment {
  DATABASE: any | null;
  logger: {
    debug(message: string, fields?: Record<string, any>): void;
    info(message: string, fields?: Record<string, any>): void;
    warn(message: string, fields?: Record<string, any>): void;
    error(message: string, fields?: Record<string, any>): void;
  };
}
