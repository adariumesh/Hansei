import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { rateLimiter } from 'hono-rate-limiter';
import { Env } from './raindrop.gen';
import { createLogger } from '../shared/logger.js';
import { initializeDatabase } from '../sql/initialize.js';
import { MemoryRouter } from '../shared/memory-router.js';
import { RaindropAIClient } from '../shared/raindrop-ai-client.js';

const serviceLogger = createLogger('api-gateway');

const metrics = {
  requests_total: 0,
  requests_success: 0,
  requests_error: 0,
  avg_response_time_ms: 0,
  last_reset: new Date().toISOString()
};

const InferSchema = z.object({
  user_id: z.string().optional(),
  content: z.string().min(1, 'Content cannot be empty').max(10000, 'Content too long (max 10000 chars)').trim()
});

const ChatSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(5000, "Message too long (max 5000 chars)"),
  conversation_id: z.string().optional(),
  user_id: z.string().optional()
});

const aiAnalysisCache = new Map<string, any>();

let dbInitialized = false;

function sanitizeContent(content: string): string {
  // Re-enable this when DOMPurify is integrated.
  // return DOMPurify.sanitize(content);
  return content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/on(load|error|click|submit)="[^"]*"/gi, '').replace(/javascript:/gi, '');
}

// INTELLIGENCE PROCESSING FUNCTIONS
function calculateSemanticSimilarity(
  content1: string,
  content2: string, 
  themes1: string[],
  themes2: string[],
  entities1: string[],
  entities2: string[]
): number {
  const tokens1 = new Set(content1.toLowerCase().split(/\s+/).filter(t => t.length > 3));
  const tokens2 = new Set(content2.toLowerCase().split(/\s+/).filter(t => t.length > 3));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  const jaccardScore = union.size > 0 ? intersection.size / union.size : 0;
  
  const themeSet1 = new Set(themes1);
  const themeSet2 = new Set(themes2);
  const themeIntersection = new Set([...themeSet1].filter(x => themeSet2.has(x)));
  const themeScore = (themeSet1.size + themeSet2.size) > 0 ? 
    (2 * themeIntersection.size) / (themeSet1.size + themeSet2.size) : 0;
  
  const entitySet1 = new Set(entities1);
  const entitySet2 = new Set(entities2);
  const entityIntersection = new Set([...entitySet1].filter(x => entitySet2.has(x)));
  const entityScore = (entitySet1.size + entitySet2.size) > 0 ?
    (2 * entityIntersection.size) / (entitySet1.size + entitySet2.size) : 0;
  
  return (jaccardScore * 0.4) + (themeScore * 0.4) + (entityScore * 0.2);
}

function extractThemes(memories: any[]): string[] {
  const themeKeywords: { [key: string]: string[] } = {
    'fear': ['afraid', 'fear', 'scared', 'terror', 'anxiety', 'worry'],
    'hope': ['hope', 'optimis', 'future', 'dream', 'wish', 'better'],
    'family': ['mother', 'father', 'margot', 'family', 'parent'],
    'war': ['war', 'invasion', 'allied', 'german', 'soldier', 'battle'],
    'hiding': ['annex', 'hiding', 'secret', 'concealed', 'hidden'],
    'nature': ['sky', 'stars', 'moon', 'nature', 'outdoors', 'window'],
    'loneliness': ['lonely', 'alone', 'isolated', 'misunderstood'],
    'growth': ['change', 'grow', 'develop', 'mature', 'better']
  };
  
  const themeScores: { [key: string]: number } = {};
  const allContent = memories.map(m => m.content.toLowerCase()).join(' ');
  
  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = allContent.match(regex);
      score += matches ? matches.length : 0;
    }
    if (score > 0) {
      themeScores[theme] = score;
    }
  }
  
  return Object.entries(themeScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme]) => theme);
}

