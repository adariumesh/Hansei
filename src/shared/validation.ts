/**
 * Shared validation utilities for request/response validation across components
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Creates a successful validation result
 */
export function createValidResult(): ValidationResult {
  return {
    isValid: true,
    errors: [],
    warnings: []
  };
}

/**
 * Creates a failed validation result with errors
 */
export function createErrorResult(errors: string[]): ValidationResult {
  return {
    isValid: false,
    errors,
    warnings: []
  };
}

/**
 * Validates that a value is a non-empty string
 */
export function validateRequiredString(
  value: any, 
  fieldName: string
): ValidationResult {
  if (value === undefined || value === null) {
    return createErrorResult([`${fieldName} is required`]);
  }
  
  if (typeof value !== 'string') {
    return createErrorResult([`${fieldName} must be a string`]);
  }
  
  if (value.trim() === '') {
    return createErrorResult([`${fieldName} cannot be empty`]);
  }
  
  return createValidResult();
}

/**
 * Validates that a value is an object
 */
export function validateObject(
  value: any, 
  fieldName: string, 
  required: boolean = true
): ValidationResult {
  if (!required && (value === undefined || value === null)) {
    return createValidResult();
  }
  
  if (required && (value === undefined || value === null)) {
    return createErrorResult([`${fieldName} is required`]);
  }
  
  if (value !== null && typeof value !== 'object') {
    return createErrorResult([`${fieldName} must be an object`]);
  }
  
  return createValidResult();
}

/**
 * Combines multiple validation results
 */
export function combineValidationResults(results: ValidationResult[]): ValidationResult {
  const combined: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  for (const result of results) {
    combined.errors.push(...result.errors);
    combined.warnings.push(...result.warnings);
    
    if (!result.isValid) {
      combined.isValid = false;
    }
  }
  
  return combined;
}

/**
 * Validates input length constraints
 */
export function validateInputLength(
  input: string, 
  maxLength: number = 1000000
): ValidationResult {
  if (input.length > maxLength) {
    return createErrorResult([
      `Input length ${input.length} exceeds maximum allowed length of ${maxLength}`
    ]);
  }
  
  const result = createValidResult();
  
  if (input.length > maxLength * 0.8) {
    result.warnings.push(`Input length ${input.length} is approaching maximum limit`);
  }
  
  return result;
}