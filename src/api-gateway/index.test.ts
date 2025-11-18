import { describe, it, expect, beforeEach, vi } from 'vitest';
import ApiGatewayService from './index.js';
import { processRequest, validateRequest, optimizeProcessing } from './utils.js';
import { ComponentRequest, Environment } from './interfaces.js';

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
  }
};

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