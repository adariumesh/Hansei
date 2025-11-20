/**
 * Structured logging utility for HANSEI system
 * Provides consistent, queryable logs across all services
 */

export interface LogContext {
  requestId?: string;
  userId?: string;
  service?: string;
  duration?: number;
  [key: string]: any;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
}

/**
 * Creates a structured logger instance
 */
export class StructuredLogger implements Logger {
  constructor(private defaultContext: LogContext = {}) {}

  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('WARN', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : String(error)
    };
    this.log('ERROR', message, errorContext);
  }

  private log(level: string, message: string, context?: LogContext): void {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.defaultContext,
      ...context
    };

    // In production, this would send to a logging service (DataDog, CloudWatch, etc.)
    // For now, use structured console output
    const logString = JSON.stringify(logEntry);
    
    switch (level) {
      case 'ERROR':
        console.error(logString);
        break;
      case 'WARN':
        console.warn(logString);
        break;
      case 'DEBUG':
        console.debug(logString);
        break;
      default:
        console.log(logString);
    }
  }
}

/**
 * Creates a logger with service-specific context
 */
export function createLogger(service: string, additionalContext?: LogContext): Logger {
  return new StructuredLogger({ service, ...additionalContext });
}

/**
 * Default logger instance (for backward compatibility)
 */
export const logger = new StructuredLogger({ service: 'hansei-system' });
