export default function Page() {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "24px",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          background: "#0052CC",
          color: "white",
          padding: "24px",
          borderRadius: "8px",
          marginBottom: "24px",
        }}
      >
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>Jira Forecast App</h1>
        <p style={{ margin: 0, opacity: 0.9 }}>Monte Carlo simulation-based forecasting for Jira projects</p>
      </div>

      <div
        style={{
          background: "#FFF4E6",
          border: "2px solid #FF991F",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ margin: "0 0 12px 0", color: "#974F0C", fontSize: "18px" }}>
          ⚠️ This is a Forge App for Atlassian Jira
        </h2>
        <p style={{ margin: "0 0 12px 0", color: "#974F0C" }}>
          This application cannot run in the v0 preview environment because it requires:
        </p>
        <ul style={{ margin: "0 0 12px 0", color: "#974F0C" }}>
          <li>Atlassian Forge runtime environment</li>
          <li>DuckDB native Node.js modules (server-side only)</li>
          <li>Jira REST API access via Forge Bridge</li>
          <li>Forge Custom UI framework</li>
        </ul>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>How to Deploy</h2>

        <div style={{ background: "#F4F5F7", padding: "16px", borderRadius: "6px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>1. Install Forge CLI</h3>
          <pre
            style={{
              background: "#172B4D",
              color: "#B6C2CF",
              padding: "12px",
              borderRadius: "4px",
              overflow: "auto",
              margin: 0,
            }}
          >
            npm install -g @forge/cli
          </pre>
        </div>

        <div style={{ background: "#F4F5F7", padding: "16px", borderRadius: "6px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>2. Build the Frontend</h3>
          <pre
            style={{
              background: "#172B4D",
              color: "#B6C2CF",
              padding: "12px",
              borderRadius: "4px",
              overflow: "auto",
              margin: 0,
            }}
          >
            cd src/frontend{"\n"}npm install{"\n"}npm run build{"\n"}cd ../..
          </pre>
        </div>

        <div style={{ background: "#F4F5F7", padding: "16px", borderRadius: "6px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>3. Copy Static Resources</h3>
          <pre
            style={{
              background: "#172B4D",
              color: "#B6C2CF",
              padding: "12px",
              borderRadius: "4px",
              overflow: "auto",
              margin: 0,
            }}
          >
            npm run copy:static
          </pre>
        </div>

        <div style={{ background: "#F4F5F7", padding: "16px", borderRadius: "6px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>4. Deploy to Forge</h3>
          <pre
            style={{
              background: "#172B4D",
              color: "#B6C2CF",
              padding: "12px",
              borderRadius: "4px",
              overflow: "auto",
              margin: 0,
            }}
          >
            forge login{"\n"}forge deploy
          </pre>
        </div>

        <div style={{ background: "#F4F5F7", padding: "16px", borderRadius: "6px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>5. Install on Jira Site</h3>
          <pre
            style={{
              background: "#172B4D",
              color: "#B6C2CF",
              padding: "12px",
              borderRadius: "4px",
              overflow: "auto",
              margin: 0,
            }}
          >
            forge install
          </pre>
        </div>
      </div>

      <div
        style={{
          background: "#E3FCEF",
          border: "2px solid '#00875A",
          borderRadius: "8px",
          padding: "20px",
        }}
      >
        <h2 style={{ margin: "0 0 12px 0", color: "#006644", fontSize: "18px" }}>✓ Features</h2>
        <ul style={{ margin: 0, color: "#006644" }}>
          <li>Fetch and analyze Jira issues from projects, epics, or custom JQL queries</li>
          <li>Compute baseline forecasts using historical throughput data</li>
          <li>Monte Carlo simulation with P50, P80, and P95 confidence levels</li>
          <li>DuckDB for efficient in-memory data processing</li>
          <li>Custom UI built with React and Forge Bridge</li>
        </ul>
      </div>

      <div style={{ marginTop: "24px", padding: "16px", background: "#F4F5F7", borderRadius: "6px" }}>
        <p style={{ margin: 0, fontSize: "14px", color: "#5E6C84" }}>
          For detailed documentation, see <code>README.md</code> in the project root.
        </p>
      </div>
    </div>
  )
}
