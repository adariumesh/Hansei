import { Each, Message } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { createLogger } from '../shared/logger.js';

const serviceLogger = createLogger('insight-generator');

export default class extends Each<Body, Env> {
  async process(message: Message<Body>): Promise<void> {
    serviceLogger.info('Processing insight message', { message: message.body });
  }
}

export interface Body {
}
