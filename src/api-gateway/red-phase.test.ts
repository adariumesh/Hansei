import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processRequest, validateRequest, optimizeProcessing } from './utils.js';
import { ComponentRequest, ComponentResponse, Environment } from './interfaces.js';

// Mock environment
const mockEnv: Environment = {
  DATABASE: {
    prepare: vi.fn(),
    exec: vi.fn(),
    batch: vi.fn()
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
};

describe('API Gateway Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processRequest', () => {
    it('should process valid request and return response', async () => {
      const request: ComponentRequest = {
        input: 'test input',
        options: { timeout: 5000 },
        metadata: { source: 'test' }
      };

      const response = await processRequest(mockEnv, request);
      
      expect(response).toMatchObject({
        status: 'success',
        result: expect.objectContaining({
          processed_input: 'test input'
        }),
        processing_time_ms: expect.any(Number),
        metadata: expect.objectContaining({
          source: 'test'
        })
      });
      expect(response.id).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(response.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle empty input', async () => {
      const request: ComponentRequest = {
        input: '',
        options: {},
        metadata: {}
      };

      await expect(processRequest(mockEnv, request)).rejects.toThrow('Input must be a non-empty string');
    });

    it('should handle request without options', async () => {
      const request: ComponentRequest = {
        input: 'test input'
      };

      const response = await processRequest(mockEnv, request);
      expect(response.status).toBe('success');
      expect(response.result.processed_input).toBe('test input');
    });

    it('should generate unique response ID', async () => {
      const request: ComponentRequest = {
        input: 'test input'
      };

      const response1 = await processRequest(mockEnv, request);
      const response2 = await processRequest(mockEnv, request);
      
      expect(response1.id).not.toBe(response2.id);
      expect(response1.id).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(response2.id).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should measure processing time', async () => {
      const request: ComponentRequest = {
        input: 'test input'
      };

      const response = await processRequest(mockEnv, request);
      expect(response.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(typeof response.processing_time_ms).toBe('number');
    });
  });

  describe('validateRequest', () => {
    it('should validate request with all required fields', async () => {
      const validRequest: ComponentRequest = {
        input: 'valid input',
        options: { timeout: 1000 },
        metadata: { source: 'api' }
      };

      const result = await validateRequest(validRequest);
      expect(result).toBe(true);
    });

    it('should reject request without input', async () => {
      const invalidRequest = {
        options: {},
        metadata: {}
      } as ComponentRequest;

      await expect(validateRequest(invalidRequest)).rejects.toThrow('Input is required');
    });

    it('should reject request with empty input', async () => {
      const invalidRequest: ComponentRequest = {
        input: '',
        options: {},
        metadata: {}
      };

      await expect(validateRequest(invalidRequest)).rejects.toThrow('Input must be a non-empty string');
    });

    it('should accept request with only input', async () => {
      const minimalRequest: ComponentRequest = {
        input: 'minimal input'
      };

      const result = await validateRequest(minimalRequest);
      expect(result).toBe(true);
    });

    it('should validate input length limits', async () => {
      const tooLongInput = 'x'.repeat(100000);
      const invalidRequest: ComponentRequest = {
        input: tooLongInput
      };

      await expect(validateRequest(invalidRequest)).rejects.toThrow('Input exceeds maximum length of 50,000 characters');
    });
  });

  describe('optimizeProcessing', () => {
    it('should optimize request for better performance', async () => {
      const request: ComponentRequest = {
        input: 'test input for optimization',
        options: { cache: true },
        metadata: { priority: 'high' }
      };

      const optimized = await optimizeProcessing(mockEnv, request);
      
      expect(optimized.input).toBe('test input for optimization');
      expect(optimized.options).toMatchObject({ 
        cache: true,
        timeout: 30000
      });
      expect(optimized.metadata).toMatchObject({
        priority: 'high',
        optimization_applied: true,
        optimized_at: expect.any(String)
      });
    });

    it('should handle request with no optimization needed', async () => {
      const request: ComponentRequest = {
        input: 'simple input'
      };

      const optimized = await optimizeProcessing(mockEnv, request);
      
      expect(optimized.input).toBe('simple input');
      expect(optimized.options).toMatchObject({
        timeout: 30000,
        cache: true
      });
      expect(optimized.metadata!.optimization_applied).toBe(true);
    });

    it('should add default options if missing', async () => {
      const request: ComponentRequest = {
        input: 'test input'
      };

      const optimized = await optimizeProcessing(mockEnv, request);
      
      expect(optimized.options!.timeout).toBe(30000);
      expect(optimized.options!.cache).toBe(true);
    });

    it('should preserve existing metadata', async () => {
      const request: ComponentRequest = {
        input: 'test input',
        metadata: { important: true }
      };

      const optimized = await optimizeProcessing(mockEnv, request);
      
      expect(optimized.metadata!.important).toBe(true);
      expect(optimized.metadata!.optimization_applied).toBe(true);
      expect(optimized.metadata!.optimized_at).toBeDefined();
    });
  });
});