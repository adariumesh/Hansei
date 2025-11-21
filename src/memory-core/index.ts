import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createLogger } from '../shared/logger.js';
import { Env } from './raindrop.gen.js';
import { MemoryRouter } from '../shared/memory-router.js'; // Import MemoryRouter

const serviceLogger = createLogger('memory-core');

interface MemoryEntry {
  id: string;
  content: string;
  user_id: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'memory-core', timestamp: new Date().toISOString() });
});

// This function is now the primary storage logic
const storeMemory = async (env: Env, input: string, userId: string, metadata: any) => {
  const router = new MemoryRouter(env);
  const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  const memoryEntry = {
    id: memoryId,
    content: input,
    user_id: userId || 'anonymous',
    timestamp: new Date().toISOString(),
    metadata: metadata || {}
  };

  const context = router.classifyMemoryContext(input, metadata);
  await router.routeMemory(memoryEntry, context);
  
  return memoryEntry;
};

app.post('/api/store', async (c) => {
  try {
    const { input, options } = await c.req.json();
    const { user_id, metadata } = options || {};
    
    if (!input || typeof input !== 'string') {
      return c.json({ error: 'Input content is required' }, 400);
    }
    
    const memoryEntry = await storeMemory(c.env, input, user_id, metadata);
    
    return c.json({
      success: true,
      id: memoryEntry.id,
      stored_at: memoryEntry.timestamp
    });
  } catch (error) {
    serviceLogger.error('Failed to store memory', { error: error instanceof Error ? error.message : 'Unknown error' });
    return c.json({ error: 'Failed to store memory' }, 500);
  }
});

app.post('/api/graph/store', async (c) => {
  try {
    const { input, options } = await c.req.json();
    const { user_id, metadata } = options || {};
    
    if (!input || typeof input !== 'string') {
      return c.json({ error: 'Input content is required' }, 400);
    }
    
    const memoryEntry = await storeMemory(c.env, input, user_id, metadata);
    
    return c.json({
      success: true,
      id: memoryEntry.id,
      stored_at: memoryEntry.timestamp
    });
  } catch (error) {
    serviceLogger.error('Failed in /api/graph/store', { error: error instanceof Error ? error.message : 'Unknown error' });
    return c.json({ error: 'Failed to store memory' }, 500);
  }
});

app.get('/api/retrieve', async (c) => {
  try {
    const user_id = c.req.query('user_id');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const router = new MemoryRouter(c.env);
    // Use user_id as the query to find all memories for that user
    const allMemories = await router.searchAllTiers(user_id || '', 1000); 
    
    const userMemories = allMemories.filter((m: any) => m.user_id === user_id);

    const memories = userMemories.slice(offset, offset + limit);
    
    return c.json({
      success: true,
      memories,
      count: memories.length,
      totalCount: userMemories.length
    });
  } catch (error) {
    serviceLogger.error('Failed to retrieve memories', { error: error instanceof Error ? error.message : 'Unknown error' });
    return c.json({ error: 'Failed to retrieve memories' }, 500);
  }
});

app.get('/api/search', async (c) => {
  try {
    const query = c.req.query('q');
    const user_id = c.req.query('user_id');
    const limit = parseInt(c.req.query('limit') || '10');
    
    if (!query) {
      return c.json({ error: 'Search query is required' }, 400);
    }
    
    const router = new MemoryRouter(c.env);
    const allMemories = await router.searchAllTiers(query, limit);

    const userMemories = user_id 
      ? allMemories.filter((m: any) => m.user_id === user_id)
      : allMemories;
    
    return c.json({
      success: true,
      query,
      results: userMemories,
      count: userMemories.length
    });
  } catch (error) {
    serviceLogger.error('Memory search failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return c.json({ error: 'Memory search failed' }, 500);
  }
});

app.post('/api/clear', async (c) => {
  try {
    const { user_id, confirm } = await c.req.json();
    
    if (!user_id || !confirm) {
      return c.json({ error: 'user_id and confirm=true are required' }, 400);
    }
    
    const router = new MemoryRouter(c.env);
    const result = await router.deleteAllMemoriesForUser(user_id);
    
    return c.json({
      success: true,
      message: `Memory clear complete. Deleted ${result.deleted} memories.`,
      ...result
    });
  } catch (error) {
    serviceLogger.error('Failed to clear memories', { error: error instanceof Error ? error.message : String(error) });
    return c.json({
      error: 'Memory clear failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});


export default class extends Service<Env> {
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  }
}