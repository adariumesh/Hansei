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

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
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

    return c.json({
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
    });
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

    return c.json({
      success: true,
      answer,
      sources: results.slice(0, 5).map((r: any) => r.chunkSignature),
      memoryCount: results.length
    });
  } catch (error) {
    return c.json({ 
      error: 'Chat query failed', 
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
