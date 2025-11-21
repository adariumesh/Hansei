import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen.js';
import { processRequest, validateRequest, optimizeProcessing } from './utils.js';
import { ComponentRequest } from './interfaces.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());

app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'pattern-detector',
    timestamp: new Date().toISOString() 
  });
});

app.post('/api/detect-patterns', async (c) => {
  try {
    const request = await c.req.json() as ComponentRequest;

    const isValid = await validateRequest(request);
    if (!isValid) {
      return c.json({ error: 'Invalid request' }, 400);
    }
    
    const optimizedRequest = await optimizeProcessing(c.env, request);
    const response = await processRequest(c.env, optimizedRequest);

    return c.json(response);
  } catch (error) {
    (c.env.logger || console).error('Pattern detection failed', { error });
    return c.json({
      error: 'Pattern detection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/api/validate', async (c) => {
  try {
    const request = await c.req.json() as ComponentRequest;
    const isValid = await validateRequest(request);
    
    return c.json({
      valid: isValid,
      message: isValid ? 'Request is valid' : 'Request is invalid'
    });
  } catch (error) {
    return c.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

app.get('/api/capabilities', (c) => {
  return c.json({
    service: 'pattern-detector',
    version: '1.0.0',
    capabilities: [
      'email_detection',
      'phone_detection', 
      'url_detection',
      'temporal_patterns'
    ],
    max_input_length: 1000000
  });
});

export default class extends Service<Env> {
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  }
}