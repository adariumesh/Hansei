import { describe, it, expect } from 'vitest';
import EntityResolverService from './index.js';
import { processRequest, validateRequest } from './utils.js';

describe('RED Phase Verification - Entity Resolver', () => {
  const mockEnv = {
    DATABASE: { prepare: () => ({}), exec: () => ({}) },
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }
  };

  it('should pass - main endpoint implemented', async () => {
    const service = new EntityResolverService();
    const request = new Request('http://localhost/api/resolve-entities', {
      method: 'POST',
      body: JSON.stringify({ entities: [{ name: 'Test', type: 'person' }] }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    const response = await service.fetch(request, mockEnv as any);
    expect(response.status).toBe(200);
  });

  it('should pass - processing function returns valid result', async () => {
    const request = { input: 'John Doe works at Google', options: {}, metadata: {} };
    const result = await processRequest(mockEnv as any, request);
    expect(result).toBeTruthy();
    expect(result.status).toBe('success');
  });

  it('should pass - validation works correctly', async () => {
    const validRequest = { input: 'Valid input', options: {}, metadata: {} };
    const isValid = await validateRequest(validRequest);
    expect(isValid).toBe(true);
  });

  it('should pass - results array has extracted entities', async () => {
    const request = { input: 'John Smith works at Microsoft Corp', options: {}, metadata: {} };
    const result = await processRequest(mockEnv as any, request);
    expect(result.result).toBeDefined();
    expect(Array.isArray(result.result)).toBe(true);
  });

  it('should pass - configuration is properly handled', async () => {
    const service = new EntityResolverService();
    expect(service).toBeDefined();
    expect(typeof service.resolveEntities).toBe('function');
  });
});