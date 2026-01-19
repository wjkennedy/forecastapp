'use client';

import { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import "./styles.css"
import DataExplorer from "./DataExplorer"
import { SimulationProgress, useSimulation } from "./MonteCarloSimulation"

// ========== IMMEDIATE INITIALIZATION ==========
console.log("[v0] ========== SCRIPT START ==========")
console.log("[v0] Time:", new Date().toISOString())

// Render something visible IMMEDIATELY before any async operations
const showImmediateContent = () => {
  console.log("[v0] showImmediateContent called")
  const root = document.getElementById("root")
  console.log("[v0] root element:", root)
  if (root) {
    root.innerHTML = `
      <div style="padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: #0052CC; color: white; padding: 16px 24px; border-radius: 8px; margin-bottom: 16px;">
          <h1 style="margin: 0; font-size: 24px;">Project Forecast</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Loading application...</p>
        </div>
        <div id="app-status" style="padding: 16px; background: #f4f5f7; border-radius: 4px;">
          <p style="margin: 0;">Initializing React...</p>
        </div>
      </div>
    `
    console.log("[v0] Immediate content rendered")
  } else {
    console.error("[v0] Root element not found!")
  }
}

// Show content immediately
console.log("[v0] Document readyState:", document.readyState)
if (document.readyState === "loading") {
  console.log("[v0] Adding DOMContentLoaded listener")
  document.addEventListener("DOMContentLoaded", showImmediateContent)
} else {
  console.log("[v0] DOM already ready, showing content now")
  showImmediateContent()
}

// Lazy load Forge Bridge - don't block rendering
let forgeBridgeModule = null
const loadForgeBridge = async () => {
  if (!forgeBridgeModule) {
    try {
      console.log("[v0] Loading @forge/bridge...")
      forgeBridgeModule = await import("@forge/bridge")
      console.log("[v0] @forge/bridge loaded:", Object.keys(forgeBridgeModule))
    } catch (err) {
      console.error("[v0] Failed to load @forge/bridge:", err)
    }
  }
  return forgeBridgeModule
}

const invokeResolver = async (functionKey, payload) => {
  console.log("[v0] invokeResolver:", functionKey, payload)
  const bridge = await loadForgeBridge()
  if (bridge && bridge.invoke) {
    const result = await bridge.invoke(functionKey, payload)
    console.log("[v0] invokeResolver result:", result)
    return result
  }
  throw new Error("Forge Bridge not available")
}

function InfoPanel({ title, children, collapsible = false }) {
  const [collapsed, setCollapsed] = useState(false)
  
  return (
    <div className="info-panel">
      <div 
        className={`info-panel-header ${collapsible ? 'collapsible' : ''}`}
        onClick={() => collapsible && setCollapsed(!collapsed)}
      >
        <span className="info-icon">i</span>
        <span className="info-title">{title}</span>
        {collapsible && <span className="collapse-icon">{collapsed ? '+' : '-'}</span>}
      </div>
      {!collapsed && <div className="info-panel-content">{children}</div>}
    </div>
  )
}

function HelpTooltip({ text }) {
  return (
    <span className="help-tooltip" title={text}>?</span>
  )
}

function App() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState("")
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)
  const [bridgeStatus, setBridgeStatus] = useState("checking...")
  const [showMethodology, setShowMethodology] = useState(false)
  const [showExplorer, setShowExplorer] = useState(false)
  const [aggregateData, setAggregateData] = useState(null)
  const [simulationSamples, setSimulationSamples] = useState(10000)
  
  // Use client-side simulation with progress
  const simulation = useSimulation()

  useEffect(() => {
    console.log("[v0] App mounted")
    // Check bridge availability
    loadForgeBridge().then(bridge => {
      if (bridge) {
        setBridgeStatus("connected")
        loadProjects()
      } else {
        setBridgeStatus("not available")
        setError("Forge Bridge not available - are you running inside Jira?")
      }
    })
  }, [])

  const loadProjects = async () => {
    console.log("[v0] loadProjects: Starting")
    try {
      const result = await invokeResolver("getProjects")
      console.log("[v0] loadProjects result:", result)
      if (result && result.success) {
        setProjects(result.projects || [])
        if (result.projects && result.projects.length > 0) {
          setSelectedProject(result.projects[0].key)
        }
      } else {
        setError("Failed to load projects: " + (result?.error || "Unknown error"))
      }
    } catch (err) {
      console.error("[v0] loadProjects error:", err)
      setError("Failed to load projects: " + err.message)
    }
  }

  const runForecast = async () => {
    if (!selectedProject) return
    setLoading(true)
    setError(null)
    setForecast(null)
    simulation.reset()

    try {
      // Step 1: Fetch and aggregate data from Jira
      const aggregateResult = await invokeResolver("fetchAndAggregate", {
        scopeType: "project",
        scopeParams: { projectKey: selectedProject },
      })

      if (!aggregateResult?.success) {
        throw new Error(aggregateResult?.error || "Aggregation failed")
      }

      setAggregateData(aggregateResult)

      // Step 2: Run Monte Carlo simulation client-side with progress
      const throughputData = aggregateResult.throughput?.weeklyData || 
                            aggregateResult.throughput?.pointsPerWeek?.map((p, i) => ({
                              pointsCompleted: p,
                              issuesCompleted: aggregateResult.throughput?.issuesPerWeek?.[i] || 0
                            })) || []
      
      const remainingWork = aggregateResult.remaining?.totalPoints || 
                           aggregateResult.remaining?.total_points ||
                           aggregateResult.remaining?.issueCount ||
                           aggregateResult.remaining?.issue_count || 0
      
      const useIssueCount = (aggregateResult.remaining?.totalPoints || aggregateResult.remaining?.total_points || 0) === 0

      if (throughputData.length === 0) {
        throw new Error("No historical throughput data available. Need at least one week of completed work.")
      }

      setLoading(false) // Stop loading indicator, simulation progress will take over

      const forecastResult = await simulation.run(throughputData, remainingWork, {
        samples: simulationSamples,
        seed: aggregateResult.snapshotId || selectedProject,
        useIssueCount,
        batchSize: 500,
      })

      if (!forecastResult?.success) {
        throw new Error(forecastResult?.error || "Simulation failed")
      }

      // Enhance result with remaining work info
      setForecast({
        ...forecastResult,
        remaining: remainingWork,
        weeksAnalyzed: throughputData.length,
        throughput: forecastResult.throughputStats,
        useIssueCount,
      })
    } catch (err) {
      setError(err.message || "Failed to compute forecast")
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Project Forecast</h1>
        <p className="header-subtitle">Probabilistic completion forecasting using Monte Carlo simulation</p>
      </header>

      <InfoPanel title="What is this tool?">
        <p>
          This forecast tool uses <strong>Monte Carlo simulation</strong> to predict when your project 
          work will likely be completed. Instead of giving you a single estimate that's almost always wrong, 
          it provides a range of outcomes based on your team's actual historical performance.
        </p>
        <p>
          <strong>How it works:</strong> We analyze your team's past throughput (how many items completed per week), 
          then run up to 50,000 simulations in your browser to determine the probability distribution of completion dates.
        </p>
        <p>
          <strong>Data processing:</strong> Jira issues are aggregated with DuckDB in-memory on the backend, and the
          resulting throughput data is sent to the client. Your simulation results stay in a client-side in-memory
          dataset and can be explored with SQL-style queries in the Data Explorer.
        </p>
        <button 
          className="link-button" 
          onClick={() => setShowMethodology(!showMethodology)}
        >
          {showMethodology ? 'Hide methodology details' : 'Learn more about the methodology'}
        </button>
        {showMethodology && (
          <div className="methodology-details">
            <h4>Understanding the Results</h4>
            <ul>
              <li><strong>P50 (Median):</strong> 50% chance of completing by this date. This is optimistic.</li>
              <li><strong>P80:</strong> 80% chance of completing by this date. A reasonable target for planning.</li>
              <li><strong>P95:</strong> 95% chance of completing by this date. Use this for commitments with low risk tolerance.</li>
            </ul>
            <h4>Data Used</h4>
            <ul>
              <li>Throughput is calculated from resolved issues in the past 12 weeks</li>
              <li>Remaining work counts all unresolved issues in the selected scope</li>
              <li>The simulation randomly samples from historical weekly throughput</li>
            </ul>
          </div>
        )}
      </InfoPanel>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="project-select">
            Select Project
            <HelpTooltip text="Choose the Jira project to forecast. The tool will analyze all issues in this project." />
          </label>
          <select
            id="project-select"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={loading}
          >
            {projects.length === 0 && <option value="">Loading projects...</option>}
            {projects.map((project) => (
              <option key={project.key} value={project.key}>
                {project.name} ({project.key})
              </option>
            ))}
          </select>
          <span className="control-hint">
            {projects.length > 0 ? `${projects.length} projects available` : 'Loading...'}
          </span>
        </div>

        <div className="control-group">
          <label htmlFor="sample-count">
            Simulation Samples
            <HelpTooltip text="More samples = more accurate results but longer runtime. 10,000 is recommended." />
          </label>
          <select
            id="sample-count"
            value={simulationSamples}
            onChange={(e) => setSimulationSamples(Number(e.target.value))}
            disabled={loading || simulation.isRunning}
          >
            <option value={1000}>1,000 (fast)</option>
            <option value={5000}>5,000 (balanced)</option>
            <option value={10000}>10,000 (recommended)</option>
            <option value={25000}>25,000 (high accuracy)</option>
            <option value={50000}>50,000 (very high)</option>
          </select>
        </div>

        <button 
          onClick={runForecast} 
          disabled={loading || simulation.isRunning || !selectedProject} 
          className="run-button"
        >
          {loading ? "Fetching data..." : simulation.isRunning ? "Simulating..." : "Run Forecast"}
        </button>
      </div>

      {/* Simulation Progress */}
      <SimulationProgress 
        progress={simulation.progress} 
        isRunning={simulation.isRunning} 
      />

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {forecast && (
        <div className="results">
          <h2>Forecast Results</h2>
          
          <div className="results-summary">
            <p>
              Based on <strong>{forecast.simulationCount || 10000} simulations</strong> using 
              your team's historical throughput, here are the projected completion timeframes:
            </p>
          </div>

          <div className="stats-grid">
            <div className="stat-card optimistic">
              <div className="stat-label">
                P50 (Median)
                <HelpTooltip text="50% probability of completion by this date. Half of simulations finished earlier, half later." />
              </div>
              <div className="stat-value">{forecast.p50 || '--'}</div>
              <div className="stat-unit">weeks</div>
              <div className="stat-desc">Optimistic target</div>
            </div>
            <div className="stat-card recommended">
              <div className="stat-label">
                P80
                <HelpTooltip text="80% probability of completion. This is a reasonable target for most planning purposes." />
              </div>
              <div className="stat-value">{forecast.p80 || '--'}</div>
              <div className="stat-unit">weeks</div>
              <div className="stat-desc">Recommended for planning</div>
            </div>
            <div className="stat-card conservative">
              <div className="stat-label">
                P95
                <HelpTooltip text="95% probability of completion. Use this for high-stakes commitments where missing the deadline has serious consequences." />
              </div>
              <div className="stat-value">{forecast.p95 || '--'}</div>
              <div className="stat-unit">weeks</div>
              <div className="stat-desc">Conservative estimate</div>
            </div>
          </div>

          {(forecast.throughput || forecast.remaining) && (
            <div className="data-summary">
              <h3>Data Summary</h3>
              <div className="summary-grid">
                {forecast.remaining !== undefined && (
                  <div className="summary-item">
                    <span className="summary-label">Remaining Items:</span>
                    <span className="summary-value">{forecast.remaining}</span>
                  </div>
                )}
                {forecast.throughput && (
                  <div className="summary-item">
                    <span className="summary-label">Avg Weekly Throughput:</span>
                    <span className="summary-value">
                      {typeof forecast.throughput === 'object' 
                        ? (forecast.throughput.mean || forecast.throughput.avg || '--')
                        : forecast.throughput} items/week
                    </span>
                  </div>
                )}
                {forecast.weeksAnalyzed && (
                  <div className="summary-item">
                    <span className="summary-label">Historical Data:</span>
                    <span className="summary-value">{forecast.weeksAnalyzed} weeks</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <InfoPanel title="How to use these results" collapsible={true}>
            <ul>
              <li><strong>For sprint planning:</strong> Use the P50 as an optimistic goal, but plan buffer time.</li>
              <li><strong>For stakeholder communication:</strong> Communicate the P80 date as your target, with P95 as the outer bound.</li>
              <li><strong>For contracts/commitments:</strong> Use P95 to minimize risk of missing deadlines.</li>
            </ul>
            <p className="info-note">
              Remember: These forecasts assume current team capacity and scope remain constant. 
              Re-run the forecast regularly as conditions change.
            </p>
          </InfoPanel>

          <div className="explorer-toggle">
            <button 
              className="toggle-explorer-button"
              onClick={() => setShowExplorer(!showExplorer)}
            >
              {showExplorer ? 'Hide Data Explorer' : 'Open Data Explorer'}
            </button>
            <span className="explorer-hint">Query your forecast data with SQL</span>
          </div>

          {showExplorer && (
            <DataExplorer 
              forecastData={forecast}
              throughputData={aggregateData?.throughput}
              simulationResults={forecast?.distribution}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Initialize React after a short delay to ensure DOM is ready
console.log("[v0] Setting up React initialization")
const initializeReact = () => {
  console.log("[v0] initializeReact called")
  const rootElement = document.getElementById("root")
  
  if (!rootElement) {
    console.error("[v0] CRITICAL: Root element not found!")
    return
  }

  console.log("[v0] Creating React root")
  try {
    const root = ReactDOM.createRoot(rootElement)
    console.log("[v0] Rendering App")
    root.render(<App />)
    console.log("[v0] App rendered successfully")
  } catch (err) {
    console.error("[v0] React render error:", err)
    rootElement.innerHTML = '<div style="color: red; padding: 20px;">React Error: ' + err.message + '</div>'
  }
}

// Wait for DOM then initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[v0] DOMContentLoaded fired")
    setTimeout(initializeReact, 100)
  })
} else {
  console.log("[v0] DOM ready, initializing after timeout")
  setTimeout(initializeReact, 100)
}

console.log("[v0] Script end reached")
