'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';

// CDN URLs for DuckDB WASM bundles
const DUCKDB_BUNDLES = {
  mvp: {
    mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-mvp.wasm',
    mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-mvp.worker.js',
  },
  eh: {
    mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-eh.wasm',
    mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-eh.worker.js',
  },
};

/**
 * React hook for using DuckDB-WASM in the browser
 */
export function useDuckDB() {
  const [db, setDb] = useState(null);
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initializingRef = useRef(false);

  // Initialize DuckDB
  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    const initDuckDB = async () => {
      try {
        console.log('[DuckDB] Initializing DuckDB-WASM...');
        
        // Select bundle based on browser capabilities
        const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);
        console.log('[DuckDB] Selected bundle:', bundle.mainModule);
        
        // Create worker
        const worker = new Worker(bundle.mainWorker);
        const logger = new duckdb.ConsoleLogger();
        
        // Instantiate DuckDB
        const database = new duckdb.AsyncDuckDB(logger, worker);
        await database.instantiate(bundle.mainModule);
        console.log('[DuckDB] Database instantiated');
        
        // Create connection
        const connection = await database.connect();
        console.log('[DuckDB] Connection established');
        
        setDb(database);
        setConn(connection);
        setLoading(false);
      } catch (err) {
        console.error('[DuckDB] Initialization error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    initDuckDB();

    // Cleanup on unmount
    return () => {
      if (conn) conn.close();
      if (db) db.terminate();
    };
  }, []);

  // Execute SQL query
  const query = useCallback(async (sql) => {
    if (!conn) {
      throw new Error('DuckDB not initialized');
    }
    
    console.log('[DuckDB] Executing query:', sql.substring(0, 100));
    const result = await conn.query(sql);
    const rows = result.toArray().map(row => row.toJSON());
    console.log('[DuckDB] Query returned', rows.length, 'rows');
    return rows;
  }, [conn]);

  // Load data into a table
  const loadData = useCallback(async (tableName, data, schema) => {
    if (!conn) {
      throw new Error('DuckDB not initialized');
    }

    console.log('[DuckDB] Loading data into table:', tableName);
    
    // Drop existing table
    await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
    
    // Create table from schema or infer
    if (schema) {
      await conn.query(`CREATE TABLE ${tableName} (${schema})`);
    }
    
    // Insert data using JSON
    if (data && data.length > 0) {
      const jsonStr = JSON.stringify(data);
      await db.registerFileText(`${tableName}.json`, jsonStr);
      await conn.query(`
        INSERT INTO ${tableName} 
        SELECT * FROM read_json_auto('${tableName}.json')
      `);
    }
    
    console.log('[DuckDB] Loaded', data?.length || 0, 'rows into', tableName);
  }, [conn, db]);

  // Register JSON data as a virtual table
  const registerJSON = useCallback(async (name, data) => {
    if (!db) {
      throw new Error('DuckDB not initialized');
    }
    
    const jsonStr = JSON.stringify(data);
    await db.registerFileText(`${name}.json`, jsonStr);
    console.log('[DuckDB] Registered JSON file:', name);
  }, [db]);

  return {
    db,
    conn,
    loading,
    error,
    query,
    loadData,
    registerJSON,
    isReady: !loading && !error && conn !== null
  };
}

export default useDuckDB;
