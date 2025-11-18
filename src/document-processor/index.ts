import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { processRequest, validateRequest, optimizeProcessing } from './utils.js';
import { ComponentRequest } from './interfaces.js';

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Document processing endpoint
app.post('/api/process', async (c) => {
  try {
    const body = await c.req.json() as ComponentRequest;
    
    // Create environment object for utils functions
    const env = {
      DATABASE: c.env.GRAPH_DATABASE, // Use available database from bindings
      logger: c.env.logger
    };

    const response = await processRequest(env, body);
    
    return c.json(response, response.status === 'failed' ? 500 : 200);
  } catch (error) {
    c.env.logger.error('API processing error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Validation endpoint
app.post('/api/validate', async (c) => {
  try {
    const body = await c.req.json() as ComponentRequest;
    
    const isValid = await validateRequest(body);
    
    return c.json({ valid: isValid });
  } catch (error) {
    return c.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    }, 400);
  }
});

// Optimization endpoint
app.post('/api/optimize', async (c) => {
  try {
    const body = await c.req.json() as ComponentRequest;
    
    // Create environment object for utils functions
    const env = {
      DATABASE: c.env.GRAPH_DATABASE,
      logger: c.env.logger
    };
    
    const optimizedRequest = await optimizeProcessing(env, body);
    
    return c.json(optimizedRequest);
  } catch (error) {
    return c.json({
      error: 'Optimization failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}

// Export utility functions for use by other components
export { processRequest, validateRequest, optimizeProcessing } from './utils.js';
export * from './interfaces.js';
