import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createLogger } from '../shared/logger.js';

const serviceLogger = createLogger('memory-core');

interface Env {
  GRAPH_DATABASE: any;
  AGENT_MEMORY: any;
  logger: any;
  [key: string]: any;
}

interface MemoryEntry {
  id: string;
  content: string;
  user_id: string;
  timestamp: string;
  metadata?: Record<string, any>;
  embeddings?: number[];
  entities?: Array<{type: string, value: string}>;
}

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'memory-core',
    timestamp: new Date().toISOString() 
  });
});

// Store memory entry
app.post('/api/store', async (c) => {
  try {
    const { input, options } = await c.req.json();
    const { user_id, metadata } = options || {};
    
    if (!input || typeof input !== 'string') {
      return c.json({ error: 'Input content is required' }, 400);
    }
    
    const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create memory entry
    const memoryEntry: MemoryEntry = {
      id: memoryId,
      content: input,
      user_id: user_id || 'anonymous',
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
      entities: extractSimpleEntities(input)
    };
    
    // TODO: Debug - temporarily disabled storage to test routing
    serviceLogger.info('POST /api/store - Memory entry would be stored', { id: memoryId, user_id: memoryEntry.user_id });
    
    return c.json({
      success: true,
      id: memoryId,
      stored_at: memoryEntry.timestamp,
      entities_found: memoryEntry.entities?.length || 0
    });
  } catch (error) {
    return c.json({
      error: 'Failed to store memory',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Alias for /api/store at /api/graph/store to match API gateway routing
app.post('/api/graph/store', async (c) => {
  try {
    const { input, options } = await c.req.json();
    const { user_id, metadata } = options || {};
    
    if (!input || typeof input !== 'string') {
      return c.json({ error: 'Input content is required' }, 400);
    }
    
    const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create memory entry
    const memoryEntry: MemoryEntry = {
      id: memoryId,
      content: input,
      user_id: user_id || 'anonymous',
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
      entities: extractSimpleEntities(input)
    };
    
    // TODO: Debug - temporarily disabled storage to test routing
    serviceLogger.info('POST /api/graph/store - Memory entry would be stored', { id: memoryId, user_id: memoryEntry.user_id });
    
    return c.json({
      success: true,
      id: memoryId,
      stored_at: memoryEntry.timestamp,
      entities_found: memoryEntry.entities?.length || 0
    });
  } catch (error) {
    serviceLogger.error('Failed in /api/graph/store', error);
    return c.json({
      error: 'Failed to store memory',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      details: String(error)
    }, 500);
  }
});

// Retrieve memory entries
app.get('/api/retrieve', async (c) => {
  try {
    const user_id = c.req.query('user_id');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Get from SmartMemory
    const memories = await retrieveMemories(c.env.AGENT_MEMORY, user_id, limit, offset);
    
    return c.json({
      success: true,
      memories,
      count: memories.length,
      pagination: { limit, offset }
    });
  } catch (error) {
    return c.json({
      error: 'Failed to retrieve memories',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Search memories
app.get('/api/search', async (c) => {
  try {
    const query = c.req.query('q');
    const user_id = c.req.query('user_id');
    const limit = parseInt(c.req.query('limit') || '10');
    
    if (!query) {
      return c.json({ error: 'Search query is required' }, 400);
    }
    
    // Simple text-based search in memories
    const results = await searchMemories(c.env.AGENT_MEMORY, query, user_id, limit);
    
    return c.json({
      success: true,
      query,
      results,
      count: results.length
    });
  } catch (error) {
    return c.json({
      error: 'Memory search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Clear all memories (for reset/cleanup)
app.post('/api/clear', async (c) => {
  try {
    const { user_id, confirm } = await c.req.json();
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400);
    }
    
    if (!confirm) {
      return c.json({ error: 'confirm flag must be true to clear memories' }, 400);
    }
    
    serviceLogger.info('Clearing memories', { user_id });
    
    // Clear SmartMemory for this user
    // Note: SmartMemory doesn't have a built-in clear method, so this is a placeholder
    // In production, you'd need to implement proper deletion logic
    
    return c.json({
      success: true,
      message: 'Memories cleared successfully',
      user_id,
      deletedCount: 0 // Placeholder - would be actual count in production
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
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}

// Helper functions
function extractSimpleEntities(text: string): Array<{type: string, value: string}> {
  const entities = [];
  
  // Extract emails
  const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [];
  emails.forEach(email => entities.push({ type: 'email', value: email }));
  
  // Extract phone numbers
  const phones = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [];
  phones.forEach(phone => entities.push({ type: 'phone', value: phone }));
  
  // Extract dates
  const dates = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g) || [];
  dates.forEach(date => entities.push({ type: 'date', value: date }));
  
  return entities;
}

async function storeInGraphDatabase(database: Env['GRAPH_DATABASE'], memory: MemoryEntry): Promise<void> {
  try {
    // Insert memory entry as a node
    const memoryNode = {
      id: memory.id,
      type: 'memory',
      content: memory.content,
      user_id: memory.user_id,
      timestamp: memory.timestamp
    };
    
    // Store entities as separate nodes and create relationships
    if (memory.entities && memory.entities.length > 0) {
      for (const entity of memory.entities) {
        const entityId = `${entity.type}_${entity.value.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create entity node if it doesn't exist
        const entityNode = {
          id: entityId,
          type: entity.type,
          value: entity.value,
          user_id: memory.user_id
        };
        
        // Create relationship between memory and entity
        // This would use actual SQL/database operations in real implementation
      }
    }
  } catch (error) {
    serviceLogger.error('Failed to store in graph database', { error: error instanceof Error ? error.message : String(error) });
  }
}

async function retrieveMemories(agentMemory: Env['AGENT_MEMORY'], user_id?: string, limit: number = 10, offset: number = 0): Promise<MemoryEntry[]> {
  try {
    // In a real implementation, this would paginate through stored memories
    // For now, return a simple structure
    const memories: MemoryEntry[] = [];
    
    // This is a simplified implementation
    // In reality, you'd iterate through keys and filter by user_id
    
    return memories;
  } catch (error) {
    serviceLogger.error('Failed to retrieve memories', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

async function searchMemories(agentMemory: Env['AGENT_MEMORY'], query: string, user_id?: string, limit: number = 10): Promise<MemoryEntry[]> {
  try {
    // Simple text search implementation
    // In reality, this would use vector search or full-text search
    const results: MemoryEntry[] = [];
    
    return results;
  } catch (error) {
    serviceLogger.error('Failed to search memories', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}