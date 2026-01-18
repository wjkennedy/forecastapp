'use client';

import { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import "./styles.css"

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

function App() {
  console.log("[v0] App component rendering")

  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState("")
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)
  const [bridgeStatus, setBridgeStatus] = useState("checking...")

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
    console.log("[v0] runForecast for:", selectedProject)
    setLoading(true)
    setError(null)

    try {
      const aggregateResult = await invokeResolver("fetchAndAggregate", {
        scopeType: "project",
        scopeParams: { projectKey: selectedProject },
      })

      if (!aggregateResult?.success) {
        throw new Error(aggregateResult?.error || "Aggregation failed")
      }

      const forecastResult = await invokeResolver("computeBaseline", {
        snapshotId: aggregateResult.snapshotId,
        throughput: aggregateResult.throughput,
        remaining: aggregateResult.remaining,
      })

      if (!forecastResult?.success) {
        throw new Error(forecastResult?.error || "Forecast failed")
      }

      setForecast(forecastResult)
    } catch (err) {
      console.error("[v0] runForecast error:", err)
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
        <small>Bridge: {bridgeStatus}</small>
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
            {projects.length === 0 && <option value="">Loading projects...</option>}
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
            </div>
            <div className="stat-card">
              <div className="stat-label">P80</div>
              <div className="stat-value">{forecast.p80} weeks</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">P95</div>
              <div className="stat-value">{forecast.p95} weeks</div>
            </div>
          </div>
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
