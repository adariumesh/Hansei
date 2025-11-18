import { 
  ComponentRequest, 
  ComponentResponse, 
  Environment,
  Entity,
  EntityMatch,
  EntityResolutionRequest,
  EntityResolutionOptions,
  ResolutionResult,
  MatchType,
  MatchReason,
  MergeOperation,
  ResolutionConflict,
  ResolutionStatistics,
  ConfidenceDistribution
} from './interfaces.js';

// ===========================================
// REQUEST PROCESSING AND VALIDATION
// ===========================================

export async function processRequest(
  env: Environment,
  request: ComponentRequest
): Promise<ComponentResponse> {
  const startTime = Date.now();
  
  try {
    // Enhanced validation
    const validationResult = await validateRequest(request);
    if (!validationResult) {
      return createErrorResponse(generateId(), 'Invalid request structure', startTime);
    }

    // Extract entities from the input text
    const extractedEntities = await extractEntities(request.input);
    
    const processingTime = Date.now() - startTime;
    
    return {
      id: generateId(),
      status: 'success',
      result: extractedEntities,
      processing_time_ms: Math.max(1, processingTime),
      metadata: { 
        entity_count: extractedEntities.length,
        extraction_method: 'pattern_based'
      },
      created_at: new Date().toISOString()
    };
  } catch (error) {
    env.logger.error('Processing request failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      request_id: generateId()
    });
    return createErrorResponse(
      generateId(), 
      `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      startTime
    );
  }
}

export async function validateRequest(request: ComponentRequest): Promise<boolean> {
  // Null/undefined checks
  if (!request) {
    return false;
  }
  
  // Input validation
  if (!request.input || typeof request.input !== 'string') {
    return false;
  }
  
  // Content validation
  if (request.input.trim().length === 0) {
    return false;
  }
  
  // Length validation (reasonable limits)
  if (request.input.length > 100000) {
    return false;
  }
  
  return true;
}

export async function optimizeProcessing(
  env: Environment,
  request: ComponentRequest
): Promise<ComponentRequest> {
  const optimizedInput = normalizeText(request.input);
  
  return {
    ...request,
    input: optimizedInput,
    options: {
      ...request.options,
      optimized: true,
      normalized: true
    }
  };
}

// ===========================================
// ENTITY RESOLUTION CORE FUNCTIONS
// ===========================================

export async function resolveEntities(
  request: EntityResolutionRequest,
  env: Environment
): Promise<ResolutionResult> {
  const startTime = Date.now();
  
  const options = {
    similarity_threshold: 0.7,
    confidence_threshold: 0.5,
    max_merge_candidates: 5,
    enable_phonetic_matching: true,
    enable_semantic_matching: false,
    ...request.options
  };

  const normalizedEntities = request.entities.map(normalizeEntity);
  const matches = await findEntityMatches(normalizedEntities, options);
  const mergeOperations = await generateMergeOperations(matches, options);
  const conflicts = await detectResolutionConflicts(matches, options);
  const resolvedEntities = await applyResolution(normalizedEntities, mergeOperations);
  
  const statistics = calculateStatistics(
    request.entities,
    resolvedEntities,
    mergeOperations,
    conflicts,
    Date.now() - startTime
  );

  return {
    resolved_entities: resolvedEntities,
    merge_operations: mergeOperations,
    conflicts,
    statistics
  };
}

// ===========================================
// ENTITY MATCHING ALGORITHMS
// ===========================================

export async function findEntityMatches(
  entities: Entity[],
  options: EntityResolutionOptions
): Promise<EntityMatch[]> {
  const matches: EntityMatch[] = [];
  
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const entity1 = entities[i];
      const entity2 = entities[j];
      
      const match = await calculateEntityMatch(entity1, entity2, options);
      
      if (match.similarity_score >= (options.similarity_threshold || 0.7)) {
        matches.push(match);
      }
    }
  }
  
  return matches.sort((a, b) => b.similarity_score - a.similarity_score);
}

export async function calculateEntityMatch(
  entity1: Entity,
  entity2: Entity,
  options: EntityResolutionOptions
): Promise<EntityMatch> {
  const reasons: MatchReason[] = [];
  let totalScore = 0;
  let weightSum = 0;

  // Name similarity (weight: 0.4)
  const nameScore = calculateNameSimilarity(entity1.name, entity2.name);
  if (nameScore > 0) {
    reasons.push({
      type: 'name_similarity',
      score: nameScore,
      description: `Name similarity: ${(nameScore * 100).toFixed(1)}%`
    });
    totalScore += nameScore * 0.4;
    weightSum += 0.4;
  }

  // Type match (weight: 0.3)
  const typeScore = entity1.type === entity2.type ? 1.0 : 0.0;
  if (typeScore > 0) {
    reasons.push({
      type: 'type_match',
      score: typeScore,
      description: `Exact type match: ${entity1.type}`
    });
    totalScore += typeScore * 0.3;
    weightSum += 0.3;
  }

  // Alias matching (weight: 0.2)
  const aliasScore = calculateAliasMatch(entity1, entity2);
  if (aliasScore > 0) {
    reasons.push({
      type: 'alias_match',
      score: aliasScore,
      description: `Alias match found with score ${(aliasScore * 100).toFixed(1)}%`
    });
    totalScore += aliasScore * 0.2;
    weightSum += 0.2;
  }

  // Phonetic similarity (if enabled, weight: 0.1)
  if (options.enable_phonetic_matching) {
    const phoneticScore = calculatePhoneticSimilarity(entity1.name, entity2.name);
    if (phoneticScore > 0.5) {
      reasons.push({
        type: 'name_similarity',
        score: phoneticScore,
        description: `Phonetic similarity: ${(phoneticScore * 100).toFixed(1)}%`
      });
      totalScore += phoneticScore * 0.1;
      weightSum += 0.1;
    }
  }

  const finalScore = weightSum > 0 ? totalScore / weightSum : 0;
  const matchType = determineMatchType(finalScore, reasons);

  return {
    source_entity: entity1,
    target_entity: entity2,
    similarity_score: finalScore,
    match_type: matchType,
    confidence: Math.min(finalScore, Math.min(entity1.confidence, entity2.confidence)),
    reasons
  };
}

// ===========================================
// SIMILARITY CALCULATION FUNCTIONS
// ===========================================

export function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  
  const norm1 = normalizeText(name1);
  const norm2 = normalizeText(name2);
  
  // Exact match
  if (norm1 === norm2) return 1.0;
  
  // Levenshtein distance based similarity
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  
  if (maxLength === 0) return 1.0;
  
  return Math.max(0, 1 - (distance / maxLength));
}

export function calculateAliasMatch(entity1: Entity, entity2: Entity): number {
  const aliases1 = [...(entity1.aliases || []), entity1.name];
  const aliases2 = [...(entity2.aliases || []), entity2.name];
  
  let maxScore = 0;
  
  for (const alias1 of aliases1) {
    for (const alias2 of aliases2) {
      const score = calculateNameSimilarity(alias1, alias2);
      maxScore = Math.max(maxScore, score);
    }
  }
  
  return maxScore;
}

export function calculatePhoneticSimilarity(name1: string, name2: string): number {
  // Basic phonetic similarity using soundex-like algorithm
  const soundex1 = generateSoundex(name1);
  const soundex2 = generateSoundex(name2);
  
  return soundex1 === soundex2 ? 0.8 : 0.0;
}

// ===========================================
// ENTITY NORMALIZATION AND UTILITIES
// ===========================================

export function normalizeEntity(entity: Entity): Entity {
  return {
    ...entity,
    id: entity.id || generateId(),
    name: normalizeText(entity.name),
    normalized_name: normalizeText(entity.name),
    confidence: Math.max(0, Math.min(1, entity.confidence || 0.5))
  };
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

export function generateId(): string {
  return `entity-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// ===========================================
// ENTITY EXTRACTION
// ===========================================

async function extractEntities(text: string): Promise<Entity[]> {
  const entities: Entity[] = [];
  const processedText = normalizeText(text);
  
  // Enhanced person name detection
  const personPatterns = [
    /[A-Z][a-z]+ [A-Z][a-z]+/g, // John Smith
    /[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+/g, // John A. Smith
    /Dr\.|Mr\.|Ms\.|Mrs\.]\s+[A-Z][a-z]+ [A-Z][a-z]+/g // Dr. John Smith
  ];
  
  personPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        entities.push({
          name: match.trim(),
          type: 'person',
          confidence: 0.8,
          metadata: { extraction_method: 'pattern_based', pattern: 'person' }
        });
      });
    }
  });
  
  // Enhanced organization detection
  const orgPatterns = [
    /[A-Z][a-zA-Z\s]+(Inc\.?|Corp\.?|LLC|Ltd\.?|Company|Co\.?)/g,
    /[A-Z][a-zA-Z\s]+(University|College|Institute)/g,
    /[A-Z][a-zA-Z\s]+(Bank|Hospital|School)/g
  ];
  
  orgPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        entities.push({
          name: match.trim(),
          type: 'organization',
          confidence: 0.85,
          metadata: { extraction_method: 'pattern_based', pattern: 'organization' }
        });
      });
    }
  });
  
  // Location detection
  const locationMatches = text.match(/[A-Z][a-z]+,\s*[A-Z]{2}/g); // City, ST
  if (locationMatches) {
    locationMatches.forEach(match => {
      entities.push({
        name: match.trim(),
        type: 'location',
        confidence: 0.75,
        metadata: { extraction_method: 'pattern_based', pattern: 'location' }
      });
    });
  }
  
  return entities.map(normalizeEntity);
}

