import { ComponentRequest, ComponentResponse, Environment } from './interfaces.js';

export async function processRequest(
  env: Environment,
  request: ComponentRequest
): Promise<ComponentResponse> {
  const startTime = Date.now();
  
  // Validate the request
  const isValid = await validateRequest(request);
  if (!isValid) {
    throw new Error('Invalid request');
  }

  // Optimize the request before processing
  const optimizedRequest = await optimizeProcessing(env, request);

  // Generate unique response ID
  const responseId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Log request processing
  env.logger.info('Processing request', { 
    id: responseId,
    input_length: optimizedRequest.input.length,
    options: optimizedRequest.options 
  });

  // Process the request (basic implementation)
  let result: any;
  let status: 'success' | 'failed' | 'pending' = 'success';

  try {
    // Simple processing logic - echo the input with metadata
    result = {
      processed_input: optimizedRequest.input,
      options: optimizedRequest.options,
      metadata: optimizedRequest.metadata,
      processed_at: new Date().toISOString()
    };
  } catch (error) {
    env.logger.error('Request processing failed', { 
      id: responseId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    status = 'failed';
    result = { error: error instanceof Error ? error.message : 'Unknown error' };
  }

  const processingTime = Date.now() - startTime;

  const response: ComponentResponse = {
    id: responseId,
    status,
    result,
    processing_time_ms: processingTime,
    metadata: {
      processed_at: new Date().toISOString(),
      input_length: optimizedRequest.input.length,
      ...optimizedRequest.metadata
    },
    created_at: new Date().toISOString()
  };

  env.logger.debug('Request processing completed', { 
    id: responseId,
    status,
    processing_time_ms: processingTime 
  });

  return response;
}

export async function validateRequest(
  request: ComponentRequest
): Promise<boolean> {
  // Check if request exists
  if (!request) {
    throw new Error('Request is required');
  }

  // Check if input property exists
  if (!request.hasOwnProperty('input')) {
    throw new Error('Input is required');
  }

  // Check if input is a non-empty string
  if (typeof request.input !== 'string' || request.input.trim() === '') {
    throw new Error('Input must be a non-empty string');
  }

  // Check input length limits (max 50KB)
  if (request.input.length > 50000) {
    throw new Error('Input exceeds maximum length of 50,000 characters');
  }

  // Validate options if provided
  if (request.options && typeof request.options !== 'object') {
    throw new Error('Options must be an object');
  }

  // Validate metadata if provided
  if (request.metadata && typeof request.metadata !== 'object') {
    throw new Error('Metadata must be an object');
  }

  return true;
}

export async function optimizeProcessing(
  env: Environment,
  request: ComponentRequest
): Promise<ComponentRequest> {
  // Create optimized copy of the request
  const optimizedRequest: ComponentRequest = {
    input: request.input,
    options: request.options || {},
    metadata: request.metadata || {}
  };

  // Add default options if missing
  if (!optimizedRequest.options!.timeout) {
    optimizedRequest.options!.timeout = 30000; // 30 seconds default
  }

  if (!optimizedRequest.options!.cache) {
    optimizedRequest.options!.cache = true; // Enable caching by default
  }

  // Add optimization metadata
  optimizedRequest.metadata!.optimized_at = new Date().toISOString();
  optimizedRequest.metadata!.optimization_applied = true;

  // Trim whitespace from input
  optimizedRequest.input = optimizedRequest.input.trim();

  env.logger.debug('Request optimization completed', {
    original_input_length: request.input.length,
    optimized_input_length: optimizedRequest.input.length,
    options_added: Object.keys(optimizedRequest.options!).length
  });

  return optimizedRequest;
}
