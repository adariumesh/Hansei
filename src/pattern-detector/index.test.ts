import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  processRequest,
  validateRequest,
  optimizeProcessing
} from './utils.js';
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

describe('Pattern Detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processRequest', () => {
    it('should process valid request', async () => {
      const request: ComponentRequest = {
        input: 'Sample text with patterns',
        options: { algorithm: 'regex' },
        metadata: { source: 'test' }
      };

      const result = await processRequest(mockEnv, request);
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.result).toHaveProperty('patterns');
      expect(result.result).toHaveProperty('count');
      expect(typeof result.processing_time_ms).toBe('number');
    });

    it('should reject empty input', async () => {
      const request: ComponentRequest = {
        input: '',
        options: {},
        metadata: {}
      };

      await expect(
        processRequest(mockEnv, request)
      ).rejects.toThrow();
    });
  });

  describe('validateRequest', () => {
    it('should validate proper request structure', async () => {
      const request: ComponentRequest = {
        input: 'Test input',
        options: {},
        metadata: {}
      };

      const result = await validateRequest(request);
      expect(result).toBe(true);
    });

    it('should reject invalid request', async () => {
      const request = {} as ComponentRequest;

      await expect(
        validateRequest(request)
      ).rejects.toThrow();
    });
  });

  describe('optimizeProcessing', () => {
    it('should optimize valid request', async () => {
      const request: ComponentRequest = {
        input: 'Test input for optimization',
        options: { performance: 'high' },
        metadata: {}
      };

      const result = await optimizeProcessing(mockEnv, request);
      expect(result).toBeDefined();
      expect(result.input).toBe(request.input.trim());
      expect(result.options?.optimized).toBe(true);
      expect(result.metadata?.optimized_at).toBeDefined();
    });
  });

  describe('Pattern Detection', () => {
    it('should detect email patterns', async () => {
      const request: ComponentRequest = {
        input: 'Contact me at test@example.com for more info',
        options: { algorithm: 'regex' },
        metadata: {}
      };

      const result = await processRequest(mockEnv, request);
      expect(result.status).toBe('success');
      expect(result.result.count).toBeGreaterThan(0);
      expect(result.result.patterns).toContain('email:test@example.com');
    });

    it('should detect phone patterns', async () => {
      const request: ComponentRequest = {
        input: 'Call me at 123-456-7890 tomorrow',
        options: { algorithm: 'regex' },
        metadata: {}
      };

      const result = await processRequest(mockEnv, request);
      expect(result.status).toBe('success');
      expect(result.result.count).toBeGreaterThan(0);
      expect(result.result.patterns).toContain('phone:123-456-7890');
    });

    it('should detect URL patterns', async () => {
      const request: ComponentRequest = {
        input: 'Visit https://example.com for details',
        options: { algorithm: 'regex' },
        metadata: {}
      };

      const result = await processRequest(mockEnv, request);
      expect(result.status).toBe('success');
      expect(result.result.count).toBeGreaterThan(0);
      expect(result.result.patterns).toContain('url:https://example.com');
    });

    it('should handle text with no patterns', async () => {
      const request: ComponentRequest = {
        input: 'This is just plain text with no special patterns',
        options: { algorithm: 'regex' },
        metadata: {}
      };

      const result = await processRequest(mockEnv, request);
      expect(result.status).toBe('success');
      expect(result.result.count).toBe(0);
      expect(result.result.patterns).toEqual([]);
    });
  });
});