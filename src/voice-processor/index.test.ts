import { describe, it, expect } from 'vitest';

describe('Voice Processor Service', () => {
  it('should export service class', async () => {
    const module = await import('./index.js');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
  
  it('should have service inheritance', async () => {
    const module = await import('./index.js');
    const ServiceClass = module.default;
    
    // Check if it's a class that can be instantiated
    expect(() => {
      const mockEnv = { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } };
      new ServiceClass(mockEnv);
    }).not.toThrow();
  });
});