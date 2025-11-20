import { describe, it, expect, beforeEach, vi } from 'vitest';
import Service from './index.js';
import { Env } from './raindrop.gen.js';
import { 
  performSearch,
  semanticSearch,
  hybridSearch,
  generateVectorEmbeddings,
  indexDocument,
  processRequest,
  validateRequest 
} from './utils.js';

// Mock environment
const mockEnv = {
  DOCUMENT_EMBEDDINGS: {
    query: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn()
  },
  MEMORY_EMBEDDINGS: {
    query: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn()
  },
  DOCUMENT_STORAGE: {
    get: vi.fn(),
    put: vi.fn(),
    list: vi.fn(),
    search: vi.fn(),
    chunkSearch: vi.fn(),
    documentChat: vi.fn()
  },
  QUERY_CACHE: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  AI: {
    run: vi.fn(),
    generateEmbedding: vi.fn()
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  GRAPH_DATABASE: {
    prepare: vi.fn(),
    exec: vi.fn(),
    batch: vi.fn()
  }
} as unknown as Env;

describe('SearchEngineService', () => {
  let service: Service;

  beforeEach(() => {
    service = new Service();
    vi.clearAllMocks();
  });

  describe('API Endpoints', () => {
    it('should handle search POST /api/search', async () => {
      const searchData = {
        query: 'test search query',
        options: { limit: 10 }
      };

      const request = new Request('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify(searchData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.results).toBeDefined();
      expect(data.total).toBeGreaterThan(0);
    });

    it('should handle semantic search POST /api/search/semantic', async () => {
      const searchData = { query: 'test semantic query' };

      const request = new Request('http://localhost/api/search/semantic', {
        method: 'POST',
        body: JSON.stringify(searchData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.results).toBeDefined();
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.search_type).toBe('semantic');
    });

    it('should handle hybrid search POST /api/search/hybrid', async () => {
      const searchData = { query: 'test hybrid query' };

      const request = new Request('http://localhost/api/search/hybrid', {
        method: 'POST',
        body: JSON.stringify(searchData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.combined_results).toBeDefined();
      expect(data.search_method).toBe('hybrid');
    });

    it('should handle embeddings generation POST /api/embeddings', async () => {
      const embeddingData = { text: 'test text for embeddings' };

      const request = new Request('http://localhost/api/embeddings', {
        method: 'POST',
        body: JSON.stringify(embeddingData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.embeddings).toBeDefined();
      expect(data.embeddings.length).toBe(384);
      expect(data.dimensions).toBe(384);
    });

    it('should handle document indexing POST /api/index', async () => {
      const document = {
        id: 'test-doc-1',
        title: 'Test Document',
        content: 'This is a test document for indexing'
      };

      const request = new Request('http://localhost/api/index', {
        method: 'POST',
        body: JSON.stringify(document),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.indexed).toBe(true);
      expect(data.document_id).toBeDefined();
      expect(data.status).toBe('success');
    });

    it('should handle request processing POST /api/process', async () => {
      const requestData = {
        input: 'test processing request',
        options: { priority: 'high' },
        metadata: { source: 'test' }
      };

      const request = new Request('http://localhost/api/process', {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.status).toBe('success');
      expect(data.result).toBeDefined();
      expect(data.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should return 400 for missing query in search', async () => {
      const request = new Request('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Query is required');
    });

    it('should return 400 for missing text in embeddings', async () => {
      const request = new Request('http://localhost/api/embeddings', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Text is required');
    });

    it('should return 400 for missing document in indexing', async () => {
      const request = new Request('http://localhost/api/index', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toBe('Document is required');
    });
  });

  describe('Search Functions', () => {
    describe('performSearch', () => {
      it('should return search results with multiple types', async () => {
        const results = await performSearch('test query');
        
        expect(results).toBeDefined();
        expect(results.results).toBeDefined();
        expect(results.total).toBeGreaterThan(0);
        expect(results.query).toBe('test query');
        expect(results.searchType).toBe('comprehensive');
        expect(results.results.length).toBeGreaterThan(4); // Should have results from all search types
      });

      it('should handle search options', async () => {
        const options = { limit: 5, filter: 'documents' };
        const results = await performSearch('test query', options);
        
        expect(results).toBeDefined();
        expect(results.results).toBeDefined();
        expect(results.total).toBeGreaterThan(0);
      });
    });

    describe('semanticSearch', () => {
      it('should return semantic search results', async () => {
        const results = await semanticSearch('test query');
        
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('type', 'semantic');
        expect(results[0]).toHaveProperty('score');
      });
    });

    describe('hybridSearch', () => {
      it('should return hybrid search results', async () => {
        const results = await hybridSearch('test query');
        
        expect(results).toBeDefined();
        expect(results).toBeTruthy();
        expect(results.combined_results).toBeDefined();
        expect(results.search_method).toBe('hybrid');
        expect(results.success).toBe(true);
      });
    });

    describe('generateVectorEmbeddings', () => {
      it('should generate vector embeddings', async () => {
        const embeddings = await generateVectorEmbeddings('test text');
        
        expect(embeddings).toBeDefined();
        expect(embeddings.embeddings).toBeDefined();
        expect(embeddings.embeddings.length).toBe(384);
        expect(embeddings.dimensions).toBe(384);
        expect(embeddings.model).toBe('text-embedding-3-small');
        expect(embeddings.input_text).toBe('test text');
      });
    });

    describe('indexDocument', () => {
      it('should index document successfully', async () => {
        const document = { id: 'test-1', content: 'test content' };
        const result = await indexDocument(document);
        
        expect(result).toBeDefined();
        expect(result.indexed).toBe(true);
        expect(result.document_id).toBeDefined();
        expect(result.status).toBe('success');
        expect(result.index_time).toBeDefined();
      });
    });
  });

  describe('Request Processing', () => {
    describe('processRequest', () => {
      it('should process valid requests successfully', async () => {
        const env = {
          DATABASE: mockEnv.GRAPH_DATABASE,
          logger: mockEnv.logger
        };
        
        const request = {
          input: 'test search query',
          options: { limit: 10 },
          metadata: { source: 'test' }
        };

        const response = await processRequest(env, request);
        
        expect(response).toBeDefined();
        expect(response.status).toBe('success');
        expect(response.result).toBeDefined();
        expect(response.processing_time_ms).toBeGreaterThanOrEqual(0);
        expect(response.id).toBeDefined();
        expect(response.created_at).toBeDefined();
        expect(response.metadata.query).toBe('test search query');
      });
    });

    describe('validateRequest', () => {
      it('should validate correct requests', async () => {
        const validRequest = {
          input: 'valid search query',
          options: {},
          metadata: {}
        };

        const isValid = await validateRequest(validRequest);
        expect(isValid).toBe(true);
      });

      it('should reject requests with empty input', async () => {
        const invalidRequest = {
          input: '',
          options: {},
          metadata: {}
        };

        const isValid = await validateRequest(invalidRequest);
        expect(isValid).toBe(false);
      });

      it('should reject requests with whitespace-only input', async () => {
        const invalidRequest = {
          input: '   ',
          options: {},
          metadata: {}
        };

        const isValid = await validateRequest(invalidRequest);
        expect(isValid).toBe(false);
      });

      it('should reject requests with non-string input', async () => {
        const invalidRequest = {
          input: 123 as any,
          options: {},
          metadata: {}
        };

        const isValid = await validateRequest(invalidRequest);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Health Check', () => {
    it('should respond to health check', async () => {
      const request = new Request('http://localhost/health', {
        method: 'GET'
      });

      const response = await service.fetch(request, mockEnv);
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in request body', async () => {
      const request = new Request('http://localhost/api/search', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle missing Content-Type header', async () => {
      const request = new Request('http://localhost/api/search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' })
        // Missing Content-Type header
      });

      const response = await service.fetch(request, mockEnv);
      // Should still work or handle gracefully
      expect(response).toBeDefined();
    });
  });
});