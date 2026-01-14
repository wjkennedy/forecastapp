"use client"

import { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { invoke, view } from "@forge/bridge"
import "./styles.css"

console.log("[v0] Frontend script loaded at:", new Date().toISOString())
console.log("[v0] Window location:", window.location.href)
console.log("[v0] Document ready state:", document.readyState)

function App() {
  console.log("[v0] App component rendering")

  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState("")
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)

  // Fetch available projects on mount
  useEffect(() => {
    console.log("[v0] App mounted, loading projects")
    loadProjects()
  }, [])

  const loadProjects = async () => {
    console.log("[v0] loadProjects: Starting to fetch projects")
    try {
      console.log("[v0] loadProjects: Calling invoke('getProjects')")
      const result = await invoke("getProjects")
      console.log("[v0] loadProjects: Received result:", JSON.stringify(result, null, 2))

      if (result.success) {
        console.log("[v0] loadProjects: Setting projects, count:", result.projects.length)
        setProjects(result.projects)
        if (result.projects.length > 0) {
          console.log("[v0] loadProjects: Setting selected project to:", result.projects[0].key)
          setSelectedProject(result.projects[0].key)
        }
      } else {
        console.error("[v0] loadProjects: Result not successful:", result)
        setError("Failed to load projects: " + (result.error || "Unknown error"))
      }
    } catch (err) {
      console.error("[v0] loadProjects: Exception caught:", err)
      console.error("[v0] loadProjects: Error stack:", err.stack)
      setError("Failed to load projects: " + err.message)
    }
  }

  const runForecast = async () => {
    if (!selectedProject) {
      console.warn("[v0] runForecast: No project selected")
      return
    }

    console.log("[v0] runForecast: Starting forecast for project:", selectedProject)
    setLoading(true)
    setError(null)

    try {
      // Step 1: Fetch and aggregate data
      console.log("[v0] runForecast: Step 1 - Calling fetchAndAggregate")
      const aggregateResult = await invoke("fetchAndAggregate", {
        scopeType: "project",
        scopeParams: { projectKey: selectedProject },
      })
      console.log("[v0] runForecast: Aggregate result:", JSON.stringify(aggregateResult, null, 2))

      if (!aggregateResult.success) {
        throw new Error(aggregateResult.error)
      }

      // Step 2: Compute baseline forecast
      console.log("[v0] runForecast: Step 2 - Calling computeBaseline")
      const forecastResult = await invoke("computeBaseline", {
        snapshotId: aggregateResult.snapshotId,
        throughput: aggregateResult.throughput,
        remaining: aggregateResult.remaining,
      })
      console.log("[v0] runForecast: Forecast result:", JSON.stringify(forecastResult, null, 2))

      if (!forecastResult.success) {
        throw new Error(forecastResult.error)
      }

      console.log("[v0] runForecast: Setting forecast state")
      setForecast(forecastResult)
    } catch (err) {
      console.error("[v0] runForecast: Exception:", err)
      console.error("[v0] runForecast: Error stack:", err.stack)
      setError(err.message || "Failed to compute forecast")
    } finally {
      setLoading(false)
      console.log("[v0] runForecast: Complete")
    }
  }

  console.log("[v0] App render state:", {
    projectsCount: projects.length,
    selectedProject,
    loading,
    hasError: !!error,
    hasForecast: !!forecast,
  })

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

console.log("[v0] Setting up theme subscription")
view.theme.subscribe((theme) => {
  console.log("[v0] Theme changed:", theme)
  document.body.className = theme.colorMode === "dark" ? "dark-mode" : "light-mode"
})

console.log("[v0] Waiting for DOM ready")
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp)
} else {
  initializeApp()
}

function initializeApp() {
  console.log("[v0] DOM ready, initializing React app")
  const rootElement = document.getElementById("root")

  if (!rootElement) {
    console.error("[v0] CRITICAL: Root element not found!")
    document.body.innerHTML =
      '<div style="padding: 20px; color: red; font-family: sans-serif;"><h1>Error</h1><p>Root element #root not found. Check that index.html has the correct structure.</p></div>'
    return
  }

  console.log("[v0] Root element found, creating React root")
  const root = ReactDOM.createRoot(rootElement)
  console.log("[v0] Rendering App component")
  root.render(<App />)
  console.log("[v0] App rendered successfully")
}
