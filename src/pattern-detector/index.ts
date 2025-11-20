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
  return c.json({ 
    status: 'ok', 
    service: 'pattern-detector',
    timestamp: new Date().toISOString() 
  });
});

// Pattern detection endpoint
app.post('/api/detect-patterns', async (c) => {
  try {
    const request = await c.req.json() as ComponentRequest;

    // Create environment adapter
    const env = {
      DATABASE: c.env.GRAPH_DATABASE,
      logger: c.env.logger
    };

    // Validate request
    await validateRequest(request);

    // Optimize processing
    const optimizedRequest = await optimizeProcessing(env, request);

    // Process request
    const response = await processRequest(env, optimizedRequest);

    return c.json(response);
  } catch (error) {
    c.env.logger.error('Pattern detection failed', { error });
    return c.json({
      error: 'Pattern detection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Validate request endpoint
app.post('/api/validate', async (c) => {
  try {
    const request = await c.req.json() as ComponentRequest;
    const isValid = await validateRequest(request);
    
    return c.json({
      valid: isValid,
      message: 'Request is valid'
    });
  } catch (error) {
    return c.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

// Service capabilities endpoint
app.get('/api/capabilities', (c) => {
  return c.json({
    service: 'pattern-detector',
    version: '1.0.0',
    capabilities: [
      'email_detection',
      'phone_detection', 
      'url_detection',
      'custom_patterns',
      'regex_support'
    ],
    supported_algorithms: ['regex', 'default'],
    max_input_length: 1000000
  });
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}

// Export utility functions for external use
export { processRequest, validateRequest, optimizeProcessing } from './utils.js';
export * from './interfaces.js';
