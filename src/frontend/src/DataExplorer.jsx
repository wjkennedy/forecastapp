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
function SQLEditor({ onExecute, disabled, sql, onSqlChange }) {
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute(sql);
    }
  };

  return (
    <div className="sql-editor">
      <div className="sql-editor-header">
        <span className="sql-label">SQL Query</span>
        <span className="sql-hint">Cmd/Ctrl + Enter to run</span>
      </div>
      <textarea
        className="sql-textarea"
        value={sql}
        onChange={(e) => onSqlChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter SQL query..."
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
 * Predefined queries panel - shows query syntax when selected
 */
function QueryTemplates({ onSelect, currentSql }) {
  const templates = [
    {
      name: 'Forecast Summary',
      description: 'View P50/P80/P95 completion estimates',
      sql: 'SELECT * FROM forecast LIMIT 1'
    },
    {
      name: 'Weekly Throughput',
      description: 'All historical throughput data',
      sql: 'SELECT * FROM throughput ORDER BY weekStart'
    },
    {
      name: 'Best Weeks',
      description: 'Top performing weeks by points',
      sql: 'SELECT * FROM throughput ORDER BY pointsCompleted DESC LIMIT 10'
    },
    {
      name: 'Low Throughput Weeks',
      description: 'Weeks with lowest output',
      sql: 'SELECT * FROM throughput ORDER BY pointsCompleted ASC LIMIT 5'
    },
    {
      name: 'Simulation Distribution',
      description: 'Monte Carlo simulation results',
      sql: 'SELECT * FROM simulation LIMIT 25'
    }
  ];

  return (
    <div className="query-templates">
      <h4>Quick Queries</h4>
      <p className="templates-hint">Click to load query into editor</p>
      <div className="templates-list">
        {templates.map((t, i) => (
          <button 
            key={i}
            className={`template-button ${currentSql === t.sql ? 'active' : ''}`}
            onClick={() => onSelect(t.sql)}
          >
            <span className="template-name">{t.name}</span>
            <span className="template-desc">{t.description}</span>
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
  const [currentSql, setCurrentSql] = useState('SELECT * FROM forecast LIMIT 1');

  // Calculate data availability for context display
  const dataContext = useMemo(() => {
    const context = {
      hasForecast: Boolean(forecastData),
      hasThroughput: Boolean(throughputData?.weeklyData || throughputData?.pointsPerWeek),
      hasSimulation: Boolean(simulationResults || forecastData?.distribution),
      throughputWeeks: 0,
      simulationSamples: 0
    };
    
    if (throughputData?.weeklyData) {
      context.throughputWeeks = throughputData.weeklyData.length;
    } else if (throughputData?.pointsPerWeek) {
      context.throughputWeeks = throughputData.pointsPerWeek.length;
    }
    
    if (simulationResults?.length) {
      context.simulationSamples = simulationResults.length;
    } else if (forecastData?.distribution?.length) {
      context.simulationSamples = forecastData.distribution.length;
    }
    
    return context;
  }, [forecastData, throughputData, simulationResults]);

  // Initialize query engine with data
  const queryEngine = useMemo(() => {
    const engine = new SimpleQueryEngine();
    
    // Register forecast data
    if (forecastData) {
      engine.registerTable('forecast', {
        p50_weeks: forecastData.p50,
        p80_weeks: forecastData.p80,
        p95_weeks: forecastData.p95,
        remaining_work: forecastData.remaining || forecastData.remainingWork,
        weeks_analyzed: forecastData.weeksAnalyzed,
        avg_throughput: forecastData.throughput?.mean || forecastData.throughputStats?.mean,
        simulation_count: forecastData.simulationCount || 10000,
        use_issue_count: forecastData.useIssueCount || false
      });
    }
    
    // Register throughput data
    if (throughputData?.weeklyData) {
      engine.registerTable('throughput', throughputData.weeklyData);
    } else if (throughputData?.pointsPerWeek) {
      const data = throughputData.pointsPerWeek.map((points, i) => ({
        week_number: i + 1,
        weekStart: throughputData.weeklyData?.[i]?.weekStart || `Week ${i + 1}`,
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

  // Handle template selection - update SQL in editor
  const handleTemplateSelect = useCallback((sql) => {
    setCurrentSql(sql);
    executeQuery(sql);
  }, [executeQuery]);

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
        <span className="explorer-badge">SQL Query Interface</span>
      </div>
      
      {/* Data context info */}
      <div className="data-context-banner">
        <div className="context-icon">i</div>
        <div className="context-text">
          <strong>Available data:</strong> This explorer queries the in-memory results from your forecast run. 
          Data includes {dataContext.hasForecast && 'forecast summary'}
          {dataContext.hasThroughput && `, ${dataContext.throughputWeeks} weeks of throughput history`}
          {dataContext.hasSimulation && `, and ${dataContext.simulationSamples.toLocaleString()} simulation samples`}.
          Data is not persisted and will reset when you run a new forecast.
        </div>
      </div>
      
      <div className="explorer-content">
        <div className="explorer-sidebar">
          <QueryTemplates 
            onSelect={handleTemplateSelect} 
            currentSql={currentSql}
          />
          
          <div className="available-tables">
            <h4>Table Schema</h4>
            <div className="table-schema">
              <div className="schema-table">
                <code>forecast</code>
                <span className="schema-hint">1 row</span>
                <ul className="schema-columns">
                  <li>p50_weeks, p80_weeks, p95_weeks</li>
                  <li>remaining_work, weeks_analyzed</li>
                  <li>avg_throughput, simulation_count</li>
                </ul>
              </div>
              
              <div className="schema-table">
                <code>throughput</code>
                <span className="schema-hint">{dataContext.throughputWeeks} rows</span>
                <ul className="schema-columns">
                  <li>weekStart</li>
                  <li>pointsCompleted</li>
                  <li>issuesCompleted</li>
                </ul>
              </div>
              
              <div className="schema-table">
                <code>simulation</code>
                <span className="schema-hint">{dataContext.simulationSamples > 0 ? `${dataContext.simulationSamples.toLocaleString()} rows` : 'varies'}</span>
                <ul className="schema-columns">
                  <li>weeks (completion time)</li>
                  <li>count (frequency)</li>
                  <li>percent (distribution %)</li>
                </ul>
              </div>
            </div>
            
            <div className="syntax-help">
              <h4>Supported SQL</h4>
              <ul>
                <li><code>SELECT *</code> or columns</li>
                <li><code>WHERE col = value</code></li>
                <li><code>ORDER BY col ASC/DESC</code></li>
                <li><code>LIMIT n</code></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="explorer-main">
          <SQLEditor 
            onExecute={executeQuery}
            disabled={false}
            sql={currentSql}
            onSqlChange={setCurrentSql}
          />
          
          {queryError && (
            <div className="query-error">
              <strong>Error:</strong> {queryError}
            </div>
          )}
          
          {results && (
            <div className="query-results">
              <div className="results-header">
                <span>{results.length} row{results.length !== 1 ? 's' : ''} returned</span>
                {queryTime && <span className="query-time">{queryTime}ms</span>}
              </div>
              <ResultsTable data={results} />
            </div>
          )}
          
          {!results && !queryError && (
            <div className="results-placeholder">
              <p>Select a quick query or write your own SQL to explore the data.</p>
              <p className="placeholder-hint">Try: <code>SELECT * FROM throughput ORDER BY pointsCompleted DESC LIMIT 5</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataExplorer;
