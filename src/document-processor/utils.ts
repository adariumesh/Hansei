import { ComponentRequest, ComponentResponse, Environment } from './interfaces.js';

// Helper function to generate unique IDs
function generateId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Helper function to sanitize content
function sanitizeContent(content: string): string {
  // Basic sanitization - remove script tags and normalize whitespace
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function validateRequest(
  request: ComponentRequest
): Promise<boolean> {
  // Validate input is provided and not empty
  if (!request.input || typeof request.input !== 'string') {
    throw new Error('Input must be a non-empty string');
  }

  // Validate input length (max 1MB)
  if (request.input.length > 1000000) {
    throw new Error('Input exceeds maximum length of 1MB');
  }

  // Validate options format if provided
  if (request.options && typeof request.options !== 'object') {
    throw new Error('Options must be an object');
  }

  // Validate metadata depth if provided
  if (request.metadata) {
    const validateDepth = (obj: any, depth = 0): boolean => {
      if (depth > 5) return false; // Max 5 levels deep
      if (typeof obj !== 'object' || obj === null) return true;
      
      for (const key in obj) {
        if (!validateDepth(obj[key], depth + 1)) {
          return false;
        }
      }
      return true;
    };
    
    if (!validateDepth(request.metadata)) {
      throw new Error('Metadata nesting too deep (max 5 levels)');
    }
  }

  return true;
}

export async function optimizeProcessing(
  env: Environment,
  request: ComponentRequest
): Promise<ComponentRequest> {
  const optimizedRequest: ComponentRequest = {
    ...request,
    input: request.input
  };

  // Skip optimization if requested
  if (request.options?.skip_optimization) {
    return optimizedRequest;
  }

  // Text preprocessing
  if (request.options?.trim || request.options?.normalize) {
    optimizedRequest.input = sanitizeContent(request.input);
  }

  // Handle text encoding
  if (request.options?.encoding === 'utf-8') {
    // Normalize Unicode characters
    optimizedRequest.input = optimizedRequest.input.normalize('NFC');
  }

  // Chunk large documents
  if (request.options?.chunk_size && typeof request.options.chunk_size === 'number') {
    const chunkSize = request.options.chunk_size;
    if (request.input.length > chunkSize) {
      // For this implementation, just truncate to chunk size
      // In a real implementation, you'd want to split intelligently
      optimizedRequest.input = request.input.substring(0, chunkSize);
      optimizedRequest.metadata = {
        ...optimizedRequest.metadata,
        chunked: true,
        original_length: request.input.length
      };
    }
  }

  env.logger.debug('Request optimized', { 
    original_length: request.input.length,
    optimized_length: optimizedRequest.input.length 
  });

  return optimizedRequest;
}

export async function processRequest(
  env: Environment,
  request: ComponentRequest
): Promise<ComponentResponse> {
  const startTime = Date.now();
  
  try {
    // Validate the request first
    await validateRequest(request);
    
    // Check database connection
    if (!env.DATABASE) {
      throw new Error('Database connection not available');
    }

    // Optimize the request
    const optimizedRequest = await optimizeProcessing(env, request);

    // Process based on format
    const format = request.options?.format || 'text';
    let processedResult: any;

    switch (format) {
      case 'text':
        processedResult = {
          content: sanitizeContent(optimizedRequest.input),
          word_count: optimizedRequest.input.split(/\s+/).length,
          format: 'text'
        };
        break;
        
      case 'markdown':
        processedResult = {
          content: optimizedRequest.input,
          format: 'markdown',
          headers: extractMarkdownHeaders(optimizedRequest.input)
        };
        break;
        
      case 'json':
        try {
          const jsonData = JSON.parse(optimizedRequest.input);
          processedResult = {
            content: jsonData,
            format: 'json',
            keys: Object.keys(jsonData || {})
          };
        } catch (e) {
          throw new Error('Invalid JSON format');
        }
        break;
        
      case 'xml':
        processedResult = {
          content: optimizedRequest.input,
          format: 'xml',
          length: optimizedRequest.input.length
        };
        break;
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const processingTime = Date.now() - startTime;
    const responseId = generateId();

    env.logger.info('Document processed successfully', {
      id: responseId,
      format,
      processing_time_ms: processingTime,
      input_length: request.input.length
    });

    const response: ComponentResponse = {
      id: responseId,
      status: 'success',
      result: processedResult,
      processing_time_ms: processingTime,
      metadata: {
        ...request.metadata,
        processed_at: new Date().toISOString(),
        format: format
      },
      created_at: new Date().toISOString()
    };

    return response;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorId = generateId();
    
    env.logger.error('Document processing failed', {
      id: errorId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime
    });

    const errorResponse: ComponentResponse = {
      id: errorId,
      status: 'failed',
      result: {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      processing_time_ms: processingTime,
      metadata: {
        ...request.metadata,
        error_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };

    return errorResponse;
  }
}

// Helper function to extract markdown headers
function extractMarkdownHeaders(content: string): string[] {
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const headers: string[] = [];
  let match;
  
  while ((match = headerRegex.exec(content)) !== null) {
    headers.push(match[2]);
  }
  
  return headers;
}
