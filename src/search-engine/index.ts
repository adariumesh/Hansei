import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { performSearch, semanticSearch, hybridSearch, generateVectorEmbeddings, indexDocument, processRequest, validateRequest } from './utils.js';
import { ComponentRequest } from './interfaces.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/search', async (c) => {
  try {
    const { query, options } = await c.req.json();
    if (!query) return c.json({ error: 'Query is required' }, 400);
    const searchResults = await performSearch(c.env, query, options);
    return c.json({ success: true, ...searchResults });
  } catch (error) {
    return c.json({ error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

app.post('/api/search/semantic', async (c) => {
  try {
    const { query, topK = 10 } = await c.req.json();
    if (!query) return c.json({ error: 'Query is required' }, 400);
    const results = await semanticSearch(c.env, query, topK);
    return c.json({ success: true, results, total: results.length, search_type: 'semantic' });
  } catch (error) {
    return c.json({ error: 'Semantic search failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

app.post('/api/search/hybrid', async (c) => {
  try {
    const { query, topK = 10 } = await c.req.json();
    if (!query) return c.json({ error: 'Query is required' }, 400);
    const results = await hybridSearch(c.env, query, topK);
    return c.json({ success: true, results, total: results.length, search_type: 'hybrid (semantic)' });
  } catch (error) {
    return c.json({ error: 'Hybrid search failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

app.post('/api/embeddings', async (c) => {
  try {
    const { text } = await c.req.json();
    if (!text) return c.json({ error: 'Text is required' }, 400);
    const embeddings = await generateVectorEmbeddings(c.env, text);
    return c.json({ success: true, ...embeddings });
  } catch (error) {
    return c.json({ error: 'Embedding generation failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

app.post('/api/index', async (c) => {
  try {
    const document = await c.req.json();
    if (!document || Object.keys(document).length === 0) {
      return c.json({ error: 'Document is required' }, 400);
    }
    const indexResult = await indexDocument(document);
    return c.json({ success: true, ...indexResult });
  } catch (error) {
    return c.json({ error: 'Indexing failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

app.post('/api/process', async (c) => {
  try {
    const requestData = await c.req.json();
    const componentRequest: ComponentRequest = {
      input: requestData.input || '',
      options: requestData.options || {},
      metadata: requestData.metadata || {}
    };
    const isValid = await validateRequest(componentRequest);
    if (!isValid) {
      return c.json({ error: 'Invalid request' }, 400);
    }
    const env = { DATABASE: c.env?.GRAPH_DATABASE || null, logger: c.env?.logger || console };
    const response = await processRequest(env, componentRequest);
    return c.json(response);
  } catch (error) {
    return c.json({ error: 'Processing failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  }
}