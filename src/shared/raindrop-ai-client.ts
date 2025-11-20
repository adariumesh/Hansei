/**
 * Raindrop AI Client
 * Provides LLM-powered entity extraction, pattern analysis, and behavioral insights
 * Uses Raindrop's built-in AI.run() with model-router for external LLMs
 */

import { AvailableModel } from "@liquidmetal-ai/raindrop-framework";

export interface EntityExtractionResult {
  entities: Array<{
    type: 'person' | 'goal' | 'habit' | 'project' | 'emotion' | 'object' | 'theme' | 'event';
    content: string;
    weight: number; // 0-1 importance
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: 'CAUSES' | 'DEPENDS_ON' | 'PART_OF' | 'IMPACTS' | 'RELATED_TO' | 'INVOLVES';
  }>;
  metadata: {
    emotional_intensity: number; // 1-10
    priority: 'high' | 'medium' | 'low';
    themes: string[];
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  };
}

export interface BehavioralPattern {
  pattern_type: 'recurring_habit' | 'emotional_trigger' | 'decision_pattern' | 'social_interaction';
  description: string;
  frequency: 'daily' | 'weekly' | 'occasional';
  confidence: number; // 0-1
  recommendations: string[];
}

export class RaindropAIClient {
  private env: any;
  private defaultModel: AvailableModel = 'llama-3.3-70b'; // Fast, capable, 70B params

  constructor(env: any) {
    this.env = env;
  }

