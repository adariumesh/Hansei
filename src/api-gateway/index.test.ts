import { describe, it, expect, beforeEach, vi } from 'vitest';
import ApiGatewayService from './index.js';
import { processRequest, validateRequest, optimizeProcessing } from './utils.js';
import { ComponentRequest, Environment } from './interfaces.js';
import { z } from 'zod'; // Added zod import

// Mock environment
const mockEnv: Environment = {
  DATABASE: {
    prepare: vi.fn(),
    exec: vi.fn()
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  AI: {
    run: vi.fn(),
  } as any, // Mock AI
  MEMORY_CORE: {
    fetch: vi.fn(),
  } as any, // Mock MEMORY_CORE
  AGENT_MEMORY: {
    searchSemanticMemory: vi.fn(),
  } as any, // Mock AGENT_MEMORY
  CHAT_SERVICE: {
    fetch: vi.fn(),
  } as any, // Mock CHAT_SERVICE
  INSIGHTS_SERVICE: {
    fetch: vi.fn(),
  } as any, // Mock INSIGHTS_SERVICE
};

// Mock the schemas used by the API Gateway
const InferSchema = z.object({
  user_id: z.string().optional(),
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(10000, 'Content too long (max 10000 chars)')
    .trim()
});

const ChatSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(5000, "Message too long (max 5000 chars)"),
  conversation_id: z.string().optional(),
  user_id: z.string().optional()
});

describe('API Gateway Service', () => {
  let service: ApiGatewayService;

  beforeEach(() => {
    service = new ApiGatewayService();
    vi.clearAllMocks();
  });

  describe('API Endpoints', () => {
    it('should handle POST /api/gateway/process', async () => {
      const requestData = {
        service: 'search-engine',
        input: 'test query',
        options: { limit: 10 }
      };

      const request = new Request('http://localhost/api/gateway/process', {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv as any);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe('success');
      expect(result.metadata.service).toBe('search-engine');
    });

    it('should return 400 for invalid request body', async () => {
      const request = new Request('http://localhost/api/gateway/process', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv as any);
      expect(response.status).toBe(400);
    });
  });

  describe('Utils Functions', () => {
    describe('processRequest', () => {
      it('should process valid request successfully', async () => {
        const request: ComponentRequest = {
          input: 'test input for processing',
          options: { service: 'entity-resolver' },
          metadata: {}
        };

        const result = await processRequest(mockEnv, request);
        expect(result.status).toBe('success');
        expect(result.result).toBeDefined();
        expect(result.processing_time_ms).toBeGreaterThan(0);
      });

      it('should handle invalid input', async () => {
        const request: ComponentRequest = {
          input: '',
          options: {},
          metadata: {}
        };

        const result = await processRequest(mockEnv, request);
        expect(result.status).toBe('failed');
        expect(result.metadata.error).toBeDefined();
      });
    });

    describe('validateRequest', () => {
      it('should validate correct request', async () => {
        const request: ComponentRequest = {
          input: 'Valid input text',
          options: { service: 'search-engine' },
          metadata: {}
        };

        const isValid = await validateRequest(request);
        expect(isValid).toBe(true);
      });

      it('should reject empty input', async () => {
        const request: ComponentRequest = {
          input: '',
          options: {},
          metadata: {}
        };

        const isValid = await validateRequest(request);
        expect(isValid).toBe(false);
      });
    });

    describe('optimizeProcessing', () => {
      it('should optimize request properly', async () => {
        const request: ComponentRequest = {
          input: '  Text with whitespace  ',
          options: { service: 'entity-resolver' },
          metadata: {}
        };

        const optimized = await optimizeProcessing(mockEnv, request);
        expect(optimized.input).toBe('Text with whitespace');
        expect(optimized.options.optimized).toBe(true);
      });
    });
  });
});

// New tests for /health and /infer from audit report
describe('Health Endpoint', () => {
  let service: ApiGatewayService;

  beforeEach(() => {
    service = new ApiGatewayService();
    vi.clearAllMocks();
    mockEnv.AGENT_MEMORY.searchSemanticMemory.mockResolvedValue({ success: true, document: [] }); // Mock successful SmartMemory check
  });

  it('should return 200 OK for /health with healthy dependencies', async () => {
    const request = new Request('http://localhost/health', {
      method: 'GET',
    });
    const response = await service.fetch(request, mockEnv as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('api-gateway');
    expect(data.smartmemory).toBe('healthy');
    expect(data.ai).toBe('available');
  });

  it('should return 503 if SmartMemory check fails', async () => {
    mockEnv.AGENT_MEMORY.searchSemanticMemory.mockRejectedValue(new Error('SmartMemory down')); // Mock failed SmartMemory check
    const request = new Request('http://localhost/health', {
      method: 'GET',
    });
    const response = await service.fetch(request, mockEnv as any);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.status).toBe('degraded');
    expect(data.smartmemory).toBe('unhealthy');
  });
});

describe('Infer Endpoint', () => {
  let service: ApiGatewayService;

  beforeEach(() => {
    service = new ApiGatewayService();
    vi.clearAllMocks();
    // Mock the AI.run and MEMORY_CORE.fetch for the Infer endpoint
    mockEnv.AI.run.mockResolvedValue({ embeddings: [{ embedding: [0.1, 0.2] }] }); // Mock AI embedding generation
    mockEnv.MEMORY_CORE.fetch.mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })); // Mock MEMORY_CORE
  });

  it('should process a valid /infer request', async () => {
    const request = new Request('http://localhost/infer', {
      method: 'POST',
      body: JSON.stringify({ content: 'Test memory content', user_id: 'test_user' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await service.fetch(request, mockEnv as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockEnv.MEMORY_CORE.fetch).toHaveBeenCalled();
  });

  it('should return 400 for invalid /infer request (missing content)', async () => {
    const request = new Request('http://localhost/infer', {
      method: 'POST',
      body: JSON.stringify({ user_id: 'test_user' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await service.fetch(request, mockEnv as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 for invalid /infer request (content too short)', async () => {
    const request = new Request('http://localhost/infer', {
      method: 'POST',
      body: JSON.stringify({ content: '', user_id: 'test_user' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await service.fetch(request, mockEnv as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });
});