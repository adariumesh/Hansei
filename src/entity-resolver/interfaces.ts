// Basic request/response interfaces
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

export interface Environment {
  DATABASE: any;
  logger: {
    debug(message: string, fields?: Record<string, any>): void;
    info(message: string, fields?: Record<string, any>): void;
    warn(message: string, fields?: Record<string, any>): void;
    error(message: string, fields?: Record<string, any>): void;
  };
}

// Entity-specific interfaces
export interface Entity {
  id?: string;
  name: string;
  type: EntityType;
  confidence: number;
  metadata?: Record<string, any>;
  aliases?: string[];
  normalized_name?: string;
  resolved?: boolean;
  resolved_at?: string;
}

export type EntityType = 
  | 'person' 
  | 'organization' 
  | 'location' 
  | 'event' 
  | 'product' 
  | 'concept' 
  | 'unknown';

export interface EntityMatch {
  source_entity: Entity;
  target_entity: Entity;
  similarity_score: number;
  match_type: MatchType;
  confidence: number;
  reasons: MatchReason[];
}

export type MatchType = 
  | 'exact' 
  | 'fuzzy' 
  | 'phonetic' 
  | 'semantic' 
  | 'partial' 
  | 'alias';

export interface MatchReason {
  type: 'name_similarity' | 'type_match' | 'alias_match' | 'semantic_similarity';
  score: number;
  description: string;
}

export interface ResolutionResult {
  resolved_entities: Entity[];
  merge_operations: MergeOperation[];
  conflicts: ResolutionConflict[];
  statistics: ResolutionStatistics;
}

export interface MergeOperation {
  primary_entity: Entity;
  merged_entities: Entity[];
  confidence: number;
  strategy: MergeStrategy;
}

export type MergeStrategy = 
  | 'highest_confidence' 
  | 'most_recent' 
  | 'composite' 
  | 'manual_review';

export interface ResolutionConflict {
  entities: Entity[];
  conflict_type: ConflictType;
  description: string;
  resolution_strategy: ConflictResolutionStrategy;
}

export type ConflictType = 
  | 'ambiguous_match' 
  | 'type_mismatch' 
  | 'conflicting_metadata' 
  | 'low_confidence';

export type ConflictResolutionStrategy = 
  | 'prefer_higher_confidence' 
  | 'manual_review' 
  | 'keep_separate' 
  | 'merge_with_warning';

export interface ResolutionStatistics {
  total_entities: number;
  resolved_entities: number;
  merged_entities: number;
  conflicts_found: number;
  processing_time_ms: number;
  confidence_distribution: ConfidenceDistribution;
}

export interface ConfidenceDistribution {
  high: number; // >= 0.8
  medium: number; // 0.5 - 0.79
  low: number; // < 0.5
}

export interface EntityResolutionRequest {
  entities: Entity[];
  options?: EntityResolutionOptions;
}

export interface EntityResolutionOptions {
  similarity_threshold?: number;
  confidence_threshold?: number;
  max_merge_candidates?: number;
  enable_phonetic_matching?: boolean;
  enable_semantic_matching?: boolean;
  merge_strategy?: MergeStrategy;
  conflict_resolution?: ConflictResolutionStrategy;
}