function extractEntities(memories: any[]): string[] {
  const entities = new Set<string>();
  const allContent = memories.map(m => m.content).join(' ');
  
  const capitalizedWords = allContent.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  
  const knownEntities = ['Anne', 'Margot', 'Peter', 'Mother', 'Father', 'Kitty', 'Dussel', 'Mrs. van Daan', 
                         'Mr. van Daan', 'Miep', 'Bep', 'Kugler', 'Kleiman', 'Amsterdam', 'Holland', 'Germany'];
  
  for (const entity of capitalizedWords) {
    if (entity.length > 2 && !['The', 'I', 'We', 'They', 'He', 'She', 'It'].includes(entity)) {
      entities.add(entity);
    }
  }
  
  for (const known of knownEntities) {
    if (allContent.includes(known)) {
      entities.add(known);
    }
  }
  
  return Array.from(entities).slice(0, 20);
}

function findMemoryThemes(memory: any, globalThemes: string[]): string[] {
  const content = memory.content.toLowerCase();
  return globalThemes.filter(theme => content.includes(theme));
}

function findMemoryEntities(memory: any, globalEntities: string[]): string[] {
  const content = memory.content;
  return globalEntities.filter(entity => content.includes(entity));
}

function calculateImportance(memory: any, themes: string[]): number {
  const content = memory.content.toLowerCase();
  let score = 0.3;
  
  for (const theme of themes) {
    if (content.includes(theme)) {
      score += 0.15;
    }
  }
  
  if (memory.content.length > 500) score += 0.1;
  if (memory.content.length > 1000) score += 0.1;
  
  return Math.min(score, 1.0);
}

function analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
  const positive = ['hope', 'happy', 'joy', 'love', 'wonderful', 'good', 'better', 'optimis'];
  const negative = ['fear', 'afraid', 'terrible', 'horrible', 'sad', 'worried', 'awful', 'bad'];
  
  const lower = content.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of positive) {
    if (lower.includes(word)) positiveCount++;
  }
  for (const word of negative) {
    if (lower.includes(word)) negativeCount++;
  }
  
  if (positiveCount > negativeCount + 1) return 'positive';
  if (negativeCount > positiveCount + 1) return 'negative';
  return 'neutral';
}
// END INTELLIGENCE PROCESSING FUNCTIONS


const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  if (!dbInitialized) {
    try {
      await initializeDatabase(c.env.GRAPH_DATABASE, serviceLogger);
      dbInitialized = true;
      serviceLogger.info('Database initialized successfully');
    } catch (error) {
      serviceLogger.error('Database initialization failed', error);
      // Continue anyway - table might already exist
    }
  }
  await next();
});

app.use('*', cors({
  origin: ['https://hansei.app', 'https://app.hansei.ai'],
  credentials: true
}));

app.use('*', async (c, next) => {
  const requestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const start = Date.now();
  metrics.requests_total++;
  await next();
  const ms = Date.now() - start;
  if (c.res.status >= 200 && c.res.status < 400) {
    metrics.requests_success++;
  } else {
    metrics.requests_error++;
  }
  metrics.avg_response_time_ms = (metrics.avg_response_time_ms * (metrics.requests_total - 1) + ms) / metrics.requests_total;
  if (c.env.logger) {
    c.env.logger.info('request_metrics', {
        requestId,
        endpoint: c.req.path,
        method: c.req.method,
        status: c.res.status,
        duration_ms: ms,
        user_id: c.req.query('user_id') || 'anonymous'
    });
  }
});

app.use('/api/*', rateLimiter({
  windowMs: 60 * 1000,
  limit: 100,
  message: 'Too many requests',
  keyGenerator: (c) => c.req.query('user_id') || 'anonymous_api_user'
}));

app.use('/infer', rateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  message: 'AI rate limit exceeded',
  keyGenerator: (c) => c.req.query('user_id') || 'anonymous_infer_user'
}));

