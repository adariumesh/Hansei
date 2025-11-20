import { Service } from '@liquidmetal-ai/raindrop-framework';

interface Env {
  [key: string]: any;
}

export default class extends Service<Env> {
  async fetch() {
    return new Response('Voice processor stub', { status: 200 });
  }
}