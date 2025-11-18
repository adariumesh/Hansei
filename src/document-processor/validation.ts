/**
 * Document processing validation utilities
 */

import { 
  validateNonEmptyString, 
  validateStringLength, 
  validateObject, 
  validateObjectDepth,
  ValidationException,
  ValidationError 
} from '../shared/validation.js';
import { DocumentRequest } from './interfaces.js';

/**
 * Maximum input size (1MB)
 */
const MAX_INPUT_SIZE = 1000000;

/**
 * Maximum metadata nesting depth
 */
const MAX_METADATA_DEPTH = 5;

/**
 * Validates a document processing request
 * Throws ValidationException if validation fails
 */
export const validateDocumentRequest = (request: DocumentRequest): void => {
  const errors: ValidationError[] = [];
  
  // Validate input
  errors.push(...validateNonEmptyString(request.input, 'input'));
  
  if (typeof request.input === 'string') {
    errors.push(...validateStringLength(request.input, 'input', { max: MAX_INPUT_SIZE }));
  }
  
  // Validate options format if provided
  if (request.options !== undefined) {
    errors.push(...validateObject(request.options, 'options'));
  }
  
  // Validate metadata depth if provided
  if (request.metadata !== undefined) {
    errors.push(...validateObjectDepth(request.metadata, 'metadata', MAX_METADATA_DEPTH));
  }
  
  if (errors.length > 0) {
    throw new ValidationException(errors);
  }
};

/**
 * Validates environment configuration
 */
export const validateEnvironment = (env: any): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (!env.DATABASE) {
    errors.push({
      field: 'environment.DATABASE',
      message: 'Database connection not available',
      value: env.DATABASE
    });
  }
  
  if (!env.logger) {
    errors.push({
      field: 'environment.logger',
      message: 'Logger not available',
      value: env.logger
    });
  }
  
  return errors;
};