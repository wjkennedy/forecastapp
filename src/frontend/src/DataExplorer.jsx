'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * Simple in-memory query engine using JavaScript
 * Supports basic SQL-like operations without DuckDB workers
 */
class SimpleQueryEngine {
  constructor() {
    this.tables = new Map();
  }

  registerTable(name, data) {
    this.tables.set(name.toLowerCase(), Array.isArray(data) ? data : [data]);
  }

  query(sql) {
    const normalizedSql = sql.trim().toLowerCase();
    
    // Parse SELECT ... FROM table [WHERE ...] [ORDER BY ...] [LIMIT n]
    const selectMatch = normalizedSql.match(/select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(.+?))?(?:\s+limit\s+(\d+))?$/i);
    
    if (!selectMatch) {
      // Handle UNION queries
      if (normalizedSql.includes('union')) {
        return this.handleUnion(sql);
      }
      throw new Error('Unsupported query format. Use: SELECT columns FROM table [WHERE condition] [ORDER BY column] [LIMIT n]');
    }

    const [, columns, tableName, whereClause, orderBy, limit] = selectMatch;
    
    const table = this.tables.get(tableName.toLowerCase());
    if (!table) {
      throw new Error(`Table '${tableName}' not found. Available: ${Array.from(this.tables.keys()).join(', ')}`);
    }

    let results = [...table];

    // Apply WHERE
    if (whereClause) {
      results = this.applyWhere(results, whereClause);
    }

    // Apply ORDER BY
    if (orderBy) {
      results = this.applyOrderBy(results, orderBy);
    }

    // Apply LIMIT
    if (limit) {
      results = results.slice(0, parseInt(limit, 10));
    }

    // Apply SELECT (column selection)
    results = this.applySelect(results, columns);

    return results;
  }

  handleUnion(sql) {
    const parts = sql.split(/\bunion\s+all\b|\bunion\b/i);
    let allResults = [];
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        const partResults = this.query(trimmed);
        allResults = allResults.concat(partResults);
      }
    }
    
    return allResults;
  }

  applyWhere(rows, whereClause) {
    // Simple WHERE parsing: column = value, column > value, etc.
    const conditions = whereClause.split(/\s+and\s+/i);
    
    return rows.filter(row => {
      return conditions.every(condition => {
        const match = condition.match(/(\w+)\s*(=|!=|>|<|>=|<=|like)\s*['"]?([^'"]+)['"]?/i);
        if (!match) return true;
        
        const [, col, op, val] = match;
        const rowVal = row[col] ?? row[col.toLowerCase()];
        const compareVal = isNaN(val) ? val : Number(val);
        
        switch (op.toLowerCase()) {
          case '=': return rowVal == compareVal;
          case '!=': return rowVal != compareVal;
          case '>': return rowVal > compareVal;
          case '<': return rowVal < compareVal;
          case '>=': return rowVal >= compareVal;
          case '<=': return rowVal <= compareVal;
          case 'like': return String(rowVal).toLowerCase().includes(String(compareVal).toLowerCase().replace(/%/g, ''));
          default: return true;
        }
      });
    });
  }

  applyOrderBy(rows, orderBy) {
    const [col, direction] = orderBy.trim().split(/\s+/);
    const desc = direction?.toLowerCase() === 'desc';
    
    return rows.sort((a, b) => {
      const aVal = a[col] ?? a[col.toLowerCase()];
      const bVal = b[col] ?? b[col.toLowerCase()];
      
      if (aVal < bVal) return desc ? 1 : -1;
      if (aVal > bVal) return desc ? -1 : 1;
      return 0;
    });
  }

  applySelect(rows, columns) {
    if (columns.trim() === '*') {
      return rows;
    }

    const cols = columns.split(',').map(c => {
      const aliasMatch = c.trim().match(/(.+?)\s+as\s+(\w+)/i);
      if (aliasMatch) {
        return { expr: aliasMatch[1].trim(), alias: aliasMatch[2].trim() };
      }
      return { expr: c.trim(), alias: c.trim() };
    });

    return rows.map(row => {
      const result = {};
      for (const { expr, alias } of cols) {
        // Handle simple column references
        if (row.hasOwnProperty(expr)) {
          result[alias] = row[expr];
        } else if (row.hasOwnProperty(expr.toLowerCase())) {
          result[alias] = row[expr.toLowerCase()];
        } else {
          // Handle expressions like COUNT(*), SUM(col), etc. - just return the value
          result[alias] = expr;
        }
      }
      return result;
    });
  }
}

/**
 * SQL Editor component
 */
function SQLEditor({ onExecute, disabled, defaultSql }) {
  const [sql, setSql] = useState(defaultSql || 'SELECT * FROM forecast LIMIT 10');
  
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute(sql);
    }
  };

  return (
    <div className="sql-editor">
      <div className="sql-editor-header">
        <span className="sql-label">Query</span>
        <span className="sql-hint">Cmd/Ctrl + Enter to run</span>
      </div>
      <textarea
        className="sql-textarea"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter query..."
        disabled={disabled}
        spellCheck={false}
        rows={4}
      />
      <button 
        className="sql-run-button"
        onClick={() => onExecute(sql)}
        disabled={disabled || !sql.trim()}
      >
        Run Query
      </button>
    </div>
  );
}

