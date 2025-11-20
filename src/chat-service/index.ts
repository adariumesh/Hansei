import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { Env } from './raindrop.gen.js';
import { createLogger } from '../shared/logger.js';

const serviceLogger = createLogger('chat-service');

/**
 * Chat Service
 * 
 * Handles conversational AI and document Q&A
 * 
 * Routes:
 * - POST /api/chat - Main chat endpoint with memory context
 * - POST /api/document-chat - Document-specific Q&A
 * - GET /api/conversations/history - Retrieve conversation history
 * - GET /api/conversations/timeline - Get conversation timeline linked to graph
 */

const app = new Hono<{ Bindings: Env }>();

// POST /api/chat - Main chat endpoint with memory context
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
      serviceLogger.warn('Failed to store conversation history', { error: historyError instanceof Error ? historyError.message : String(historyError) });
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

// GET /api/conversations/history - Retrieve conversation history
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
        serviceLogger.warn('Failed to retrieve conversation history', { error: e instanceof Error ? e.message : String(e) });
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

// GET /api/conversations/timeline - Get conversation timeline linked to graph nodes
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

// POST /api/document-chat - Document-specific Q&A
app.post('/api/document-chat', async (c) => {
  try {
    const { objectId, query } = await c.req.json();

    if (!objectId || !query) {
      return c.json({ error: 'objectId and query are required' }, 400);
    }

    const smartbucket = c.env.DOCUMENT_STORAGE;
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

// Health check
app.get('/health', (c) => {
  return c.json({ 
    service: 'chat-service',
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

export default class ChatService extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