// Re-enabled error handling middleware as per audit report
app.use('*', async (c, next) => {
  try {
    await next();
  } catch (error) {
    serviceLogger.error('Gateway error', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});


app.get('/health', async (c) => {
  const checks: { [key: string]: string } = {
    service: 'api-gateway',
    status: 'ok',
    version: '2.0.0',
    smartmemory: 'unknown',
    ai: c.env.AI ? 'available' : 'unavailable'
  };
  try {
    await c.env.AGENT_MEMORY.searchSemanticMemory('__health_check_ping__');
    checks.smartmemory = 'healthy';
  } catch (error) {
    checks.smartmemory = 'unhealthy';
    serviceLogger.error('SmartMemory health check failed', { error: error instanceof Error ? error.message : String(error) });
  }
  const dependenciesStatus = [checks.smartmemory, checks.ai];
  const overallStatus = dependenciesStatus.every(dep => dep === 'healthy' || dep === 'available') ? 'ok' : 'degraded';
  checks.status = overallStatus;
  return c.json(checks, overallStatus === 'ok' ? 200 : 503);
});

app.get('/metrics', (c) => c.json(metrics));

app.post('/login', async (c) => {
    const { username, password } = await c.req.json();
    if (username === 'admin' && password === 'password') {
        return c.json({ success: true, token: 'dummy-jwt-token' });
    }
    return c.json({ success: false, message: 'Invalid credentials' }, 401);
});

// Route to chat-service
app.post('/api/chat', async (c) => {
  const body = await c.req.json();
  
  const validation = ChatSchema.safeParse(body);
  if (!validation.success) {
      return c.json({
          error: 'Validation failed',
          details: validation.error.issues
      }, 400);
  }
  let { message, conversation_id, user_id } = validation.data;

  message = sanitizeContent(message);

  const newRequest = new Request('https://internal/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversation_id, user_id })
  });
  return await c.env.CHAT_SERVICE.fetch(newRequest);
});

app.post('/api/document-chat', async (c) => {
  return await c.env.CHAT_SERVICE.fetch(c.req.raw);
});

app.get('/api/conversations/:path*', async (c) => {
  return await c.env.CHAT_SERVICE.fetch(c.req.raw);
});

// Route to insights-service
app.get('/api/insights/:path*', async (c) => {
  return await c.env.INSIGHTS_SERVICE.fetch(c.req.raw);
});

app.get('/api/patterns/:path*', async (c) => {
  return await c.env.INSIGHTS_SERVICE.fetch(c.req.raw);
});

app.all('/api/checkins/:path*', async (c) => {
  return await c.env.INSIGHTS_SERVICE.fetch(c.req.raw);
});

// Route to memory-core
app.post('/infer', async (c) => {
  try {
    const body = await c.req.json();
    
    const validation = InferSchema.safeParse(body);
    if (!validation.success) {
        return c.json({
            error: 'Validation failed',
            details: validation.error.issues
        }, 400);
    }
    let { content, user_id } = validation.data;

    content = sanitizeContent(content);

    const newRequest = new Request('http://memory-core/infer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, user_id })
    });
    const response = await c.env.MEMORY_CORE.fetch(newRequest, c.env as any);
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    serviceLogger.error('Failed to route /infer', error);
    return c.json({ error: 'Failed to route to memory-core', details: String(error) }, 500);
  }
});

