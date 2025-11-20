import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { QueueSendOptions } from '@liquidmetal-ai/raindrop-framework';
import { KvCachePutOptions, KvCacheGetOptions } from '@liquidmetal-ai/raindrop-framework';
import { BucketPutOptions, BucketListOptions } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Enhanced entity resolution endpoint with advanced features
app.post('/api/resolve-entities', async (c) => {
  try {
    const body = await c.req.json();
    const { entities, options = {} } = body;
    
    if (!entities || !Array.isArray(entities)) {
      return c.json({ error: 'entities array is required' }, 400);
    }
    
    const startTime = Date.now();
    
    // Enhanced entity resolution with confidence scoring and temporal detection
    const normalizedEntities = entities.map(normalizeEntityWithAdvancedScoring);
    const temporalRelationships = await detectTemporalRelationships(normalizedEntities);
    const resolvedEntities = await performAdvancedResolution(normalizedEntities, {
      semantic_similarity_threshold: 0.7,
      confidence_boost_enabled: true,
      temporal_relationship_detection: true,
      ...options
    });
    
    const processingTime = Date.now() - startTime;
    
    return c.json({
      status: 'success',
      resolved_entities: resolvedEntities,
      temporal_relationships: temporalRelationships,
      processing_time_ms: processingTime,
      metadata: {
        total_entities: resolvedEntities.length,
        resolved_count: resolvedEntities.length,
        temporal_relationships_found: temporalRelationships.length,
        confidence_distribution: calculateConfidenceDistribution(resolvedEntities)
      }
    });
  } catch (error) {
    return c.json({
      error: 'Failed to resolve entities',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

function generateId(): string {
  return `entity-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Advanced entity normalization with confidence scoring
function normalizeEntityWithAdvancedScoring(entity: any): any {
  const baseConfidence = entity.confidence || 0.5;
  let confidenceBoost = 0;
  
  // Confidence boost factors
  if (entity.name && entity.name.length > 3) confidenceBoost += 0.1;
  if (entity.type) confidenceBoost += 0.1;
  if (entity.aliases && entity.aliases.length > 0) confidenceBoost += 0.1;
  if (entity.metadata?.source === 'verified') confidenceBoost += 0.2;
  
  return {
    ...entity,
    id: entity.id || generateId(),
    normalized_name: entity.name?.toLowerCase().trim().replace(/[^\w\s]/g, ''),
    confidence: Math.min(1.0, baseConfidence + confidenceBoost),
    enhanced_scoring: true
  };
}

// Temporal relationship detection
async function detectTemporalRelationships(entities: any[]): Promise<any[]> {
  const relationships: any[] = [];
  const temporalIndicators = [
    'before', 'after', 'during', 'since', 'until', 'while', 'when',
    'first', 'second', 'next', 'then', 'later', 'earlier', 'previously',
    'yesterday', 'today', 'tomorrow', 'last week', 'next month'
  ];
  
  // Find entities with temporal context
  const temporalEntities = entities.filter(entity => {
    if (!entity.metadata?.context) return false;
    const context = entity.metadata.context.toLowerCase();
    return temporalIndicators.some(indicator => context.includes(indicator));
  });
  
  // Create temporal relationships between entities
  for (let i = 0; i < temporalEntities.length; i++) {
    for (let j = i + 1; j < temporalEntities.length; j++) {
      const entity1 = temporalEntities[i];
      const entity2 = temporalEntities[j];
      
      const relationship = analyzeTemporalRelationship(entity1, entity2);
      if (relationship) {
        relationships.push(relationship);
      }
    }
  }
  
  return relationships;
}

function analyzeTemporalRelationship(entity1: any, entity2: any): any | null {
  const context1 = entity1.metadata?.context?.toLowerCase() || '';
  const context2 = entity2.metadata?.context?.toLowerCase() || '';
  
  // Simple temporal analysis
  if (context1.includes('before') && context2.includes('after')) {
    return {
      type: 'temporal_sequence',
      source_entity: entity1,
      target_entity: entity2,
      relationship: 'precedes',
      confidence: 0.7
    };
  }
  
  if (context1.includes('during') && context2.includes('during')) {
    return {
      type: 'temporal_overlap',
      source_entity: entity1,
      target_entity: entity2,
      relationship: 'concurrent',
      confidence: 0.6
    };
  }
  
  return null;
}

// Advanced resolution with semantic similarity improvements
async function performAdvancedResolution(entities: any[], options: any): Promise<any[]> {
  const resolved = [...entities];
  
  // Enhanced alias handling
  const aliasGroups = groupEntitiesByAliases(resolved);
  const mergedByAliases = mergeAliasGroups(aliasGroups);
  
  // Semantic similarity edge case fixes
  const semanticMerged = await fixSemanticSimilarityEdgeCases(mergedByAliases, options);
  
  return semanticMerged.map(entity => ({
    ...entity,
    resolved: true,
    resolution_timestamp: new Date().toISOString()
  }));
}

function groupEntitiesByAliases(entities: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();
  
  entities.forEach(entity => {
    const aliases = [entity.name, ...(entity.aliases || [])];
    const normalizedAliases = aliases.map(alias => alias.toLowerCase().trim());
    
    // Find existing group or create new one
    let groupKey = entity.normalized_name;
    for (const [key, group] of groups.entries()) {
      const groupAliases = group.flatMap(e => [e.normalized_name, ...(e.aliases || [])]);
      if (normalizedAliases.some(alias => groupAliases.includes(alias))) {
        groupKey = key;
        break;
      }
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(entity);
  });
  
  return groups;
}

function mergeAliasGroups(groups: Map<string, any[]>): any[] {
  const merged: any[] = [];
  
  groups.forEach(entities => {
    if (entities.length === 1) {
      merged.push(entities[0]);
    } else {
      // Merge entities with highest confidence as primary
      const primary = entities.reduce((highest, current) => 
        current.confidence > highest.confidence ? current : highest
      );
      
      const allAliases = new Set<string>();
      entities.forEach(entity => {
        allAliases.add(entity.name);
        (entity.aliases || []).forEach((alias: string) => allAliases.add(alias));
      });
      
      merged.push({
        ...primary,
        aliases: Array.from(allAliases).filter(alias => alias !== primary.name),
        confidence: Math.min(1.0, primary.confidence + 0.1), // Boost confidence for merged entities
        merged_from: entities.map(e => e.id),
        merge_reason: 'alias_matching'
      });
    }
  });
  
  return merged;
}

async function fixSemanticSimilarityEdgeCases(entities: any[], options: any): Promise<any[]> {
  const processed = [...entities];
  
  // Handle common edge cases
  for (let i = 0; i < processed.length; i++) {
    for (let j = i + 1; j < processed.length; j++) {
      const entity1 = processed[i];
      const entity2 = processed[j];
      
      // Fix abbreviation edge cases (e.g., "AI" vs "Artificial Intelligence")
      if (isAbbreviation(entity1.name, entity2.name) || isAbbreviation(entity2.name, entity1.name)) {
        const primary = entity1.name.length > entity2.name.length ? entity1 : entity2;
        const secondary = primary === entity1 ? entity2 : entity1;
        
        // Merge abbreviation with full form
        primary.aliases = [...(primary.aliases || []), secondary.name];
        primary.confidence = Math.min(1.0, primary.confidence + 0.15);
        processed.splice(processed.indexOf(secondary), 1);
        j--; // Adjust index after removal
        continue;
      }
      
      // Fix partial name matches (e.g., "John" vs "John Smith")
      if (isPartialMatch(entity1.name, entity2.name)) {
        const longer = entity1.name.length > entity2.name.length ? entity1 : entity2;
        const shorter = longer === entity1 ? entity2 : entity1;
        
        longer.aliases = [...(longer.aliases || []), shorter.name];
        longer.confidence = Math.min(1.0, longer.confidence + 0.1);
        processed.splice(processed.indexOf(shorter), 1);
        j--; // Adjust index after removal
      }
    }
  }
  
  return processed;
}

function isAbbreviation(short: string, long: string): boolean {
  if (short.length >= long.length) return false;
  
  const shortNorm = short.toUpperCase().replace(/[^A-Z]/g, '');
  const longWords = long.toUpperCase().split(/\s+/);
  
  if (shortNorm.length !== longWords.length) return false;
  
  return longWords.every((word, index) => 
    word.startsWith(shortNorm[index])
  );
}

function isPartialMatch(name1: string, name2: string): boolean {
  const norm1 = name1.toLowerCase().trim();
  const norm2 = name2.toLowerCase().trim();
  
  return norm1.includes(norm2) || norm2.includes(norm1);
}

function calculateConfidenceDistribution(entities: any[]): any {
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

// === Basic API Routes ===
app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Hono!' });
});

app.get('/api/hello/:name', (c) => {
  const name = c.req.param('name');
  return c.json({ message: `Hello, ${name}!` });
});

// Example POST endpoint
app.post('/api/echo', async (c) => {
  const body = await c.req.json();
  return c.json({ received: body });
});

// === RPC Examples: Service calling Actor ===
// Example: Call an actor method
/*
app.post('/api/actor-call', async (c) => {
  try {
    const { message, actorName } = await c.req.json();

    if (!actorName) {
      return c.json({ error: 'actorName is required' }, 400);
    }

    // Get actor namespace and create actor instance
    // Note: Replace MY_ACTOR with your actual actor binding name
    const actorNamespace = c.env.MY_ACTOR; // This would be bound in raindrop.manifest
    const actorId = actorNamespace.idFromName(actorName);
    const actor = actorNamespace.get(actorId);

    // Call actor method (assuming actor has a 'processMessage' method)
    const response = await actor.processMessage(message);

    return c.json({
      success: true,
      actorName,
      response
    });
  } catch (error) {
    return c.json({
      error: 'Failed to call actor',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// Example: Get actor state
/*
app.get('/api/actor-state/:actorName', async (c) => {
  try {
    const actorName = c.req.param('actorName');

    // Get actor instance
    const actorNamespace = c.env.MY_ACTOR;
    const actorId = actorNamespace.idFromName(actorName);
    const actor = actorNamespace.get(actorId);

    // Get actor state (assuming actor has a 'getState' method)
    const state = await actor.getState();

    return c.json({
      success: true,
      actorName,
      state
    });
  } catch (error) {
    return c.json({
      error: 'Failed to get actor state',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// === SmartBucket Examples ===
// Example: Upload file to SmartBucket
/*
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Upload to SmartBucket (Replace MY_SMARTBUCKET with your binding name)
    const smartbucket = c.env.MY_SMARTBUCKET;
    const arrayBuffer = await file.arrayBuffer();

    const putOptions: BucketPutOptions = {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: {
        originalName: file.name,
        size: file.size.toString(),
        description: description || '',
        uploadedAt: new Date().toISOString()
      }
    };

    const result = await smartbucket.put(file.name, new Uint8Array(arrayBuffer), putOptions);

    return c.json({
      success: true,
      message: 'File uploaded successfully',
      key: result.key,
      size: result.size,
      etag: result.etag
    });
  } catch (error) {
    return c.json({
      error: 'Failed to upload file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// Example: Get file from SmartBucket
/*
app.get('/api/file/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');

    // Get file from SmartBucket
    const smartbucket = c.env.MY_SMARTBUCKET;
    const file = await smartbucket.get(filename);

    if (!file) {
      return c.json({ error: 'File not found' }, 404);
    }

    return new Response(file.body, {
      headers: {
        'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Object-Size': file.size.toString(),
        'X-Object-ETag': file.etag,
        'X-Object-Uploaded': file.uploaded.toISOString(),
      }
    });
  } catch (error) {
    return c.json({
      error: 'Failed to retrieve file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// Example: Search SmartBucket documents
/*
app.post('/api/search', async (c) => {
  try {
    const { query, page = 1, pageSize = 10 } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    const smartbucket = c.env.MY_SMARTBUCKET;

    // For initial search
    if (page === 1) {
      const requestId = `search-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const results = await smartbucket.search({
        input: query,
        requestId
      });

      return c.json({
        success: true,
        message: 'Search completed',
        query,
        results: results.results,
        pagination: {
          ...results.pagination,
          requestId
        }
      });
    } else {
      // For paginated results
      const { requestId } = await c.req.json();
      if (!requestId) {
        return c.json({ error: 'Request ID required for pagination' }, 400);
      }

      const paginatedResults = await smartbucket.getPaginatedResults({
        requestId,
        page,
        pageSize
      });

      return c.json({
        success: true,
        message: 'Paginated results',
        query,
        results: paginatedResults.results,
        pagination: paginatedResults.pagination
      });
    }
  } catch (error) {
    return c.json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// Example: Chunk search for finding specific sections
/*
app.post('/api/chunk-search', async (c) => {
  try {
    const { query } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    const smartbucket = c.env.MY_SMARTBUCKET;
    const requestId = `chunk-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const results = await smartbucket.chunkSearch({
      input: query,
      requestId
    });

    return c.json({
      success: true,
      message: 'Chunk search completed',
      query,
      results: results.results
    });
  } catch (error) {
    return c.json({
      error: 'Chunk search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// Example: Document chat/Q&A
/*
app.post('/api/document-chat', async (c) => {
  try {
    const { objectId, query } = await c.req.json();

    if (!objectId || !query) {
      return c.json({ error: 'objectId and query are required' }, 400);
    }

    const smartbucket = c.env.MY_SMARTBUCKET;
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const response = await smartbucket.documentChat({
      objectId,
      input: query,
      requestId
    });

    return c.json({
      success: true,
      message: 'Document chat completed',
      objectId,
      query,
      answer: response.answer
    });
  } catch (error) {
    return c.json({
      error: 'Document chat failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// Example: List objects in bucket
/*
app.get('/api/list', async (c) => {
  try {
    const url = new URL(c.req.url);
    const prefix = url.searchParams.get('prefix') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;

    const smartbucket = c.env.MY_SMARTBUCKET;

    const listOptions: BucketListOptions = {
      prefix,
      limit
    };

    const result = await smartbucket.list(listOptions);

    return c.json({
      success: true,
      objects: result.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        etag: obj.etag
      })),
      truncated: result.truncated,
      cursor: result.truncated ? result.cursor : undefined
    });
  } catch (error) {
    return c.json({
      error: 'List failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// === KV Cache Examples ===
// Example: Store data in KV cache
/*
app.post('/api/cache', async (c) => {
  try {
    const { key, value, ttl } = await c.req.json();

    if (!key || value === undefined) {
      return c.json({ error: 'key and value are required' }, 400);
    }

    const cache = c.env.MY_CACHE;

    const putOptions: KvCachePutOptions = {};
    if (ttl) {
      putOptions.expirationTtl = ttl;
    }

    await cache.put(key, JSON.stringify(value), putOptions);

    return c.json({
      success: true,
      message: 'Data cached successfully',
      key
    });
  } catch (error) {
    return c.json({
      error: 'Cache put failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// Example: Get data from KV cache
/*
app.get('/api/cache/:key', async (c) => {
  try {
    const key = c.req.param('key');

    const cache = c.env.MY_CACHE;

    const getOptions: KvCacheGetOptions<'json'> = {
      type: 'json'
    };

    const value = await cache.get(key, getOptions);

    if (value === null) {
      return c.json({ error: 'Key not found in cache' }, 404);
    }

    return c.json({
      success: true,
      key,
      value
    });
  } catch (error) {
    return c.json({
      error: 'Cache get failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// === Queue Examples ===
// Example: Send message to queue
/*
app.post('/api/queue/send', async (c) => {
  try {
    const { message, delaySeconds } = await c.req.json();

    if (!message) {
      return c.json({ error: 'message is required' }, 400);
    }

    const queue = c.env.MY_QUEUE;

    const sendOptions: QueueSendOptions = {};
    if (delaySeconds) {
      sendOptions.delaySeconds = delaySeconds;
    }

    await queue.send(message, sendOptions);

    return c.json({
      success: true,
      message: 'Message sent to queue'
    });
  } catch (error) {
    return c.json({
      error: 'Queue send failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
*/

// === Environment Variable Examples ===
app.get('/api/config', (c) => {
  return c.json({
    hasEnv: !!c.env,
    availableBindings: {
      // These would be true if the resources are bound in raindrop.manifest
      // MY_ACTOR: !!c.env.MY_ACTOR,
      // MY_SMARTBUCKET: !!c.env.MY_SMARTBUCKET,
      // MY_CACHE: !!c.env.MY_CACHE,
      // MY_QUEUE: !!c.env.MY_QUEUE,
    },
    // Example access to environment variables:
    // MY_SECRET_VAR: c.env.MY_SECRET_VAR // This would be undefined if not set
  });
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
  
  // Service method for other components to call
  async resolveEntities(entities: any[]): Promise<any[]> {
    if (!entities || !Array.isArray(entities)) {
      return [];
    }
    
    // Basic entity resolution
    const resolvedEntities = entities.map(entity => ({
      ...entity,
      id: entity.id || generateId(),
      normalized_name: entity.name?.toLowerCase().trim(),
      resolved: true,
      confidence: entity.confidence || 0.8,
      metadata: {
        ...entity.metadata,
        resolved_at: new Date().toISOString()
      }
    }));
    
    return resolvedEntities;
  }
}
