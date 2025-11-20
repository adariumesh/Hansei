// Core pattern detection interfaces aligned with architecture requirements
export interface PatternDetectionRequest {
  input: string;
  analysisType: 'orphan_detection' | 'cycle_analysis' | 'hub_identification' | 'anomaly_detection' | 'trend_analysis' | 'text_patterns';
  options?: PatternDetectionOptions;
  metadata?: Record<string, any>;
}

export interface PatternDetectionOptions {
  algorithm?: 'regex' | 'graph_analysis' | 'statistical' | 'default';
  sensitivity?: 'low' | 'medium' | 'high';
  includeMetrics?: boolean;
  maxResults?: number;
}

export interface PatternDetectionResponse {
  id: string;
  status: 'success' | 'failed' | 'pending';
  result: DetectionResult;
  processing_time_ms: number;
  metadata: ResponseMetadata;
  created_at: string;
}

export interface DetectionResult {
  patterns: DetectedPattern[];
  count: number;
  analysisMetrics?: AnalysisMetrics;
}

export interface DetectedPattern {
  type: string;
  value: string;
  confidence: number;
  location?: PatternLocation;
  metadata?: Record<string, any>;
}

export interface PatternLocation {
  start: number;
  end: number;
  line?: number;
  column?: number;
}

export interface AnalysisMetrics {
  totalAnalyzed: number;
  processingTimeMs: number;
  algorithmUsed: string;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface ResponseMetadata {
  algorithm: string;
  inputLength: number;
  analysisType: string;
  optimized?: boolean;
  optimizedAt?: string;
  [key: string]: any;
}

// Environment interface for dependency injection
export interface PatternDetectorEnvironment {
  DATABASE: any;
  logger: Logger;
}

export interface Logger {
  debug(message: string, fields?: Record<string, any>): void;
  info(message: string, fields?: Record<string, any>): void;
  warn(message: string, fields?: Record<string, any>): void;
  error(message: string, fields?: Record<string, any>): void;
}

// Legacy interfaces for backwards compatibility
export type ComponentRequest = PatternDetectionRequest;
export type ComponentResponse = PatternDetectionResponse;
export type Environment = PatternDetectorEnvironment;