// Handle /api/graph directly (no subpath) for getting all memories
app.get('/api/graph', async (c) => {
  try {
    const query = c.req.query('query') || '';
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0'); // Added offset
    const user_id = c.req.query('user_id') || 'anonymous';
    
    // Use MemoryRouter to search across all 4 tiers
    // Fetch more memories than the limit to allow for local pagination after filtering
    const router = new MemoryRouter(c.env);
    const allMemories = await router.searchAllTiers(query, 1000); // Fetch a generous amount
    
    serviceLogger.info(`searchAllTiers returned ${allMemories.length} results`);
    
    // Filter by user_id if provided
    const userMemories = allMemories.filter((m: any) => {
      const memUserId = m.metadata?.user_id || m.user_id;
      return !user_id || user_id === 'anonymous' || memUserId === user_id;
    });
    
    serviceLogger.info(`After user filter: ${userMemories.length} memories for user ${user_id}`);

    // Apply pagination
    const paginatedMemories = userMemories.slice(offset, offset + limit);
    
    if (!paginatedMemories || paginatedMemories.length === 0) {
      return c.json({
        success: true,
        count: 0,
        totalCount: userMemories.length, // Total count for pagination metadata
        memories: [],
        graph: { nodes: [], edges: [] },
        rawResults: []
      });
    }
    
    // Convert SmartMemory results to memory format
    const memories = paginatedMemories.map((m: any) => ({
      id: m.id,
      content: m.content || m.text,
      user_id: m.user_id || user_id,
      timestamp: m.timestamp || m.metadata?.timestamp,
      metadata: m.metadata || {},
      memory_id: m.id, // For delete/update operations
      tier: m.tier
    }));
    
    // INTELLIGENCE PROCESSING: Extract themes and entities
    const themes = extractThemes(paginatedMemories); // Use paginated memories for analysis
    const entities = extractEntities(paginatedMemories); // Use paginated memories for analysis
    
    // Create nodes with semantic analysis
    const graphNodes = memories.map((m: any) => {
      const memoryThemes = findMemoryThemes(m, themes);
      const memoryEntities = findMemoryEntities(m, entities);
      
      return {
        id: m.id,
        memory_id: m.id, // For context menu operations
        label: m.content.substring(0, 50) + '...',
        type: 'memory',
        weight: calculateImportance(m, themes),
        fullContent: m.content,
        timestamp: m.timestamp,
        user_id: m.user_id,
        themes: memoryThemes,
        entities: memoryEntities,
        sentiment: analyzeSentiment(m.content),
        // Add privacy flags for UI
        pinned: m.metadata?.pinned || false,
        sensitive: m.metadata?.sensitive || false,
        // Add AI analysis if available
        ai_entities: m.metadata?.ai_entities || [],
        ai_themes: m.metadata?.ai_themes || [],
        ai_sentiment: m.metadata?.ai_sentiment
      };
    });
    
    // Calculate semantic similarity and create weighted edges
    const edges: any[] = [];
    for (let i = 0; i < graphNodes.length; i++) {
      for (let j = i + 1; j < graphNodes.length; j++) {
        const similarity = calculateSemanticSimilarity(
          graphNodes[i].fullContent,
          graphNodes[j].fullContent,
          graphNodes[i].themes,
          graphNodes[j].themes,
          graphNodes[i].entities,
          graphNodes[j].entities
        );
        
        // Only create edge if similarity is above threshold
        if (similarity > 0.2) {
          edges.push({
            source: graphNodes[i].id,
            target: graphNodes[j].id,
            weight: similarity,
            type: 'semantic_correlation',
            strength: similarity > 0.6 ? 'strong' : similarity > 0.4 ? 'medium' : 'weak'
          });
        }
      }
    }
    
    return c.json({
      success: true,
      count: memories.length,
      totalCount: userMemories.length, // Total count for pagination metadata
      memories: memories,
      graph: { 
        nodes: graphNodes, 
        edges: edges 
      },
      rawResults: memories,
      intelligence: {
        themes: themes,
        entities: entities,
        totalCorrelations: edges.length,
        strongCorrelations: edges.filter(e => e.strength === 'strong').length,
        avgSimilarity: edges.length > 0 ? 
          edges.reduce((sum, e) => sum + e.weight, 0) / edges.length : 0
      }
    });
  } catch (graphError) {
    serviceLogger.error('Graph query failed', graphError);
    return c.json({
      error: 'Graph query failed',
      message: graphError instanceof Error ? graphError.message : 'Unknown error'
    }, 500);
  }
});

