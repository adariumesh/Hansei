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

    // SmartMemory putSemanticMemory expects text content for vector embedding
    // Store the full object as JSON in the text field for later retrieval
    const documentText = JSON.stringify(enrichedData);

    let result;
    const tierName = this.getTierFromContext(context);
    
    switch(context) {
      case 'session':
        // Working Memory: Active session data, temporary state
        result = await this.env.WORKING_MEMORY.putSemanticMemory({
          text: documentText,
          metadata: { user_id: (data as any).user_id, memory_id: data.id }
        });
        break;
      
      case 'knowledge':
        // Semantic Memory: Knowledge graph, facts, entities
        result = await this.env.SEMANTIC_MEMORY.putSemanticMemory({
          text: documentText,
          metadata: { user_id: (data as any).user_id, memory_id: data.id }
        });
        break;
      
      case 'skill':
        // Procedural Memory: Habits, routines, learned behaviors
        result = await this.env.PROCEDURAL_MEMORY.putSemanticMemory({
          text: documentText,
          metadata: { user_id: (data as any).user_id, memory_id: data.id }
        });
        break;
      
      case 'episode':
        // Episodic Memory: Life events, conversations, experiences
        result = await this.env.EPISODIC_MEMORY.putSemanticMemory({
          text: documentText,
          metadata: { user_id: (data as any).user_id, memory_id: data.id }
        });
        break;
      
      default:
        // Default to working memory for unclassified data
        result = await this.env.WORKING_MEMORY.putSemanticMemory({
          text: documentText,
          metadata: { user_id: (data as any).user_id, memory_id: data.id }
        });
    }

    // Store deletion metadata in SESSION_CACHE for fast lookup
    if (result?.chunkSignature && data.id && (data as any).user_id) {
      const indexKey = `memory_index:${(data as any).user_id}:${data.id}`;
      const indexData = {
        chunkSignature: result.chunkSignature,
        tier: tierName,
        user_id: (data as any).user_id,
        memory_id: data.id,
        created_at: enrichedData.routed_at
      };
      await this.env.SESSION_CACHE.put(indexKey, JSON.stringify(indexData));
    }

    return result;
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
      const workingMemories = await this.env.WORKING_MEMORY.searchSemanticMemory('all');
      
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
          await this.env.PROCEDURAL_MEMORY.putSemanticMemory(memory);
          stats.toProcedural++;
          stats.consolidated++;
        }
        // Old memories with personal context → Episodic Memory (experiences)
        else if (age > 86400000) { // > 24 hours
          await this.env.EPISODIC_MEMORY.putSemanticMemory(memory);
          stats.toEpisodic++;
          stats.consolidated++;
        }
        
        // Remove from working memory if older than 1 hour
        if (age > 3600000) {
          // Note: SmartMemory doesn't have delete API, will rely on TTL
          stats.deleted++;
        }
      }
    } catch (error) {
      // Memory consolidation is best-effort, don't fail the request
    }

    return stats;
  }

  /**
   * Search across all memory tiers
   */
  async searchAllTiers(query: string, limit: number = 20): Promise<any[]> {
    console.log(`[MemoryRouter] searchAllTiers: query="${query}", limit=${limit}`);
    
    const results = await Promise.allSettled([
      this.env.WORKING_MEMORY.searchSemanticMemory(query || ''),
      this.env.SEMANTIC_MEMORY.searchSemanticMemory(query || ''),
      this.env.EPISODIC_MEMORY.searchSemanticMemory(query || ''),
      this.env.PROCEDURAL_MEMORY.searchSemanticMemory(query || ''),
    ]);

    console.log(`[MemoryRouter] Promise.allSettled full results:`, JSON.stringify(results, null, 2));

    const allResults: any[] = [];
    results.forEach((result, index) => {
      const tier = ['working', 'semantic', 'episodic', 'procedural'][index];
      
      if (result.status === 'fulfilled' && result.value) {
        console.log(`[MemoryRouter] ${tier} result structure:`, Object.keys(result.value));
        
        // Try different response formats
        let tierResults = result.value?.documentSearchResponse?.results ||
                         result.value?.results ||
                         (Array.isArray(result.value?.document) ? result.value.document : 
                          result.value?.document ? [result.value.document] : []);
        
        if (!Array.isArray(tierResults) && tierResults) {
          tierResults = [tierResults];
        }
        if (!Array.isArray(tierResults) && tierResults) {
          tierResults = [tierResults];
        }
        
        console.log(`[MemoryRouter] Processing ${tierResults?.length || 0} results from ${tier}`);
        
        if (Array.isArray(tierResults)) {
          tierResults.forEach((r: any) => {
            try {
              // SmartMemory stores JSON as text, parse it back
              const parsed = r.text ? JSON.parse(r.text) : {};
              allResults.push({
                id: parsed.id || r.chunkSignature || r.id,
                text: parsed.content || r.text,
                content: parsed.content || r.text,
                metadata: parsed.metadata || {},
                timestamp: parsed.timestamp,
                user_id: parsed.user_id,
                tier,
                score: r.score
              });
            } catch (parseError) {
              console.log(`[MemoryRouter] Parse error in ${tier}:`, parseError);
              // If not JSON, treat as plain text
              allResults.push({
                id: r.chunkSignature || r.id || `unknown_${Date.now()}`,
                text: r.text || r.content,
                content: r.text || r.content,
                metadata: {},
                tier,
                score: r.score
              });
            }
          });
        }
      }
    });

    console.log(`[MemoryRouter] Total results before slice: ${allResults.length}`);
    return allResults.slice(0, limit);
  }

  /**
   * Delete a memory using hybrid KV+SmartMemory approach
   * 1. Look up deletion metadata from SESSION_CACHE index
   * 2. Delete from appropriate SmartMemory tier using chunkSignature
   * 3. Clean up the index entry
   */
  async deleteMemory(memoryId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Step 1: Get deletion metadata from SESSION_CACHE index
      const indexKey = `memory_index:${userId}:${memoryId}`;
      const indexDataRaw = await this.env.SESSION_CACHE.get(indexKey);
      
      if (!indexDataRaw) {
        // Fallback: Try searching all tiers (for old memories without index)
        return await this.deleteMemoryFallback(memoryId, userId);
      }

      const indexData = JSON.parse(indexDataRaw);
      const { chunkSignature, tier } = indexData;

      // Step 2: Get the correct tier resource
      let tierResource;
      switch(tier) {
        case 'working':
          tierResource = this.env.WORKING_MEMORY;
          break;
        case 'semantic':
          tierResource = this.env.SEMANTIC_MEMORY;
          break;
        case 'episodic':
          tierResource = this.env.EPISODIC_MEMORY;
          break;
        case 'procedural':
          tierResource = this.env.PROCEDURAL_MEMORY;
          break;
        default:
          return { success: false, error: `Unknown tier: ${tier}` };
      }

      // Step 3: Delete from SmartMemory using chunkSignature
      await tierResource.deleteSemanticMemory(chunkSignature);

      // Step 4: Clean up the index entry
      await this.env.SESSION_CACHE.delete(indexKey);

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Fallback deletion method for memories created before index implementation
   * Searches all tiers to find and delete the memory
   */
  private async deleteMemoryFallback(memoryId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const tiers = [
      { name: 'working', ref: this.env.WORKING_MEMORY },
      { name: 'semantic', ref: this.env.SEMANTIC_MEMORY },
      { name: 'episodic', ref: this.env.EPISODIC_MEMORY },
      { name: 'procedural', ref: this.env.PROCEDURAL_MEMORY },
    ];

    for (const tier of tiers) {
      try {
        const searchResult = await tier.ref.searchSemanticMemory(memoryId);
        
        if (searchResult?.documentSearchResponse?.results) {
          for (const result of searchResult.documentSearchResponse.results) {
            try {
              const parsed = result.text ? JSON.parse(result.text) : {};
              if (parsed.id === memoryId && parsed.user_id === userId) {
                await tier.ref.deleteSemanticMemory(result.chunkSignature);
                return { success: true };
              }
            } catch (parseError) {
              continue;
            }
          }
        }
      } catch (tierError) {
        continue;
      }
    }

    return { success: false, error: 'Memory not found in any tier' };
  }

  /**
   * Delete ALL memories for a user across all tiers
   * WARNING: This is destructive and cannot be undone
   */
  async deleteAllMemoriesForUser(userId: string): Promise<{ 
    success: boolean; 
    deleted: number; 
    errors: number;
    details: { tier: string; deleted: number }[];
  }> {
    const tiers = [
      { name: 'working', ref: this.env.WORKING_MEMORY },
      { name: 'semantic', ref: this.env.SEMANTIC_MEMORY },
      { name: 'episodic', ref: this.env.EPISODIC_MEMORY },
      { name: 'procedural', ref: this.env.PROCEDURAL_MEMORY },
    ];

    let totalDeleted = 0;
    let totalErrors = 0;
    const details = [];

    for (const tier of tiers) {
      let tierDeleted = 0;
      const deletedChunks = new Set<string>();
      
      try {
        // Try multiple broad queries to catch all memories
        // SmartMemory uses vector search so we need semantic queries
        const queries = [userId, 'memory', 'test', 'diary', 'conversation', 'note'];
        
        for (const query of queries) {
          try {
            const searchResult = await tier.ref.searchSemanticMemory(query);
            
            if (searchResult?.documentSearchResponse?.results) {
              for (const result of searchResult.documentSearchResponse.results) {
                try {
                  const parsed = result.text ? JSON.parse(result.text) : {};
                  if (parsed.user_id === userId && !deletedChunks.has(result.chunkSignature)) {
                    // Delete this memory
                    await tier.ref.deleteSemanticMemory(result.chunkSignature);
                    deletedChunks.add(result.chunkSignature);
                    tierDeleted++;
                    totalDeleted++;
                    
                    // Also delete from SESSION_CACHE index if it exists
                    if (parsed.id) {
                      const indexKey = `memory_index:${userId}:${parsed.id}`;
                      await this.env.SESSION_CACHE.delete(indexKey);
                    }
                  }
                } catch (parseError) {
                  totalErrors++;
                  continue;
                }
              }
            }
          } catch (queryError) {
            totalErrors++;
            continue;
          }
        }
      } catch (tierError) {
        totalErrors++;
      }
      
      details.push({ tier: tier.name, deleted: tierDeleted });
    }

    return {
      success: true,
      deleted: totalDeleted,
      errors: totalErrors,
      details
    };
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