// ===========================================
// MERGE AND CONFLICT RESOLUTION
// ===========================================

async function generateMergeOperations(
  matches: EntityMatch[],
  options: EntityResolutionOptions
): Promise<MergeOperation[]> {
  const operations: MergeOperation[] = [];
  const processedEntities = new Set<string>();
  
  for (const match of matches) {
    const sourceId = match.source_entity.id!;
    const targetId = match.target_entity.id!;
    
    if (processedEntities.has(sourceId) || processedEntities.has(targetId)) {
      continue;
    }
    
    if (match.confidence >= (options.confidence_threshold || 0.5)) {
      operations.push({
        primary_entity: match.confidence > match.target_entity.confidence 
          ? match.source_entity 
          : match.target_entity,
        merged_entities: [match.source_entity, match.target_entity],
        confidence: match.confidence,
        strategy: options.merge_strategy || 'highest_confidence'
      });
      
      processedEntities.add(sourceId);
      processedEntities.add(targetId);
    }
  }
  
  return operations;
}

async function detectResolutionConflicts(
  matches: EntityMatch[],
  options: EntityResolutionOptions
): Promise<ResolutionConflict[]> {
  const conflicts: ResolutionConflict[] = [];
  
  // Group matches by entity to find conflicts
  const entityMatches = new Map<string, EntityMatch[]>();
  
  matches.forEach(match => {
    const sourceId = match.source_entity.id!;
    const targetId = match.target_entity.id!;
    
    if (!entityMatches.has(sourceId)) {
      entityMatches.set(sourceId, []);
    }
    if (!entityMatches.has(targetId)) {
      entityMatches.set(targetId, []);
    }
    
    entityMatches.get(sourceId)!.push(match);
    entityMatches.get(targetId)!.push(match);
  });
  
  // Detect ambiguous matches (entity matches multiple others with similar confidence)
  entityMatches.forEach((matches, entityId) => {
    if (matches.length > 1) {
      const confidences = matches.map(m => m.confidence);
      const maxConfidence = Math.max(...confidences);
      const similarConfidenceMatches = matches.filter(m => 
        Math.abs(m.confidence - maxConfidence) < 0.1
      );
      
      if (similarConfidenceMatches.length > 1) {
        conflicts.push({
          entities: similarConfidenceMatches.flatMap(m => [m.source_entity, m.target_entity]),
          conflict_type: 'ambiguous_match',
          description: `Entity has multiple similar-confidence matches`,
          resolution_strategy: options.conflict_resolution || 'prefer_higher_confidence'
        });
      }
    }
  });
  
  return conflicts;
}

