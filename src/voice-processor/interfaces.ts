/**
 * Audio input formats supported by the voice processor
 */
export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'flac';

/**
 * Processing status for voice operations
 */
export type ProcessingStatus = 'success' | 'failed' | 'pending';

/**
 * Quality settings for voice processing
 */
export type ProcessingQuality = 'low' | 'balanced' | 'high' | 'max';

/**
 * Compression settings for audio processing
 */
export type CompressionMode = 'auto' | 'none' | 'light' | 'aggressive';

/**
 * Audio input data with metadata
 */
export interface AudioInput {
  /** Audio data as base64 string or file path */
  data: string;
  /** Format of the audio file */
  format: AudioFormat;
  /** Duration in seconds if known */
  duration?: number;
  /** Sample rate in Hz */
  sampleRate?: number;
  /** Number of audio channels */
  channels?: number;
  /** File size in bytes */
  size?: number;
}

/**
 * Processing options for voice operations
 */
export interface VoiceProcessingOptions {
  /** Target audio format */
  format?: AudioFormat;
  /** Quality setting for processing */
  quality?: ProcessingQuality;
  /** Compression mode */
  compression?: CompressionMode;
  /** Enable noise reduction */
  noiseReduction?: boolean;
  /** Language hint for transcription */
  language?: string;
  /** Enable confidence scoring */
  enableConfidenceScore?: boolean;
}

/**
 * Transcript output with confidence and metadata
 */
export interface TranscriptOutput {
  /** Transcribed text content */
  text: string;
  /** Confidence score 0-1 */
  confidence?: number;
  /** Detected language */
  language?: string;
  /** Word-level timestamps */
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
  /** Processing duration */
  processingTimeMs: number;
}

/**
 * Voice processing request
 */
export interface VoiceProcessingRequest {
  /** Audio input data */
  input: AudioInput | string; // Support legacy string input
  /** Processing options */
  options?: VoiceProcessingOptions;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Voice processing response
 */
export interface VoiceProcessingResponse {
  /** Unique processing ID */
  id: string;
  /** Processing status */
  status: ProcessingStatus;
  /** Transcription result */
  result: TranscriptOutput | any; // any for backward compatibility
  /** Total processing time */
  processing_time_ms: number;
  /** Response metadata */
  metadata: Record<string, any>;
  /** Creation timestamp */
  created_at: string;
}

/**
 * Legacy interfaces for backward compatibility
 */
export interface ComponentRequest extends VoiceProcessingRequest {}
export interface ComponentResponse extends VoiceProcessingResponse {}

/**
 * Environment configuration for the voice processor
 */
export interface Environment {
  /** Database connection */
  DATABASE: any;
  /** Logger instance */
  logger: {
    debug(message: string, fields?: Record<string, any>): void;
    info(message: string, fields?: Record<string, any>): void;
    warn(message: string, fields?: Record<string, any>): void;
    error(message: string, fields?: Record<string, any>): void;
  };
}
