// PostgreSQL Schema for graph-database SmartSQL resource
// Contains memory nodes, edges, entities, and document processing tables
// Converted from SQLite to PostgreSQL compatible types

export const createTablesSQL = `
CREATE TABLE IF NOT EXISTS memories (
  id VARCHAR(100) PRIMARY KEY,
  content TEXT NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('concept', 'goal', 'procedure', 'progress')),
  content TEXT NOT NULL,
  weight DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  metadata JSONB, -- Native JSON support in PostgreSQL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL,
  target_id UUID NOT NULL,
  relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('CAUSES', 'DEPENDS_ON', 'RELATED_TO', 'PART_OF')),
  strength DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES memory_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES memory_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  type VARCHAR(100) NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  metadata JSONB, -- Native JSON support in PostgreSQL
  canonical_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a_id UUID NOT NULL,
  entity_b_id UUID NOT NULL,
  relationship_type VARCHAR(100) NOT NULL,
  strength DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_a_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (entity_b_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS processing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  metadata JSONB, -- Native JSON support in PostgreSQL
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS extracted_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  entity_text TEXT NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL,
  start_position INTEGER,
  end_position INTEGER,
  FOREIGN KEY (session_id) REFERENCES processing_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  content_hash VARCHAR(256) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB -- Native JSON support in PostgreSQL
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  chunk_type VARCHAR(50) NOT NULL DEFAULT 'text',
  metadata JSONB, -- Native JSON support in PostgreSQL
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  search_type VARCHAR(50) NOT NULL CHECK (search_type IN ('hybrid', 'semantic', 'graph')),
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pattern_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL,
  affected_nodes JSONB, -- JSON array of node IDs
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB -- Native JSON support in PostgreSQL
);

-- Raindrop SmartMemory 4-tier hierarchy tables
CREATE TABLE IF NOT EXISTS working_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id VARCHAR(255),
  content JSONB NOT NULL,
  context JSONB,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS episodic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id VARCHAR(255),
  event_data JSONB NOT NULL,
  temporal_context JSONB,
  emotional_weight DECIMAL(3,2) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS semantic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id UUID NOT NULL,
  knowledge_data JSONB NOT NULL,
  relationships JSONB,
  confidence DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS procedural_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  pattern_type VARCHAR(100) NOT NULL,
  ui_preferences JSONB,
  behavioral_patterns JSONB,
  adaptation_rules JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

export const createIndexesSQL = `
-- Memories table indexes
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);

-- Core graph database indexes
CREATE INDEX IF NOT EXISTS idx_memory_nodes_type ON memory_nodes(type);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_weight ON memory_nodes(weight);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_created_at ON memory_nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_memory_edges_source ON memory_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_memory_edges_target ON memory_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_memory_edges_relationship ON memory_edges(relationship);
CREATE INDEX IF NOT EXISTS idx_memory_edges_strength ON memory_edges(strength);

-- Entity resolution indexes
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_canonical ON entities(canonical_id);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_confidence ON entities(confidence_score);

-- Processing and document indexes
CREATE INDEX IF NOT EXISTS idx_processing_sessions_status ON processing_sessions(status);
CREATE INDEX IF NOT EXISTS idx_processing_sessions_started ON processing_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_processed_at ON documents(processed_at);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_index ON document_chunks(chunk_index);

-- Search and pattern detection indexes
CREATE INDEX IF NOT EXISTS idx_search_sessions_type ON search_sessions(search_type);
CREATE INDEX IF NOT EXISTS idx_search_sessions_created_at ON search_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_pattern_detections_type ON pattern_detections(pattern_type);
CREATE INDEX IF NOT EXISTS idx_pattern_detections_confidence ON pattern_detections(confidence_score);

-- SmartMemory 4-tier hierarchy indexes
CREATE INDEX IF NOT EXISTS idx_working_memory_session ON working_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_working_memory_user ON working_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_working_memory_expires ON working_memory(expires_at);

CREATE INDEX IF NOT EXISTS idx_episodic_memory_session ON episodic_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_user ON episodic_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_created_at ON episodic_memory(created_at);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_emotional_weight ON episodic_memory(emotional_weight);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_concept ON semantic_memory(concept_id);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_confidence ON semantic_memory(confidence);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_usage ON semantic_memory(usage_count);

CREATE INDEX IF NOT EXISTS idx_procedural_memory_user ON procedural_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_procedural_memory_pattern ON procedural_memory(pattern_type);

-- JSONB GIN indexes for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_memory_nodes_metadata_gin ON memory_nodes USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_entities_metadata_gin ON entities USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_working_memory_content_gin ON working_memory USING GIN (content);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_event_gin ON episodic_memory USING GIN (event_data);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_knowledge_gin ON semantic_memory USING GIN (knowledge_data);
CREATE INDEX IF NOT EXISTS idx_procedural_memory_preferences_gin ON procedural_memory USING GIN (ui_preferences);
`;