  /**
   * Extract entities, relationships, and metadata from memory content
   * Replaces keyword-based extractThemes() and extractEntities()
   */
  async analyzeMemory(content: string, existingMetadata?: any): Promise<EntityExtractionResult> {
    const systemPrompt = `You are HANSEI's intelligence layer - an AI memory analyst.

Analyze the given content and extract:

**ENTITIES** (people, goals, habits, projects, emotions, objects, themes, events):
- Type: person | goal | habit | project | emotion | object | theme | event
- Content: The entity text
- Weight: Importance score 0-1

**RELATIONSHIPS** (connections between entities):
- Source & Target: Entity names
- Type: CAUSES | DEPENDS_ON | PART_OF | IMPACTS | RELATED_TO | INVOLVES

**METADATA**:
- Emotional intensity: 1-10 scale
- Priority: high | medium | low
- Themes: Array of extracted themes
- Sentiment: positive | negative | neutral | mixed

Return ONLY valid JSON matching this structure:
{
  "entities": [{"type": "person", "content": "Anne Frank", "weight": 0.9}],
  "relationships": [{"source": "Anne Frank", "target": "hope", "type": "INVOLVES"}],
  "metadata": {
    "emotional_intensity": 7,
    "priority": "high",
    "themes": ["resilience", "hope"],
    "sentiment": "positive"
  }
}`;

    try {
      const response = await this.env.AI.run(
        this.defaultModel,
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analyze this memory:\n\n${content}` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2, // Low temp for consistent extraction
          max_tokens: 800
        } as any
      );

      const raw = (response as any).response || (response as any).choices?.[0]?.message?.content || "";
      let extracted: EntityExtractionResult;

      try {
        extracted = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (e) {
        // Fallback: Try to extract JSON from markdown code blocks
        const match = String(raw).match(/\{[\s\S]*\}/);
        if (match) {
          extracted = JSON.parse(match[0]);
        } else {
          throw new Error("Failed to parse AI response as JSON");
        }
      }

      // Validate structure
      if (!extracted.entities || !extracted.relationships || !extracted.metadata) {
        throw new Error("Invalid extraction structure from AI");
      }

      return extracted;
    } catch (error) {
      console.error("AI analysis failed, using fallback:", error);
      // Fallback to basic keyword extraction
      return this.fallbackExtraction(content);
    }
  }

  /**
   * Analyze behavioral patterns across multiple memories
   * Used by Sleep Cycle consolidation to extract procedural memory
   */
  async detectBehavioralPatterns(memories: any[]): Promise<BehavioralPattern[]> {
    if (memories.length === 0) return [];

    const systemPrompt = `You are HANSEI's behavioral pattern analyst.

Analyze the collection of memories and identify:

**BEHAVIORAL PATTERNS**:
1. Recurring habits (actions repeated over time)
2. Emotional triggers (situations causing emotional responses)
3. Decision patterns (how user makes choices)
4. Social interaction patterns (relationship dynamics)

For each pattern, provide:
- pattern_type: recurring_habit | emotional_trigger | decision_pattern | social_interaction
- description: Clear explanation
- frequency: daily | weekly | occasional
- confidence: 0-1 score
- recommendations: Array of actionable insights

Return ONLY valid JSON:
{
  "patterns": [
    {
      "pattern_type": "recurring_habit",
      "description": "User writes reflectively every evening",
      "frequency": "daily",
      "confidence": 0.85,
      "recommendations": ["Continue this practice to maintain mental clarity"]
    }
  ]
}`;

    const memoryText = memories.map((m, i) => 
      `Memory ${i + 1}: ${m.content}\n  Created: ${m.timestamp || m.created_at}\n  Metadata: ${JSON.stringify(m.metadata || {})}`
    ).join('\n\n');

    try {
      const response = await this.env.AI.run(
        this.defaultModel,
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analyze these ${memories.length} memories:\n\n${memoryText}` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 1000
        } as any
      );

      const raw = (response as any).response || (response as any).choices?.[0]?.message?.content || "";
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

      return parsed.patterns || [];
    } catch (error) {
      console.error("Pattern detection failed:", error);
      return [];
    }
  }

  /**
   * Generate third-person objective advice based on memories and patterns
   * Used by personality-based advisors
   */
  async generateAdvice(
    memories: any[],
    patterns: BehavioralPattern[],
    personality: 'Gandhi' | 'Anne Frank' | 'Einstein' | 'Sensei',
    userQuery: string
  ): Promise<string> {
    const personalityPrompts = {
      'Gandhi': 'You are Mahatma Gandhi. Provide advice rooted in non-violence, self-discipline, and inner peace. Be compassionate yet firm.',
      'Anne Frank': 'You are Anne Frank. Provide advice with optimism, hope, and resilience despite difficulties. Be empathetic and understanding.',
      'Einstein': 'You are Albert Einstein. Provide advice using logical reasoning, curiosity, and scientific thinking. Be intellectually rigorous.',
      'Sensei': 'You are a wise Japanese Sensei. Provide advice with mindfulness, discipline, and philosophical wisdom. Be calm and insightful.'
    };

    const systemPrompt = `${personalityPrompts[personality]}

You have access to the user's memory graph and behavioral patterns. Analyze them objectively from a third-person perspective and provide advice that:

1. Acknowledges patterns you observe
2. Offers out-of-the-box thinking
3. Considers options available based on their context
4. Provides actionable next steps
5. Maintains your personality's perspective

Be direct, honest, and helpful.`;

    const contextText = `
**Behavioral Patterns Observed:**
${patterns.map(p => `- ${p.description} (${p.frequency}, confidence: ${(p.confidence * 100).toFixed(0)}%)`).join('\n')}

**Recent Memories (${memories.length}):**
${memories.slice(0, 10).map(m => `- ${m.content}`).join('\n')}

**User's Question:**
${userQuery}
`;

    try {
      const response = await this.env.AI.run(
        this.defaultModel,
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: contextText }
          ],
          temperature: 0.7, // Higher temp for creative advice
          max_tokens: 500
        } as any
      );

      const advice = (response as any).response || (response as any).choices?.[0]?.message?.content || "I apologize, but I'm unable to provide advice at this moment.";
      return advice;
    } catch (error) {
      console.error("Advice generation failed:", error);
      return `${personality}: I apologize, but I encountered an issue analyzing your situation. Please try again.`;
    }
  }

  /**
   * Fallback extraction when AI fails
   * Basic keyword-based approach (original implementation)
   */
  private fallbackExtraction(content: string): EntityExtractionResult {
    const contentLower = content.toLowerCase();
    
    // Simple theme detection
    const themes: string[] = [];
    if (contentLower.includes('hope') || contentLower.includes('optimis')) themes.push('hope');
    if (contentLower.includes('fear') || contentLower.includes('worry')) themes.push('fear');
    if (contentLower.includes('love') || contentLower.includes('family')) themes.push('relationships');
    if (contentLower.includes('work') || contentLower.includes('project')) themes.push('work');
    
    // Simple sentiment
    let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
    const positiveWords = ['happy', 'good', 'great', 'love', 'hope', 'joy'];
    const negativeWords = ['sad', 'bad', 'fear', 'worry', 'difficult', 'hard'];
    const posCount = positiveWords.filter(w => contentLower.includes(w)).length;
    const negCount = negativeWords.filter(w => contentLower.includes(w)).length;
    if (posCount > negCount) sentiment = 'positive';
    else if (negCount > posCount) sentiment = 'negative';
    else if (posCount > 0 && negCount > 0) sentiment = 'mixed';

    return {
      entities: [
        { type: 'theme', content: themes[0] || 'general', weight: 0.5 }
      ],
      relationships: [],
      metadata: {
        emotional_intensity: 5,
        priority: 'medium',
        themes,
        sentiment
      }
    };
  }
}
