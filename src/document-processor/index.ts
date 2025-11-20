import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createLogger } from '../shared/logger.js';

const serviceLogger = createLogger('document-processor');

interface Env {
  DOCUMENT_STORAGE: any;
  AGENT_MEMORY: any;
  AI: any;
  logger: any;
  [key: string]: any;
}

interface DocumentProcessingRequest {
  input: string;
  options: {
    document_type?: string;
    user_id?: string;
    extract_entities?: boolean;
    generate_summary?: boolean;
    store_results?: boolean;
    metadata?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'document-processor',
    timestamp: new Date().toISOString() 
  });
});

// Document upload and processing endpoint
app.post('/upload', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }
      
      const result = await processUploadedFile(c.env, file);
      return c.json(result);
    } else {
      return c.json({ error: 'Expected multipart/form-data' }, 400);
    }
  } catch (error) {
    return c.json({
      error: 'File upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Text document processing endpoint
app.post('/process', async (c) => {
  try {
    const request = await c.req.json() as DocumentProcessingRequest;
    
    if (!request.input) {
      return c.json({ error: 'Input content is required' }, 400);
    }
    
    const result = await processDocument(c.env, request);
    return c.json(result);
  } catch (error) {
    return c.json({
      error: 'Document processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request, env: Env) {
    return app.fetch(request, env);
  }
}

// Helper functions for document processing
async function processUploadedFile(env: Env, file: File): Promise<any> {
  const fileName = file.name;
  const fileSize = file.size;
  const fileType = file.type;
  
  // Check file size limit (10MB)
  if (fileSize > 10 * 1024 * 1024) {
    throw new Error('File size exceeds 10MB limit');
  }
  
  let content = '';
  
  try {
    if (fileType.includes('text/') || fileName.endsWith('.txt')) {
      // Handle text files
      content = await file.text();
    } else if (fileType.includes('application/pdf') || fileName.endsWith('.pdf')) {
      // Handle PDF files (simplified - would use PDF.js or similar)
      content = await extractPDFText(file);
    } else if (fileType.includes('application/json') || fileName.endsWith('.json')) {
      // Handle JSON files
      const jsonData = await file.text();
      content = JSON.stringify(JSON.parse(jsonData), null, 2);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    // Store file in document storage
    const fileId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    await env.DOCUMENT_STORAGE.put(fileId, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: fileType,
      },
      customMetadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
        size: fileSize.toString()
      }
    });
    
    // Process the extracted content
    const processingResult = await processDocument(env, {
      input: content,
      options: {
        document_type: getDocumentType(fileType, fileName),
        user_id: 'file_upload_user',
        extract_entities: true,
        generate_summary: true,
        store_results: true,
        metadata: {
          originalFileName: fileName,
          fileType,
          fileSize,
          fileId
        }
      }
    });
    
    return {
      success: true,
      fileId,
      fileName,
      fileSize,
      contentLength: content.length,
      processing: processingResult
    };
  } catch (error) {
    throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function processDocument(env: Env, request: DocumentProcessingRequest): Promise<any> {
  const { input, options } = request;
  const startTime = Date.now();
  
  const result = {
    success: true,
    content: input,
    contentLength: input.length,
    entities: [] as any[],
    summary: '',
    keywords: [] as string[],
    metadata: {
      processedAt: new Date().toISOString(),
      processingTimeMs: 0,
      documentType: options.document_type || 'text'
    }
  };
  
  try {
    // Extract entities if requested
    if (options.extract_entities) {
      result.entities = extractEntitiesFromText(input);
    }
    
    // Generate summary if requested
    if (options.generate_summary) {
      result.summary = await generateDocumentSummary(env, input);
    }
    
    // Extract keywords
    result.keywords = extractKeywords(input);
    
    // Store results if requested
    if (options.store_results) {
      await storeProcessingResults(env, result, options);
    }
    
    result.metadata.processingTimeMs = Date.now() - startTime;
    return result;
  } catch (error) {
    throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractPDFText(file: File): Promise<string> {
  // Simplified PDF text extraction
  // In a real implementation, you'd use a PDF parsing library
  const arrayBuffer = await file.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(arrayBuffer);
  
  // Very basic text extraction (this would need proper PDF parsing)
  const lines = text.split('\n').filter(line => 
    line.trim().length > 0 && 
    !line.includes('%%PDF') && 
    !line.includes('endobj')
  );
  
  return lines.join(' ').substring(0, 5000); // Limit to 5000 chars for demo
}

function extractEntitiesFromText(text: string): Array<{type: string, value: string, confidence: number}> {
  const entities = [];
  
  // Extract emails
  const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [];
  emails.forEach(email => entities.push({ type: 'email', value: email, confidence: 0.9 }));
  
  // Extract phone numbers
  const phones = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [];
  phones.forEach(phone => entities.push({ type: 'phone', value: phone, confidence: 0.8 }));
  
  // Extract dates
  const dates = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g) || [];
  dates.forEach(date => entities.push({ type: 'date', value: date, confidence: 0.7 }));
  
  // Extract names (simple capitalized word pairs)
  const names = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
  names.forEach(name => entities.push({ type: 'person', value: name, confidence: 0.6 }));
  
  return entities;
}

async function generateDocumentSummary(env: Env, content: string): Promise<string> {
  try {
    if (content.length < 100) {
      return content; // Too short to summarize
    }
    
    // Use AI to generate summary
    const prompt = `Summarize the following text in 2-3 sentences, focusing on the key points:\n\n${content.substring(0, 2000)}`;
    
    const aiResult = await env.AI.run('llama-3.3-70b', {
      messages: [
        { role: 'system', content: 'You are a helpful assistant that creates concise, accurate summaries of documents.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150
    });
    
    return aiResult.response || 'Summary generation failed';
  } catch (error) {
    return `Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordCounts: Record<string, number> = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  return Object.entries(wordCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 10)
    .map(([word]) => word);
}

async function storeProcessingResults(env: Env, result: any, options: any): Promise<void> {
  try {
    const storageKey = `processed_doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const storageData = {
      ...result,
      options,
      storedAt: new Date().toISOString()
    };
    
    // Store in agent memory
    await env.AGENT_MEMORY.put(storageKey, JSON.stringify(storageData));
  } catch (error) {
    serviceLogger.error('Failed to store processing results', { error: error instanceof Error ? error.message : String(error) });
  }
}

function getDocumentType(fileType: string, fileName: string): string {
  if (fileType.includes('text/')) return 'text';
  if (fileType.includes('application/pdf')) return 'pdf';
  if (fileType.includes('application/json')) return 'json';
  if (fileName.endsWith('.md')) return 'markdown';
  if (fileName.endsWith('.csv')) return 'csv';
  return 'unknown';
}