async function applyResolution(
  entities: Entity[],
  mergeOperations: MergeOperation[]
): Promise<Entity[]> {
  const resolved = [...entities];
  const mergedIds = new Set<string>();
  
  mergeOperations.forEach(operation => {
    operation.merged_entities.forEach(entity => {
      if (entity.id) {
        mergedIds.add(entity.id);
      }
    });
  });
  
  // Remove merged entities and add primary entities
  const filteredEntities = resolved.filter(entity => 
    !entity.id || !mergedIds.has(entity.id)
  );
  
  mergeOperations.forEach(operation => {
    const mergedEntity = {
      ...operation.primary_entity,
      resolved: true,
      resolved_at: new Date().toISOString(),
      metadata: {
        ...operation.primary_entity.metadata,
        merge_operation: true,
        merged_count: operation.merged_entities.length,
        merge_strategy: operation.strategy
      }
    };
    filteredEntities.push(mergedEntity);
  });
  
  return filteredEntities;
}

// ===========================================
// STATISTICS AND HELPER FUNCTIONS
// ===========================================

function calculateStatistics(
  originalEntities: Entity[],
  resolvedEntities: Entity[],
  mergeOperations: MergeOperation[],
  conflicts: ResolutionConflict[],
  processingTimeMs: number
): ResolutionStatistics {
  const totalMerged = mergeOperations.reduce(
    (sum, op) => sum + op.merged_entities.length, 
    0
  );
  
  const confidenceDistribution = calculateConfidenceDistribution(resolvedEntities);
  
  return {
    total_entities: originalEntities.length,
    resolved_entities: resolvedEntities.length,
    merged_entities: totalMerged,
    conflicts_found: conflicts.length,
    processing_time_ms: processingTimeMs,
    confidence_distribution: confidenceDistribution
  };
}

