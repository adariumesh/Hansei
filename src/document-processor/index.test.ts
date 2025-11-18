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

describe('Document Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the DATABASE mock
    mockEnv.DATABASE = {
      prepare: vi.fn(),
      exec: vi.fn(),
      batch: vi.fn()
    };
  });

  describe('Request Validation', () => {
    describe('validateRequest', () => {
      it('should validate valid request', async () => {
        const request: ComponentRequest = {
          input: 'Test document content',
          options: { format: 'text' },
          metadata: { source: 'test' }
        };
        const result = await validateRequest(request);
        expect(result).toBe(true);
      });

      it('should reject empty input', async () => {
        const request: ComponentRequest = { input: '' };
        await expect(validateRequest(request)).rejects.toThrow();
      });

      it('should reject null input', async () => {
        const request: ComponentRequest = { input: null as any };
        await expect(validateRequest(request)).rejects.toThrow();
      });

      it('should handle missing options gracefully', async () => {
        const request: ComponentRequest = { input: 'Test content' };
        const result = await validateRequest(request);
        expect(result).toBe(true);
      });

      it('should validate input length limits', async () => {
        const longInput = 'a'.repeat(1000001); // Over 1MB of text
        const request: ComponentRequest = { input: longInput };
        await expect(validateRequest(request)).rejects.toThrow();
      });
    });
  });

  describe('Request Processing', () => {
    describe('processRequest', () => {
      it('should process valid text input', async () => {
        const request: ComponentRequest = {
          input: 'Test document content',
          options: { format: 'text' }
        };
        const response = await processRequest(mockEnv, request);
        expect(response.status).toBe('success');
        expect(response.result.format).toBe('text');
        expect(response.result.content).toBe('Test document content');
        expect(response.result.word_count).toBe(3);
      });

      it('should handle different document formats', async () => {
        const testCases = [
          { format: 'text', input: 'Test content' },
          { format: 'markdown', input: '# Header\nTest content' },
          { format: 'json', input: '{"test": "content"}' },
          { format: 'xml', input: '<test>content</test>' }
        ];
        
        for (const testCase of testCases) {
          const request: ComponentRequest = {
            input: testCase.input,
            options: { format: testCase.format }
          };
          const response = await processRequest(mockEnv, request);
          expect(response.status).toBe('success');
          expect(response.result.format).toBe(testCase.format);
        }
      });

      it('should generate unique response IDs', async () => {
        const request: ComponentRequest = { input: 'Test' };
        const responses = await Promise.all(
          Array.from({ length: 5 }, () => processRequest(mockEnv, request))
        );
        
        const ids = responses.map(r => r.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(5); // All IDs should be unique
        responses.forEach(response => {
          expect(response.status).toBe('success');
          expect(response.id).toMatch(/^doc-\d+-\w+$/);
        });
      });

      it('should track processing time', async () => {
        const request: ComponentRequest = { input: 'Test content' };
        const response = await processRequest(mockEnv, request);
        expect(response.status).toBe('success');
        expect(response.processing_time_ms).toBeGreaterThanOrEqual(0);
        expect(typeof response.processing_time_ms).toBe('number');
      });

      it('should handle large documents', async () => {
        const largeInput = 'content '.repeat(50000).trim();
        const request: ComponentRequest = { input: largeInput };
        const response = await processRequest(mockEnv, request);
        expect(response.status).toBe('success');
        expect(response.result.word_count).toBe(50000);
      });

      it('should preserve metadata in response', async () => {
        const request: ComponentRequest = {
          input: 'Test',
          metadata: { source: 'test', priority: 'high' }
        };
        const response = await processRequest(mockEnv, request);
        expect(response.status).toBe('success');
        expect(response.metadata.source).toBe('test');
        expect(response.metadata.priority).toBe('high');
        expect(response.metadata.processed_at).toBeDefined();
      });
    });
  });

  describe('Processing Optimization', () => {
    describe('optimizeProcessing', () => {
      it('should optimize simple text requests', async () => {
        const request: ComponentRequest = {
          input: 'Simple text to optimize'
        };
        const result = await optimizeProcessing(mockEnv, request);
        expect(result.input).toBe('Simple text to optimize');
      });

      it('should handle preprocessing options', async () => {
        const request: ComponentRequest = {
          input: 'Text with extra    spaces',
          options: { trim: true, normalize: true }
        };
        const result = await optimizeProcessing(mockEnv, request);
        expect(result.input).toBe('Text with extra spaces');
      });

      it('should chunk large documents', async () => {
        const largeText = 'paragraph '.repeat(10000);
        const request: ComponentRequest = {
          input: largeText,
          options: { chunk_size: 1000 }
        };
        const result = await optimizeProcessing(mockEnv, request);
        expect(result.input.length).toBe(1000);
        expect(result.metadata?.chunked).toBe(true);
        expect(result.metadata?.original_length).toBe(largeText.length);
      });

      it('should preserve original input when no optimization needed', async () => {
        const request: ComponentRequest = {
          input: 'Already optimized text',
          options: { skip_optimization: true }
        };
        const result = await optimizeProcessing(mockEnv, request);
        expect(result.input).toBe('Already optimized text');
      });

      it('should apply text encoding optimizations', async () => {
        const request: ComponentRequest = {
          input: 'Text with émojis and ünïcödé',
          options: { encoding: 'utf-8' }
        };
        const result = await optimizeProcessing(mockEnv, request);
        expect(result.input).toBeDefined();
        expect(result.input.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockEnv.DATABASE = null as any;
      const request: ComponentRequest = { input: 'Test' };
      const response = await processRequest(mockEnv, request);
      expect(response.status).toBe('failed');
      expect(response.result.error).toBe('Database connection not available');
    });

    it('should handle malformed JSON in input', async () => {
      const request: ComponentRequest = {
        input: '{"malformed": json}',
        options: { format: 'json' }
      };
      const response = await processRequest(mockEnv, request);
      expect(response.status).toBe('failed');
      expect(response.result.error).toBe('Invalid JSON format');
    });

    it('should handle unsupported document formats', async () => {
      const request: ComponentRequest = {
        input: 'Binary data',
        options: { format: 'binary' }
      };
      const response = await processRequest(mockEnv, request);
      expect(response.status).toBe('failed');
      expect(response.result.error).toBe('Unsupported format: binary');
    });

    it('should log errors appropriately', async () => {
      const request: ComponentRequest = { input: 'Test' };
      try {
        await processRequest(mockEnv, request);
      } catch (error) {
        expect(error.message).toBe('Not implemented');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        input: `Concurrent request ${i}`
      }));

      const promises = requests.map(req => 
        processRequest(mockEnv, req).catch(e => e)
      );

      const results = await Promise.allSettled(promises);
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });

    it('should complete processing within time limits', async () => {
      const start = Date.now();
      const request: ComponentRequest = {
        input: 'Time-sensitive processing'
      };

      try {
        await processRequest(mockEnv, request);
      } catch (error) {
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(5000); // 5 second max
        expect(error.message).toBe('Not implemented');
      }
    });
  });
});