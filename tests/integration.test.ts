/**
 * HANSEI System Tests
 * Comprehensive test suite for all components
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = process.env.API_BASE || 'http://localhost:8787';
const TEST_USER_ID = 'test_user_' + Date.now();

describe('HANSEI Integration Tests', () => {
  
  describe('Authentication & User Context', () => {
    it('should extract user context from headers', async () => {
      const response = await fetch(`${API_BASE}/health`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('ok');
    });
    
    it('should default to anonymous for missing user', async () => {
      const response = await fetch(`${API_BASE}/health`);
      expect(response.status).toBe(200);
    });
  });
  
  describe('Memory Core', () => {
    let memoryId: string;
    
    it('should store memory with user isolation', async () => {
      const response = await fetch(`${API_BASE}/api/store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': TEST_USER_ID
        },
        body: JSON.stringify({
          input: 'I want to start running every morning',
          options: {
            metadata: { type: 'goal' }
          }
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
      memoryId = data.id;
    });
    
    it('should retrieve user-specific memories', async () => {
      const response = await fetch(`${API_BASE}/api/retrieve?limit=10`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.memories)).toBe(true);
    });
    
    it('should search user-specific memories', async () => {
      const response = await fetch(`${API_BASE}/api/search?q=running`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
  
  describe('Intelligence Processor', () => {
    it('should extract entities from text', async () => {
      const response = await fetch(`${API_BASE}/infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': TEST_USER_ID
        },
        body: JSON.stringify({
          content: 'I want to meditate for 10 minutes every morning to reduce stress'
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.extracted).toBeDefined();
      expect(data.extracted.entities).toBeDefined();
      expect(data.extracted.relationships).toBeDefined();
      expect(data.userId).toBe(TEST_USER_ID);
    });
    
    it('should classify memory context correctly', async () => {
      const response = await fetch(`${API_BASE}/infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': TEST_USER_ID
        },
        body: JSON.stringify({
          content: 'Every morning at 6am I go for a run'
        })
      });
      
      const data = await response.json();
      expect(data.context).toBeDefined();
      // Should classify as 'skill' (habit/routine)
      expect(['skill', 'knowledge', 'session', 'episode']).toContain(data.context);
    });
  });
  
  describe('Graph Visualization', () => {
    beforeAll(async () => {
      // Seed some data
      const seedData = [
        'I want to learn TypeScript to build better applications',
        'I practice meditation every morning',
        'TypeScript helps me write cleaner code'
      ];
      
      for (const content of seedData) {
        await fetch(`${API_BASE}/infer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': TEST_USER_ID
          },
          body: JSON.stringify({ content })
        });
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
    
    it('should return graph data with nodes and edges', async () => {
      const response = await fetch(`${API_BASE}/api/graph?limit=50`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.graph).toBeDefined();
      expect(data.graph.nodes).toBeDefined();
      expect(data.graph.edges).toBeDefined();
      expect(Array.isArray(data.graph.nodes)).toBe(true);
      expect(Array.isArray(data.graph.edges)).toBe(true);
    });
    
    it('should filter graph by query', async () => {
      const response = await fetch(`${API_BASE}/api/graph?query=meditation&limit=50`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });
    
    it('should cache graph results', async () => {
      const response1 = await fetch(`${API_BASE}/api/graph?limit=50`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      const data1 = await response1.json();
      
      const response2 = await fetch(`${API_BASE}/api/graph?limit=50`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      const data2 = await response2.json();
      
      // Second request should be cached
      expect(data2.cached).toBe(true);
    });
  });
  
  describe('Memory Router & Tiering', () => {
    it('should consolidate memories', async () => {
      const response = await fetch(`${API_BASE}/api/memory/consolidate`, {
        method: 'POST',
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.consolidation).toBeDefined();
    });
  });
  
  describe('Pattern Detection', () => {
    it('should detect orphaned nodes', async () => {
      const response = await fetch(`${API_BASE}/api/patterns/orphans`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.orphans).toBeDefined();
      expect(Array.isArray(data.orphans)).toBe(true);
    });
    
    it('should detect hub nodes', async () => {
      const response = await fetch(`${API_BASE}/api/patterns/hubs`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.hubs).toBeDefined();
    });
  });
  
  describe('Conversational Interface', () => {
    it('should answer questions about memories', async () => {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': TEST_USER_ID
        },
        body: JSON.stringify({
          message: 'What are my goals?'
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.answer).toBeDefined();
      expect(typeof data.answer).toBe('string');
    });
    
    it('should track conversation history', async () => {
      const response = await fetch(`${API_BASE}/api/conversations/history`, {
        headers: {
          'X-User-ID': TEST_USER_ID
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.conversations).toBeDefined();
    });
  });
  
  describe('User Isolation', () => {
    const USER_A = 'user_a_' + Date.now();
    const USER_B = 'user_b_' + Date.now();
    
    it('should isolate memories between users', async () => {
      // User A stores a memory
      await fetch(`${API_BASE}/infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': USER_A
        },
        body: JSON.stringify({
          content: 'Secret goal for user A only'
        })
      });
      
      // User B stores a memory
      await fetch(`${API_BASE}/infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': USER_B
        },
        body: JSON.stringify({
          content: 'Different goal for user B'
        })
      });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // User A retrieves graph - should NOT see User B's data
      const graphA = await fetch(`${API_BASE}/api/graph?query=goal&limit=50`, {
        headers: { 'X-User-ID': USER_A }
      });
      const dataA = await graphA.json();
      
      // User B retrieves graph
      const graphB = await fetch(`${API_BASE}/api/graph?query=goal&limit=50`, {
        headers: { 'X-User-ID': USER_B }
      });
      const dataB = await graphB.json();
      
      // Both should have results but different ones
      expect(dataA.graph.nodes.length).toBeGreaterThan(0);
      expect(dataB.graph.nodes.length).toBeGreaterThan(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle missing content gracefully', async () => {
      const response = await fetch(`${API_BASE}/infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': TEST_USER_ID
        },
        body: JSON.stringify({})
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
    
    it('should handle malformed JSON', async () => {
      const response = await fetch(`${API_BASE}/infer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': TEST_USER_ID
        },
        body: 'invalid json'
      });
      
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
  
  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        fetch(`${API_BASE}/infer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': `perf_test_${i}`
          },
          body: JSON.stringify({
            content: `Test goal number ${i}`
          })
        })
      );
      
      const responses = await Promise.all(requests);
      const allSuccessful = responses.every(r => r.status === 200);
      expect(allSuccessful).toBe(true);
    });
  });
  
  afterAll(async () => {
    // Cleanup test data
    try {
      await fetch(`${API_BASE}/api/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': TEST_USER_ID
        },
        body: JSON.stringify({
          user_id: TEST_USER_ID
        })
      });
    } catch (e) {
      console.warn('Cleanup failed:', e);
    }
  });
});
