// Vultr PostgreSQL connection configuration
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

export interface VultrDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  max_connections: number;
}

export interface Database {
  memory_nodes: {
    id: string;
    user_id: string;
    content: string;
    content_type: string;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
  };
  memory_edges: {
    id: string;
    source_id: string;
    target_id: string;
    relationship_type: string;
    strength: number;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  };
  entities: {
    id: string;
    user_id: string;
    name: string;
    type: string;
    confidence: number;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
  };
  entity_relationships: {
    id: string;
    entity_a_id: string;
    entity_b_id: string;
    relationship_type: string;
    confidence: number;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  };
  processing_sessions: {
    id: string;
    user_id: string;
    session_type: string;
    status: string;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    completed_at: Date | null;
  };
  documents: {
    id: string;
    user_id: string;
    title: string;
    content: string;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  };
  document_chunks: {
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  };
}

export function createVultrDatabase(config: VultrDatabaseConfig): Kysely<Database> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: config.max_connections || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool })
  });
}

// Helper function to create database connection from environment
export function createDatabaseFromEnv(env: any): Kysely<Database> {
  return createVultrDatabase({
    host: env.VULTR_DB_HOST || 'localhost',
    port: parseInt(env.VULTR_DB_PORT || '5432'),
    database: env.VULTR_DB_NAME || 'hansei_production',
    user: env.VULTR_DB_USER || 'hansei_user',
    password: env.VULTR_DB_PASSWORD || '',
    ssl: env.VULTR_DB_SSL === 'true',
    max_connections: parseInt(env.VULTR_DB_MAX_CONNECTIONS || '20'),
  });
}
