// Raindrop SmartMemory 4-Tier Router
// Routes data to appropriate memory tiers based on context and importance

export interface MemoryData {
  id?: string;
  content: string;
  metadata: any;
  created_at?: Date;
  access_count?: number;
  priority?: 'high' | 'medium' | 'low';
}

export type MemoryContext = 'session' | 'knowledge' | 'skill' | 'episode';

export class MemoryRouter {
  constructor(private env: any) {}

  /**
   * Route data to appropriate memory tier based on context
   * 
   * Memory Tiers:
   * - Working Memory: Active session data, temporary state (TTL: 1 hour)
   * - Semantic Memory: Knowledge graph, facts, entities (persistent)
   * - Procedural Memory: Habits, routines, learned behaviors (persistent)
   * - Episodic Memory: Life events, conversations, experiences (long-term)
   */
  async routeMemory(data: MemoryData, context: MemoryContext): Promise<any> {
    const enrichedData = {
      ...data,
      routed_at: new Date().toISOString(),
      tier: this.getTierFromContext(context),
    };

    switch(context) {
      case 'session':
        // Working Memory: Active session data, temporary state
        return await this.env.AGENT_MEMORY.putWorkingMemory(enrichedData);
      
      case 'knowledge':
        // Semantic Memory: Knowledge graph, facts, entities
        return await this.env.SEMANTIC_MEMORY.putSemanticMemory(enrichedData);
      
      case 'skill':
        // Procedural Memory: Habits, routines, learned behaviors
        return await this.env.PROCEDURAL_MEMORY.putProceduralMemory(enrichedData);
      
      case 'episode':
        // Episodic Memory: Life events, conversations, experiences
        return await this.env.EPISODIC_MEMORY.putEpisodicMemory(enrichedData);
      
      default:
        // Default to working memory for unclassified data
        return await this.env.AGENT_MEMORY.putWorkingMemory(enrichedData);
    }
  }

  /**
   * Intelligent memory consolidation
   * Moves memories from working tier to long-term tiers based on age and access patterns
   */
  async consolidateMemories(): Promise<{
    consolidated: number;
    toSemantic: number;
    toEpisodic: number;
    toProcedural: number;
    deleted: number;
  }> {
    const stats = {
      consolidated: 0,
      toSemantic: 0,
      toEpisodic: 0,
      toProcedural: 0,
      deleted: 0,
    };

    try {
      // Get all working memories
      const workingMemories = await this.env.AGENT_MEMORY.searchWorkingMemory('all');
      
      if (!workingMemories?.results) {
        return stats;
      }

      for (const memory of workingMemories.results) {
        const age = Date.now() - new Date(memory.created_at).getTime();
        const accessCount = memory.access_count || 0;
        const priority = memory.metadata?.priority || 'medium';
        
        // Consolidation rules based on age, access patterns, and priority
        
        // High-priority or frequently accessed → Semantic Memory (knowledge)
        if (priority === 'high' || accessCount > 5) {
          await this.env.SEMANTIC_MEMORY.putSemanticMemory(memory);
          stats.toSemantic++;
          stats.consolidated++;
        }
        // Repeated patterns or habits → Procedural Memory (skills)
        else if (this.detectPattern(memory)) {
          await this.env.PROCEDURAL_MEMORY.putProceduralMemory(memory);
          stats.toProcedural++;
          stats.consolidated++;
        }
        // Old memories with personal context → Episodic Memory (experiences)
        else if (age > 86400000) { // > 24 hours
          await this.env.EPISODIC_MEMORY.putEpisodicMemory(memory);
          stats.toEpisodic++;
          stats.consolidated++;
        }
        
        // Remove from working memory if older than 1 hour
        if (age > 3600000) {
          await this.env.AGENT_MEMORY.deleteWorkingMemory(memory.id);
          stats.deleted++;
        }
      }
    } catch (error) {
      console.error('Memory consolidation error:', error);
    }

    return stats;
  }

  /**
   * Search across all memory tiers
   */
  async searchAllTiers(query: string, limit: number = 20): Promise<any[]> {
    const results = await Promise.allSettled([
      this.env.AGENT_MEMORY.searchWorkingMemory(query, { limit: limit / 4 }),
      this.env.SEMANTIC_MEMORY.searchSemanticMemory(query, { limit: limit / 4 }),
      this.env.EPISODIC_MEMORY.searchEpisodicMemory(query, { limit: limit / 4 }),
      this.env.PROCEDURAL_MEMORY.searchProceduralMemory(query, { limit: limit / 4 }),
    ]);

    const allResults: any[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value?.results) {
        const tier = ['working', 'semantic', 'episodic', 'procedural'][index];
        allResults.push(...result.value.results.map((r: any) => ({ ...r, tier })));
      }
    });

    return allResults;
  }

  /**
   * Classify incoming data into appropriate memory context
   */
  classifyMemoryContext(content: string, metadata: any): MemoryContext {
    const contentLower = content.toLowerCase();
    
    // Knowledge indicators (facts, entities, concepts)
    if (
      metadata?.type === 'entity' ||
      metadata?.type === 'fact' ||
      contentLower.includes('is a') ||
      contentLower.includes('definition')
    ) {
      return 'knowledge';
    }
    
    // Skill indicators (habits, routines, procedures)
    if (
      metadata?.type === 'habit' ||
      metadata?.type === 'routine' ||
      contentLower.includes('how to') ||
      contentLower.includes('steps to') ||
      contentLower.includes('every day')
    ) {
      return 'skill';
    }
    
    // Episodic indicators (events, experiences, conversations)
    if (
      metadata?.type === 'conversation' ||
      metadata?.type === 'event' ||
      contentLower.includes('remember when') ||
      contentLower.includes('happened')
    ) {
      return 'episode';
    }
    
    // Default to session (working memory)
    return 'session';
  }

  /**
   * Detect if memory represents a recurring pattern
   */
  private detectPattern(memory: any): boolean {
    const metadata = memory.metadata || {};
    return (
      metadata.recurring === true ||
      metadata.frequency === 'daily' ||
      metadata.frequency === 'weekly' ||
      metadata.type === 'habit' ||
      metadata.type === 'routine'
    );
  }

  /**
   * Get memory tier name from context
   */
  private getTierFromContext(context: MemoryContext): string {
    const tierMap: Record<MemoryContext, string> = {
      session: 'working',
      knowledge: 'semantic',
      skill: 'procedural',
      episode: 'episodic',
    };
    return tierMap[context];
  }
}
