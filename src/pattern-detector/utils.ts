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
      request.analysisType || 'general',
      request.options || {}
    );
    
    // Add graph analysis if requested
    if (request.analysisType === 'orphan_nodes' as any || request.analysisType === 'hub_nodes' as any) {
      const graphAnalysis = await performGraphAnalysis(
        env,
        request.input,
        request.analysisType,
        request.options || {}
      );
      Object.assign(detectionResult, graphAnalysis);
    }
    
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

// Real graph analysis functions
async function performGraphAnalysis(
  env: PatternDetectorEnvironment,
  input: string,
  analysisType: string,
  options: Record<string, any>
): Promise<DetectionResult> {
  const startTime = Date.now();
  
  try {
    // Mock graph data structure for analysis
    const graphData = await buildGraphFromInput(input, options);
    
    if (analysisType === 'orphan_nodes') {
      return await detectOrphanNodes(graphData, options);
    } else if (analysisType === 'hub_nodes') {
      return await detectHubNodes(graphData, options);
    }
    
    return {
      patterns: [],
      count: 0,
      analysisMetrics: {
        totalAnalyzed: 0,
        processingTimeMs: Date.now() - startTime,
        algorithmUsed: analysisType,
        confidenceDistribution: { high: 0, medium: 0, low: 0 }
      }
    };
  } catch (error) {
    env.logger.error('Graph analysis failed', { error });
    throw error;
  }
}

async function buildGraphFromInput(input: string, options: Record<string, any>): Promise<GraphData> {
  // Parse input as graph data or build from entities
  const entities = extractEntitiesFromText(input);
  const nodes = new Map();
  const edges = new Map();
  
  // Create nodes for each entity
  entities.forEach((entity, index) => {
    nodes.set(`node_${index}`, {
      id: `node_${index}`,
      type: entity.type,
      label: entity.value,
      connections: []
    });
  });
  
  // Create edges based on co-occurrence
  const nodeArray = Array.from(nodes.values());
  for (let i = 0; i < nodeArray.length; i++) {
    for (let j = i + 1; j < nodeArray.length; j++) {
      const edgeId = `edge_${i}_${j}`;
      edges.set(edgeId, {
        id: edgeId,
        source: nodeArray[i].id,
        target: nodeArray[j].id,
        weight: calculateRelationshipWeight(nodeArray[i], nodeArray[j])
      });
      
      // Update connection counts
      nodeArray[i].connections.push(nodeArray[j].id);
      nodeArray[j].connections.push(nodeArray[i].id);
    }
  }
  
  return { nodes, edges };
}

async function detectOrphanNodes(graphData: GraphData, options: Record<string, any>): Promise<DetectionResult> {
  const threshold = options.threshold || 2;
  const orphans = [];
  
  for (const node of graphData.nodes.values()) {
    if (node.connections.length <= threshold) {
      orphans.push({
        id: node.id,
        label: node.label,
        type: node.type,
        connectionCount: node.connections.length,
        confidence: 1.0 - (node.connections.length / threshold)
      });
    }
  }
  
  return {
    patterns: orphans.map(orphan => ({
      type: 'orphan_node',
      value: orphan.label,
      confidence: orphan.confidence,
      description: `Orphaned ${orphan.type}: ${orphan.label} (${orphan.connectionCount} connections)`,
      location: { start: 0, end: 0 },
      metadata: {
        nodeId: orphan.id,
        connectionCount: orphan.connectionCount
      }
    })),
    count: orphans.length,
    analysisMetrics: {
      totalAnalyzed: graphData.nodes.size,
      processingTimeMs: 0,
      algorithmUsed: 'orphan_detection',
      confidenceDistribution: { high: 0, medium: 0, low: 0 }
    }
  };
}

async function detectHubNodes(graphData: GraphData, options: Record<string, any>): Promise<DetectionResult> {
  const minConnections = options.min_connections || 5;
  const hubs = [];
  
  for (const node of graphData.nodes.values()) {
    if (node.connections.length >= minConnections) {
      hubs.push({
        id: node.id,
        label: node.label,
        type: node.type,
        connectionCount: node.connections.length,
        centrality: node.connections.length / graphData.nodes.size
      });
    }
  }
  
  // Sort by connection count
  hubs.sort((a, b) => b.connectionCount - a.connectionCount);
  
  return {
    patterns: hubs.map(hub => ({
      type: 'hub_node',
      value: hub.label,
      confidence: Math.min(1.0, hub.connectionCount / (graphData.nodes.size * 0.8)),
      description: `Hub ${hub.type}: ${hub.label} (${hub.connectionCount} connections)`,
      location: { start: 0, end: 0 },
      metadata: {
        nodeId: hub.id,
        connectionCount: hub.connectionCount,
        centrality: hub.centrality
      }
    })),
    count: hubs.length,
    analysisMetrics: {
      totalAnalyzed: graphData.nodes.size,
      processingTimeMs: 0,
      algorithmUsed: 'hub_identification',
      confidenceDistribution: { high: 0, medium: 0, low: 0 }
    }
  };
}

function extractEntitiesFromText(text: string): Array<{type: string, value: string}> {
  const entities = [];
  
  // Extract various entity types
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex) || [];
  emails.forEach(email => entities.push({ type: 'email', value: email }));
  
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  const phones = text.match(phoneRegex) || [];
  phones.forEach(phone => entities.push({ type: 'phone', value: phone }));
  
  const nameRegex = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
  const names = text.match(nameRegex) || [];
  names.forEach(name => entities.push({ type: 'person', value: name }));
  
  const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
  const dates = text.match(dateRegex) || [];
  dates.forEach(date => entities.push({ type: 'date', value: date }));
  
  // Extract keywords (simple approach)
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const wordCounts: Record<string, number> = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  // Add frequent words as keywords
  Object.entries(wordCounts)
    .filter(([word, count]) => count >= 2)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([word]) => {
      entities.push({ type: 'keyword', value: word });
    });
  
  return entities;
}

function calculateRelationshipWeight(node1: any, node2: any): number {
  // Simple relationship weight calculation
  // In reality, this would use more sophisticated methods
  let weight = 0.1; // base weight
  
  // Same type entities have higher weight
  if (node1.type === node2.type) {
    weight += 0.3;
  }
  
  // Text similarity (simple approach)
  const similarity = calculateTextSimilarity(node1.label, node2.label);
  weight += similarity * 0.6;
  
  return Math.min(1.0, weight);
}

function calculateTextSimilarity(text1: string, text2: string): number {
  // Simple Jaccard similarity
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

interface GraphData {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
}

interface GraphNode {
  id: string;
  type: string;
  label: string;
  connections: string[];
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
}