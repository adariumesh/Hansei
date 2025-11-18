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

describe('Voice Processor Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processRequest', () => {
    it('should process basic voice request', async () => {
      const request: ComponentRequest = {
        input: 'test audio data',
        options: { format: 'wav' }
      };
      
      const result = await processRequest(mockEnv, request);
      expect(result.status).toBe('success');
      expect(result.result.processed).toBe(true);
      expect(result.result.format).toBe('wav');
    });

    it('should handle empty input', async () => {
      const request: ComponentRequest = {
        input: ''
      };
      
      await expect(processRequest(mockEnv, request)).rejects.toThrow();
    });

    it('should handle invalid audio format', async () => {
      const request: ComponentRequest = {
        input: 'test audio data',
        options: { format: 'invalid' }
      };
      
      await expect(processRequest(mockEnv, request)).rejects.toThrow('Unsupported format: invalid');
    });
  });

  describe('validateRequest', () => {
    it('should validate valid request', async () => {
      const request: ComponentRequest = {
        input: 'valid audio data',
        options: { format: 'wav' }
      };
      
      const result = await validateRequest(request);
      expect(result).toBe(true);
    });

    it('should reject empty input', async () => {
      const request: ComponentRequest = {
        input: ''
      };
      
      await expect(validateRequest(request)).rejects.toThrow();
    });

    it('should reject null input', async () => {
      const request: ComponentRequest = {
        input: null as any
      };
      
      await expect(validateRequest(request)).rejects.toThrow();
    });
  });

  describe('optimizeProcessing', () => {
    it('should optimize valid request', async () => {
      const request: ComponentRequest = {
        input: 'audio data to optimize',
        options: { quality: 'high' }
      };
      
      const result = await optimizeProcessing(mockEnv, request);
      expect(result.options.quality).toBe('high');
      expect(result.options.compression).toBe('auto');
      expect(result.options.format).toBe('wav');
      expect(result.metadata.optimized).toBe(true);
    });

    it('should handle optimization with no options', async () => {
      const request: ComponentRequest = {
        input: 'audio data'
      };
      
      const result = await optimizeProcessing(mockEnv, request);
      expect(result.options.quality).toBe('balanced');
      expect(result.options.compression).toBe('auto');
      expect(result.options.format).toBe('wav');
      expect(result.metadata.optimized).toBe(true);
    });
  });
});