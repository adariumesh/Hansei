import { ComponentRequest, ComponentResponse, Environment } from './interfaces.js';
import { Hono, Context, MiddlewareHandler } from 'hono';

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
    // Simple processing logic - echo the input with metadata
    result = {
      processed_input: optimizedRequest.input,
      options: optimizedRequest.options,
      metadata: optimizedRequest.metadata,
      processed_at: new Date().toISOString()
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
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
  const duration = Date.now() - start;
  console.log(`${c.req.method} ${c.req.url} - ${c.res.status} (${duration}ms)`);
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
    console.error('Error:', err);
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
  app.get('/api/memory/search', (c) => {
    const query = c.req.query('q');
    // TODO: Integrate with memory-core service
    return createStandardResponse(c, 200, { 
      query,
      results: [],
      message: 'Memory search endpoint - integration pending'
    });
  });
  
  app.post('/api/memory/store', async (c) => {
    const body = await c.req.json();
    // TODO: Integrate with memory-core service
    return createStandardResponse(c, 201, { 
      id: `mem_${Date.now()}`,
      stored: true,
      message: 'Memory store endpoint - integration pending'
    });
  });
}

export function createIntelligenceRoutes(app: Hono<any>) {
  app.post('/api/chat', async (c) => {
    try {
      const body = await c.req.json();
      const { message, conversation_id } = body;
      
      // TODO: Integrate with hansei-intelligence-processor service
      const response = {
        id: `chat_${Date.now()}`,
        message: `Echo: ${message}`,
        conversation_id: conversation_id || `conv_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'assistant'
      };
      
      return createStandardResponse(c, 200, response);
    } catch (error) {
      return createStandardResponse(c, 400, { error: 'Invalid request body' });
    }
  });
  
  app.post('/api/infer', async (c) => {
    try {
      const body = await c.req.json();
      // TODO: Integrate with intelligence-pipeline service
      return createStandardResponse(c, 200, { 
        inference: 'Intelligence inference endpoint - integration pending',
        input: body
      });
    } catch (error) {
      return createStandardResponse(c, 400, { error: 'Invalid request body' });
    }
  });
}

export function createSearchRoutes(app: Hono<any>) {
  app.get('/api/search', (c) => {
    const query = c.req.query('q');
    const type = c.req.query('type') || 'semantic';
    
    // TODO: Integrate with search-engine service
    return createStandardResponse(c, 200, { 
      query,
      type,
      results: [],
      message: 'Search endpoint - integration pending'
    });
  });
}

export function createProcessingRoutes(app: Hono<any>) {
  app.get('/api/patterns/orphans', (c) => {
    // TODO: Integrate with pattern-detector service
    return createStandardResponse(c, 200, { 
      orphans: [],
      message: 'Orphan patterns endpoint - integration pending'
    });
  });
  
  app.get('/api/patterns/hubs', (c) => {
    // TODO: Integrate with pattern-detector service
    return createStandardResponse(c, 200, { 
      hubs: [],
      message: 'Hub patterns endpoint - integration pending'
    });
  });
  
  app.post('/api/process/document', async (c) => {
    try {
      const body = await c.req.json();
      // TODO: Integrate with document-processor service
      return createStandardResponse(c, 202, { 
        id: `doc_${Date.now()}`,
        status: 'processing',
        message: 'Document processing endpoint - integration pending'
      });
    } catch (error) {
      return createStandardResponse(c, 400, { error: 'Invalid request body' });
    }
  });
}
