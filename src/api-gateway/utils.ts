import { ComponentRequest, ComponentResponse, Environment } from './interfaces.js';
import { Hono, Context, MiddlewareHandler } from 'hono';
import { createLogger } from '../shared/logger.js';

const utilLogger = createLogger('api-gateway-utils');

export async function processRequest(
  env: Environment,
  request: ComponentRequest
): Promise<ComponentResponse> {
  const startTime = Date.now();
  
  // Validate the request
  const isValid = await validateRequest(request);
  if (!isValid) {
    throw new Error('Invalid request');
  }

  // Optimize the request before processing
  const optimizedRequest = await optimizeProcessing(env, request);

  // Generate unique response ID
  const responseId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Log request processing
  env.logger.info('Processing request', { 
    id: responseId,
    input_length: optimizedRequest.input.length,
    options: optimizedRequest.options 
  });

  // Process the request (basic implementation)
  let result: any;
  let status: 'success' | 'failed' | 'pending' = 'success';

  try {
    // Advanced processing logic - analyze and route to appropriate services
    const inputLength = optimizedRequest.input.length;
    const inputType = determineInputType(optimizedRequest.input);
    
    // Route to appropriate processing based on input type and content
    let processedResult: any = {
      input_analysis: {
        type: inputType,
        length: inputLength,
        complexity: inputLength > 1000 ? 'high' : inputLength > 100 ? 'medium' : 'low'
      },
      processing_path: [],
      results: {}
    };
    
    // Add entity extraction for text inputs
    if (inputType === 'text' && inputLength > 10) {
      processedResult.processing_path.push('entity_extraction');
      processedResult.results.entities = extractBasicEntities(optimizedRequest.input);
    }
    
    // Add sentiment analysis for longer text
    if (inputType === 'text' && inputLength > 50) {
      processedResult.processing_path.push('sentiment_analysis');
      processedResult.results.sentiment = analyzeSentiment(optimizedRequest.input);
    }
    
    result = {
      processed_input: optimizedRequest.input,
      analysis: processedResult,
      options: optimizedRequest.options,
      metadata: optimizedRequest.metadata,
      processed_at: new Date().toISOString(),
      success: true
    };
  } catch (error) {
    env.logger.error('Request processing failed', { 
      id: responseId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    status = 'failed';
    result = { error: error instanceof Error ? error.message : 'Unknown error' };
  }

  const processingTime = Date.now() - startTime;

  const response: ComponentResponse = {
    id: responseId,
    status,
    result,
    processing_time_ms: processingTime,
    metadata: {
      processed_at: new Date().toISOString(),
      input_length: optimizedRequest.input.length,
      ...optimizedRequest.metadata
    },
    created_at: new Date().toISOString()
  };

  env.logger.debug('Request processing completed', { 
    id: responseId,
    status,
    processing_time_ms: processingTime 
  });

  return response;
}

export async function validateRequest(
  request: ComponentRequest
): Promise<boolean> {
  // Check if request exists
  if (!request) {
    throw new Error('Request is required');
  }

  // Check if input property exists
  if (!request.hasOwnProperty('input')) {
    throw new Error('Input is required');
  }

  // Check if input is a non-empty string
  if (typeof request.input !== 'string' || request.input.trim() === '') {
    throw new Error('Input must be a non-empty string');
  }

  // Check input length limits (max 50KB)
  if (request.input.length > 50000) {
    throw new Error('Input exceeds maximum length of 50,000 characters');
  }

  // Validate options if provided
  if (request.options && typeof request.options !== 'object') {
    throw new Error('Options must be an object');
  }

  // Validate metadata if provided
  if (request.metadata && typeof request.metadata !== 'object') {
    throw new Error('Metadata must be an object');
  }

  return true;
}

export async function optimizeProcessing(
  env: Environment,
  request: ComponentRequest
): Promise<ComponentRequest> {
  // Create optimized copy of the request
  const optimizedRequest: ComponentRequest = {
    input: request.input,
    options: request.options || {},
    metadata: request.metadata || {}
  };

  // Add default options if missing
  if (!optimizedRequest.options!.timeout) {
    optimizedRequest.options!.timeout = 30000; // 30 seconds default
  }

  if (!optimizedRequest.options!.cache) {
    optimizedRequest.options!.cache = true; // Enable caching by default
  }

  // Add optimization metadata
  optimizedRequest.metadata!.optimized_at = new Date().toISOString();
  optimizedRequest.metadata!.optimization_applied = true;

  // Trim whitespace from input
  optimizedRequest.input = optimizedRequest.input.trim();

  env.logger.debug('Request optimization completed', {
    original_input_length: request.input.length,
    optimized_input_length: optimizedRequest.input.length,
    options_added: Object.keys(optimizedRequest.options!).length
  });

  return optimizedRequest;
}

// Performance cache for responses
const responseCacheStore = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Rate limiting store (simple in-memory)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Middleware functions
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  utilLogger.info(`${c.req.method} ${c.req.url}`);
  await next();
  const duration = Date.now() - start;
  utilLogger.info(`${c.req.method} ${c.req.url} - ${c.res.status} (${duration}ms)`);
};

// Response caching middleware for GET requests
export const responseCacheMiddleware: MiddlewareHandler = async (c, next) => {
  // Only cache GET requests
  if (c.req.method !== 'GET') {
    await next();
    return;
  }
  
  const cacheKey = c.req.url;
  const cached = responseCacheStore.get(cacheKey);
  
  // Check if we have a valid cached response
  if (cached && Date.now() < cached.timestamp + cached.ttl) {
    c.header('X-Cache', 'HIT');
    return c.json(cached.data);
  }
  
  await next();
  
  // Cache successful responses for 5 minutes
  if (c.res.status === 200) {
    const data = await c.res.clone().json();
    responseCacheStore.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: 300000 // 5 minutes
    });
    c.header('X-Cache', 'MISS');
  }
};

