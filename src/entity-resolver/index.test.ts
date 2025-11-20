import { describe, it, expect, beforeEach, vi } from 'vitest';
import EntityResolverService from './index.js';
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

describe('Entity Resolver Service', () => {
  let service: EntityResolverService;

  beforeEach(() => {
    service = new EntityResolverService();
    vi.clearAllMocks();
  });

  describe('API Endpoints', () => {
    it('should handle entity resolution POST /api/resolve-entities', async () => {
      const requestData = {
        entities: [
          { name: 'Apple Inc', type: 'organization', confidence: 0.9 },
          { name: 'John Smith', type: 'person', confidence: 0.8 }
        ]
      };

      const request = new Request('http://localhost/api/resolve-entities', {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv as any);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe('success');
      expect(result.resolved_entities).toHaveLength(2);
      expect(result.metadata.total_entities).toBe(2);
    });

    it('should return 400 for invalid request body', async () => {
      const request = new Request('http://localhost/api/resolve-entities', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await service.fetch(request, mockEnv as any);
      expect(response.status).toBe(400);
    });
  });

  describe('Service Method', () => {
    it('should resolve entities successfully', async () => {
      const entities = [
        { name: 'Microsoft Corp', type: 'organization' },
        { name: 'Jane Doe', type: 'person' }
      ];

      const resolved = await service.resolveEntities(entities);
      expect(resolved).toHaveLength(2);
      expect(resolved[0]).toHaveProperty('resolved', true);
      expect(resolved[0]).toHaveProperty('id');
      expect(resolved[0]).toHaveProperty('normalized_name');
    });

    it('should handle empty array', async () => {
      const resolved = await service.resolveEntities([]);
      expect(resolved).toEqual([]);
    });

    it('should handle invalid input', async () => {
      const resolved = await service.resolveEntities(null as any);
      expect(resolved).toEqual([]);
    });
  });

  describe('Utils Functions', () => {
    describe('processRequest', () => {
      it('should process valid request successfully', async () => {
        const request: ComponentRequest = {
          input: 'John Smith works at Microsoft Corp.',
          options: {},
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
        expect(result.metadata.error).toBe('Invalid input');
      });
    });

    describe('validateRequest', () => {
      it('should validate correct request', async () => {
        const request: ComponentRequest = {
          input: 'Valid text input',
          options: {},
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

      it('should reject null request', async () => {
        const isValid = await validateRequest(null as any);
        expect(isValid).toBe(false);
      });
    });

    describe('optimizeProcessing', () => {
      it('should optimize request properly', async () => {
        const request: ComponentRequest = {
          input: '  Text with whitespace  ',
          options: { someOption: 'value' },
          metadata: {}
        };

        const optimized = await optimizeProcessing(mockEnv, request);
        expect(optimized.input).toBe('Text with whitespace');
        expect(optimized.options.optimized).toBe(true);
      });
    });
  });
});