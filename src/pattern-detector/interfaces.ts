/**
 * Pattern detector specific interfaces
 */
import { ComponentRequest as BaseComponentRequest } from '../shared/types.js';

export interface ComponentRequest extends BaseComponentRequest {
  // Add any pattern-detector specific request properties here
}

export interface Pattern {
    type: string;
    description: string;
    confidence: number;
    evidence: string[];
}

export interface PatternDetectionResult {
    patterns: Pattern[];
    input_length: number;
    processing_time_ms: number;
}
