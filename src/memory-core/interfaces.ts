// Core memory node representing entities, concepts, or relationships in the knowledge graph
export interface MemoryNode {
  id: string;
  type: MemoryNodeType;
  content: string;
  metadata: MetadataObject;
  weight: number; // Range: [0,1] representing node importance
  created_at: string;
  updated_at: string;
}

// Valid memory node types for semantic classification
export type MemoryNodeType = 'entity' | 'concept' | 'relationship';

// Type-safe metadata object with depth validation
export type MetadataObject = Record<string, MetadataValue>;
type MetadataValue = string | number | boolean | null | MetadataObject | MetadataValue[];

// Weighted edge connecting memory nodes with relationship semantics
export interface MemoryEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: RelationshipType;
  weight: number; // Range: [0,1] representing relationship strength
  metadata: MetadataObject;
  created_at: string;
}

// Valid relationship types for edge classification
export type RelationshipType = 
  | 'related_to'
  | 'part_of'
  | 'friend'
  | 'colleague'
  | 'family'
  | 'mutual_friend'
  | 'self_reference';

// Graph traversal query with filtering and depth control
export interface GraphQuery {
  node_ids?: string[]; // Starting nodes for traversal
  relationship_types?: RelationshipType[]; // Filter by edge types
  max_depth?: number; // Maximum traversal depth (default: 3, max: 50)
  min_weight?: number; // Minimum edge weight threshold [0,1]
  filters?: GraphFilters; // Additional node/edge filters
}

// Structured filters for graph queries
export interface GraphFilters {
  node_type?: MemoryNodeType;
  metadata?: Partial<MetadataObject>;
  created_after?: string; // ISO timestamp
  created_before?: string; // ISO timestamp
}

export interface GraphTraversalResult {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  path_count: number;
  max_depth_reached: number;
}

// Request payload for memory node creation
export interface MemoryIngestRequest {
  content: string; // Non-empty node content
  type: MemoryNodeType;
  metadata?: MetadataObject;
  relationships?: RelationshipSpec[]; // Optional relationships to create
}

// Specification for creating relationships during ingestion
export interface RelationshipSpec {
  target_id: string;
  relationship_type: RelationshipType;
  weight?: number; // Optional weight [0,1], defaults to 1.0
}

export interface MemoryIngestResponse {
  node_id: string;
  success: boolean;
  relationships_created: number;
}

// Raindrop environment with typed bindings
export interface Environment {
  GRAPH_DATABASE: DatabaseBinding; // SmartSQL database connection
  logger: Logger; // Structured logging interface
}

// Database connection interface for graph operations
export interface DatabaseBinding {
  prepare(query: string): PreparedStatement;
  exec(query: string): DatabaseResult;
  batch(statements: PreparedStatement[]): Promise<DatabaseResult[]>;
}

// Prepared SQL statement interface
export interface PreparedStatement {
  bind(...params: any[]): PreparedStatement;
  run(): DatabaseResult;
  first(): any;
  all(): any[];
}

// Database operation result
export interface DatabaseResult {
  success: boolean;
  meta?: {
    changes: number;
    last_row_id: number;
    duration: number;
  };
  results?: any[];
}

// Structured logger interface
export interface Logger {
  debug(message: string, fields?: Record<string, any>): void;
  info(message: string, fields?: Record<string, any>): void;
  warn(message: string, fields?: Record<string, any>): void;
  error(message: string, fields?: Record<string, any>): void;
}