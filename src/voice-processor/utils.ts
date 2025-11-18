import { 
  ComponentRequest, 
  ComponentResponse, 
  Environment,
  AudioInput,
  VoiceProcessingRequest,
  VoiceProcessingResponse,
  TranscriptOutput,
  AudioFormat,
  ProcessingQuality,
  CompressionMode
} from './interfaces.js';

// =============================================================================
// Constants and Configuration
// =============================================================================

const SUPPORTED_FORMATS: readonly AudioFormat[] = ['wav', 'mp3', 'ogg', 'flac'] as const;
const DEFAULT_QUALITY: ProcessingQuality = 'balanced';
const DEFAULT_COMPRESSION: CompressionMode = 'auto';
const DEFAULT_FORMAT: AudioFormat = 'wav';

// Quality to processing parameter mapping
const QUALITY_SETTINGS = {
  low: { sampleRate: 16000, bitRate: 64 },
  balanced: { sampleRate: 22050, bitRate: 128 },
  high: { sampleRate: 44100, bitRate: 192 },
  max: { sampleRate: 48000, bitRate: 320 }
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique processing ID
 */
const generateProcessingId = (): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  return `voice-${timestamp}-${randomSuffix}`;
};

/**
 * Checks if input is a legacy string format
 */
const isLegacyStringInput = (input: AudioInput | string): input is string => {
  return typeof input === 'string';
};

/**
 * Normalizes input to AudioInput format
 */
const normalizeAudioInput = (input: AudioInput | string): AudioInput => {
  if (isLegacyStringInput(input)) {
    return {
      data: input,
      format: 'wav' as AudioFormat,
      duration: input.length // Rough estimate for legacy support
    };
  }
  return input;
};

/**
 * Validates audio format
 */
const isValidAudioFormat = (format: string): format is AudioFormat => {
  return SUPPORTED_FORMATS.includes(format as AudioFormat);
};

/**
 * Validates processing quality setting
 */
const isValidQuality = (quality: string): quality is ProcessingQuality => {
  return quality in QUALITY_SETTINGS;
};

/**
 * Sanitizes and cleans transcript text
 */
const cleanTranscript = (rawText: string): string => {
  return rawText
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s.,!?;:()\-'"]/g, '') // Remove special characters
    .substring(0, 10000); // Limit length for safety
};

/**
 * Calculates confidence score based on input quality
 */
const calculateConfidenceScore = (audioInput: AudioInput): number => {
  // Mock confidence calculation based on audio properties
  let confidence = 0.8; // Base confidence
  
  if (audioInput.sampleRate && audioInput.sampleRate >= 22050) {
    confidence += 0.1;
  }
  
  if (audioInput.duration && audioInput.duration > 1 && audioInput.duration < 300) {
    confidence += 0.05; // Good duration range
  }
  
  return Math.min(confidence, 0.99); // Cap at 99%
};

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates voice processing request with detailed error messages
 */
