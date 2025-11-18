import { 
  PatternDetectionRequest, 
  PatternDetectionResponse, 
  PatternDetectorEnvironment,
  DetectedPattern,
  AnalysisMetrics,
  PatternLocation,
  DetectionResult
} from './interfaces.js';
import { extractAllPatterns, calculateConfidence, COMMON_PATTERNS } from '../shared/patterns.js';
import { 
  validateRequiredString, 
  validateObject, 
  validateInputLength,
  combineValidationResults,
  ValidationResult
} from '../shared/validation.js';

/**
 * Main processing function for pattern detection requests
 * Uses functional programming patterns and improved error handling
 */
export async function processRequest(
  env: PatternDetectorEnvironment,
  request: PatternDetectionRequest
): Promise<PatternDetectionResponse> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Validate input first
  const validation = await validatePatternDetectionRequest(request);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  try {
    env.logger.info('Processing pattern detection request', { 
      id: requestId, 
      inputLength: request.input.length,
      analysisType: request.analysisType 
    });

    // Process patterns based on analysis type
    const detectionResult = await detectPatternsForAnalysisType(
      request.input, 
      request.analysisType,
      request.options || {}
    );
    
    const processingTime = Date.now() - startTime;
    
    // Include metrics if requested
    if (request.options?.includeMetrics) {
      detectionResult.analysisMetrics = createAnalysisMetrics(
        detectionResult.patterns,
        processingTime,
        request.options.algorithm || 'default'
      );
    }
    
    return {
      id: requestId,
      status: 'success',
      result: detectionResult,
      processing_time_ms: processingTime,
      metadata: {
        algorithm: request.options?.algorithm || 'default',
        inputLength: request.input.length,
        analysisType: request.analysisType,
        ...request.metadata
      },
      created_at: new Date().toISOString()
    };
  } catch (error) {
    env.logger.error('Error processing pattern detection request', { 
      id: requestId, 
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Validates a pattern detection request using shared validation utilities
 */
export async function validateRequest(
  request: PatternDetectionRequest
): Promise<boolean> {
  const validation = await validatePatternDetectionRequest(request);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  return true;
}

/**
 * Optimizes processing request with functional approach
 */
export async function optimizeProcessing(
  env: PatternDetectorEnvironment,
  request: PatternDetectionRequest
): Promise<PatternDetectionRequest> {
  // Validate request first
  await validateRequest(request);

  env.logger.debug('Optimizing processing request', { 
    inputLength: request.input.length,
    analysisType: request.analysisType 
  });

  // Return optimized version using functional approach
  return optimizeRequest(request);
}

// === PURE FUNCTIONS ===

/**
 * Validates pattern detection request structure
 */
function validatePatternDetectionRequest(
  request: PatternDetectionRequest
): Promise<ValidationResult> {
  return Promise.resolve(combineValidationResults([
    validateObject(request, 'request'),
    validateRequiredString(request.input, 'input'),
    validateInputLength(request.input),
    validateAnalysisType(request.analysisType),
    validateObject(request.options, 'options', false),
    validateObject(request.metadata, 'metadata', false)
  ]));
}

/**
 * Validates analysis type
 */
function validateAnalysisType(analysisType: string): ValidationResult {
  const validTypes = ['orphan_detection', 'cycle_analysis', 'hub_identification', 'anomaly_detection', 'trend_analysis', 'text_patterns'];
  
  if (!validTypes.includes(analysisType)) {
    return {
      isValid: false,
      errors: [`Invalid analysis type: ${analysisType}. Must be one of: ${validTypes.join(', ')}`],
      warnings: []
    };
  }
  
  return {
    isValid: true,
    errors: [],
    warnings: []
  };
}

/**
 * Optimizes request using pure functional approach
 */
function optimizeRequest(request: PatternDetectionRequest): PatternDetectionRequest {
  return {
    ...request,
    input: request.input.trim(),
    options: {
      sensitivity: 'medium',
      ...request.options,
      algorithm: request.options?.algorithm || 'regex',
      maxResults: request.options?.maxResults || 100
    },
    metadata: {
      ...request.metadata,
      optimizedAt: new Date().toISOString()
    }
  };
}

/**
 * Detects patterns based on analysis type
 */
async function detectPatternsForAnalysisType(
  input: string, 
  analysisType: string, 
  options: any
): Promise<DetectionResult> {
  switch (analysisType) {
    case 'text_patterns':
      return detectTextPatterns(input, options);
    case 'orphan_detection':
      return detectOrphanPatterns(input, options);
    case 'cycle_analysis':
      return detectCyclePatterns(input, options);
    case 'hub_identification':
      return detectHubPatterns(input, options);
    case 'anomaly_detection':
      return detectAnomalyPatterns(input, options);
    case 'trend_analysis':
      return detectTrendPatterns(input, options);
    default:
      throw new Error(`Unsupported analysis type: ${analysisType}`);
  }
}

/**
 * Detects text patterns using shared pattern utilities
 */
function detectTextPatterns(input: string, options: any): DetectionResult {
  const extractedPatterns = extractAllPatterns(input);
  const patterns: DetectedPattern[] = extractedPatterns.map(p => ({
    type: p.pattern,
    value: p.value,
    confidence: calculateConfidence(p.value, COMMON_PATTERNS.find(cp => cp.name === p.pattern)!),
    location: findPatternLocation(input, p.value),
    metadata: { category: p.type }
  }));

  // Apply max results limit
  const maxResults = options.maxResults || 100;
  const limitedPatterns = patterns.slice(0, maxResults);

  return {
    patterns: limitedPatterns,
    count: limitedPatterns.length
  };
}

/**
 * Placeholder for orphan pattern detection (future enhancement)
 */
function detectOrphanPatterns(input: string, options: any): DetectionResult {
  // TODO: Implement graph-based orphan node detection
  return { patterns: [], count: 0 };
}

/**
 * Placeholder for cycle pattern detection (future enhancement)
 */
function detectCyclePatterns(input: string, options: any): DetectionResult {
  // TODO: Implement cycle analysis
  return { patterns: [], count: 0 };
}

/**
 * Placeholder for hub pattern detection (future enhancement)
 */
function detectHubPatterns(input: string, options: any): DetectionResult {
  // TODO: Implement hub identification
  return { patterns: [], count: 0 };
}

/**
 * Placeholder for anomaly pattern detection (future enhancement)
 */
function detectAnomalyPatterns(input: string, options: any): DetectionResult {
  // TODO: Implement anomaly detection
  return { patterns: [], count: 0 };
}

/**
 * Placeholder for trend pattern detection (future enhancement)
 */
function detectTrendPatterns(input: string, options: any): DetectionResult {
  // TODO: Implement trend analysis
  return { patterns: [], count: 0 };
}

/**
 * Finds pattern location in input text
 */
function findPatternLocation(input: string, pattern: string): PatternLocation | undefined {
  const index = input.indexOf(pattern);
  if (index === -1) return undefined;
  
  return {
    start: index,
    end: index + pattern.length
  };
}

/**
 * Creates analysis metrics for the detection result
 */
function createAnalysisMetrics(
  patterns: DetectedPattern[], 
  processingTimeMs: number, 
  algorithm: string
): AnalysisMetrics {
  const confidenceDistribution = patterns.reduce(
    (acc, pattern) => {
      if (pattern.confidence >= 0.8) acc.high++;
      else if (pattern.confidence >= 0.5) acc.medium++;
      else acc.low++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  return {
    totalAnalyzed: patterns.length,
    processingTimeMs,
    algorithmUsed: algorithm,
    confidenceDistribution
  };
}

/**
 * Generates unique request ID
 */
function generateRequestId(): string {
  return `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Legacy exports for backwards compatibility
export { validatePatternDetectionRequest as validateRequestStructure };
