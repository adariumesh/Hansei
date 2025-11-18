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

// Add CORS middleware - must be before other routes
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// Add request logging middleware
app.use('*', logger());

// Global error handling middleware
app.use('*', async (c, next) => {
  try {
    await next();
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('Request failed:', error, 'RequestId:', requestId);
    
    // Log error to SmartMemory for monitoring
    try {
      await c.env.AGENT_MEMORY.putSemanticMemory({
        type: 'error_log',
        requestId,
        path: c.req.path,
        method: c.req.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        userAgent: c.req.header('user-agent')
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return c.json({ 
      error: 'Internal server error', 
      requestId,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Request analytics middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  
  // Skip logging for health checks and static assets
  if (c.req.path === '/health' || c.req.path === '/favicon.ico') {
    return;
  }
  
  // Log request analytics asynchronously
  try {
    c.executionCtx.waitUntil(
      c.env.AGENT_MEMORY.putSemanticMemory({
        type: 'request_analytics',
        path: c.req.path,
        method: c.req.method,
        duration,
        status: c.res.status,
        timestamp: new Date().toISOString(),
        userAgent: c.req.header('user-agent')
      })
    );
  } catch (error) {
    console.error('Analytics logging failed:', error);
  }
});

// Explicit OPTIONS handler for CORS preflight
app.options('*', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '600',
    }
  });
});

// WebSocket endpoint for real-time graph updates
app.get('/api/ws/graph-updates', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 400);
  }
  
  // In a real implementation, this would handle WebSocket connections
  // For now, return connection info
  return c.json({
    success: true,
    endpoint: '/api/ws/graph-updates',
    protocol: 'websocket',
    message: 'WebSocket endpoint ready for real-time graph updates'
  });
});