export const validateRequest = async (request: ComponentRequest): Promise<boolean> => {
  // Null/undefined check
  if (!request) {
    throw new Error('Request is required');
  }
  
  // Input validation
  if (!request.input) {
    throw new Error('Input is required');
  }
  
  const audioInput = normalizeAudioInput(request.input);
  
  // Validate audio data
  if (!audioInput.data || typeof audioInput.data !== 'string') {
    throw new Error('Valid audio data is required');
  }
  
  if (audioInput.data.trim().length === 0) {
    throw new Error('Audio data cannot be empty');
  }
  
  // Validate format
  if (!isValidAudioFormat(audioInput.format)) {
    throw new Error(`Unsupported audio format: ${audioInput.format}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
  }
  
  // Validate options if provided
  if (request.options) {
    if (typeof request.options !== 'object') {
      throw new Error('Options must be an object');
    }
    
    const { format, quality, compression } = request.options;
    
    if (format && !isValidAudioFormat(format)) {
      throw new Error(`Unsupported format in options: ${format}`);
    }
    
    if (quality && !isValidQuality(quality)) {
      throw new Error(`Invalid quality setting: ${quality}. Valid options: ${Object.keys(QUALITY_SETTINGS).join(', ')}`);
    }
    
    if (compression && !['auto', 'none', 'light', 'aggressive'].includes(compression)) {
      throw new Error(`Invalid compression mode: ${compression}`);
    }
  }
  
  return true;
};

// =============================================================================
// Processing Functions
// =============================================================================

/**
 * Optimizes processing parameters based on input and options
 */
export const optimizeProcessing = async (
  env: Environment,
  request: ComponentRequest
): Promise<ComponentRequest> => {
  env.logger.debug('Optimizing voice processing request', { 
    hasInput: !!request.input,
    inputType: typeof request.input
  });
  
  const audioInput = normalizeAudioInput(request.input);
  const quality = request.options?.quality || DEFAULT_QUALITY;
  const qualitySettings = QUALITY_SETTINGS[quality];
  
  const optimizedRequest: ComponentRequest = {
    ...request,
    input: audioInput,
    options: {
      ...request.options,
      compression: request.options?.compression ?? DEFAULT_COMPRESSION,
      quality,
      format: request.options?.format ?? DEFAULT_FORMAT,
      // Add optimized settings
      noiseReduction: request.options?.noiseReduction ?? true,
      enableConfidenceScore: request.options?.enableConfidenceScore ?? true,
      // Apply quality-based optimizations
      targetSampleRate: qualitySettings.sampleRate,
      targetBitRate: qualitySettings.bitRate
    },
    metadata: {
      ...request.metadata,
      optimized: true,
      optimizedAt: new Date().toISOString(),
      qualitySettings
    }
  };
  
  return optimizedRequest;
};

/**
 * Simulates voice transcription processing
 * In production, this would integrate with Whisper or other transcription services
 */
const performTranscription = async (
  audioInput: AudioInput,
  options: any = {}
): Promise<TranscriptOutput> => {
  const startTime = Date.now();
  
  // Simulate processing delay based on audio duration
  const processingDelay = Math.min((audioInput.duration || 1) * 100, 1000);
  await new Promise(resolve => setTimeout(resolve, processingDelay));
  
  // Generate mock transcription
  const baseText = isLegacyStringInput(audioInput.data) 
    ? audioInput.data 
    : `Transcribed audio content: ${audioInput.format} format`;
    
  const cleanedText = cleanTranscript(baseText);
  const confidence = options.enableConfidenceScore ? calculateConfidenceScore(audioInput) : undefined;
  
  const processingTimeMs = Date.now() - startTime;
  
  return {
    text: cleanedText,
    confidence,
    language: options.language || 'en',
    processingTimeMs,
    // Mock word-level timestamps
    words: cleanedText.split(' ').map((word, index) => ({
      word,
      start: index * 0.5,
      end: (index + 1) * 0.5,
      confidence: confidence ? confidence * (0.95 + Math.random() * 0.05) : undefined
    }))
  };
};

/**
 * Main processing function for voice requests
 */
export const processRequest = async (
  env: Environment,
  request: ComponentRequest
): Promise<ComponentResponse> => {
  const startTime = Date.now();
  
  try {
    // Validate request first
    await validateRequest(request);
    
    const audioInput = normalizeAudioInput(request.input);
    
    env.logger.info('Processing voice request', { 
      audioFormat: audioInput.format,
      duration: audioInput.duration,
      options: request.options 
    });
    
    // Perform transcription
    const transcriptOutput = await performTranscription(audioInput, request.options);
    
    const totalProcessingTime = Date.now() - startTime;
    
    const response: ComponentResponse = {
      id: generateProcessingId(),
      status: 'success',
      result: transcriptOutput,
      processing_time_ms: totalProcessingTime,
      metadata: {
        component: 'voice-processor',
        version: '1.0.0',
        audioFormat: audioInput.format,
        qualityUsed: request.options?.quality || DEFAULT_QUALITY,
        compressionUsed: request.options?.compression || DEFAULT_COMPRESSION,
        ...request.metadata
      },
      created_at: new Date().toISOString()
    };
    
    env.logger.info('Voice processing completed', {
      processingId: response.id,
      processingTimeMs: totalProcessingTime,
      textLength: transcriptOutput.text.length,
      confidence: transcriptOutput.confidence
    });
    
    return response;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    env.logger.error('Voice processing failed', { 
      error: errorMessage,
      processingTimeMs: processingTime
    });
    
    // Return failed response instead of throwing
    return {
      id: generateProcessingId(),
      status: 'failed',
      result: { error: errorMessage },
      processing_time_ms: processingTime,
      metadata: {
        component: 'voice-processor',
        version: '1.0.0',
        error: errorMessage,
        ...request.metadata
      },
      created_at: new Date().toISOString()
    };
  }
};
