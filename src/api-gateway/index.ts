import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { 
  createHealthRoutes,
  createMemoryRoutes,
  createIntelligenceRoutes,
  createSearchRoutes,
  createProcessingRoutes
} from './utils.js';
import { 
  errorHandler,
  requestLogger,
  authenticateRequest,
  createStandardResponse
} from './utils.js';

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env }>();

// Add global middleware
app.use('*', logger());
app.use('*', requestLogger);
app.use('*', errorHandler);

// Register route groups
createHealthRoutes(app);
createMemoryRoutes(app);
createIntelligenceRoutes(app);
createSearchRoutes(app);
createProcessingRoutes(app);







// Export utility functions and types for external use
export * from './utils.js';
export * from './interfaces.js';

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
