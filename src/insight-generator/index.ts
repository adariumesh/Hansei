import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { createLogger } from '../shared/logger.js';

const serviceLogger = createLogger('insight-generator');

/**
 * Defines the expected structure of a message body
 * that this observer will process.
 */
export interface Body { // Added export
  type: 'NEW_MEMORY' | 'CONSOLIDATION_COMPLETE';
  userId: string;
  memoryId?: string;
  content?: string;
}

/**
 * The InsightGenerator is an observer that listens to a queue for events
 * (like new memories) and generates insights from them.
 */
export default class extends Each<Body, Env> {
  /**
   * Processes each message received from the queue.
   * @param message The message from the queue.
   */
  async process(message: Message<Body>): Promise<void> { // Corrected type to Message<Body>
    serviceLogger.info('Received message in insight-generator', { messageId: message.id, body: message.body });

    const { type, userId, content } = message.body;

    try {
      if (type === 'NEW_MEMORY' && content) {
        // 1. Simulate insight generation based on new memory content
        const insights = this.generateDummyInsights(content);
        serviceLogger.info(`Generated ${insights.length} insights for user ${userId}`, { insights });

        // 2. Store the generated insights by calling the insights-service
        // This demonstrates service-to-service communication
        const storeRequest = new Request(`/api/insights`, { // Relative path since this.env.INSIGHTS_SERVICE handles routing
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                insights: insights,
                source_memory_id: message.body.memoryId
            })
        });
        
        const response = await this.env.INSIGHTS_SERVICE.fetch(storeRequest);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to store insights via insights-service. Status: ${response.status}. Body: ${errorText}`);
        }

        serviceLogger.info(`Successfully stored ${insights.length} insights for user ${userId}`);

      } else if (type === 'CONSOLIDATION_COMPLETE') {
        serviceLogger.info(`Processing memory consolidation event for user ${userId}`);
        // TODO: Implement logic to generate insights from a collection of memories after consolidation
      }

      // Acknowledge the message was processed successfully
      await message.ack();

    } catch (error) {
      serviceLogger.error('Error processing insight message', { error: error instanceof Error ? error.message : String(error) });
      // In a real scenario, you might want to retry or move to a dead-letter queue
      // For now, we just acknowledge to prevent retries on this simple implementation.
      await message.ack();
    }
  }

  /**
   * A dummy function to simulate generating insights.
   * @param content The text content of a memory.
   * @returns An array of generated insights.
   */
  private generateDummyInsights(content: string): { type: string; content: string; confidence: number }[] {
    const insights = [];
    if (content.toLowerCase().includes('run')) {
      insights.push({
        type: 'Habit Suggestion',
        content: 'It seems you are focused on running. Consider setting a recurring goal.',
        confidence: 0.8
      });
    }
    if (content.length > 50) {
        insights.push({
          type: 'Observation',
          content: 'This was a detailed memory, indicating its importance.',
          confidence: 0.7
        });
    }
    return insights;
  }
}
