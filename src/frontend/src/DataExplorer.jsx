'use client';

import { useState, useEffect, useCallback } from 'react';
import useDuckDB from './useDuckDB';

/**
 * SQL Editor component for querying forecast data
 */
function SQLEditor({ onExecute, disabled }) {
  const [sql, setSql] = useState('SELECT * FROM forecast_data LIMIT 10');
  
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
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter SQL query..."
        disabled={disabled}
        spellCheck={false}
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
function ResultsTable({ data, columns }) {
  if (!data || data.length === 0) {
    return <div className="results-empty">No results</div>;
  }

  const cols = columns || Object.keys(data[0] || {});

  return (
    <div className="results-table-container">
      <table className="results-table">
        <thead>
          <tr>
            {cols.map(col => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {cols.map(col => (
                <td key={col}>
                  {typeof row[col] === 'object' 
                    ? JSON.stringify(row[col]) 
                    : String(row[col] ?? '')}
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
      name: 'All Forecast Data',
      sql: 'SELECT * FROM forecast_data LIMIT 100'
    },
    {
      name: 'Throughput by Week',
      sql: `SELECT 
  week_start,
  issues_completed,
  points_completed
FROM throughput_data
ORDER BY week_start`
    },
    {
      name: 'Completion Distribution',
      sql: `SELECT 
  weeks,
  COUNT(*) as simulations,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM simulation_results
GROUP BY weeks
ORDER BY weeks`
    },
    {
      name: 'Summary Statistics',
      sql: `SELECT 
  'Remaining Issues' as metric, remaining_issues as value FROM summary
UNION ALL
SELECT 'Remaining Points', remaining_points FROM summary
UNION ALL
SELECT 'P50 Weeks', p50_weeks FROM summary
UNION ALL
SELECT 'P80 Weeks', p80_weeks FROM summary
UNION ALL
SELECT 'P95 Weeks', p95_weeks FROM summary`
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
 * Data Explorer - DuckDB-powered SQL interface
 */
export function DataExplorer({ forecastData, throughputData, simulationResults }) {
  const { loading, error, query, registerJSON, isReady } = useDuckDB();
  const [results, setResults] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [queryTime, setQueryTime] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load forecast data into DuckDB when available
  useEffect(() => {
    if (!isReady || dataLoaded) return;

    const loadAllData = async () => {
      try {
        console.log('[DataExplorer] Loading data into DuckDB...');
        
        // Register forecast data
        if (forecastData) {
          await registerJSON('forecast_data', Array.isArray(forecastData) ? forecastData : [forecastData]);
        }
        
        // Register throughput data
        if (throughputData?.weeklyData) {
          await registerJSON('throughput_data', throughputData.weeklyData);
        }
        
        // Register simulation results if available
        if (simulationResults) {
          await registerJSON('simulation_results', simulationResults);
        }

        // Create summary table
        if (forecastData) {
          const summary = [{
            remaining_issues: forecastData.remainingIssues || 0,
            remaining_points: forecastData.remainingWork || 0,
            p50_weeks: forecastData.p50 || 0,
            p80_weeks: forecastData.p80 || 0,
            p95_weeks: forecastData.p95 || 0,
            weeks_analyzed: forecastData.weeksAnalyzed || 0
          }];
          await registerJSON('summary', summary);
        }

        setDataLoaded(true);
        console.log('[DataExplorer] Data loaded successfully');
      } catch (err) {
        console.error('[DataExplorer] Failed to load data:', err);
        setQueryError('Failed to load data: ' + err.message);
      }
    };

    loadAllData();
  }, [isReady, forecastData, throughputData, simulationResults, registerJSON, dataLoaded]);

  // Execute SQL query
  const executeQuery = useCallback(async (sql) => {
    setQueryError(null);
    setResults(null);
    
    const startTime = performance.now();
    
    try {
      // Handle JSON file references
      let processedSql = sql;
      
      // Replace table references with read_json_auto for our registered files
      const tables = ['forecast_data', 'throughput_data', 'simulation_results', 'summary'];
      for (const table of tables) {
        const regex = new RegExp(`\\b${table}\\b`, 'gi');
        processedSql = processedSql.replace(regex, `read_json_auto('${table}.json')`);
      }
      
      const rows = await query(processedSql);
      const elapsed = performance.now() - startTime;
      
      setResults(rows);
      setQueryTime(elapsed.toFixed(2));
    } catch (err) {
      console.error('[DataExplorer] Query error:', err);
      setQueryError(err.message);
    }
  }, [query]);

  if (loading) {
    return (
      <div className="data-explorer loading">
        <div className="loading-spinner"></div>
        <p>Initializing DuckDB...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-explorer error">
        <p>Failed to initialize DuckDB: {error}</p>
      </div>
    );
  }

  return (
    <div className="data-explorer">
      <div className="explorer-header">
        <h3>Data Explorer</h3>
        <span className="duckdb-badge">Powered by DuckDB-WASM</span>
      </div>
      
      <div className="explorer-content">
        <div className="explorer-sidebar">
          <QueryTemplates onSelect={(sql) => {
            document.querySelector('.sql-textarea').value = sql;
            executeQuery(sql);
          }} />
          
          <div className="available-tables">
            <h4>Available Tables</h4>
            <ul>
              <li><code>forecast_data</code> - Forecast results</li>
              <li><code>throughput_data</code> - Weekly throughput</li>
              <li><code>simulation_results</code> - Monte Carlo results</li>
              <li><code>summary</code> - Summary statistics</li>
            </ul>
          </div>
        </div>
        
        <div className="explorer-main">
          <SQLEditor 
            onExecute={executeQuery}
            disabled={!dataLoaded}
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
