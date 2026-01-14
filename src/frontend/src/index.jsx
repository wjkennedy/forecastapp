"use client"

import { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { invoke, view } from "@forge/bridge"
import "./styles.css"

function App() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState("")
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)

  // Fetch available projects on mount
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const result = await invoke("getProjects")
      if (result.success) {
        setProjects(result.projects)
        if (result.projects.length > 0) {
          setSelectedProject(result.projects[0].key)
        }
      }
    } catch (err) {
      console.error("Failed to load projects:", err)
      setError("Failed to load projects")
    }
  }

  const runForecast = async () => {
    if (!selectedProject) return

    setLoading(true)
    setError(null)

    try {
      // Step 1: Fetch and aggregate data
      const aggregateResult = await invoke("fetchAndAggregate", {
        scopeType: "project",
        scopeParams: { projectKey: selectedProject },
      })

      if (!aggregateResult.success) {
        throw new Error(aggregateResult.error)
      }

      // Step 2: Compute baseline forecast
      const forecastResult = await invoke("computeBaseline", {
        snapshotId: aggregateResult.snapshotId,
        throughput: aggregateResult.throughput,
        remaining: aggregateResult.remaining,
      })

      if (!forecastResult.success) {
        throw new Error(forecastResult.error)
      }

      setForecast(forecastResult)
    } catch (err) {
      console.error("Forecast failed:", err)
      setError(err.message || "Failed to compute forecast")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Project Forecast</h1>
        <p>Monte Carlo simulation-based forecasting for Jira projects</p>
      </header>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="project-select">Select Project:</label>
          <select
            id="project-select"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={loading}
          >
            {projects.map((project) => (
              <option key={project.key} value={project.key}>
                {project.name} ({project.key})
              </option>
            ))}
          </select>
        </div>

        <button onClick={runForecast} disabled={loading || !selectedProject} className="run-button">
          {loading ? "Computing..." : "Run Forecast"}
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {forecast && (
        <div className="results">
          <h2>Forecast Results</h2>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">P50 (Median)</div>
              <div className="stat-value">{forecast.p50} weeks</div>
              <div className="stat-desc">50% confidence</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">P80</div>
              <div className="stat-value">{forecast.p80} weeks</div>
              <div className="stat-desc">80% confidence</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">P95</div>
              <div className="stat-value">{forecast.p95} weeks</div>
              <div className="stat-desc">95% confidence</div>
            </div>
          </div>

          <div className="work-summary">
            <h3>Work Summary</h3>
            <div className="summary-grid">
              <div>
                <strong>Remaining Work:</strong> {forecast.remainingWork} points
              </div>
              <div>
                <strong>Issues:</strong> {forecast.remainingIssues}
              </div>
              <div>
                <strong>Unestimated:</strong> {forecast.unestimatedIssues}
              </div>
            </div>
          </div>

          {forecast.throughputStats && (
            <div className="throughput-stats">
              <h3>Throughput Statistics</h3>
              <div className="summary-grid">
                <div>
                  <strong>Median:</strong> {forecast.throughputStats.median.toFixed(1)} points/week
                </div>
                <div>
                  <strong>Mean:</strong> {forecast.throughputStats.mean.toFixed(1)} points/week
                </div>
                <div>
                  <strong>Range:</strong> {forecast.throughputStats.min} - {forecast.throughputStats.max} points
                </div>
              </div>
            </div>
          )}

          <div className="meta">
            <small>
              Computed at: {new Date(forecast.computedAt).toLocaleString()} | Execution time: {forecast.executionTime}ms
              | Snapshot: {forecast.snapshotId}
            </small>
          </div>
        </div>
      )}
    </div>
  )
}

// Resize app height
view.theme.subscribe((theme) => {
  document.body.className = theme.colorMode === "dark" ? "dark-mode" : "light-mode"
})

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(<App />)
