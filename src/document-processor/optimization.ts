/**
 * Document processing optimization utilities
 */

import { 
  sanitizeContent, 
  normalizeUnicode, 
  chunkText 
} from '../shared/content-processing.js';
import { 
  DocumentRequest, 
  OptimizationResult, 
  DocumentProcessorEnvironment,
  ProcessingOptions 
} from './interfaces.js';

/**
 * Optimizes a document processing request based on provided options
 */
export const optimizeDocumentRequest = (
  env: DocumentProcessorEnvironment,
  request: DocumentRequest
): OptimizationResult => {
  const optimizations: string[] = [];
  const metadata: Record<string, any> = {};
  
  let optimizedInput = request.input;
  const options = request.options || {};
  
  // Skip optimization if requested
  if (options.skip_optimization) {
    return {
      request,
      optimizations: ['optimization_skipped'],
      metadata: {}
    };
  }
  
  // Apply text preprocessing
  if (shouldApplyContentSanitization(options)) {
    const originalLength = optimizedInput.length;
    optimizedInput = sanitizeContent(optimizedInput, {
      removeScripts: true,
      normalizeWhitespace: options.normalize || options.trim,
      trim: options.trim,
    });
    
    if (optimizedInput.length !== originalLength) {
      optimizations.push('content_sanitized');
      metadata.original_content_length = originalLength;
    }
  }
  
  // Handle text encoding
  if (options.encoding === 'utf-8') {
    const originalInput = optimizedInput;
    optimizedInput = normalizeUnicode(optimizedInput);
    
    if (originalInput !== optimizedInput) {
      optimizations.push('unicode_normalized');
    }
  }
  
  // Chunk large documents
  if (options.chunk_size && typeof options.chunk_size === 'number') {
    const chunkResult = chunkText(optimizedInput, options.chunk_size, true);
    
    if (chunkResult.chunks.length > 1) {
      // For this optimization step, we just take the first chunk
      // In a full implementation, you might want to process all chunks
      optimizedInput = chunkResult.chunks[0];
      optimizations.push('content_chunked');
      metadata.chunked = true;
      metadata.original_length = chunkResult.metadata.originalLength;
      metadata.total_chunks = chunkResult.metadata.chunkCount;
    }
  }
  
  env.logger.debug('Request optimized', {
    original_length: request.input.length,
    optimized_length: optimizedInput.length,
    optimizations
  });
  
  const optimizedRequest: DocumentRequest = {
    ...request,
    input: optimizedInput,
    metadata: {
      ...request.metadata,
      ...metadata
    }
  };
  
  return {
    request: optimizedRequest,
    optimizations,
    metadata
  };
};

/**
 * Determines if content sanitization should be applied
 */
const shouldApplyContentSanitization = (options: ProcessingOptions): boolean => {
  return Boolean(options.trim || options.normalize);
};