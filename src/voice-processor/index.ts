import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ service: 'voice-processor', status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/voice/ingest', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    const userId = formData.get('user_id') as string;

    if (!audioFile || typeof audioFile === 'string') {
      return c.json({ error: 'Validation failed', details: 'Audio file is missing or invalid.' }, 400);
    }
    if (!userId) {
        return c.json({ error: 'Validation failed', details: 'user_id is missing.' }, 400);
    }

    // 1. Simulate storing the audio file in the AUDIO_STORAGE SmartBucket
    const audioFileName = `audio_${userId}_${Date.now()}.${audioFile.name.split('.').pop()}`;
    // In a real implementation, you would use c.env.AUDIO_STORAGE.put(...)
    c.env.logger.info(`Simulating storage of audio file: ${audioFileName}`);

    // 2. Simulate transcription (e.g., calling Whisper)
    const dummyTranscription = `This is a dummy transcription for the file ${audioFile.name}. The user's goal is to go for a run every day next week.`;
    c.env.logger.info(`Simulated transcription result: ${dummyTranscription}`);

    // 3. Forward the transcribed text to the API Gateway for analysis and storage
    // The API Gateway's /api/graph/store endpoint handles AI analysis and storage
    const storeRequest = new Request(`/api/graph/store`, { // Relative path since c.env.API_GATEWAY handles routing
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input: dummyTranscription,
            options: {
                user_id: userId,
                metadata: {
                    source: 'voice-ingestion',
                    originalFilename: audioFile.name,
                }
            }
        })
    });
    const storeResponse = await c.env.API_GATEWAY.fetch(storeRequest, c.env as any);

    if (!storeResponse.ok) {
        const errorText = await storeResponse.text();
        throw new Error(`Failed to store memory via API Gateway. Status: ${storeResponse.status}. Body: ${errorText}`);
    }

    const analysisResult = await storeResponse.json();

    // 4. Return a success response to the client
    return c.json({ 
        success: true, 
        message: 'Voice processed and memory stored.',
        transcript: dummyTranscription,
        extracted: analysisResult.ai_analysis || {}
    });

  } catch (error) {
    c.env.logger.error('Failed to process voice data', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: 'Failed to process voice data', details: String(error) }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Add the logger to the context to be available in handlers
    (request as any).customCtx = { logger: this.env.logger };
    return app.fetch(request, env);
  }
}
