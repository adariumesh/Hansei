import { createTablesSQL, createIndexesSQL } from './graph-database';

/**
 * Database Initialization Module
 * Ensures all tables and indexes are created on service startup
 */

let isInitialized = false;
const initLock = new Map<string, Promise<void>>();

interface Logger {
  debug?: (msg: string) => void;
  info: (msg: string) => void;
  error: (msg: string, err?: unknown) => void;
}

export async function initializeDatabase(db: any, logger?: Logger): Promise<void> {
  const log = logger || console;
  
  // Singleton pattern - only initialize once per instance
  if (isInitialized) {
    log.debug('Database already initialized, skipping');
    return;
  }
  
  // Prevent concurrent initialization attempts
  const existingInit = initLock.get('db_init');
  if (existingInit) {
    log.debug('Database initialization in progress, waiting...');
    return existingInit;
  }
  
  const initPromise = (async () => {
    try {
      log.info('Starting database initialization...');
      
      // Create tables
      log.info('Creating database tables...');
      await db.exec(createTablesSQL);
      log.info('✓ Tables created successfully');
      
      // Create indexes
      log.info('Creating database indexes...');
      await db.exec(createIndexesSQL);
      log.info('✓ Indexes created successfully');
      
      isInitialized = true;
      log.info('✓ Database initialization complete');
    } catch (error) {
      log.error('Database initialization failed:', error);
      throw error;
    } finally {
      initLock.delete('db_init');
    }
  })();
  
  initLock.set('db_init', initPromise);
  return initPromise;
}

/**
 * Check if database is initialized and healthy
 */
export async function checkDatabaseHealth(db: any): Promise<{
  healthy: boolean;
  tables: string[];
  error?: string;
}> {
  try {
    // Query to list all tables
    const result = await db.prepare(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `).all();
    
    const tables = result.results.map((r: any) => r.table_name);
    
    const requiredTables = [
      'memory_nodes',
      'memory_edges',
      'entities',
      'entity_relationships',
      'working_memory',
      'episodic_memory',
      'semantic_memory',
      'procedural_memory'
    ];
    
    const missingTables = requiredTables.filter(t => !tables.includes(t));
    
    return {
      healthy: missingTables.length === 0,
      tables,
      error: missingTables.length > 0 
        ? `Missing tables: ${missingTables.join(', ')}` 
        : undefined
    };
  } catch (error) {
    return {
      healthy: false,
      tables: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Reset initialization state (for testing)
 */
export function resetInitialization(): void {
  isInitialized = false;
  initLock.clear();
}