function calculateConfidenceDistribution(entities: Entity[]): ConfidenceDistribution {
  const distribution = { high: 0, medium: 0, low: 0 };
  
  entities.forEach(entity => {
    if (entity.confidence >= 0.8) {
      distribution.high++;
    } else if (entity.confidence >= 0.5) {
      distribution.medium++;
    } else {
      distribution.low++;
    }
  });
  
  return distribution;
}

function determineMatchType(score: number, reasons: MatchReason[]): MatchType {
  if (score >= 0.95) return 'exact';
  if (score >= 0.8) return 'fuzzy';
  if (reasons.some(r => r.type === 'alias_match')) return 'alias';
  if (score >= 0.6) return 'partial';
  if (reasons.some(r => r.description.includes('phonetic'))) return 'phonetic';
  return 'partial';
}

function createErrorResponse(
  id: string, 
  errorMessage: string, 
  startTime: number
): ComponentResponse {
  return {
    id,
    status: 'failed',
    result: null,
    processing_time_ms: Math.max(1, Date.now() - startTime),
    metadata: { error: errorMessage },
    created_at: new Date().toISOString()
  };
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

function generateSoundex(name: string): string {
  // Basic soundex implementation
  const normalized = name.toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return '0000';
  
  const firstLetter = normalized[0];
  let code = firstLetter;
  
  const soundexMap: { [key: string]: string } = {
    'BFPV': '1', 'CGJKQSXZ': '2', 'DT': '3',
    'L': '4', 'MN': '5', 'R': '6'
  };
  
  for (let i = 1; i < normalized.length && code.length < 4; i++) {
    const char = normalized[i];
    for (const [chars, digit] of Object.entries(soundexMap)) {
      if (chars.includes(char)) {
        if (code[code.length - 1] !== digit) {
          code += digit;
        }
        break;
      }
    }
  }
  
  return code.padEnd(4, '0').substring(0, 4);
}
