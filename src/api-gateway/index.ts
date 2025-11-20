import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { createLogger } from '../shared/logger.js';

const serviceLogger = createLogger('api-gateway');

/**
 * API Gateway - Single public entry point
 * 
 * Routes requests to appropriate private microservices:
 * - chat-service: /api/chat, /api/conversations/*
 * - insights-service: /api/insights/*, /api/patterns/*, /api/checkins/*
 * - memory-core: /infer, /api/graph
 * - search-engine: /api/search
 * - document-processor: /api/upload, /api/file/*
 * - entity-resolver: Entity extraction
 * - pattern-detector: Pattern detection
 */

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// Logging middleware
app.use('*', logger());

// Error handling middleware
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

// Health check
app.get('/health', (c) => {
  return c.json({ 
    service: 'api-gateway',
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Route to chat-service
app.post('/api/chat', async (c) => {
  return await c.env.CHAT_SERVICE.fetch(c.req.raw);
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
  return await c.env.MEMORY_CORE.fetch(c.req.raw);
});

app.all('/api/graph/:path*', async (c) => {
  return await c.env.MEMORY_CORE.fetch(c.req.raw);
});

// Route to search-engine  
app.all('/api/search/:path*', async (c) => {
  return await c.env.SEARCH_ENGINE.fetch(c.req.raw);
});

// Route to document-processor
app.post('/api/upload', async (c) => {
  return await c.env.DOCUMENT_PROCESSOR.fetch(c.req.raw, c.env as any);
});

app.post('/api/file/:fileId', async (c) => {
  return await c.env.DOCUMENT_PROCESSOR.fetch(c.req.raw, c.env as any);
});

// Catch-all for unknown routes
app.all('*', (c) => {
  return c.json({
    error: 'Not Found',
    message: `Route ${c.req.method} ${c.req.path} not found`,
    timestamp: new Date().toISOString()
  }, 404);
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
