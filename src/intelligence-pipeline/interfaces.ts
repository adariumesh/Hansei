export interface ProcessingResult {
  id: string;
  status: 'success' | 'failed' | 'pending';
  extracted_entities: ExtractedEntity[];
  sentiment_score: number;
  confidence: number;
  processing_time_ms: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ExtractedEntity {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'location' | 'concept' | 'event';
  confidence: number;
  mentions: EntityMention[];
  relationships: EntityRelationship[];
  metadata: Record<string, any>;
}

export interface EntityMention {
  text: string;
  start_position: number;
  end_position: number;
  context: string;
  confidence: number;
}

export interface EntityRelationship {
  target_entity_id: string;
  relationship_type: string;
  confidence: number;
  evidence: string[];
}

export interface ExtractionRequest {
  content: string;
  content_type: 'text' | 'audio' | 'transcript';
  source_id?: string;
  processing_options?: ProcessingOptions;
  metadata?: Record<string, any>;
}

export interface ProcessingOptions {
  extract_entities?: boolean;
  analyze_sentiment?: boolean;
  detect_patterns?: boolean;
  generate_insights?: boolean;
  language?: string;
  model_config?: ModelConfig;
}

export interface ModelConfig {
  model_name: string;
  temperature: number;
  max_tokens: number;
  custom_prompts?: Record<string, string>;
}

export interface TranscriptionRequest {
  audio_data: ArrayBuffer;
  audio_format: 'wav' | 'mp3' | 'flac' | 'ogg';
  language?: string;
  quality?: 'fast' | 'balanced' | 'high';
  metadata?: Record<string, any>;
}

export interface TranscriptionResult {
  id: string;
  transcript: string;
  confidence: number;
  segments: TranscriptSegment[];
  language_detected: string;
  processing_time_ms: number;
  metadata: Record<string, any>;
}

export interface TranscriptSegment {
  text: string;
  start_time: number;
  end_time: number;
  confidence: number;
  speaker_id?: string;
}

export interface BatchProcessingRequest {
  items: ExtractionRequest[];
  batch_options: BatchOptions;
}

export interface BatchOptions {
  parallel_processing: boolean;
  max_concurrency: number;
  priority: 'low' | 'normal' | 'high';
  callback_url?: string;
}

export interface BatchProcessingResult {
  batch_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  total_items: number;
  processed_items: number;
  failed_items: number;
  results: ProcessingResult[];
  started_at: string;
  completed_at?: string;
}

export interface InsightGeneration {
  id: string;
  type: 'trend' | 'anomaly' | 'pattern' | 'summary' | 'prediction';
  title: string;
  description: string;
  confidence: number;
  supporting_evidence: string[];
  related_entities: string[];
  timestamp: string;
  metadata: Record<string, any>;
}

export interface Environment {
  AI_MODEL: any;
  WHISPER_API: any;
  ENTITY_RESOLVER: {
    resolveEntities(entities: ExtractedEntity[]): Promise<ExtractedEntity[]>;
  };
  MEMORY_CORE: {
    storeMemory(data: any): Promise<any>;
  };
  PATTERN_DETECTOR: {
    detectPatterns(data: any): Promise<any>;
  };
  logger: {
    debug(message: string, fields?: Record<string, any>): void;
    info(message: string, fields?: Record<string, any>): void;
    warn(message: string, fields?: Record<string, any>): void;
    error(message: string, fields?: Record<string, any>): void;
  };
}