import { Env } from './raindrop.gen.js';
import { VectorEmbeddings, DocumentToIndex, IndexingResult } from './interfaces.js';
import { ComponentRequest, ComponentResponse } from '../shared/types.js';

export async function generateVectorEmbeddings(env: Env, text: string): Promise<VectorEmbeddings> {
  const embeddingResponse = await env.AI.run('embeddings', { input: [text] });
  const embeddings = embeddingResponse.embeddings[0].embedding;
  return {
    embeddings,
    dimensions: embeddings.length,
    model: 'embeddings',
    input_text: text
  };
}

export async function semanticSearch(env: Env, query: string, topK: number = 10) {
  const embeddingResponse = await env.AI.run('embeddings', { input: [query] });
  const queryVector = embeddingResponse.embeddings[0].embedding;

  if (!queryVector) {
      throw new Error('Failed to generate query embeddings.');
  }

  const searchResults = await env.MEMORY_EMBEDDINGS.query(queryVector, { topK });
  return searchResults.matches;
}

export async function hybridSearch(env: Env, query: string, topK: number = 10) {
  // For now, hybrid search will just be semantic search
  return semanticSearch(env, query, topK);
}

export async function performSearch(env: Env, query: string, options?: { limit?: number }) {
  const topK = options?.limit || 10;
  // For now, comprehensive search will just be semantic search
  const results = await semanticSearch(env, query, topK);
  return {
    results,
    total: results.length,
    query,
    searchType: 'comprehensive (semantic)'
  };
}

export async function indexDocument(env: Env, document: DocumentToIndex): Promise<IndexingResult> {
    try {
        const { embeddings, dimensions } = await generateVectorEmbeddings(env, document.content);

        const docId = document.id || `doc_${Date.now()}`;
        
        await env.MEMORY_EMBEDDINGS.upsert([
            {
                id: docId,
                values: embeddings,
                metadata: {
                    ...document.metadata,
                    title: document.title,
                    content: document.content,
                    indexedAt: new Date().toISOString()
                }
            }
        ]);

        return {
            indexed: true,
            document_id: docId,
            index_time: new Date().toISOString(),
            status: 'success'
        };
    } catch (error) {
        console.error('Indexing failed', error);
        return {
            indexed: false,
            document_id: document.id || 'unknown',
            index_time: new Date().toISOString(),
            status: 'failed'
        };
    }
}

export async function processRequest(env: Env, request: ComponentRequest): Promise<ComponentResponse> {
    const startTime = Date.now();
    const searchResults = await performSearch(env, request.input, request.options);
    const processingTime = Date.now() - startTime;

    return {
        id: `res_${Date.now()}`,
        status: 'success',
        result: searchResults,
        processing_time_ms: processingTime,
        metadata: {
            query: request.input
        },
        created_at: new Date().toISOString()
    };
}

export async function validateRequest(request: ComponentRequest): Promise<boolean> {
    if (!request.input) {
        return false;
    }
    return true;
}