/**
 * Results table component
 */
function ResultsTable({ data }) {
  if (!data || data.length === 0) {
    return <div className="results-empty">No results</div>;
  }

  const columns = Object.keys(data[0] || {});

  return (
    <div className="results-table-container">
      <table className="results-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col}>
                  {typeof row[col] === 'object' 
                    ? JSON.stringify(row[col]) 
                    : row[col]?.toFixed ? row[col].toFixed(2) : String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Predefined queries panel
 */
function QueryTemplates({ onSelect }) {
  const templates = [
    {
      name: 'Forecast Summary',
      sql: 'SELECT * FROM forecast LIMIT 1'
    },
    {
      name: 'Weekly Throughput',
      sql: 'SELECT * FROM throughput ORDER BY weekStart'
    },
    {
      name: 'Top 10 Weeks',
      sql: 'SELECT * FROM throughput ORDER BY pointsCompleted DESC LIMIT 10'
    },
    {
      name: 'Simulation Stats',
      sql: 'SELECT * FROM simulation LIMIT 20'
    }
  ];

  return (
    <div className="query-templates">
      <h4>Quick Queries</h4>
      <div className="templates-list">
        {templates.map((t, i) => (
          <button 
            key={i}
            className="template-button"
            onClick={() => onSelect(t.sql)}
            title={t.sql}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Data Explorer - JavaScript-powered query interface
 * Works within Forge CSP without web workers
 */
export function DataExplorer({ forecastData, throughputData, simulationResults }) {
  const [results, setResults] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [queryTime, setQueryTime] = useState(null);
  const [currentSql, setCurrentSql] = useState('SELECT * FROM forecast LIMIT 10');

  // Initialize query engine with data
  const queryEngine = useMemo(() => {
    const engine = new SimpleQueryEngine();
    
    // Register forecast data
    if (forecastData) {
      engine.registerTable('forecast', {
        p50: forecastData.p50,
        p80: forecastData.p80,
        p95: forecastData.p95,
        remainingWork: forecastData.remaining || forecastData.remainingWork,
        weeksAnalyzed: forecastData.weeksAnalyzed,
        avgThroughput: forecastData.throughput?.mean || forecastData.throughputStats?.mean,
        simulationCount: forecastData.simulationCount || 10000
      });
    }
    
    // Register throughput data
    if (throughputData?.weeklyData) {
      engine.registerTable('throughput', throughputData.weeklyData);
    } else if (throughputData?.pointsPerWeek) {
      const data = throughputData.pointsPerWeek.map((points, i) => ({
        week: i + 1,
        pointsCompleted: points,
        issuesCompleted: throughputData.issuesPerWeek?.[i] || 0
      }));
      engine.registerTable('throughput', data);
    }
    
    // Register simulation distribution if available
    if (simulationResults && Array.isArray(simulationResults)) {
      engine.registerTable('simulation', simulationResults);
    } else if (forecastData?.distribution) {
      engine.registerTable('simulation', forecastData.distribution);
    }

    return engine;
  }, [forecastData, throughputData, simulationResults]);

  // Execute query
  const executeQuery = useCallback((sql) => {
    setQueryError(null);
    setResults(null);
    setCurrentSql(sql);
    
    const startTime = performance.now();
    
    try {
      const rows = queryEngine.query(sql);
      const elapsed = performance.now() - startTime;
      
      setResults(rows);
      setQueryTime(elapsed.toFixed(2));
    } catch (err) {
      setQueryError(err.message);
    }
  }, [queryEngine]);

  const hasData = forecastData || throughputData;

  if (!hasData) {
    return (
      <div className="data-explorer loading">
        <p>Run a forecast first to explore the data</p>
      </div>
    );
  }

  return (
    <div className="data-explorer">
      <div className="explorer-header">
        <h3>Data Explorer</h3>
        <span className="duckdb-badge">In-Memory Query Engine</span>
      </div>
      
      <div className="explorer-content">
        <div className="explorer-sidebar">
          <QueryTemplates onSelect={(sql) => {
            setCurrentSql(sql);
            executeQuery(sql);
          }} />
          
          <div className="available-tables">
            <h4>Available Tables</h4>
            <ul>
              <li><code>forecast</code> - P50/P80/P95 results</li>
              <li><code>throughput</code> - Weekly velocity</li>
              <li><code>simulation</code> - Distribution data</li>
            </ul>
            <p className="table-hint">
              Supports: SELECT, WHERE, ORDER BY, LIMIT
            </p>
          </div>
        </div>
        
        <div className="explorer-main">
          <SQLEditor 
            onExecute={executeQuery}
            disabled={false}
            defaultSql={currentSql}
          />
          
          {queryError && (
            <div className="query-error">
              <strong>Error:</strong> {queryError}
            </div>
          )}
          
          {results && (
            <div className="query-results">
              <div className="results-header">
                <span>{results.length} row(s)</span>
                {queryTime && <span className="query-time">{queryTime}ms</span>}
              </div>
              <ResultsTable data={results} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataExplorer;
