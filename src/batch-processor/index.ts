import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { createLogger } from '../shared/logger.js';
import { MemoryRouter } from '../shared/memory-router.js';
import { RaindropAIClient } from '../shared/raindrop-ai-client.js';

const serviceLogger = createLogger('batch-processor');

/**
 * Sleep Cycle Batch Processor
 * 
 * Runs consolidation on memories to:
 * 1. Extract behavioral patterns from working memory
 * 2. Apply exponential temporal decay
 * 3. Migrate memories to appropriate long-term tiers
 * 4. Store patterns in procedural memory
 */
export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    const { action, user_id } = message.body;
    
    serviceLogger.info('Processing batch job', { action, user_id });
    
    try {
      if (action === 'sleep_cycle') {
        await this.runSleepCycle(user_id);
      } else if (action === 'decay_weights') {
        await this.applyTemporalDecay(user_id);
      } else {
        serviceLogger.warn('Unknown action', { action });
      }
    } catch (error) {
      serviceLogger.error('Batch processing failed', error);
      throw error;
    }
  }
  
  /**
   * Sleep Cycle: Consolidate working memory into long-term storage
   * Mimics human sleep - patterns emerge, unimportant memories fade
   */
  private async runSleepCycle(user_id: string): Promise<void> {
    serviceLogger.info('Starting Sleep Cycle consolidation', { user_id });
    
    const router = new MemoryRouter(this.env);
    const aiClient = new RaindropAIClient(this.env);
    
    // Phase 1: Consolidate memories using MemoryRouter
    const consolidationStats = await router.consolidateMemories();
    
    serviceLogger.info('Memory consolidation complete', consolidationStats);
    
    // Phase 2: Analyze patterns from working memory
    try {
      const workingMemories = await this.env.WORKING_MEMORY.searchSemanticMemory('all');
      const rawResults = workingMemories.documentSearchResponse?.results || [];
      
      // Parse memories from SmartMemory results
      const results = rawResults.map((r: any) => {
        try {
          return JSON.parse(r.text || '{}');
        } catch {
          return null;
        }
      }).filter((m: any) => m && m.content);
      
      if (results.length > 0) {
        // Extract behavioral patterns using AI
        const patterns = await aiClient.detectBehavioralPatterns(results);
        
        if (patterns.length > 0) {
          // Store patterns in procedural memory
          for (const pattern of patterns) {
            await this.env.PROCEDURAL_MEMORY.putSemanticMemory({
              type: 'behavioral_pattern',
              user_id,
              pattern_type: pattern.pattern_type,
              description: pattern.description,
              frequency: pattern.frequency,
              confidence: pattern.confidence,
              recommendations: pattern.recommendations,
              extracted_at: new Date().toISOString(),
              source_memory_count: results.length
            } as any);
          }
          
          serviceLogger.info('Behavioral patterns extracted and stored', {
            pattern_count: patterns.length,
            user_id
          });
        }
      }
    } catch (patternError) {
      serviceLogger.error('Pattern extraction failed', patternError);
      // Continue processing - pattern extraction is non-critical
    }
    
    // Phase 3: Apply temporal decay to all memories
    await this.applyTemporalDecay(user_id);
    
    serviceLogger.info('Sleep Cycle complete', {
      user_id,
      consolidated: consolidationStats.consolidated,
      to_semantic: consolidationStats.toSemantic,
      to_episodic: consolidationStats.toEpisodic,
      to_procedural: consolidationStats.toProcedural
    });
  }
  
  /**
   * Apply exponential temporal decay to memory weights
   * Formula: weight *= Math.exp(-days_since_creation / half_life)
   * Default half_life: 30 days
   */
  private async applyTemporalDecay(user_id: string): Promise<void> {
    const HALF_LIFE_DAYS = 30;
    const now = Date.now();
    
    serviceLogger.info('Applying temporal decay', { user_id, half_life: HALF_LIFE_DAYS });
    
    // Apply decay to each memory tier
    const tiers = [
      { name: 'working-memory', resource: this.env.WORKING_MEMORY },
      { name: 'episodic-memory', resource: this.env.EPISODIC_MEMORY },
      { name: 'semantic-memory', resource: this.env.SEMANTIC_MEMORY },
      { name: 'procedural-memory', resource: this.env.PROCEDURAL_MEMORY }
    ];
    
    let totalDecayed = 0;
    
    for (const tier of tiers) {
      try {
        const memories = await tier.resource.searchSemanticMemory('all');
        const rawResults = memories.documentSearchResponse?.results || [];
        
        // Parse memories from SmartMemory results
        const results = rawResults.map((r: any) => {
          try {
            return JSON.parse(r.text || '{}');
          } catch {
            return null;
          }
        }).filter((m: any) => m);
        
        if (results.length === 0) continue;
        
        for (const memory of results) {
          // Skip pinned memories - they don't decay
          if (memory.metadata?.pinned) continue;
          
          const createdAt = new Date(memory.created_at || memory.timestamp).getTime();
          const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
          
          // Calculate decay factor
          const decayFactor = Math.exp(-daysSinceCreation / HALF_LIFE_DAYS);
          
          // Apply decay to weight (default weight = 1.0)
          const originalWeight = memory.metadata?.weight || 1.0;
          const newWeight = originalWeight * decayFactor;
          
          // Update memory with decayed weight
          const updatedMemory = {
            ...memory,
            metadata: {
              ...memory.metadata,
              weight: newWeight,
              last_decay_at: new Date().toISOString(),
              decay_factor: decayFactor
            }
          };
          
          await tier.resource.putSemanticMemory(updatedMemory as any);
          totalDecayed++;
        }
        
        serviceLogger.info(`Decay applied to ${tier.name}`, {
          memory_count: results.length,
          half_life_days: HALF_LIFE_DAYS
        });
      } catch (tierError) {
        serviceLogger.error(`Decay failed for ${tier.name}`, tierError);
      }
    }
    
    serviceLogger.info('Temporal decay complete', {
      total_memories_decayed: totalDecayed,
      half_life_days: HALF_LIFE_DAYS
    });
  }
}

export interface Body {
  action: 'sleep_cycle' | 'decay_weights';
  user_id: string;
  options?: {
    half_life_days?: number;
    force_consolidation?: boolean;
  };
}

