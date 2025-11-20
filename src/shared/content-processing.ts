/**
 * Shared content processing utilities for the Hansei system
 */

/**
 * Content sanitization options
 */
export interface SanitizationOptions {
  removeScripts?: boolean;
  normalizeWhitespace?: boolean;
  trim?: boolean;
  maxLength?: number;
}

/**
 * Sanitizes text content by removing potentially harmful scripts and normalizing whitespace
 */
export const sanitizeContent = (
  content: string, 
  options: SanitizationOptions = {}
): string => {
  const {
    removeScripts = true,
    normalizeWhitespace = true,
    trim = true,
    maxLength
  } = options;
  
  let result = content;
  
  // Remove script tags if requested
  if (removeScripts) {
    result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  
  // Normalize whitespace if requested
  if (normalizeWhitespace) {
    result = result.replace(/\s+/g, ' ');
  }
  
  // Trim whitespace if requested
  if (trim) {
    result = result.trim();
  }
  
  // Truncate if max length specified
  if (maxLength && result.length > maxLength) {
    result = result.substring(0, maxLength);
  }
  
  return result;
};

/**
 * Normalizes Unicode characters to a consistent form
 */
export const normalizeUnicode = (text: string): string => {
  return text.normalize('NFC');
};

/**
 * Chunks text into smaller pieces while attempting to preserve word boundaries
 */
export const chunkText = (
  text: string, 
  chunkSize: number, 
  preserveWords: boolean = true
): { chunks: string[]; metadata: { originalLength: number; chunkCount: number } } => {
  if (text.length <= chunkSize) {
    return {
      chunks: [text],
      metadata: {
        originalLength: text.length,
        chunkCount: 1
      }
    };
  }
  
  const chunks: string[] = [];
  let currentPosition = 0;
  
  while (currentPosition < text.length) {
    let endPosition = Math.min(currentPosition + chunkSize, text.length);
    
    // Try to preserve word boundaries if requested and not at end of text
    if (preserveWords && endPosition < text.length) {
      const lastSpace = text.lastIndexOf(' ', endPosition);
      if (lastSpace > currentPosition) {
        endPosition = lastSpace;
      }
    }
    
    chunks.push(text.substring(currentPosition, endPosition));
    currentPosition = endPosition;
    
    // Skip whitespace at the beginning of the next chunk
    while (currentPosition < text.length && text[currentPosition] === ' ') {
      currentPosition++;
    }
  }
  
  return {
    chunks,
    metadata: {
      originalLength: text.length,
      chunkCount: chunks.length
    }
  };
};

/**
 * Counts words in text using a simple whitespace-based approach
 */
export const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Extracts headers from markdown content
 */
export const extractMarkdownHeaders = (content: string): Array<{ level: number; text: string }> => {
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const headers: Array<{ level: number; text: string }> = [];
  let match;
  
  while ((match = headerRegex.exec(content)) !== null) {
    headers.push({
      level: match[1].length,
      text: match[2].trim()
    });
  }
  
  return headers;
};

/**
 * Attempts to parse JSON content safely
 */
export const safeJsonParse = (content: string): { success: boolean; data?: any; error?: string } => {
  try {
    const data = JSON.parse(content);
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Invalid JSON format'
    };
  }
};