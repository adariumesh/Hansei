// SQL Schema for graph-database SmartSQL resource
// Contains memory nodes, edges, entities, and document processing tables

export const createTablesSQL = `
CREATE TABLE IF NOT EXISTS memory_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('concept', 'goal', 'procedure', 'progress')),
  content TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  metadata TEXT, -- JSON blob
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('CAUSES', 'DEPENDS_ON', 'RELATED_TO', 'PART_OF')),
  strength REAL NOT NULL DEFAULT 1.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES memory_nodes(id),
  FOREIGN KEY (target_id) REFERENCES memory_nodes(id)
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  confidence_score REAL NOT NULL DEFAULT 0.0,
  metadata TEXT, -- JSON blob
  canonical_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entity_relationships (
  id TEXT PRIMARY KEY,
  entity_a_id TEXT NOT NULL,
  entity_b_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 1.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_a_id) REFERENCES entities(id),
  FOREIGN KEY (entity_b_id) REFERENCES entities(id)
);

CREATE TABLE IF NOT EXISTS processing_sessions (
  id TEXT PRIMARY KEY,
  input_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  metadata TEXT, -- JSON blob
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS extracted_entities (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  entity_text TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  start_position INTEGER,
  end_position INTEGER,
  FOREIGN KEY (session_id) REFERENCES processing_sessions(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT -- JSON blob
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  chunk_type TEXT NOT NULL DEFAULT 'text',
  metadata TEXT, -- JSON blob
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS search_sessions (
  id TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  search_type TEXT NOT NULL CHECK (search_type IN ('hybrid', 'semantic', 'graph')),
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pattern_detections (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence_score REAL NOT NULL,
  affected_nodes TEXT, -- JSON array of node IDs
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT -- JSON blob
);
`;

export const createIndexesSQL = `
CREATE INDEX IF NOT EXISTS idx_memory_nodes_type ON memory_nodes(type);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_weight ON memory_nodes(weight);
CREATE INDEX IF NOT EXISTS idx_memory_edges_source ON memory_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_memory_edges_target ON memory_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_memory_edges_relationship ON memory_edges(relationship);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_canonical ON entities(canonical_id);
CREATE INDEX IF NOT EXISTS idx_processing_sessions_status ON processing_sessions(status);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_type ON search_sessions(search_type);
CREATE INDEX IF NOT EXISTS idx_pattern_detections_type ON pattern_detections(pattern_type);
`;