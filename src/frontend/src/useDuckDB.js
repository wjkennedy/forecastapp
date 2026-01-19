'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';

/**
 * React hook for using DuckDB-WASM in the browser
 * Uses locally bundled WASM files to work within Forge's CSP
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
        // Get the base URL for locally bundled files
        // In Forge, this will be the static resource path
        const baseUrl = new URL('.', window.location.href).href;
        
        // Local bundle paths (files are copied by webpack)
        const MANUAL_BUNDLES = {
          mvp: {
            mainModule: `${baseUrl}duckdb-mvp.wasm`,
            mainWorker: `${baseUrl}duckdb-browser-mvp.worker.js`,
          },
          eh: {
            mainModule: `${baseUrl}duckdb-eh.wasm`,
            mainWorker: `${baseUrl}duckdb-browser-eh.worker.js`,
          },
        };
        
        // Try EH bundle first (better performance), fallback to MVP
        let bundle;
        try {
          // Check if EH worker is accessible
          const ehWorkerResponse = await fetch(MANUAL_BUNDLES.eh.mainWorker, { method: 'HEAD' });
          if (ehWorkerResponse.ok) {
            bundle = MANUAL_BUNDLES.eh;
          } else {
            bundle = MANUAL_BUNDLES.mvp;
          }
        } catch {
          bundle = MANUAL_BUNDLES.mvp;
        }
        
        // Create worker from local file using blob URL to avoid CSP issues
        const workerResponse = await fetch(bundle.mainWorker);
        const workerBlob = await workerResponse.blob();
        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);
        
        const logger = new duckdb.ConsoleLogger();
        
        // Instantiate DuckDB
        const database = new duckdb.AsyncDuckDB(logger, worker);
        await database.instantiate(bundle.mainModule);
        
        // Create connection
        const connection = await database.connect();
        
        setDb(database);
        setConn(connection);
        setLoading(false);
        
        // Clean up blob URL
        URL.revokeObjectURL(workerUrl);
      } catch (err) {
        console.error('Failed to initialize DuckDB:', err);
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