// Broadcast graph updates to connected WebSocket clients
app.post('/api/broadcast/graph-update', async (c) => {
  try {
    const { updateType, data } = await c.req.json();
    
    // In a real implementation, this would broadcast to WebSocket clients
    // For now, store the update for polling
    const updateInfo = {
      id: `update_${Date.now()}`,
      type: updateType || 'node_added',
      data: data || {},
      timestamp: new Date().toISOString()
    };
    
    // Store in memory for polling clients (temporary solution)
    await c.env.SESSION_CACHE?.put(
      `graph_update_${updateInfo.id}`,
      JSON.stringify(updateInfo),
      { expirationTtl: 3600 } // 1 hour
    );
    
    return c.json({
      success: true,
      update: updateInfo,
      message: 'Graph update broadcasted'
    });
  } catch (error) {
    return c.json({
      error: 'Failed to broadcast update',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Enhanced health check endpoint
app.get('/health', async (c) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      memory: 'unknown',
      database: 'unknown', 
      ai: 'unknown'
    },
    uptime: process.uptime ? Math.floor(process.uptime()) : 0
  };

  // Test memory service
  try {
    await c.env.AGENT_MEMORY.searchSemanticMemory('health check');
    health.services.memory = 'ok';
  } catch (error) {
    health.services.memory = 'error';
    health.status = 'degraded';
  }

  // Test database service (simplified check)
  try {
    // Check if database binding exists
    if (c.env.GRAPH_DATABASE) {
      health.services.database = 'ok';
    } else {
      health.services.database = 'error';
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.database = 'error'; 
    health.status = 'degraded';
  }

  // Test AI service
  try {
    await c.env.AI.run('llama-3.3-70b', {
      messages: [{ role: 'user', content: 'health check' }],
      max_tokens: 1,
      temperature: 0
    } as any);
    health.services.ai = 'ok';
  } catch (error) {
    health.services.ai = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  return c.json(health, statusCode);
});

// === Frontend Static File Serving ===
// Serve main frontend at root
app.get('/', (c) => {
  return c.html(getIndexHTML());
});

// Serve 3D version
app.get('/3d', (c) => {
  return c.html(getIndex3DHTML());
});

// Serve static assets (favicon, etc.)
app.get('/favicon.ico', (c) => {
  // Return a simple 204 No Content for favicon requests
  return new Response(null, { status: 204 });
});

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

// Voice inference: extract entities/relationships/metadata and store in SmartMemory
app.post('/infer', async (c) => {
  try {
    let body: any;
    const contentType = c.req.header('content-type') || '';
    
    // Handle both application/json and text/plain (for CORS workaround)
    if (contentType.includes('text/plain')) {
      const text = await c.req.text();
      body = JSON.parse(text);
    } else {
      body = await c.req.json();
    }
    
    const userId: string | undefined = body.user_id || body.userId;
    const content: string | undefined = body.content || body.transcript || body.text;

    if (!content) {
      return c.json({ error: 'Missing content/transcript' }, 400);
    }

    const systemPrompt = "You are HANSEI's entity extraction engine. Analyze user voice notes and extract: ENTITIES: [person, goal, habit, project, emotion, object] RELATIONSHIPS: [CAUSES, DEPENDS_ON, PART_OF, IMPACTS, RELATED_TO] EMOTIONAL_INTENSITY: 1-10 scale PRIORITY_LEVEL: high/medium/low Return ONLY valid JSON: { \"entities\": [{\"type\": \"\", \"content\": \"\", \"weight\": 0.5}], \"relationships\": [{\"source\": \"\", \"target\": \"\", \"type\": \"\"}], \"metadata\": {\"emotional_intensity\": 5, \"priority\": \"medium\"} }";

    // Run AI with enforced JSON output
    const aiResult = await c.env.AI.run(
      'llama-3.3-70b',
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.1
      } as any
    );

    const raw = (aiResult as any).response || (aiResult as any).choices?.[0]?.message?.content || '';
    let parsed: any;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      // Try to extract a JSON substring if model returned extra text
      const match = String(raw).match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return c.json({ error: 'Model did not return valid JSON', raw }, 502);
      }
    }

    // Basic shape validation
    if (!parsed || typeof parsed !== 'object' || !parsed.entities || !parsed.relationships || !parsed.metadata) {
      return c.json({ error: 'Invalid JSON structure from model', parsed }, 422);
    }

    // Entity Resolution: Prevent duplicate entities using fuzzy matching + semantic similarity
    const resolvedEntities = await resolveEntities(parsed.entities, c.env);
    parsed.entities = resolvedEntities;

    // Store semantic memory document
    const document = {
      type: 'hansei_voice_extraction',
      user_id: userId || 'unknown',
      content,
      extracted: parsed,
      created_at: new Date().toISOString()
    };

    const putRes = await c.env.AGENT_MEMORY.putSemanticMemory(document);
    if (!putRes.success) {
      return c.json({ error: 'Failed to store semantic memory', details: putRes.error, extracted: parsed }, 500);
    }

    return c.json({ success: true, objectId: putRes.objectId, extracted: parsed });
  } catch (error) {
    return c.json({ error: 'Inference failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Voice ingestion: transcribe audio → extract entities → store
app.post('/api/voice/ingest', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    const userId = formData.get('user_id') as string;
    const audioFormat = (formData.get('audio_format') as string) || 'wav';

    if (!audioFile) {
      return c.json({ error: 'Missing audio file' }, 400);
    }

    // Step 1: Transcribe audio with Whisper
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioArray = Array.from(new Uint8Array(arrayBuffer));
    
    let transcriptionResult;
    try {
      transcriptionResult = await c.env.AI.run(
        'whisper-tiny',
        {
          audio: audioArray,
          contentType: audioFile.type || 'audio/wav',
          language: 'en'
        } as any
      );
    } catch (err: any) {
      return c.json({ 
        error: 'Whisper transcription failed', 
        details: err.message || String(err),
        audioSize: arrayBuffer.byteLength,
        audioFormat: audioFormat
      }, 500);
    }

    const transcript = (transcriptionResult as any).text || (transcriptionResult as any).transcript || '';
    
    if (!transcript) {
      return c.json({ 
        error: 'Transcription returned empty', 
        result: transcriptionResult,
        audioSize: arrayBuffer.byteLength 
      }, 502);
    }

    // Step 2: Extract entities/relationships from transcript
    const systemPrompt = "You are HANSEI's entity extraction engine. Analyze user voice notes and extract: ENTITIES: [person, goal, habit, project, emotion, object] RELATIONSHIPS: [CAUSES, DEPENDS_ON, PART_OF, IMPACTS, RELATED_TO] EMOTIONAL_INTENSITY: 1-10 scale PRIORITY_LEVEL: high/medium/low Return ONLY valid JSON: { \"entities\": [{\"type\": \"\", \"content\": \"\", \"weight\": 0.5}], \"relationships\": [{\"source\": \"\", \"target\": \"\", \"type\": \"\"}], \"metadata\": {\"emotional_intensity\": 5, \"priority\": \"medium\"} }";

    const aiResult = await c.env.AI.run(
      'llama-3.3-70b',
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.1
      } as any
    );

    const raw = (aiResult as any).response || (aiResult as any).choices?.[0]?.message?.content || '';
    let parsed: any;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      const match = String(raw).match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return c.json({ error: 'Model did not return valid JSON', raw }, 502);
      }
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.entities || !parsed.relationships || !parsed.metadata) {
      return c.json({ error: 'Invalid JSON structure from model', parsed }, 422);
    }

    // Step 3: Store in SmartMemory
    const document = {
      type: 'hansei_voice_ingestion',
      user_id: userId || 'unknown',
      audio_format: audioFormat,
      transcript,
      extracted: parsed,
      created_at: new Date().toISOString()
    };

    const putRes = await c.env.AGENT_MEMORY.putSemanticMemory(document);
    if (!putRes.success) {
      return c.json({ error: 'Failed to store semantic memory', details: putRes.error, extracted: parsed }, 500);
    }

    return c.json({ 
      success: true, 
      objectId: putRes.objectId, 
      transcript, 
      extracted: parsed 
    });
  } catch (error) {
    return c.json({ error: 'Voice ingestion failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Graph query: retrieve stored entities/relationships for visualization
app.get('/api/graph', async (c) => {
  try {
    const url = new URL(c.req.url);
    const userId = url.searchParams.get('user_id') || undefined;
    const query = url.searchParams.get('query') || 'all memories';
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Generate cache key based on query parameters
    const cacheKey = `graph_${JSON.stringify({ userId, query, limit })}`;
    
    // Try to get cached result first
    try {
      const cached = await c.env.SESSION_CACHE.get(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        return c.json({
          ...cachedData,
          cached: true,
          cache_timestamp: cachedData.timestamp
        });
      }
    } catch (cacheError) {
      console.warn('Cache retrieval failed:', cacheError);
    }

    // Query SmartMemory with semantic search
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory(query);

    // Transform results into graph structure
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeMap = new Map<string, number>();

    const results = searchResult.documentSearchResponse?.results || [];
    results.slice(0, limit).forEach((result: any, idx: number) => {
      // Parse the source document
      let doc: any = {};
      try {
        // Try parsing text field first (most common format)
        if (result.text) {
          doc = JSON.parse(result.text);
        } else if (typeof result.source === 'string') {
          doc = JSON.parse(result.source);
        } else if (result.source?.object) {
          doc = JSON.parse(result.source.object);
        }
      } catch (e) {
        // If parsing fails, skip this result
        console.log('Failed to parse document at index', idx, ':', e);
        return;
      }
      
      const extracted = doc.extracted || {};

      // Add entities as nodes
      if (extracted.entities && Array.isArray(extracted.entities)) {
        extracted.entities.forEach((entity: any) => {
          const nodeId = entity.content || `entity-${idx}`;
          if (!nodeMap.has(nodeId)) {
            nodeMap.set(nodeId, nodes.length);
            nodes.push({
              id: nodeId,
              type: entity.type || 'unknown',
              weight: entity.weight || 0.5,
              label: nodeId,
              metadata: {
                chunkSignature: result.chunkSignature,
                score: result.score
              }
            });
          }
        });
      }

      // Add relationships as edges
      if (extracted.relationships && Array.isArray(extracted.relationships)) {
        extracted.relationships.forEach((rel: any) => {
          edges.push({
            source: rel.source,
            target: rel.target,
            type: rel.type || 'RELATED_TO',
            metadata: {
              chunkSignature: result.chunkSignature
            }
          });
        });
      }
    });

    const result = {
      success: true,
      graph: {
        nodes,
        edges,
        metadata: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          query,
          userId,
          timestamp: new Date().toISOString()
        }
      },
      rawResults: results.slice(0, limit).map((r: any) => ({
        chunkSignature: r.chunkSignature,
        score: r.score,
        text: r.text
      }))
    };

    // Cache the result for 5 minutes
    try {
      await c.env.SESSION_CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 300 // 5 minutes
      });
    } catch (cacheError) {
      console.warn('Cache storage failed:', cacheError);
    }

    return c.json(result);
  } catch (error) {
    return c.json({ 
      error: 'Graph query failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Conversational query: ask questions about stored memories
app.post('/api/chat', async (c) => {
  try {
    let body: any;
    const contentType = c.req.header('content-type') || '';
    
    // Handle both application/json and text/plain (for CORS workaround)
    if (contentType.includes('text/plain')) {
      const text = await c.req.text();
      body = JSON.parse(text);
    } else {
      body = await c.req.json();
    }
    
    const message = body.message;
    const userId = body.user_id || 'unknown';
    
    if (!message) {
      return c.json({ error: 'Missing message' }, 400);
    }

    // Step 1: Search relevant memories
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory(message);
    const results = searchResult.documentSearchResponse?.results || [];
    
    // Step 2: Build context from top results
    const context = results.slice(0, 5).map((r: any, idx: number) => {
      try {
        const doc = JSON.parse(r.text || '{}');
        const content = doc.content || '';
        const entities = doc.extracted?.entities?.map((e: any) => e.content).join(', ') || '';
        return `Memory ${idx + 1}: ${content || entities}`;
      } catch (e) {
        return '';
      }
    }).filter(Boolean).join('\n');
    
    if (!context) {
      return c.json({
        answer: "I don't have any memories about that yet. Try adding some thoughts first!",
        sources: []
      });
    }

    // Step 3: Generate conversational response with LLaMA
    const systemPrompt = `You are HANSEI, the user's personal memory companion. Answer questions based ONLY on their stored memories below. Be conversational, insightful, and notice patterns.

Stored Memories:
${context}

If the memories don't contain enough information, say so. If you notice patterns or connections, point them out.`;

    const aiResult = await c.env.AI.run('llama-3.3-70b', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 400,
      temperature: 0.7
    } as any);

    const answer = (aiResult as any).response || (aiResult as any).choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
    
    // Store conversation in history
    const conversationId = body.conversation_id || `conv_${Date.now()}_${userId}`;
    const timestamp = new Date().toISOString();
    
    const conversationEntry = {
      conversation_id: conversationId,
      user_id: userId,
      timestamp,
      user_message: message,
      assistant_response: answer,
      sources: results.slice(0, 5).map((r: any) => r.chunkSignature),
      context_used: results.length
    };
    
    // Store conversation history
    try {
      const historyKey = `conv_history_${conversationId}_${Date.now()}`;
      await c.env.AGENT_MEMORY.putSemanticMemory({
        text: JSON.stringify(conversationEntry),
        metadata: { type: 'conversation_history', user_id: userId }
      });
      
      // Also store in session cache for quick retrieval
      await c.env.SESSION_CACHE?.put(
        `recent_conv_${userId}`,
        JSON.stringify({
          conversation_id: conversationId,
          last_message: message,
          last_response: answer,
          timestamp
        }),
        { expirationTtl: 3600 } // 1 hour
      );
    } catch (historyError) {
      console.warn('Failed to store conversation history:', historyError);
    }

    return c.json({
      success: true,
      answer,
      sources: results.slice(0, 5).map((r: any) => r.chunkSignature),
      memoryCount: results.length,
      conversation_id: conversationId,
      timestamp
    });
  } catch (error) {
    return c.json({ 
      error: 'Chat query failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Conversation history endpoint
app.get('/api/conversations/history', async (c) => {
  try {
    const userId = c.req.query('user_id') || 'unknown';
    const conversationId = c.req.query('conversation_id');
    const limit = parseInt(c.req.query('limit') || '20');
    
    let conversations = [];
    
    if (conversationId) {
      // Get specific conversation history
      const searchPattern = `conv_history_${conversationId}_`;
      // In a real implementation, you'd search by pattern
      // For now, return a placeholder structure
      conversations = [{
        conversation_id: conversationId,
        message_count: 1,
        last_activity: new Date().toISOString(),
        preview: 'Conversation history would be retrieved here'
      }];
    } else {
      // Get recent conversations for user
      try {
        const recentConv = await c.env.SESSION_CACHE?.get(`recent_conv_${userId}`);
        if (recentConv) {
          const parsed = JSON.parse(recentConv);
          conversations = [{
            conversation_id: parsed.conversation_id,
            last_message: parsed.last_message,
            last_response: parsed.last_response,
            timestamp: parsed.timestamp,
            preview: parsed.last_message.substring(0, 100)
          }];
        }
      } catch (e) {
        console.warn('Failed to retrieve conversation history:', e);
      }
    }
    
    return c.json({
      success: true,
      conversations,
      user_id: userId,
      total_found: conversations.length
    });
  } catch (error) {
    return c.json({
      error: 'Failed to retrieve conversation history',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get conversation timeline for linking to graph nodes
app.get('/api/conversations/timeline', async (c) => {
  try {
    const userId = c.req.query('user_id') || 'unknown';
    const days = parseInt(c.req.query('days') || '7');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Build timeline of conversations and their connection to graph entities
    const timeline = [];
    
    // Get memories from the period
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('all memories');
    const results = searchResult.documentSearchResponse?.results || [];
    
    results.forEach((result: any) => {
      try {
        const doc = JSON.parse(result.text || '{}');
        const entryDate = new Date(doc.created_at || result.createdAt || new Date());
        
        if (entryDate >= startDate) {
          timeline.push({
            date: entryDate.toISOString(),
            type: 'memory',
            content: doc.content?.substring(0, 200) || '',
            entities: doc.extracted?.entities?.slice(0, 3) || [],
            source: 'memory_system'
          });
        }
      } catch (e) {}
    });
    
    // Sort by date
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return c.json({
      success: true,
      timeline: timeline.slice(0, 50), // Limit to 50 entries
      period_days: days,
      user_id: userId
    });
  } catch (error) {
    return c.json({
      error: 'Failed to retrieve conversation timeline',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Pattern detection: find orphaned nodes (high-weight but no connections)
app.get('/api/patterns/orphans', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('all memories');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const allNodes = new Map<string, any>();
    const connectedNodes = new Set<string>();
    
    // Collect all nodes and track which ones have connections
    results.forEach((result: any) => {
      try {
        const doc = JSON.parse(result.text || '{}');
        const entities = doc.extracted?.entities || [];
        const relationships = doc.extracted?.relationships || [];
        
        // Track all entities
        entities.forEach((e: any) => {
          const key = e.content.toLowerCase();
          if (!allNodes.has(key)) {
            allNodes.set(key, {
              id: e.content,
              type: e.type,
              weight: e.weight || 0.5,
              lastMention: doc.created_at
            });
          }
        });
        
        // Track connected entities
        relationships.forEach((rel: any) => {
          connectedNodes.add(rel.source.toLowerCase());
          connectedNodes.add(rel.target.toLowerCase());
        });
      } catch (e) {
        // Skip malformed results
      }
    });
    
    // Find orphans: nodes with high weight but no connections
    const orphans = Array.from(allNodes.entries())
      .filter(([key, node]) => !connectedNodes.has(key) && node.weight > 0.6)
      .map(([_, node]) => node)
      .sort((a, b) => b.weight - a.weight);
    
    return c.json({
      success: true,
      orphans,
      count: orphans.length,
      insight: orphans.length > 0 
        ? `Found ${orphans.length} high-priority items that aren't connected to any actions or goals`
        : 'All your important thoughts are well connected!'
    });
  } catch (error) {
    return c.json({ 
      error: 'Orphan detection failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Pattern detection: find hub nodes (highly connected)
app.get('/api/patterns/hubs', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('all memories');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const connectionCount = new Map<string, number>();
    const nodeDetails = new Map<string, any>();
    
    // Count connections for each node
    results.forEach((result: any) => {
      try {
        const doc = JSON.parse(result.text || '{}');
        const entities = doc.extracted?.entities || [];
        const relationships = doc.extracted?.relationships || [];
        
        // Store node details
        entities.forEach((e: any) => {
          const key = e.content.toLowerCase();
          if (!nodeDetails.has(key)) {
            nodeDetails.set(key, {
              id: e.content,
              type: e.type
            });
          }
        });
        
        // Count connections
        relationships.forEach((rel: any) => {
          const sourceKey = rel.source.toLowerCase();
          const targetKey = rel.target.toLowerCase();
          
          connectionCount.set(sourceKey, (connectionCount.get(sourceKey) || 0) + 1);
          connectionCount.set(targetKey, (connectionCount.get(targetKey) || 0) + 1);
        });
      } catch (e) {
        // Skip malformed results
      }
    });
    
    // Find hubs: nodes with 3+ connections
    const hubs = Array.from(connectionCount.entries())
      .filter(([_, count]) => count >= 3)
      .map(([key, count]) => ({
        node: nodeDetails.get(key)?.id || key,
        type: nodeDetails.get(key)?.type || 'unknown',
        connections: count,
        centrality: count / Math.max(...Array.from(connectionCount.values()))
      }))
      .sort((a, b) => b.connections - a.connections);
    
    return c.json({
      success: true,
      hubs,
      count: hubs.length,
      insight: hubs.length > 0 && hubs[0]
        ? `${hubs[0].node} is your most central theme with ${hubs[0].connections} connections`
        : 'Build more connections to discover your central themes'
    });
  } catch (error) {
    return c.json({ 
      error: 'Hub detection failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Proactive check-ins system
app.post('/api/checkins/schedule', async (c) => {
  try {
    const { user_id, frequency, preferences } = await c.req.json();
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }
    
    const checkinConfig = {
      user_id,
      frequency: frequency || 'weekly', // daily, weekly, monthly
      preferences: preferences || {
        time_of_day: '18:00',
        topics: ['goals', 'habits', 'mood'],
        style: 'encouraging'
      },
      next_checkin: calculateNextCheckin(frequency || 'weekly'),
      active: true,
      created_at: new Date().toISOString()
    };
    
    // Store checkin configuration
    const configKey = `checkin_config_${user_id}`;
    await c.env.AGENT_MEMORY.putSemanticMemory({
      text: JSON.stringify(checkinConfig),
      metadata: { type: 'checkin_config', user_id }
    });
    
    return c.json({
      success: true,
      checkin_config: checkinConfig,
      message: 'Proactive check-ins scheduled successfully'
    });
  } catch (error) {
    return c.json({
      error: 'Failed to schedule check-ins',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/api/checkins/trigger', async (c) => {
  try {
    const userId = c.req.query('user_id') || 'demo_user';
    
    // Generate a proactive check-in message
    const checkinMessage = await generateCheckinMessage(c.env, userId);
    
    return c.json({
      success: true,
      checkin: checkinMessage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Failed to generate check-in',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/api/checkins/status', async (c) => {
  try {
    const userId = c.req.query('user_id');
    
    if (!userId) {
      return c.json({ error: 'user_id is required' }, 400);
    }
    
    // Get checkin configuration
    const configKey = `checkin_config_${userId}`;
    let config = null;
    
    try {
      const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory(`checkin_config ${userId}`);
      const configData = searchResult.documentSearchResponse?.results?.[0]?.text;
      if (configData) {
        config = JSON.parse(configData);
      }
    } catch (e) {}
    
    const isOverdue = config && new Date() > new Date(config.next_checkin);
    
    return c.json({
      success: true,
      has_checkin_config: !!config,
      config: config,
      is_overdue: isOverdue,
      user_id: userId
    });
  } catch (error) {
    return c.json({
      error: 'Failed to get check-in status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Temporal Analysis: Momentum tracking
app.get('/api/insights/momentum', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('all memories');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const momentumAnalysis = analyzeMomentum(results);
    
    return c.json({
      success: true,
      momentum: momentumAnalysis,
      insights: generateMomentumInsights(momentumAnalysis),
      analyzed_at: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Momentum analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Temporal Analysis: Abandoned goals detection
app.get('/api/insights/abandoned', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('goals projects habits');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const abandonedItems = detectAbandonedGoals(results);
    
    return c.json({
      success: true,
      abandoned_goals: abandonedItems,
      insights: generateAbandonedGoalsInsights(abandonedItems),
      analyzed_at: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Abandoned goals analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Temporal Analysis: Consistency checking
app.get('/api/insights/consistency', async (c) => {
  try {
    const searchResult = await c.env.AGENT_MEMORY.searchSemanticMemory('all memories');
    const results = searchResult.documentSearchResponse?.results || [];
    
    const consistencyReport = analyzeConsistency(results);
    
    return c.json({
      success: true,
      consistency: consistencyReport,
      insights: generateConsistencyInsights(consistencyReport),
      analyzed_at: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Consistency analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
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

// Entity Resolution Function - Prevent duplicate entities
async function resolveEntities(entities: any[], env: any) {
  if (!entities || entities.length === 0) {
    return entities;
  }

  // Retrieve existing entities from SmartMemory for comparison
  let existingEntities = [];
  try {
    const searchResult = await env.AGENT_MEMORY.semanticSearch('entity', { limit: 100 });
    if (searchResult.success && searchResult.results) {
      existingEntities = searchResult.results
        .map((doc: any) => doc.extracted?.entities || [])
        .flat()
        .filter((e: any) => e && e.name);
    }
  } catch (error) {
    console.warn('Could not retrieve existing entities for deduplication:', error);
  }

  const resolvedEntities = [];

  for (const newEntity of entities) {
    if (!newEntity || !newEntity.name) {
      resolvedEntities.push(newEntity);
      continue;
    }

    // Find potential duplicates using fuzzy matching and semantic similarity
    const duplicateMatch = findDuplicate(newEntity, existingEntities);
    
    if (duplicateMatch) {
      // Merge with existing entity (keep the canonical name but add new properties)
      const mergedEntity = {
        ...newEntity,
        name: duplicateMatch.name, // Use canonical name
        type: duplicateMatch.type || newEntity.type,
        aliases: [...(duplicateMatch.aliases || []), ...(newEntity.aliases || []), newEntity.name].filter((v, i, a) => a.indexOf(v) === i),
        merged: true,
        original_variant: newEntity.name
      };
      resolvedEntities.push(mergedEntity);
    } else {
      // New unique entity
      resolvedEntities.push({
        ...newEntity,
        aliases: [newEntity.name],
        canonical: true
      });
    }
  }

  return resolvedEntities;
}

// Fuzzy matching + semantic similarity to detect duplicates
function findDuplicate(newEntity: any, existingEntities: any[]) {
  const newName = newEntity.name.toLowerCase().trim();
  const newType = newEntity.type?.toLowerCase() || '';

  for (const existing of existingEntities) {
    const existingName = existing.name.toLowerCase().trim();
    const existingType = existing.type?.toLowerCase() || '';

    // Exact match
    if (newName === existingName) {
      return existing;
    }

    // Type should match or be compatible
    if (newType && existingType && newType !== existingType) {
      // Skip if types are clearly different
      const incompatibleTypes = [
        ['person', 'object'], ['person', 'location'], ['person', 'concept'],
        ['object', 'location'], ['object', 'emotion'], ['location', 'emotion']
      ];
      const isIncompatible = incompatibleTypes.some(([t1, t2]) => 
        (newType === t1 && existingType === t2) || (newType === t2 && existingType === t1)
      );
      if (isIncompatible) continue;
    }

    // Fuzzy string matching
    const similarity = calculateStringSimilarity(newName, existingName);
    
    // Check aliases
    const aliasMatches = (existing.aliases || []).some((alias: string) => {
      const aliasSim = calculateStringSimilarity(newName, alias.toLowerCase().trim());
      return aliasSim > 0.85;
    });

    // Semantic patterns for common variations
    const semanticMatch = checkSemanticPatterns(newName, existingName);

    if (similarity > 0.85 || aliasMatches || semanticMatch) {
      return existing;
    }
  }

  return null;
}

// Calculate string similarity using Levenshtein distance
function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len1][len2]) / maxLen;
}

// Check for semantic patterns (e.g., "running" vs "morning runs")
function checkSemanticPatterns(name1: string, name2: string): boolean {
  // Remove common words that don't affect meaning
  const stopWords = ['the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'morning', 'evening', 'daily', 'weekly'];
  
  const clean1 = name1.split(' ').filter(word => !stopWords.includes(word.toLowerCase())).join(' ');
  const clean2 = name2.split(' ').filter(word => !stopWords.includes(word.toLowerCase())).join(' ');
  
  // Check if one is contained in the other after cleaning
  if (clean1.includes(clean2) || clean2.includes(clean1)) {
    return true;
  }
  
  // Check for verb form variations (run, running, runs)
  const verbPatterns: [RegExp, string][] = [
    [/(.+)ing$/, '$1'], // running -> run
    [/(.+)s$/, '$1'],   // runs -> run
    [/(.+)ed$/, '$1'],  // walked -> walk
  ];
  
  for (const [pattern, replacement] of verbPatterns) {
    const stem1 = clean1.replace(pattern, replacement);
    const stem2 = clean2.replace(pattern, replacement);
    if (stem1 === stem2) return true;
  }
  
  return false;
}

// HTML content functions
function getIndexHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HANSEI - Voice Memory System</title>
    <script src="https://cdn.jsdelivr.net/npm/vis-network@9.1.2/standalone/umd/vis-network.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
            position: relative;
        }

        header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            background: linear-gradient(135deg, #fff 0%, #667eea 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        header p {
            font-size: 1.2em;
            opacity: 0.9;
            margin-bottom: 15px;
        }

        .demo-badge {
            position: absolute;
            top: -10px;
            right: 10px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);
        }

        .feature-highlights {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-bottom: 20px;
        }

        .feature {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            padding: 15px 20px;
            border-radius: 15px;
            border: 1px solid rgba(255,255,255,0.2);
            text-align: center;
            min-width: 150px;
        }

        .feature-icon {
            font-size: 2em;
            margin-bottom: 8px;
        }

        .feature-text {
            font-size: 0.9em;
            opacity: 0.9;
        }

        .main-grid {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 20px;
            margin-bottom: 20px;
        }

        .card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .card h2 {
            margin-bottom: 20px;
            color: #667eea;
            font-size: 1.5em;
        }

        /* Voice Input Section */
        .voice-controls {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .record-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 20px;
            border-radius: 50%;
            width: 100px;
            height: 100px;
            margin: 0 auto;
            cursor: pointer;
            font-size: 2em;
            transition: all 0.3s;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }

        .record-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
        }

        .record-btn.recording {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        .status {
            text-align: center;
            font-size: 1.1em;
            color: #666;
            min-height: 30px;
        }

        .status.active {
            color: #f5576c;
            font-weight: bold;
        }

        .text-input {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 1em;
            resize: vertical;
            min-height: 100px;
        }

        .text-input:focus {
            outline: none;
            border-color: #667eea;
        }

        .submit-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 1.1em;
            cursor: pointer;
            transition: all 0.3s;
        }

        .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }

        .submit-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }

        /* Document Upload Section */
        .upload-section {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
        
        .upload-area {
            border: 3px dashed #667eea;
            border-radius: 15px;
            padding: 30px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            background: #f8f9fa;
        }
        
        .upload-area:hover {
            border-color: #764ba2;
            background: #f0f1ff;
            transform: translateY(-2px);
        }
        
        .upload-area.dragover {
            border-color: #43e97b;
            background: #f0fff4;
        }
        
        .upload-prompt p {
            margin: 10px 0;
            color: #667eea;
            font-weight: bold;
        }
        
        .upload-prompt small {
            color: #999;
            font-size: 0.9em;
        }
        
        .upload-progress {
            text-align: center;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
            width: 0%;
        }
        
        .file-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin-top: 15px;
            text-align: left;
        }
        
        .file-info h4 {
            color: #667eea;
            margin-bottom: 10px;
        }
        
        .file-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 0.9em;
            color: #666;
        }

        /* Graph Section */
        #graph {
            width: 100%;
            height: 500px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            background: #fafafa;
        }

        .search-box {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }

        .search-input {
            flex: 1;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 1em;
        }

        .search-input:focus {
            outline: none;
            border-color: #667eea;
        }

        .search-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1em;
            transition: all 0.3s;
        }

        .search-btn:hover {
            background: #764ba2;
        }

        /* Results Section */
        .results {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
        }

        .result-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            border-left: 4px solid #667eea;
        }

        .result-card h3 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 1.1em;
        }

        .result-card p {
            color: #666;
            font-size: 0.95em;
            margin-bottom: 8px;
        }

        .entities {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 10px;
        }

        .entity-tag {
            background: #667eea;
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 0.85em;
        }

        .graph-stats {
            display: flex;
            justify-content: space-around;
            margin-top: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
        }

        .stat {
            text-align: center;
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }

        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: #667eea;
        }

        .error {
            background: #fee;
            border-left: 4px solid #f55;
            padding: 15px;
            border-radius: 10px;
            margin: 10px 0;
            color: #c33;
        }

        /* Chat Interface Styles */
        .chat-container {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        }

        .chat-container.open {
            transform: translateX(0);
        }

        .chat-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            cursor: pointer;
            font-size: 1.5em;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            z-index: 1001;
            transition: all 0.3s;
        }

        .chat-toggle:hover {
            transform: scale(1.1);
        }

        .chat-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 15px 15px 0 0;
            text-align: center;
            font-weight: bold;
        }

        .chat-messages {
            flex: 1;
            padding: 15px;
            overflow-y: auto;
            max-height: 350px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .chat-message {
            max-width: 80%;
            padding: 12px 15px;
            border-radius: 18px;
            font-size: 0.9em;
            line-height: 1.4;
        }

        .chat-message.user {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            align-self: flex-end;
            margin-left: auto;
        }

        .chat-message.hansei {
            background: #f8f9fa;
            color: #333;
            border: 1px solid #e0e0e0;
            align-self: flex-start;
        }

        .chat-message.hansei .source-hint {
            font-size: 0.8em;
            color: #667eea;
            margin-top: 5px;
            font-style: italic;
        }

        .chat-input-container {
            padding: 15px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
        }

        .chat-input {
            flex: 1;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 20px;
            font-size: 0.9em;
            outline: none;
            resize: none;
            max-height: 60px;
        }

        .chat-input:focus {
            border-color: #667eea;
        }

        .chat-send {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.3s;
        }

        .chat-send:hover {
            transform: translateY(-2px);
        }

        .chat-send:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }

        .insights-btn {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            margin-left: 10px;
            transition: all 0.3s;
        }

        .insights-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(240, 147, 251, 0.4);
        }

        .insights-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        }

        .insights-modal.open {
            display: flex;
        }

        .insights-content {
            background: white;
            border-radius: 15px;
            padding: 30px;
            max-width: 500px;
            max-height: 70vh;
            overflow-y: auto;
            margin: 20px;
        }

        .insights-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e0e0e0;
        }

        .insights-close {
            background: #f55;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 5px;
            cursor: pointer;
        }

        .insight-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
        }

        .insight-item h4 {
            color: #667eea;
            margin-bottom: 8px;
        }

        .insight-list {
            list-style: none;
            padding: 0;
        }

        .insight-list li {
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
            cursor: pointer;
            transition: background 0.2s;
        }

        .insight-list li:hover {
            background: rgba(102, 126, 234, 0.1);
        }

        .insight-results {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            max-height: 300px;
            overflow-y: auto;
        }

        .insight-results h5 {
            color: #667eea;
            margin-bottom: 10px;
        }

        .insight-results ul {
            list-style: none;
            padding: 0;
        }

        .insight-results li {
            padding: 8px;
            margin: 5px 0;
            background: white;
            border-radius: 5px;
            border-left: 3px solid #667eea;
        }

        @media (max-width: 768px) {
            .chat-container {
                width: calc(100vw - 40px);
                height: calc(100vh - 40px);
                top: 20px;
                right: 20px;
            }
            
            .main-grid {
                grid-template-columns: 1fr;
            }
            
            header h1 {
                font-size: 2em;
            }
        }

        @media (max-width: 768px) {
            .main-grid {
                grid-template-columns: 1fr;
            }
            
            header h1 {
                font-size: 2em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>⏺ HANSEI</h1>
            <p>Your AI-Powered Memory & Knowledge Graph</p>
        </header>

        <!-- Chat Toggle Button -->
        <button class="chat-toggle" id="chatToggle">💬</button>

        <!-- Chat Container -->
        <div class="chat-container" id="chatContainer">
            <div class="chat-header">
                💭 Chat with HANSEI
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="chat-message hansei">
                    Hello! I'm HANSEI, your memory companion. Ask me anything about your stored memories and I'll help you discover patterns and insights! 🧠
                </div>
            </div>
            <div class="chat-input-container">
                <textarea 
                    class="chat-input" 
                    id="chatInput" 
                    placeholder="Ask about your memories..."
                    rows="1"
                ></textarea>
                <button class="chat-send" id="chatSend">Send</button>
            </div>
        </div>

        <div class="main-grid">
            <!-- Voice Input Section -->
            <div class="card">
                <h2>🎤 Capture Memory</h2>
                <div class="voice-controls">
                    <button class="record-btn" id="recordBtn" title="Click to record">🎙️</button>
                    <div class="status" id="status">Ready to record</div>
                    
                    <div style="text-align: center; margin: 15px 0; color: #999;">or</div>
                    
                    <textarea 
                        class="text-input" 
                        id="textInput" 
                        placeholder="Type your thoughts here..."
                    ></textarea>
                    
                    <button class="submit-btn" id="submitBtn">💾 Save to Memory</button>
                    
                    <div style="text-align: center; margin: 20px 0; color: #999;">or</div>
                    
                    <!-- Document Upload Section -->
                    <div class="upload-section">
                        <h3 style="margin-bottom: 15px; color: #667eea;">📄 Upload Document</h3>
                        <div class="upload-area" id="uploadArea">
                            <input type="file" id="fileInput" accept=".txt,.pdf,.json,.md,.csv" style="display: none;">
                            <div class="upload-prompt" id="uploadPrompt">
                                <div style="font-size: 2em; margin-bottom: 10px;">📁</div>
                                <p>Click to upload or drag & drop files</p>
                                <small>Supports: PDF, TXT, JSON, MD, CSV (Max 10MB)</small>
                            </div>
                            <div class="upload-progress" id="uploadProgress" style="display: none;">
                                <div class="progress-bar">
                                    <div class="progress-fill" id="progressFill"></div>
                                </div>
                                <p id="uploadStatus">Uploading...</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 30px;">
                    <h3 style="margin-bottom: 15px; color: #667eea;">Recent Entries</h3>
                    <div id="recentEntries"></div>
                </div>
            </div>

            <!-- Graph Visualization Section -->
            <div class="card">
                <h2>🧠 Knowledge Graph</h2>
                <div class="search-box">
                    <input 
                        type="text" 
                        class="search-input" 
                        id="searchInput" 
                        placeholder="Search your memories..."
                        value="health goals running"
                    />
                    <button class="search-btn" id="searchBtn">🔍 Search</button>
                    <button class="insights-btn" id="insightsBtn">🧠 Insights</button>
                </div>
                
                <div id="graph"></div>
                
                <div class="graph-stats">
                    <div class="stat">
                        <div class="stat-value" id="nodeCount">0</div>
                        <div class="stat-label">Entities</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" id="edgeCount">0</div>
                        <div class="stat-label">Connections</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" id="memoryCount">0</div>
                        <div class="stat-label">Memories</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Results Section -->
        <div class="card">
            <h2>📊 Search Results</h2>
            <div class="results" id="results">
                <div class="loading">Search your memories to see results...</div>
            </div>
        </div>
    </div>

    <script>
        // Configuration
        const API_BASE = window.location.origin;
        const USER_ID = 'demo_user_' + Date.now();

        // State
        let mediaRecorder = null;
        let audioChunks = [];
        let network = null;
        let chatOpen = false;
        let conversationId = 'conv_' + Date.now();

        // Chat functionality
        function initChat() {
            const chatToggle = document.getElementById('chatToggle');
            const chatContainer = document.getElementById('chatContainer');
            const chatSend = document.getElementById('chatSend');
            const chatInput = document.getElementById('chatInput');

            // Toggle chat
            chatToggle.addEventListener('click', () => {
                chatOpen = !chatOpen;
                chatContainer.classList.toggle('open', chatOpen);
                if (chatOpen && chatInput) {
                    setTimeout(() => chatInput.focus(), 300);
                }
            });

            // Send message
            chatSend.addEventListener('click', () => sendChatMessage());
            
            // Enter key to send
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                }
            });

            // Auto-resize textarea
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = (chatInput.scrollHeight) + 'px';
            });
        }

        async function sendChatMessage() {
            const chatInput = document.getElementById('chatInput');
            const chatMessages = document.getElementById('chatMessages');
            const message = chatInput.value.trim();

            if (!message) return;

            // Add user message to chat
            addChatMessage(message, 'user');
            chatInput.value = '';
            chatInput.style.height = 'auto';

            try {
                // Send to HANSEI API
                const response = await fetch(API_BASE + '/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: message,
                        conversation_id: conversationId,
                        user_id: USER_ID
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    // Add HANSEI response
                    let responseText = result.answer || 'I received your message but could not generate a response.';
                    let sources = result.sources || [];
                    
                    addChatMessage(responseText, 'hansei', sources);
                } else {
                    addChatMessage('Sorry, I encountered an error: ' + (result.error || 'Unknown error'), 'hansei');
                }
            } catch (error) {
                console.error('Chat error:', error);
                addChatMessage('Sorry, I am having trouble connecting right now. Please try again.', 'hansei');
            }
        }

        function addChatMessage(text, sender, sources = []) {
            const chatMessages = document.getElementById('chatMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message ' + sender;
            
            let messageHtml = text;
            
            // Add sources if available
            if (sources && sources.length > 0) {
                const sourceHint = sources.length === 1 
                    ? 'Based on 1 memory' 
                    : 'Based on ' + sources.length + ' memories';
                messageHtml += '<div class="source-hint">' + sourceHint + '</div>';
            }
            
            messageDiv.innerHTML = messageHtml;
            chatMessages.appendChild(messageDiv);
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Insights functionality
        function initInsights() {
            const insightsBtn = document.getElementById('insightsBtn');
            const insightsModal = document.getElementById('insightsModal');
            const insightsClose = document.getElementById('insightsClose');

            insightsBtn.addEventListener('click', () => {
                insightsModal.classList.add('open');
            });

            insightsClose.addEventListener('click', () => {
                insightsModal.classList.remove('open');
            });

            // Close modal on outside click
            insightsModal.addEventListener('click', (e) => {
                if (e.target === insightsModal) {
                    insightsModal.classList.remove('open');
                }
            });
        }

        async function loadOrphans() {
            const resultsDiv = document.getElementById('insightResults');
            resultsDiv.innerHTML = '<div class="loading">Loading orphaned nodes...</div>';

            try {
                const response = await fetch(API_BASE + '/api/patterns/orphans');
                const result = await response.json();

                if (response.ok) {
                    displayInsightResults('Orphaned Nodes', result.orphans || [], 'These nodes have few connections and might represent isolated memories.');
                } else {
                    resultsDiv.innerHTML = '<div class="error">Failed to load orphaned nodes: ' + (result.message || 'Unknown error') + '</div>';
                }
            } catch (error) {
                resultsDiv.innerHTML = '<div class="error">Network error: ' + error.message + '</div>';
            }
        }

        async function loadHubs() {
            const resultsDiv = document.getElementById('insightResults');
            resultsDiv.innerHTML = '<div class="loading">Loading hub analysis...</div>';

            try {
                const response = await fetch(API_BASE + '/api/patterns/hubs');
                const result = await response.json();

                if (response.ok) {
                    displayInsightResults('Hub Analysis', result.hubs || [], 'These are highly connected nodes that serve as central themes in your memories.');
                } else {
                    resultsDiv.innerHTML = '<div class="error">Failed to load hub analysis: ' + (result.message || 'Unknown error') + '</div>';
                }
            } catch (error) {
                resultsDiv.innerHTML = '<div class="error">Network error: ' + error.message + '</div>';
            }
        }

        function displayInsightResults(title, items, description) {
            const resultsDiv = document.getElementById('insightResults');
            
            if (!items || items.length === 0) {
                resultsDiv.innerHTML = 
                    '<h5>' + title + '</h5>' +
                    '<p>' + description + '</p>' +
                    '<p><em>No results found. Try adding more memories!</em></p>';
                return;
            }

            let itemsHtml = items.map(item => {
                if (typeof item === 'string') {
                    return '<li>' + item + '</li>';
                } else {
                    return '<li><strong>' + (item.name || item.label || 'Unknown') + ':</strong> ' + (item.description || item.type || 'No description') + '</li>';
                }
            }).join('');

            resultsDiv.innerHTML = 
                '<h5>' + title + '</h5>' +
                '<p>' + description + '</p>' +
                '<ul>' + itemsHtml + '</ul>';
        }

        // Initialize graph
        function initGraph() {
            const container = document.getElementById('graph');
            const data = {
                nodes: new vis.DataSet([]),
                edges: new vis.DataSet([])
            };
            const options = {
                nodes: {
                    shape: 'dot',
                    size: 20,
                    font: {
                        size: 14,
                        color: '#333'
                    },
                    borderWidth: 2,
                    shadow: true
                },
                edges: {
                    width: 2,
                    arrows: 'to',
                    smooth: {
                        type: 'continuous'
                    },
                    font: {
                        size: 12,
                        align: 'middle'
                    }
                },
                physics: {
                    stabilization: true,
                    barnesHut: {
                        gravitationalConstant: -2000,
                        springConstant: 0.001,
                        springLength: 200
                    }
                },
                interaction: {
                    hover: true,
                    tooltipDelay: 100
                }
            };
            network = new vis.Network(container, data, options);
        }

        // Voice Recording
        document.getElementById('recordBtn').addEventListener('click', async () => {
            const btn = document.getElementById('recordBtn');
            const status = document.getElementById('status');

            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (e) => {
                        audioChunks.push(e.data);
                    };

                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        await uploadVoice(audioBlob);
                        stream.getTracks().forEach(track => track.stop());
                    };

                    mediaRecorder.start();
                    btn.classList.add('recording');
                    btn.textContent = '⏹️';
                    status.textContent = 'Recording... Click to stop';
                    status.classList.add('active');
                } catch (err) {
                    status.textContent = 'Microphone access denied';
                    console.error('Error accessing microphone:', err);
                }
            } else {
                mediaRecorder.stop();
                btn.classList.remove('recording');
                btn.textContent = '🎙️';
                status.textContent = 'Processing...';
            }
        });

        // Upload Voice
        async function uploadVoice(audioBlob) {
            const status = document.getElementById('status');
            try {
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.wav');
                formData.append('audio_format', 'wav');
                formData.append('user_id', USER_ID);

                const response = await fetch(API_BASE + '/api/voice/ingest', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                
                if (result.success) {
                    status.textContent = '✅ Voice processed successfully!';
                    status.classList.remove('active');
                    addRecentEntry(result.transcript, result.extracted);
                    setTimeout(() => {
                        status.textContent = 'Ready to record';
                    }, 3000);
                    // Auto-refresh graph
                    searchGraph();
                } else {
                    status.textContent = '❌ Error: ' + (result.error || 'Unknown error');
                    status.classList.remove('active');
                }
            } catch (err) {
                status.textContent = '❌ Upload failed';
                status.classList.remove('active');
                console.error('Upload error:', err);
            }
        }

        // Text Submission
        document.getElementById('submitBtn').addEventListener('click', async () => {
            const textInput = document.getElementById('textInput');
            const text = textInput.value.trim();
            
            if (!text) {
                alert('Please enter some text');
                return;
            }

            const btn = document.getElementById('submitBtn');
            const status = document.getElementById('status');
            btn.disabled = true;
            btn.textContent = '⏳ Processing...';
            status.textContent = 'Saving text...';
            status.classList.add('active');

            try {
                const response = await fetch(API_BASE + '/infer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        content: text,
                        user_id: USER_ID
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    textInput.value = '';
                    addRecentEntry(text, result.extracted);
                    btn.textContent = '✅ Saved!';
                    status.textContent = '✅ Text saved to memory!';
                    setTimeout(() => {
                        btn.textContent = '💾 Save to Memory';
                        btn.disabled = false;
                        status.textContent = 'Ready to record';
                        status.classList.remove('active');
                    }, 2000);
                    // Auto-refresh graph
                    searchGraph();
                } else {
                    btn.textContent = '❌ Error';
                    btn.disabled = false;
                    status.textContent = '❌ Error: ' + (result.error || 'Unknown error');
                    status.classList.add('active');
                    console.error('API error:', result);
                }
            } catch (err) {
                btn.textContent = '❌ Failed';
                btn.disabled = false;
                status.textContent = '❌ Network error';
                status.classList.add('active');
                console.error('Submit error:', err);
            }
        });

        // Document Upload functionality
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        const uploadPrompt = document.getElementById('uploadPrompt');
        const uploadProgress = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const uploadStatus = document.getElementById('uploadStatus');
        
        // Click to upload
        uploadArea.addEventListener('click', () => {
            if (uploadPrompt.style.display !== 'none') {
                fileInput.click();
            }
        });
        
        // File input change
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await uploadFile(file);
            }
        });
        
        // Drag and drop functionality
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', async (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                await uploadFile(file);
            }
        });
        
        // Upload file function
        async function uploadFile(file) {
            // Check file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                alert('File size exceeds 10MB limit');
                return;
            }
            
            // Show progress
            uploadPrompt.style.display = 'none';
            uploadProgress.style.display = 'block';
            uploadStatus.textContent = 'Uploading ' + file.name + '...';
            
            try {
                const formData = new FormData();
                formData.append('file', file);
                
                // Simulate progress
                let progress = 0;
                const progressInterval = setInterval(() => {
                    progress += Math.random() * 20;
                    if (progress > 90) progress = 90;
                    progressFill.style.width = progress + '%';
                }, 200);
                
                const response = await fetch(\`\${API_BASE}/api/process/document\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content: await file.text(),
                        type: file.type,
                        metadata: {
                            fileName: file.name,
                            fileSize: file.size,
                            uploadedAt: new Date().toISOString()
                        }
                    })
                });
                
                clearInterval(progressInterval);
                progressFill.style.width = '100%';
                
                const result = await response.json();
                
                if (response.ok && result.data) {
                    uploadStatus.textContent = '✅ File processed successfully!';
                    
                    // Show file info
                    showFileInfo(file, result.data);
                    
                    // Auto-refresh graph
                    setTimeout(searchGraph, 1000);
                    
                    // Reset after 3 seconds
                    setTimeout(() => {
                        resetUploadArea();
                    }, 3000);
                } else {
                    uploadStatus.textContent = '❌ Upload failed: ' + (result.error || 'Unknown error');
                    setTimeout(() => {
                        resetUploadArea();
                    }, 3000);
                }
            } catch (error) {
                console.error('Upload error:', error);
                uploadStatus.textContent = '❌ Upload failed: Network error';
                setTimeout(() => {
                    resetUploadArea();
                }, 3000);
            }
        }
        
        function resetUploadArea() {
            uploadPrompt.style.display = 'block';
            uploadProgress.style.display = 'none';
            progressFill.style.width = '0%';
            fileInput.value = '';
            
            // Remove any existing file info
            const existingInfo = uploadArea.querySelector('.file-info');
            if (existingInfo) {
                existingInfo.remove();
            }
        }
        
        function showFileInfo(file, result) {
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.innerHTML = \`
                <h4>📄 \${file.name}</h4>
                <div class="file-stats">
                    <div><strong>Size:</strong> \${(file.size / 1024).toFixed(1)} KB</div>
                    <div><strong>Type:</strong> \${file.type || 'Unknown'}</div>
                    <div><strong>Entities:</strong> \${result.entities?.length || 0}</div>
                    <div><strong>Keywords:</strong> \${result.keywords?.length || 0}</div>
                </div>
                \${result.summary ? \`<p style="margin-top: 10px; font-style: italic;">\${result.summary}</p>\` : ''}
            \`;
            
            uploadArea.appendChild(fileInfo);
        }

        // Add to recent entries
        function addRecentEntry(content, extracted) {
            const container = document.getElementById('recentEntries');
            const entry = document.createElement('div');
            entry.className = 'result-card';
            entry.style.marginBottom = '10px';
            
            const entities = extracted.entities || [];
            const entitiesHtml = entities.map(e => 
                '<span class="entity-tag">' + e.type + ': ' + e.content + '</span>'
            ).join('');

            entry.innerHTML = 
                '<p style="margin-bottom: 10px;"><strong>' + (content.substring(0, 100) + (content.length > 100 ? '...' : '')) + '</strong></p>' +
                '<div class="entities">' + entitiesHtml + '</div>';
            
            container.insertBefore(entry, container.firstChild);
            
            // Keep only last 3 entries
            while (container.children.length > 3) {
                container.removeChild(container.lastChild);
            }
        }

        // Search and visualize graph
        document.getElementById('searchBtn').addEventListener('click', searchGraph);

        async function searchGraph() {
            const query = document.getElementById('searchInput').value.trim() || 'all memories';
            const resultsDiv = document.getElementById('results');
            
            resultsDiv.innerHTML = '<div class="loading">Searching...</div>';

            try {
                const response = await fetch(API_BASE + '/api/graph?query=' + encodeURIComponent(query) + '&limit=50&user_id=' + USER_ID);
                const result = await response.json();

                if (result.success) {
                    displayGraph(result.graph);
                    displayResults(result.rawResults);
                } else {
                    resultsDiv.innerHTML = '<div class="error">Search failed: ' + result.error + '</div>';
                }
            } catch (err) {
                resultsDiv.innerHTML = '<div class="error">Network error: ' + err.message + '</div>';
                console.error('Search error:', err);
            }
        }

        // Display graph
        function displayGraph(graphData) {
            // Calculate dynamic weights for all nodes
            const enhancedNodes = graphData.nodes.map(node => {
                const dynamicWeight = calculateDynamicWeight(node, graphData.metadata || {});
                const temporalDecay = calculateTemporalDecay(node);
                const frequencyScore = calculateFrequencyScore(node, graphData.nodes);
                
                return {
                    id: node.id,
                    label: node.label,
                    title: \`Type: \${node.type}\\nBase Weight: \${node.weight}\\nDynamic Weight: \${dynamicWeight.toFixed(2)}\\nTemporal Decay: \${temporalDecay.toFixed(2)}\\nFrequency Score: \${frequencyScore.toFixed(2)}\`,
                    color: getNodeColor(node.type),
                    size: Math.max(10, 15 + (dynamicWeight * 50)) // Enhanced size with dynamic weight
                };
            });

            const edges = graphData.edges.map((edge, idx) => ({
                id: idx,
                from: edge.source,
                to: edge.target,
                label: edge.type,
                title: edge.type
            }));

            network.setData({ nodes: enhancedNodes, edges });
            
            // Update stats
            document.getElementById('nodeCount').textContent = enhancedNodes.length;
            document.getElementById('edgeCount').textContent = edges.length;
            document.getElementById('memoryCount').textContent = graphData.metadata?.totalNodes || 0;
        }

        // Get color by entity type
        function getNodeColor(type) {
            const colors = {
                'goal': '#667eea',
                'habit': '#f093fb',
                'person': '#4facfe',
                'project': '#43e97b',
                'emotion': '#fa709a',
                'object': '#ffd89b'
            };
            return colors[type] || '#999';
        }

        // Dynamic weight calculation functions
        function calculateDynamicWeight(node, metadata) {
            const baseWeight = node.weight || 0.5;
            const temporalDecay = calculateTemporalDecay(node);
            const frequencyBonus = calculateFrequencyBonus(node, metadata);
            const importanceMultiplier = calculateImportanceMultiplier(node);
            
            return Math.min(1.0, baseWeight * temporalDecay * importanceMultiplier + frequencyBonus);
        }
        
        function calculateTemporalDecay(node) {
            const now = new Date();
            const nodeDate = new Date(node.metadata?.created_at || node.metadata?.chunkSignature || now);
            const daysSince = (now - nodeDate) / (1000 * 60 * 60 * 24);
            
            // Exponential decay: newer nodes have higher weight
            // Half-life of 30 days
            const halfLife = 30;
            return Math.exp(-0.693 * daysSince / halfLife);
        }
        
        function calculateFrequencyScore(node, allNodes) {
            if (!allNodes) return 0.5;
            
            const nodeLabel = node.label.toLowerCase();
            const similarNodes = allNodes.filter(n => 
                n.label.toLowerCase().includes(nodeLabel) || 
                nodeLabel.includes(n.label.toLowerCase())
            );
            
            return Math.min(1.0, similarNodes.length / 10); // Normalize to 0-1
        }
        
        function calculateFrequencyBonus(node, metadata) {
            const mentionCount = metadata?.mentionCounts?.[node.label] || 1;
            return Math.min(0.3, mentionCount * 0.05); // Max 30% bonus
        }
        
        function calculateImportanceMultiplier(node) {
            const importanceMap = {
                'goal': 1.5,
                'project': 1.3,
                'person': 1.2,
                'habit': 1.1,
                'emotion': 1.0,
                'object': 0.9,
                'keyword': 0.8
            };
            
            return importanceMap[node.type] || 1.0;
        }

        // Display search results
        function displayResults(results) {
            const container = document.getElementById('results');
            
            if (!results || results.length === 0) {
                container.innerHTML = '<div class="loading">No results found. Try a different query!</div>';
                return;
            }

            container.innerHTML = results.map(r => 
                '<div class="result-card">' +
                    '<h3>Memory Match</h3>' +
                    '<p><strong>Score:</strong> ' + (r.score * 100).toFixed(1) + '%</p>' +
                    '<p>' + (r.text || r.content || 'No content available') + '</p>' +
                '</div>'
            ).join('');
        }

        // Real-time updates functionality
        function initRealTimeUpdates() {
            // Try WebSocket connection first, fallback to polling
            let updateInterval;
            let lastUpdateTime = Date.now();
            
            // Check for WebSocket support
            if (typeof WebSocket !== 'undefined') {
                // Attempt WebSocket connection
                try {
                    const wsUrl = API_BASE.replace('https://', 'wss://') + '/api/ws/graph-updates';
                    console.log('Attempting WebSocket connection to:', wsUrl);
                    
                    // For now, fall back to polling since WebSocket setup is complex
                    startPollingUpdates();
                } catch (error) {
                    console.warn('WebSocket connection failed, falling back to polling:', error);
                    startPollingUpdates();
                }
            } else {
                startPollingUpdates();
            }
            
            function startPollingUpdates() {
                updateInterval = setInterval(async () => {
                    try {
                        // Poll for graph updates every 10 seconds
                        const response = await fetch(\`\${API_BASE}/api/graph?query=recent_updates&since=\${lastUpdateTime}\`);
                        const result = await response.json();
                        
                        if (result.success && result.graph && result.graph.nodes.length > 0) {
                            // Check if graph has changed
                            const currentNodeCount = document.getElementById('nodeCount').textContent;
                            if (result.graph.nodes.length !== parseInt(currentNodeCount)) {
                                // Update the graph with new data
                                displayGraph(result.graph);
                                displayResults(result.rawResults || []);
                                
                                // Show notification
                                showUpdateNotification('Graph updated with new data!');
                            }
                            
                            lastUpdateTime = Date.now();
                        }
                    } catch (error) {
                        console.warn('Failed to poll for updates:', error);
                    }
                }, 10000); // Poll every 10 seconds
            }
            
            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                if (updateInterval) {
                    clearInterval(updateInterval);
                }
            });
        }
        
        function showUpdateNotification(message) {
            // Create notification element
            const notification = document.createElement('div');
            notification.className = 'update-notification';
            notification.textContent = message;
            notification.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, \#43e97b 0\%, \#38f9d7 100\%);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                font-weight: bold;
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
            \`;
            
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-in forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }

        // Initialize
        initGraph();
        initChat();
        initInsights();
        initRealTimeUpdates();
        
        // Auto-search on load
        setTimeout(() => {
            document.getElementById('searchBtn').click();
        }, 500);
    </script>

    <!-- Insights Modal -->
    <div class="insights-modal" id="insightsModal">
        <div class="insights-content">
            <div class="insights-header">
                <h3>🧠 Memory Insights</h3>
                <button class="insights-close" id="insightsClose">&times;</button>
            </div>
            <div class="insights-body">
                <div class="insight-item">
                    <h4>🔍 Pattern Detection</h4>
                    <div class="insight-list">
                        <button class="insights-btn" onclick="loadOrphans()">🔗 Orphaned Nodes</button>
                        <button class="insights-btn" onclick="loadHubs()">🌟 Hub Analysis</button>
                    </div>
                </div>
                <div id="insightResults" class="insight-results"></div>
            </div>
        </div>
    </div>

</body>
</html>`;
}

function getIndex3DHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HANSEI - 3D Memory Graph</title>
    <script src="https://unpkg.com/3d-force-graph"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0e27;
            color: white;
            overflow: hidden;
        }

        #header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: rgba(10, 14, 39, 0.95);
            backdrop-filter: blur(10px);
            padding: 20px;
            z-index: 1000;
            border-bottom: 2px solid #667eea;
        }

        h1 {
            font-size: 2em;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }

        .controls {
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .search-container {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        #searchInput {
            padding: 8px 12px;
            border: 1px solid #667eea;
            border-radius: 5px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 0.9em;
            width: 200px;
        }

        #searchInput::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }

        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.3s;
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }

        #graph {
            width: 100vw;
            height: 100vh;
            background: radial-gradient(ellipse at center, #1e3c72 0%, #0a0e27 70%);
        }

        .stats {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(10, 14, 39, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            padding: 15px;
            border: 1px solid #667eea;
            display: flex;
            gap: 20px;
        }

        .stat {
            text-align: center;
        }

        .stat-value {
            font-size: 1.5em;
            font-weight: bold;
            color: #667eea;
        }

        .stat-label {
            font-size: 0.8em;
            color: rgba(255, 255, 255, 0.7);
        }

        .info {
            position: fixed;
            top: 120px;
            right: 20px;
            background: rgba(10, 14, 39, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            padding: 15px;
            border: 1px solid #667eea;
            max-width: 300px;
        }

        .loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(10, 14, 39, 0.9);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            padding: 20px;
            border: 1px solid #667eea;
            text-align: center;
        }
    </style>
</head>
<body>
    <div id="header">
        <h1>🧠 HANSEI 3D Memory Graph</h1>
        <div class="controls">
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search memories..." value="all memories">
                <button onclick="searchGraph()">🔍 Search</button>
            </div>
            <button onclick="window.location.href='/'">📊 2D View</button>
            <button onclick="resetCamera()">🎯 Reset View</button>
            <button onclick="togglePhysics()">⚡ Physics</button>
        </div>
    </div>

    <div id="graph"></div>

    <div class="stats">
        <div class="stat">
            <div class="stat-value" id="nodeCount">0</div>
            <div class="stat-label">Entities</div>
        </div>
        <div class="stat">
            <div class="stat-value" id="edgeCount">0</div>
            <div class="stat-label">Connections</div>
        </div>
        <div class="stat">
            <div class="stat-value" id="memoryCount">0</div>
            <div class="stat-label">Memories</div>
        </div>
    </div>

    <div class="info" id="nodeInfo" style="display: none;">
        <h4 id="nodeTitle">Node Info</h4>
        <p id="nodeDetails">Hover over a node to see details</p>
    </div>

    <div class="loading" id="loading">
        <p>Loading your memory graph...</p>
    </div>

    <script>
        // Configuration
        const API_BASE = window.location.origin;
        const USER_ID = 'demo_user_' + Date.now();

        // State
        let graph3d = null;
        let physicsEnabled = true;

        // Initialize 3D Graph
        function init3DGraph() {
            const container = document.getElementById('graph');
            
            graph3d = ForceGraph3D()(container)
                .backgroundColor('#0a0e27')
                .nodeLabel('label')
                .nodeColor(node => getNodeColor(node.type))
                .nodeVal(node => Math.max(5, node.weight * 20))
                .linkColor(() => 'rgba(255, 255, 255, 0.3)')
                .linkWidth(2)
                .linkDirectionalArrowLength(6)
                .linkDirectionalArrowRelPos(1)
                .linkCurvature(0.1)
                .onNodeHover(node => {
                    const infoDiv = document.getElementById('nodeInfo');
                    if (node) {
                        document.getElementById('nodeTitle').textContent = node.label;
                        document.getElementById('nodeDetails').innerHTML = 
                            'Type: ' + node.type + '<br>' +
                            'Weight: ' + node.weight + '<br>' +
                            'Connections: ' + (node.connections || 0);
                        infoDiv.style.display = 'block';
                    } else {
                        infoDiv.style.display = 'none';
                    }
                })
                .onNodeClick(node => {
                    // Focus camera on node
                    const distance = 200;
                    graph3d.cameraPosition(
                        { x: node.x + distance, y: node.y, z: node.z + distance },
                        node,
                        3000
                    );
                });

            // Initial camera position
            setTimeout(() => {
                graph3d.cameraPosition({ x: 0, y: 0, z: 1000 });
            }, 1000);
        }

        // Get color by entity type
        function getNodeColor(type) {
            const colors = {
                'goal': '#667eea',
                'habit': '#f093fb', 
                'person': '#4facfe',
                'project': '#43e97b',
                'emotion': '#fa709a',
                'object': '#ffd89b'
            };
            return colors[type] || '#999999';
        }

        // Search and load graph
        async function searchGraph() {
            const query = document.getElementById('searchInput').value.trim() || 'all memories';
            const loadingDiv = document.getElementById('loading');
            
            loadingDiv.style.display = 'block';

            try {
                const response = await fetch(API_BASE + '/api/graph?query=' + encodeURIComponent(query) + '&limit=100&user_id=' + USER_ID);
                const result = await response.json();

                if (result.success) {
                    displayGraph3D(result.graph);
                } else {
                    console.error('Search failed:', result.error);
                    alert('Search failed: ' + result.error);
                }
            } catch (err) {
                console.error('Search error:', err);
                alert('Network error: ' + err.message);
            } finally {
                loadingDiv.style.display = 'none';
            }
        }

        // Display 3D graph
        function displayGraph3D(graphData) {
            const nodes = graphData.nodes.map(node => ({
                id: node.id,
                label: node.label,
                type: node.type,
                weight: node.weight,
                x: (Math.random() - 0.5) * 1000,
                y: (Math.random() - 0.5) * 1000,
                z: (Math.random() - 0.5) * 1000
            }));

            const links = graphData.edges.map(edge => ({
                source: edge.source,
                target: edge.target,
                type: edge.type
            }));

            // Filter out broken links
            const validLinks = links.filter(link => {
                const sourceExists = nodes.find(n => n.id === link.source);
                const targetExists = nodes.find(n => n.id === link.target);
                return sourceExists && targetExists;
            });

            // Count connections for each node
            nodes.forEach(node => {
                node.connections = validLinks.filter(link => 
                    link.source === node.id || link.target === node.id
                ).length;
            });

            graph3d.graphData({ nodes, links: validLinks });
            
            // Update stats
            document.getElementById('nodeCount').textContent = nodes.length;
            document.getElementById('edgeCount').textContent = validLinks.length;
            document.getElementById('memoryCount').textContent = graphData.metadata?.totalNodes || nodes.length;
        }

        // Reset camera
        function resetCamera() {
            graph3d.cameraPosition({ x: 0, y: 0, z: 1000 }, { x: 0, y: 0, z: 0 }, 2000);
        }

        // Toggle physics
        function togglePhysics() {
            physicsEnabled = !physicsEnabled;
            if (physicsEnabled) {
                graph3d.d3ReheatSimulation();
            } else {
                graph3d.pauseAnimation();
            }
        }

        // Enter key for search
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchGraph();
            }
        });

        // Initialize
        init3DGraph();
        
        // Auto-search on load
        setTimeout(() => {
            searchGraph();
        }, 1000);
    </script>
</body>
</html>`;
}

// Temporal analysis helper functions
function analyzeMomentum(results: any[]): any {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const momentum = {
    weekly: { entries: 0, topics: new Set(), trend: 'stable' },
    monthly: { entries: 0, topics: new Set(), trend: 'stable' },
    active_goals: [],
    recurring_themes: []
  };
  
  results.forEach(result => {
    try {
      const doc = JSON.parse(result.text || '{}');
      const entryDate = new Date(doc.created_at || result.createdAt || now);
      
      // Weekly momentum
      if (entryDate >= oneWeekAgo) {
        momentum.weekly.entries++;
        doc.entities?.forEach((entity: any) => {
          momentum.weekly.topics.add(entity.type + ':' + entity.content);
        });
      }
      
      // Monthly momentum
      if (entryDate >= oneMonthAgo) {
        momentum.monthly.entries++;
        doc.entities?.forEach((entity: any) => {
          momentum.monthly.topics.add(entity.type + ':' + entity.content);
        });
      }
      
      // Track goals with momentum
      doc.entities?.filter((e: any) => e.type === 'goal').forEach((goal: any) => {
        const existing = momentum.active_goals.find(g => g.name === goal.content);
        if (existing) {
          existing.mentions++;
          existing.last_mentioned = entryDate;
        } else {
          momentum.active_goals.push({
            name: goal.content,
            mentions: 1,
            first_mentioned: entryDate,
            last_mentioned: entryDate
          });
        }
      });
    } catch (e) {}
  });
  
  // Calculate trends
  momentum.weekly.trend = momentum.weekly.entries >= 3 ? 'increasing' : momentum.weekly.entries >= 1 ? 'stable' : 'decreasing';
  momentum.monthly.trend = momentum.monthly.entries >= 8 ? 'increasing' : momentum.monthly.entries >= 4 ? 'stable' : 'decreasing';
  
  return momentum;
}

function detectAbandonedGoals(results: any[]): any[] {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const goals = new Map();
  
  results.forEach(result => {
    try {
      const doc = JSON.parse(result.text || '{}');
      const entryDate = new Date(doc.created_at || result.createdAt || now);
      
      doc.entities?.filter((e: any) => e.type === 'goal').forEach((goal: any) => {
        const key = goal.content.toLowerCase();
        if (!goals.has(key)) {
          goals.set(key, {
            name: goal.content,
            first_mentioned: entryDate,
            last_mentioned: entryDate,
            mentions: 1,
            weight: goal.weight || 0.5
          });
        } else {
          const existing = goals.get(key);
          existing.mentions++;
          if (entryDate > existing.last_mentioned) {
            existing.last_mentioned = entryDate;
          }
        }
      });
    } catch (e) {}
  });
  
  // Find abandoned goals (high weight but not mentioned recently)
  const abandoned = Array.from(goals.values())
    .filter(goal => 
      goal.weight > 0.6 && 
      goal.last_mentioned < twoWeeksAgo &&
      goal.mentions >= 2
    )
    .sort((a, b) => b.weight - a.weight);
  
  return abandoned;
}

function analyzeConsistency(results: any[]): any {
  const consistency = {
    habit_consistency: {},
    goal_progress: {},
    overall_score: 0
  };
  
  const habits = new Map();
  const goals = new Map();
  
  results.forEach(result => {
    try {
      const doc = JSON.parse(result.text || '{}');
      const entryDate = new Date(doc.created_at || result.createdAt || new Date());
      
      // Track habits
      doc.entities?.filter((e: any) => e.type === 'habit').forEach((habit: any) => {
        const key = habit.content.toLowerCase();
        if (!habits.has(key)) {
          habits.set(key, {
            name: habit.content,
            mentions: [entryDate],
            consistency_score: 0
          });
        } else {
          habits.get(key).mentions.push(entryDate);
        }
      });
      
      // Track goals
      doc.entities?.filter((e: any) => e.type === 'goal').forEach((goal: any) => {
        const key = goal.content.toLowerCase();
        if (!goals.has(key)) {
          goals.set(key, {
            name: goal.content,
            mentions: [entryDate],
            progress_score: 0
          });
        } else {
          goals.get(key).mentions.push(entryDate);
        }
      });
    } catch (e) {}
  });
  
  // Calculate consistency scores
  habits.forEach((habit, key) => {
    const mentions = habit.mentions.sort((a: Date, b: Date) => a.getTime() - b.getTime());
    let gaps = [];
    for (let i = 1; i < mentions.length; i++) {
      const gap = (mentions[i].getTime() - mentions[i-1].getTime()) / (1000 * 60 * 60 * 24);
      gaps.push(gap);
    }
    
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b) / gaps.length : 0;
    const consistencyScore = Math.max(0, 1 - (avgGap / 7)); // Ideal is daily (gap = 1)
    
    consistency.habit_consistency[habit.name] = {
      mentions: mentions.length,
      average_gap_days: avgGap,
      consistency_score: consistencyScore
    };
  });
  
  return consistency;
}

function generateMomentumInsights(momentum: any): string[] {
  const insights = [];
  
  if (momentum.weekly.trend === 'increasing') {
    insights.push('📈 Your activity has increased this week - great momentum!');
  } else if (momentum.weekly.trend === 'decreasing') {
    insights.push('📉 Activity has slowed down this week. Consider refocusing on your goals.');
  }
  
  if (momentum.active_goals.length > 3) {
    insights.push('🎯 You have many active goals. Consider prioritizing the top 3 for better focus.');
  }
  
  const highMentionGoals = momentum.active_goals.filter((g: any) => g.mentions >= 3);
  if (highMentionGoals.length > 0) {
    insights.push(`💪 Strong focus on: ${highMentionGoals.map((g: any) => g.name).join(', ')}`);
  }
  
  return insights;
}

function generateAbandonedGoalsInsights(abandoned: any[]): string[] {
  const insights = [];
  
  if (abandoned.length === 0) {
    insights.push('✅ No abandoned goals detected - great consistency!');
  } else {
    insights.push(`⚠️  Found ${abandoned.length} potentially abandoned goal(s)`);
    abandoned.slice(0, 3).forEach(goal => {
      const daysSince = Math.floor((new Date().getTime() - goal.last_mentioned.getTime()) / (1000 * 60 * 60 * 24));
      insights.push(`• "${goal.name}" - last mentioned ${daysSince} days ago`);
    });
  }
  
  return insights;
}

function generateConsistencyInsights(consistency: any): string[] {
  const insights = [];
  
  const habitNames = Object.keys(consistency.habit_consistency);
  if (habitNames.length === 0) {
    insights.push('📝 No habits tracked yet. Consider setting up habit tracking.');
    return insights;
  }
  
  const consistentHabits = habitNames.filter(name => 
    consistency.habit_consistency[name].consistency_score > 0.7
  );
  
  if (consistentHabits.length > 0) {
    insights.push(`🔥 Strong consistency in: ${consistentHabits.join(', ')}`);
  }
  
  const inconsistentHabits = habitNames.filter(name => 
    consistency.habit_consistency[name].consistency_score < 0.3
  );
  
  if (inconsistentHabits.length > 0) {
    insights.push(`⚡ Need more consistency: ${inconsistentHabits.join(', ')}`);
  }
  
  return insights;
}

// Proactive check-in helper functions
function calculateNextCheckin(frequency: string): string {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      now.setDate(now.getDate() + 7); // Default to weekly
  }
  
  return now.toISOString();
}

async function generateCheckinMessage(env: any, userId: string): Promise<any> {
  try {
    // Analyze recent activity for personalized check-in
    const searchResult = await env.AGENT_MEMORY.searchSemanticMemory('recent activities goals');
    const results = searchResult.documentSearchResponse?.results || [];
    
    // Get momentum analysis
    const momentum = analyzeMomentum(results);
    
    // Get abandoned goals
    const abandoned = detectAbandonedGoals(results);
    
    // Generate personalized check-in based on analysis
    let message = 'Hello! Time for your regular check-in. ';
    
    if (momentum.weekly.trend === 'increasing') {
      message += 'I noticed you\'ve been quite active this week - that\'s fantastic! ';
    } else if (momentum.weekly.trend === 'decreasing') {
      message += 'It looks like things have been quieter lately. That\'s totally normal. ';
    }
    
    if (abandoned.length > 0) {
      message += `I wanted to check in about "${abandoned[0].name}" - I haven\'t heard about it recently. `;
    }
    
    if (momentum.active_goals.length > 0) {
      const topGoal = momentum.active_goals.sort((a: any, b: any) => b.mentions - a.mentions)[0];
      message += `How are you feeling about your progress on "${topGoal.name}"? `;
    }
    
    message += 'What\'s one thing you\'re excited about right now?';
    
    return {
      message,
      type: 'proactive_checkin',
      context: {
        momentum_trend: momentum.weekly.trend,
        active_goals_count: momentum.active_goals.length,
        abandoned_goals_count: abandoned.length,
        recent_activity: momentum.weekly.entries
      },
      suggestions: generateCheckinSuggestions(momentum, abandoned)
    };
  } catch (error) {
    // Fallback to generic check-in
    return {
      message: 'Hello! How are you doing today? I\'d love to hear about what you\'re working on.',
      type: 'generic_checkin',
      context: {},
      suggestions: [
        'Tell me about your current goals',
        'What challenges are you facing?',
        'Share something positive from your day'
      ]
    };
  }
}

function generateCheckinSuggestions(momentum: any, abandoned: any[]): string[] {
  const suggestions = [];
  
  if (momentum.active_goals.length > 0) {
    const topGoal = momentum.active_goals.sort((a: any, b: any) => b.mentions - a.mentions)[0];
    suggestions.push(`Update me on "${topGoal.name}"`);
  }
  
  if (abandoned.length > 0) {
    suggestions.push(`I want to revisit "${abandoned[0].name}"`);
  }
  
  if (momentum.weekly.trend === 'decreasing') {
    suggestions.push('I need help getting back on track');
    suggestions.push('Let me share what\'s been challenging');
  } else {
    suggestions.push('I want to celebrate a recent win');
    suggestions.push('I have a new goal to work on');
  }
  
  suggestions.push('Ask me about my mood today');
  
  return suggestions.slice(0, 4); // Limit to 4 suggestions
}

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    const response = await app.fetch(request, this.env);
    
    // Add CORS headers to every response
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
}
