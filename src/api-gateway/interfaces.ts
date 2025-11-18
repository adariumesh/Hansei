export interface ComponentRequest {
  input: string;
  options?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ComponentResponse {
  id: string;
  status: 'success' | 'failed' | 'pending';
  result: any;
  processing_time_ms: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Environment {
  DATABASE: any;
  logger: {
    debug(message: string, fields?: Record<string, any>): void;
    info(message: string, fields?: Record<string, any>): void;
    warn(message: string, fields?: Record<string, any>): void;
    error(message: string, fields?: Record<string, any>): void;
  };
}