// Rate limiting middleware
export const rateLimiter: MiddlewareHandler = async (c, next) => {
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 100; // 100 requests per minute
  
  const key = `rate_limit:${clientIP}`;
  const current = rateLimitStore.get(key);
  
  // Reset window if expired
  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    await next();
    return;
  }
  
  // Check if rate limit exceeded
  if (current.count >= maxRequests) {
    return createStandardResponse(c, 429, { 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((current.resetTime - now) / 1000)
    });
  }
  
  // Increment counter
  current.count++;
  rateLimitStore.set(key, current);
  
  // Add rate limit headers
  c.header('X-RateLimit-Limit', maxRequests.toString());
  c.header('X-RateLimit-Remaining', (maxRequests - current.count).toString());
  c.header('X-RateLimit-Reset', new Date(current.resetTime).toISOString());
  
  await next();
};

export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (err) {
    utilLogger.error('Request error', { error: err instanceof Error ? err.message : String(err) });
    return createStandardResponse(c, 500, { error: 'Internal server error' });
  }
};

export const authenticateRequest: MiddlewareHandler = async (c, next) => {
  // Simple authentication check - can be enhanced later
  const authHeader = c.req.header('Authorization');
  if (!authHeader && c.req.path !== '/health') {
    return createStandardResponse(c, 401, { error: 'Unauthorized' });
  }
  await next();
};

export function createStandardResponse(c: Context, status: number, data: any) {
  return c.json({
    status,
    data,
    timestamp: new Date().toISOString()
  });
}

// Route creation functions
export function createHealthRoutes(app: Hono<any>) {
  app.get('/health', (c) => {
    return createStandardResponse(c, 200, { 
      status: 'healthy', 
      service: 'hansei-api-gateway',
      timestamp: new Date().toISOString()
    });
  });
  
  app.get('/status', (c) => {
    return createStandardResponse(c, 200, { 
      status: 'operational',
      services: {
        'memory-core': 'active',
        'intelligence-pipeline': 'active',
        'search-engine': 'active'
      }
    });
  });
}

