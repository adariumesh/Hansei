import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { 
  createMemoryNode, 
  getMemoryNode, 
  traverseGraph,
  createMemoryEdge,
  analyzeGraphStructure,
  detectCycles,
  findShortestPath 
} from './utils.js';
import { MemoryIngestRequest, GraphQuery } from './interfaces.js';

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Memory ingestion endpoint
app.post('/api/memories/ingest', async (c) => {
  try {
    const data: MemoryIngestRequest = await c.req.json();
    
    // Validate required fields
    if (!data.content || !data.type) {
      return c.json({ error: 'Content and type are required' }, 400);
    }
    
    if (data.content.trim() === '') {
      return c.json({ error: 'Content cannot be empty' }, 400);
    }

    // Create the memory node (will throw "Not implemented" for now)
    const node = await createMemoryNode(c.env, data.content, data.type, data.metadata);
    
    return c.json({
      node_id: node.id,
      success: true,
      relationships_created: 0
    });
  } catch (error) {
    return c.json({
      error: 'Failed to ingest memory',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Memory retrieval endpoint
app.get('/api/memories/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    if (!id || id.trim() === '') {
      return c.json({ error: 'Memory ID is required' }, 400);
    }
    
    const node = await getMemoryNode(c.env, id);
    
    if (!node) {
      return c.json({ error: 'Memory not found' }, 404);
    }
    
    return c.json(node);
  } catch (error) {
    return c.json({
      error: 'Failed to retrieve memory',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Graph traversal endpoint
app.get('/api/graph/traverse', async (c) => {
  try {
    const queryParam = c.req.query('query');
    
    if (!queryParam) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }
    
    let query: GraphQuery;
    try {
      query = JSON.parse(queryParam);
    } catch (e) {
      return c.json({ error: 'Invalid query format' }, 400);
    }
    
    const result = await traverseGraph(c.env, query);
    
    return c.json(result);
  } catch (error) {
    return c.json({
      error: 'Failed to traverse graph',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}