app.all('/api/graph/:path*', async (c) => {
  try {
    const path = c.req.path;
    
    if (c.req.method === 'POST' && path === '/api/graph/store') {
      let { input, options } = await c.req.json();
      const { user_id, metadata } = options || {};
      
      if (!input || typeof input !== 'string') {
        return c.json({ error: 'Input content is required' }, 400);
      }
      
      input = sanitizeContent(input);

      const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const timestamp = new Date().toISOString();
      
      let aiAnalysis = null;
      if (!metadata?.analysisExcluded) {
        if (aiAnalysisCache.has(input)) {
          aiAnalysis = aiAnalysisCache.get(input);
          serviceLogger.info('AI analysis cache hit');
        } else {
          try {
            const aiClient = new RaindropAIClient(c.env);
            aiAnalysis = await aiClient.analyzeMemory(input, metadata);
            aiAnalysisCache.set(input, aiAnalysis);
            serviceLogger.info('AI analysis cache miss');
          } catch (aiError) {
            serviceLogger.warn('AI analysis failed, continuing without it', aiError);
          }
        }
      }
      
      const memoryEntry = {
        id: memoryId,
        content: input,
        user_id: user_id || 'anonymous',
        timestamp: timestamp,
        metadata: {
          ...metadata,
          sensitive: metadata?.sensitive || false,
          analysisExcluded: metadata?.analysisExcluded || false,
          pinned: metadata?.pinned || false,
          ...(aiAnalysis ? {
            ai_entities: aiAnalysis.entities,
            ai_relationships: aiAnalysis.relationships,
            ai_themes: aiAnalysis.metadata.themes,
            ai_sentiment: aiAnalysis.metadata.sentiment,
            ai_emotional_intensity: aiAnalysis.metadata.emotional_intensity,
            ai_priority: aiAnalysis.metadata.priority
          } : {})
        }
      };
      
      try {
        const router = new MemoryRouter(c.env);
        const context = router.classifyMemoryContext(input, memoryEntry.metadata);
        await router.routeMemory(memoryEntry, context);
        
        return c.json({
          success: true,
          id: memoryId,
          stored_at: timestamp,
          tier: context === 'session' ? 'working-memory' : 
                context === 'knowledge' ? 'semantic-memory' :
                context === 'skill' ? 'procedural-memory' : 'episodic-memory',
          ai_analysis: aiAnalysis ? {
            entities_found: aiAnalysis.entities.length,
            relationships_found: aiAnalysis.functions.length,
            themes: aiAnalysis.metadata.themes,
            sentiment: aiAnalysis.metadata.sentiment
          } : null
        });
      } catch (storageError) {
        serviceLogger.error('Storage failed', storageError);
        return c.json({
          error: 'Failed to store memory',
          message: storageError instanceof Error ? storageError.message : 'Unknown error'
        }, 500);
      }
    }
    
    if (c.req.method === 'GET' && path === '/api/graph/search') {
      try {
        const query = c.req.query('query') || 'all memories';
        const limit = parseInt(c.req.query('limit') || '10');
        const user_id = c.req.query('user_id');
        
        const result = await c.env.AGENT_MEMORY.getSemanticMemory(query === 'all memories' ? '' : query);
        
        if (!result || !result.success || !result.document) {
          return c.json({
            success: true,
            count: 0,
            results: []
          });
        }
        
        let memories = Array.isArray(result.document) ? result.document : [result.document];
        
        if (query && query !== 'all memories') {
          memories = memories.filter((m: any) => 
            (m.text && m.text.toLowerCase().includes(query.toLowerCase())) ||
            (m.metadata?.content && m.metadata.content.toLowerCase().includes(query.toLowerCase()))
          );
        }
        
        if (user_id) {
          memories = memories.filter((m: any) => m.metadata?.user_id === user_id);
        }
        
        memories = memories.slice(0, limit);
        
        const transformed = memories.map((m: any) => ({
          id: m.metadata?.id || 'unknown',
          content: m.metadata?.content || m.text,
          user_id: m.metadata?.user_id || 'unknown',
          timestamp: m.metadata?.timestamp || new Date().toISOString(),
          metadata: m.metadata || {}
        }));
        
        return c.json({
          success: true,
          count: transformed.length,
          results: transformed
        });
      } catch (searchError) {
        serviceLogger.error('Search failed', searchError);
        return c.json({
          error: 'Search failed',
          message: searchError instanceof Error ? searchError.message : 'Unknown error'
        }, 500);
      }
    }
    
    if (c.req.method === 'GET' && path === '/api/graph/retrieve') {
      try {
        const id = c.req.query('id');
        const user_id = c.req.query('user_id');
        
        if (!id) {
          return c.json({ error: 'Memory ID required' }, 400);
        }
        
        const result = await c.env.AGENT_MEMORY.getSemanticMemory(id);
        
        if (!result || !result.success || !result.document) {
          return c.json({ error: 'Memory not found' }, 404);
        }
        
        const memories = Array.isArray(result.document) ? result.document : [result.document];
        const memory = memories.find((m: any) => m.metadata?.id === id);
        
        if (!memory) {
          return c.json({ error: 'Memory not found' }, 404);
        }
        
        if (user_id && memory.metadata?.user_id !== user_id) {
          return c.json({ error: 'Unauthorized' }, 403);
        }
        
        return c.json({
          success: true,
          memory: {
            id: memory.metadata?.id || 'unknown',
            content: memory.metadata?.content || memory.text,
            user_id: memory.metadata?.user_id || 'unknown',
            timestamp: memory.metadata?.timestamp || new Date().toISOString(),
            metadata: memory.metadata || {}
          }
        });
      } catch (retrieveError) {
        serviceLogger.error('Retrieve failed', retrieveError);
        return c.json({
          error: 'Retrieve failed',
          message: retrieveError instanceof Error ? retrieveError.message : 'Unknown error'
        }, 500);
      }
    }
    
    return c.json({ error: 'Not Found', message: `Route ${c.req.method} ${path} not found` }, 404);
  } catch (error) {
    serviceLogger.error('Failed in /api/graph route', error);
    return c.json({ error: 'Request failed', details: String(error) }, 500);
  }
});