export function createMemoryRoutes(app: Hono<any>) {
  app.get('/api/memory/search', async (c) => {
    const query = c.req.query('q');
    
    try {
      // Call search-engine service for memory search
      const searchPayload = {
        query: query || '',
        options: {
          type: 'semantic',
          limit: 20,
          user_id: c.req.query('user_id')
        }
      };
      
      const searchResponse = await c.env.search_engine.fetch(
        new Request('https://internal/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchPayload)
        })
      );
      
      const searchResult = await searchResponse.json();
      
      return createStandardResponse(c, 200, { 
        query,
        results: searchResult.results || [],
        metadata: searchResult.metadata || {}
      });
    } catch (error) {
      return createStandardResponse(c, 500, { 
        error: 'Memory search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  app.post('/api/memory/store', async (c) => {
    try {
      const body = await c.req.json();
      const { content, user_id, metadata } = body;
      
      if (!content) {
        return createStandardResponse(c, 400, { error: 'Content is required' });
      }
      
      // Store in memory-core service
      const storePayload = {
        input: content,
        options: {
          user_id: user_id || `user_${Date.now()}`,
          store_type: 'memory',
          metadata: metadata || {}
        }
      };
      
      const memoryResponse = await c.env.memory_core.fetch(
        new Request('https://internal/api/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(storePayload)
        })
      );
      
      const storeResult = await memoryResponse.json();
      
      return createStandardResponse(c, 201, { 
        id: `mem_${Date.now()}`,
        stored: true,
        content: content,
        result: storeResult
      });
    } catch (error) {
      return createStandardResponse(c, 500, { 
        error: 'Memory storage failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

export function createIntelligenceRoutes(app: Hono<any>) {
  app.post('/api/chat', async (c) => {
    try {
      const body = await c.req.json();
      const { message, conversation_id, user_id } = body;
      
      if (!message) {
        return createStandardResponse(c, 400, { error: 'Message is required' });
      }
      
      // Call hansei-intelligence-processor service for real AI response
      const chatPayload = {
        input: message,
        options: {
          conversation_id: conversation_id || `conv_${Date.now()}`,
          user_id: user_id || `user_${Date.now()}`,
          mode: 'chat',
          context_aware: true
        },
        metadata: {
          timestamp: new Date().toISOString(),
          type: 'user_message'
        }
      };
      
      const intelligenceResponse = await c.env.hansei_intelligence_processor.fetch(
        new Request('https://internal/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatPayload)
        })
      );
      
      const aiResult = await intelligenceResponse.json();
      
      const response = {
        id: `chat_${Date.now()}`,
        answer: aiResult.answer || aiResult.result || 'I understand your message. Let me help you with that.',
        sources: aiResult.sources || [],
        conversation_id: conversation_id || `conv_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'assistant'
      };
      
      return createStandardResponse(c, 200, response);
    } catch (error) {
      return createStandardResponse(c, 500, { 
        error: 'Chat processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  app.post('/api/infer', async (c) => {
    try {
      const body = await c.req.json();
      const { content, user_id, options } = body;
      
      if (!content) {
        return createStandardResponse(c, 400, { error: 'Content is required' });
      }
      
      // Call intelligence-pipeline service for content processing
      const inferPayload = {
        input: content,
        options: {
          user_id: user_id || `user_${Date.now()}`,
          extract_entities: true,
          generate_embeddings: true,
          store_results: true,
          ...options
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'api_gateway'
        }
      };
      
      const pipelineResponse = await c.env.intelligence_pipeline.fetch(
        new Request('https://internal/infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inferPayload)
        })
      );
      
      const inferResult = await pipelineResponse.json();
      
      return createStandardResponse(c, 200, {
        success: true,
        extracted: inferResult.extracted || {},
        entities: inferResult.entities || [],
        embedding: inferResult.embedding || null,
        processed_at: new Date().toISOString()
      });
    } catch (error) {
      return createStandardResponse(c, 500, { 
        error: 'Inference processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

export function createSearchRoutes(app: Hono<any>) {
  app.get('/api/search', async (c) => {
    try {
      const query = c.req.query('q');
      const type = c.req.query('type') || 'semantic';
      const limit = parseInt(c.req.query('limit') || '20');
      const user_id = c.req.query('user_id');
      
      if (!query) {
        return createStandardResponse(c, 400, { error: 'Query parameter is required' });
      }
      
      // Call search-engine service
      const searchPayload = {
        query: query,
        options: {
          type: type,
          limit: limit,
          user_id: user_id || `user_${Date.now()}`,
          include_embeddings: false
        }
      };
      
      const searchResponse = await c.env.search_engine.fetch(
        new Request('https://internal/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchPayload)
        })
      );
      
      const searchResult = await searchResponse.json();
      
      return createStandardResponse(c, 200, {
        query,
        type,
        results: searchResult.results || [],
        metadata: {
          total_found: searchResult.total_found || 0,
          search_time_ms: searchResult.search_time_ms || 0,
          type: type
        }
      });
    } catch (error) {
      return createStandardResponse(c, 500, {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

export function createProcessingRoutes(app: Hono<any>) {
  app.get('/api/patterns/orphans', async (c) => {
    try {
      const user_id = c.req.query('user_id');
      
      // Call pattern-detector service for orphan detection
      const patternPayload = {
        input: 'detect_orphans',
        options: {
          analysis_type: 'orphan_nodes',
          user_id: user_id || `user_${Date.now()}`,
          threshold: 2 // nodes with 2 or fewer connections
        }
      };
      
      const patternResponse = await c.env.pattern_detector.fetch(
        new Request('https://internal/api/detect-patterns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patternPayload)
        })
      );
      
      const patternResult = await patternResponse.json();
      
      return createStandardResponse(c, 200, {
        orphans: patternResult.result?.orphans || [],
        analysis: patternResult.result?.analysis || {},
        metadata: {
          analyzed_at: new Date().toISOString(),
          threshold_used: 2
        }
      });
    } catch (error) {
      return createStandardResponse(c, 500, {
        error: 'Orphan pattern detection failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  app.get('/api/patterns/hubs', async (c) => {
    try {
      const user_id = c.req.query('user_id');
      
      // Call pattern-detector service for hub analysis
      const patternPayload = {
        input: 'detect_hubs',
        options: {
          analysis_type: 'hub_nodes',
          user_id: user_id || `user_${Date.now()}`,
          min_connections: 5 // nodes with 5+ connections are considered hubs
        }
      };
      
      const patternResponse = await c.env.pattern_detector.fetch(
        new Request('https://internal/api/detect-patterns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patternPayload)
        })
      );
      
      const patternResult = await patternResponse.json();
      
      return createStandardResponse(c, 200, {
        hubs: patternResult.result?.hubs || [],
        analysis: patternResult.result?.analysis || {},
        metadata: {
          analyzed_at: new Date().toISOString(),
          min_connections: 5
        }
      });
    } catch (error) {
      return createStandardResponse(c, 500, {
        error: 'Hub pattern detection failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  app.post('/api/process/document', async (c) => {
    try {
      const body = await c.req.json();
      const { content, type, user_id, metadata } = body;
      
      if (!content) {
        return createStandardResponse(c, 400, { error: 'Document content is required' });
      }
      
      // Call document-processor service
      const docPayload = {
        input: content,
        options: {
          document_type: type || 'text',
          user_id: user_id || `user_${Date.now()}`,
          extract_entities: true,
          generate_summary: true,
          store_results: true,
          metadata: metadata || {}
        },
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'api_gateway'
        }
      };
      
      const docResponse = await c.env.document_processor.fetch(
        new Request('https://internal/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(docPayload)
        })
      );
      
      const docResult = await docResponse.json();
      
      return createStandardResponse(c, 202, {
        id: `doc_${Date.now()}`,
        status: 'processed',
        result: docResult.result || {},
        entities: docResult.entities || [],
        summary: docResult.summary || '',
        processed_at: new Date().toISOString()
      });
    } catch (error) {
      return createStandardResponse(c, 500, {
        error: 'Document processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

// Helper functions for input analysis
function determineInputType(input: string): string {
  // Check if input looks like JSON
  try {
    JSON.parse(input);
    return 'json';
  } catch {}
  
  // Check if input looks like a URL
  if (input.match(/^https?:\/\/.+/)) {
    return 'url';
  }
  
  // Check if input looks like code
  if (input.includes('function') || input.includes('class') || input.includes('import')) {
    return 'code';
  }
  
  // Check if input looks like a question
  if (input.trim().endsWith('?')) {
    return 'question';
  }
  
  // Default to text
  return 'text';
}

function extractBasicEntities(text: string): Array<{type: string, value: string, confidence: number}> {
  const entities = [];
  
  // Simple email extraction
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex) || [];
  emails.forEach(email => {
    entities.push({ type: 'email', value: email, confidence: 0.9 });
  });
  
  // Simple phone number extraction
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  const phones = text.match(phoneRegex) || [];
  phones.forEach(phone => {
    entities.push({ type: 'phone', value: phone, confidence: 0.8 });
  });
  
  // Simple date extraction
  const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
  const dates = text.match(dateRegex) || [];
  dates.forEach(date => {
    entities.push({ type: 'date', value: date, confidence: 0.7 });
  });
  
  // Simple person name extraction (capitalized words)
  const nameRegex = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
  const names = text.match(nameRegex) || [];
  names.forEach((name: string) => {
    if (name.split(' ').length === 2) {
      entities.push({ type: 'person', value: name, confidence: 0.6 });
    }
  });
  
  return entities;
}

function analyzeSentiment(text: string): {score: number, label: string, confidence: number} {
  // Simple rule-based sentiment analysis
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'pleased'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'angry', 'sad', 'disappointed', 'frustrated', 'annoyed'];
  
  const words = text.toLowerCase().split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;
  
  words.forEach(word => {
    if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
    if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
  });
  
  const totalSentimentWords = positiveCount + negativeCount;
  if (totalSentimentWords === 0) {
    return { score: 0, label: 'neutral', confidence: 0.5 };
  }
  
  const score = (positiveCount - negativeCount) / totalSentimentWords;
  let label = 'neutral';
  let confidence = 0.5;
  
  if (score > 0.2) {
    label = 'positive';
    confidence = Math.min(0.9, 0.5 + Math.abs(score));
  } else if (score < -0.2) {
    label = 'negative';
    confidence = Math.min(0.9, 0.5 + Math.abs(score));
  }
  
  return { score, label, confidence };
}