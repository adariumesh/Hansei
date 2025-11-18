/**
 * Shared pattern utilities for pattern detection across components
 */

export interface PatternRegex {
  name: string;
  regex: RegExp;
  type: string;
}

/**
 * Common regex patterns used across the application
 */
export const COMMON_PATTERNS: PatternRegex[] = [
  {
    name: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    type: 'contact'
  },
  {
    name: 'phone_us',
    regex: /\b\d{3}-\d{3}-\d{4}\b/g,
    type: 'contact'
  },
  {
    name: 'url',
    regex: /https?:\/\/[^\s]+/g,
    type: 'reference'
  },
  {
    name: 'date_iso',
    regex: /\b\d{4}-\d{2}-\d{2}\b/g,
    type: 'temporal'
  },
  {
    name: 'time_24h',
    regex: /\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/g,
    type: 'temporal'
  },
  {
    name: 'ip_address',
    regex: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    type: 'network'
  }
];

/**
 * Extract patterns from text using a specific pattern definition
 */
export function extractPattern(text: string, pattern: PatternRegex): string[] {
  const matches = text.match(pattern.regex);
  return matches || [];
}

/**
 * Extract all common patterns from text
 */
export function extractAllPatterns(text: string): Array<{type: string; value: string; pattern: string}> {
  const results: Array<{type: string; value: string; pattern: string}> = [];
  
  for (const pattern of COMMON_PATTERNS) {
    const matches = extractPattern(text, pattern);
    for (const match of matches) {
      results.push({
        type: pattern.type,
        value: match,
        pattern: pattern.name
      });
    }
  }
  
  return results;
}

/**
 * Calculate confidence score for a pattern match
 */
export function calculateConfidence(
  match: string, 
  pattern: PatternRegex, 
  context?: string
): number {
  // Base confidence from regex match
  let confidence = 0.8;
  
  // Adjust based on pattern type and characteristics
  switch (pattern.type) {
    case 'contact':
      // Higher confidence for well-formed emails/phones
      if (pattern.name === 'email' && match.includes('.')) {
        confidence = 0.95;
      }
      if (pattern.name === 'phone_us' && match.length === 12) {
        confidence = 0.9;
      }
      break;
    case 'reference':
      // URLs with domains we recognize
      if (pattern.name === 'url' && (match.includes('.com') || match.includes('.org'))) {
        confidence = 0.9;
      }
      break;
    case 'temporal':
      // Valid date ranges
      if (pattern.name === 'date_iso') {
        const year = parseInt(match.substring(0, 4));
        if (year >= 1900 && year <= 2030) {
          confidence = 0.95;
        }
      }
      break;
  }
  
  return Math.min(confidence, 1.0);
}