app.all('/api/search/:path*', async (c) => {
  return await c.env.SEARCH_ENGINE.fetch(c.req.raw, c.env as any);
});

app.post('/api/upload', async (c) => {
  return await c.env.DOCUMENT_PROCESSOR.fetch(c.req.raw, c.env as any);
});

app.post('/api/file/:fileId', async (c) => {
  return await c.env.DOCUMENT_PROCESSOR.fetch(c.req.raw, c.env as any);
});

app.post('/api/memory/consolidate', async (c) => {
  try {
    const { user_id } = await c.req.json();
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }
    
    const router = new MemoryRouter(c.env);
    const result = await router.consolidateMemories();
    
    return c.json({
      success: true,
      message: 'Memory consolidation complete',
      stats: result
    });
  } catch (error) {
    serviceLogger.error('Consolidation failed', error);
    return c.json({
      error: 'Consolidation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/api/memory/stats', async (c) => {
  try {
    const user_id = c.req.query('user_id');
    
    if (!user_id) {
      return c.json({ error: 'user_id query parameter is required' }, 400);
    }
    
    return c.json({
      success: true,
      user_id,
      tiers: {
        working: { count: 0, description: 'Active sessions (<1 hour)' },
        episodic: { count: 0, description: 'Recent experiences (1 hour - 1 day)' },
        semantic: { count: 0, description: 'Long-term knowledge (permanent)' },
        procedural: { count: 0, description: 'Behavioral patterns (permanent)' }
      },
      note: 'Tier counting requires SmartMemory query implementation'
    });
  } catch (error) {
    serviceLogger.error('Stats failed', error);
    return c.json({
      error: 'Stats failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.delete('/api/memory/clear', async (c) => {
  try {
    const user_id = c.req.query('user_id');
    
    if (!user_id) {
      return c.json({ error: 'user_id query parameter is required' }, 400);
    }
    
    serviceLogger.info(`BULK DELETE: Clearing all memories for user ${user_id}`);
    
    const memoryRouter = new MemoryRouter(c.env);
    const result = await memoryRouter.deleteAllMemoriesForUser(user_id);
    
    serviceLogger.info(`Bulk delete completed`, result);
    
    return c.json({
      success: true,
      message: `Deleted ${result.deleted} memories for user ${user_id}`,
      ...result
    });
  } catch (error) {
    serviceLogger.error('Bulk delete failed', error);
    return c.json({
      error: 'Bulk delete failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.delete('/api/memory/:id', async (c) => {
  try {
    const memoryId = c.req.param('id');
    const user_id = c.req.query('user_id');
    
    if (!user_id) {
      return c.json({ error: 'user_id query parameter is required' }, 400);
    }
    
    serviceLogger.info(`Deleting memory ${memoryId} for user ${user_id} from SmartMemory`);
    
    const memoryRouter = new MemoryRouter(c.env);
    const deleteResult = await memoryRouter.deleteMemory(memoryId, user_id);
    
    if (!deleteResult.success) {
      serviceLogger.error('Delete from SmartMemory failed', deleteResult);
      return c.json({
        error: 'Delete failed',
        message: deleteResult.error || 'Failed to delete from SmartMemory'
      }, 500);
    }
    
    return c.json({
      success: true,
      message: `Memory ${memoryId} deleted from SmartMemory`,
      id: memoryId
    });
  } catch (error) {
    serviceLogger.error('Delete failed', error);
    return c.json({
      error: 'Delete failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.patch('/api/memory/:id', async (c) => {
  try {
    const memoryId = c.req.param('id');
    const { user_id, updates } = await c.req.json();
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }
    
    const key = `memory:${user_id}:${memoryId}`;
    const existing = await c.env.SESSION_CACHE.get(key);
    
    if (!existing) {
      return c.json({ error: 'Memory not found' }, 404);
    }
    
    const memory = JSON.parse(existing);
    
    if (updates.sensitive !== undefined) memory.metadata.sensitive = updates.sensitive;
    if (updates.analysisExcluded !== undefined) memory.metadata.analysisExcluded = updates.analysisExcluded;
    if (updates.pinned !== undefined) memory.metadata.pinned = updates.pinned;
    
    await c.env.SESSION_CACHE.put(key, JSON.stringify(memory), {
      expirationTtl: 60 * 60 * 24 * 365 // 1 year
    });
    
    return c.json({
      success: true,
      message: 'Memory updated',
      id: memoryId,
      metadata: memory.metadata
    });
  } catch (error) {
    serviceLogger.error('Update failed', error);
    return c.json({
      error: 'Update failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/api/advisor/chat', async (c) => {
  try {
    const { user_id, query, personality } = await c.req.json();
    
    if (!user_id || !query) {
      return c.json({ error: 'user_id and query are required' }, 400);
    }
    
    const validPersonalities = ['Gandhi', 'Anne Frank', 'Einstein', 'Sensei'];
    const selectedPersonality = validPersonalities.includes(personality) ? personality : 'Sensei';
    
    const router = new MemoryRouter(c.env);
    const allMemories = await router.searchAllTiers(user_id, 20);
    
    const patternResults = await c.env.PROCEDURAL_MEMORY.searchSemanticMemory(user_id);
    const rawPatterns = patternResults.documentSearchResponse?.results || [];
    
    const patterns = rawPatterns.map((r: any) => {
      try {
        const parsed = JSON.parse(r.text || '{}');
        return parsed;
      } catch {
        return null;
      }
    }).filter((p: any) => p && p.pattern_type);
    
    const aiClient = new RaindropAIClient(c.env);
    const advice = await aiClient.generateAdvice(
      allMemories,
      patterns,
      selectedPersonality as any,
      query
    );
    
    return c.json({
      success: true,
      personality: selectedPersonality,
      advice,
      context: {
        memories_analyzed: allMemories.length,
        patterns_found: patterns.length
      }
    });
  } catch (error) {
    serviceLogger.error('Advisor chat failed', error);
    return c.json({
      error: 'Advisor chat failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/api/sleep-cycle/trigger', async (c) => {
  try {
    const { user_id } = await c.req.json();
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }
    
    await c.env.PROCESSING_QUEUE.send({
      action: 'sleep_cycle',
      user_id
    });
    
    return c.json({
      success: true,
      message: 'Sleep Cycle consolidation queued',
      user_id,
      note: 'Check batch-processor logs for results'
    });
  } catch (error) {
    serviceLogger.error('Sleep Cycle trigger failed', error);
    return c.json({
      error: 'Failed to trigger Sleep Cycle',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.all('*', (c) => {
  return c.json({
    error: 'Not Found',
    message: `Route ${c.req.method} ${c.req.path} not found`,
    timestamp: new Date().toISOString()
  }, 404);
});

export default class extends Service<Env> {
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  }
}