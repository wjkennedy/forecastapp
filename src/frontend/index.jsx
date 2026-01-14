"use client"

import { useState } from "react"
import ForgeReconciler, {
  Text,
  Button,
  Heading,
  Strong,
  Stack,
  Form,
  FormSection,
  FormField,
  TextField,
  ButtonSet,
  ProgressBar,
} from "@forge/react"
import { invoke } from "@forge/bridge"

/**
 * Main Forecast App Component
 */
const App = () => {
  const [step, setStep] = useState("scope-picker") // scope-picker | loading | baseline | scenario
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ message: "", percent: 0 })
  const [error, setError] = useState(null)

  // Data state
  const [scopeConfig, setScopeConfig] = useState(null)
  const [baselineResult, setBaselineResult] = useState(null)
  const [scenarioResult, setScenarioResult] = useState(null)
  const [deltas, setDeltas] = useState([])

  /**
   * Step 1: Fetch and compute baseline
   */
  const handleFetchBaseline = async (scopeType, scopeParams) => {
    try {
      setLoading(true)
      setError(null)
      setStep("loading")
      setProgress({ message: "Fetching Jira issues...", percent: 10 })

      // Save scope config
      setScopeConfig({ scopeType, scopeParams })

      // Fetch and aggregate issues
      const fetchResult = await invoke("fetchAndAggregate", {
        scopeType,
        scopeParams,
      })

      if (!fetchResult.success) {
        throw new Error(fetchResult.error)
      }

      setProgress({ message: "Computing baseline forecast...", percent: 60 })

      // Compute baseline forecast
      const baselineResult = await invoke("computeBaseline", {
        snapshotId: fetchResult.snapshotId,
        throughput: fetchResult.throughput,
        remaining: fetchResult.remaining,
      })

      if (!baselineResult.success) {
        throw new Error(baselineResult.error)
      }

      setProgress({ message: "Complete!", percent: 100 })

      // Store results
      setBaselineResult({
        ...baselineResult,
        fetchData: fetchResult,
      })

      setLoading(false)
      setStep("baseline")
    } catch (err) {
      console.error("Fetch baseline error:", err)
      setError(err.message)
      setLoading(false)
      setStep("scope-picker")
    }
  }

  /**
   * Step 2: Compute scenario with deltas
   */
  const handleComputeScenario = async () => {
    try {
      setLoading(true)
      setError(null)
      setProgress({ message: "Computing scenario...", percent: 50 })

      const scenarioResult = await invoke("computeScenario", {
        snapshotId: baselineResult.snapshotId,
        baselineData: {
          issues: baselineResult.fetchData.issues || [],
          throughput: baselineResult.fetchData.throughput,
          p50: baselineResult.p50,
          p80: baselineResult.p80,
        },
        deltas,
      })

      if (!scenarioResult.success) {
        throw new Error(scenarioResult.error)
      }

      setScenarioResult(scenarioResult)
      setProgress({ message: "Complete!", percent: 100 })
      setLoading(false)
      setStep("scenario")
    } catch (err) {
      console.error("Compute scenario error:", err)
      setError(err.message)
      setLoading(false)
    }
  }

  /**
   * Render based on current step
   */
  if (step === "scope-picker") {
    return <ScopePicker onSubmit={handleFetchBaseline} error={error} />
  }

  if (step === "loading") {
    return (
      <Stack space="space.300">
        <Heading size="large">Loading...</Heading>
        <Text>{progress.message}</Text>
        <ProgressBar value={progress.percent / 100} />
      </Stack>
    )
  }

  if (step === "baseline") {
    return (
      <BaselineView
        result={baselineResult}
        onCreateScenario={() => setStep("scenario")}
        onReset={() => {
          setStep("scope-picker")
          setBaselineResult(null)
        }}
      />
    )
  }

  if (step === "scenario") {
    return (
      <ScenarioView
        baseline={baselineResult}
        scenario={scenarioResult}
        deltas={deltas}
        onDeltasChange={setDeltas}
        onCompute={handleComputeScenario}
        onBack={() => setStep("baseline")}
        loading={loading}
      />
    )
  }

  return <Text>Unknown step: {step}</Text>
}

/**
 * Scope Picker Component
 */
const ScopePicker = ({ onSubmit, error }) => {
  const [scopeType, setScopeType] = useState("project")
  const [projectKey, setProjectKey] = useState("")
  const [epicKey, setEpicKey] = useState("")
  const [jql, setJql] = useState("")

  const handleSubmit = () => {
    let scopeParams = {}

    if (scopeType === "project") {
      if (!projectKey) {
        alert("Please enter a project key")
        return
      }
      scopeParams = { projectKey }
    } else if (scopeType === "epic") {
      if (!epicKey) {
        alert("Please enter an epic key")
        return
      }
      scopeParams = { epicKey }
    } else if (scopeType === "jql") {
      if (!jql) {
        alert("Please enter a JQL query")
        return
      }
      scopeParams = { jql }
    }

    onSubmit(scopeType, scopeParams)
  }

  return (
    <Stack space="space.300">
      <Heading size="large">Jira Forecast Tool</Heading>
      <Text>Pick a scope to see a delivery forecast, then create what-if scenarios.</Text>

      {error && (
        <Text>
          <Strong>Error:</Strong> {error}
        </Text>
      )}

      <Form onSubmit={handleSubmit}>
        <FormSection>
          <FormField label="Scope Type" isRequired>
            <select
              value={scopeType}
              onChange={(e) => setScopeType(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "3px", border: "1px solid #ddd" }}
            >
              <option value="project">Project</option>
              <option value="epic">Epic</option>
              <option value="jql">Custom JQL</option>
            </select>
          </FormField>

          {scopeType === "project" && (
            <FormField label="Project Key" isRequired>
              <TextField value={projectKey} onChange={(e) => setProjectKey(e.target.value)} placeholder="e.g., PROJ" />
            </FormField>
          )}

          {scopeType === "epic" && (
            <FormField label="Epic Key" isRequired>
              <TextField value={epicKey} onChange={(e) => setEpicKey(e.target.value)} placeholder="e.g., PROJ-123" />
            </FormField>
          )}

          {scopeType === "jql" && (
            <FormField label="JQL Query" isRequired>
              <TextField
                value={jql}
                onChange={(e) => setJql(e.target.value)}
                placeholder="e.g., project = PROJ AND status != Done"
              />
            </FormField>
          )}
        </FormSection>

        <ButtonSet>
          <Button text="Fetch and Forecast" appearance="primary" />
        </ButtonSet>
      </Form>
    </Stack>
  )
}

/**
 * Baseline View Component
 */
const BaselineView = ({ result, onCreateScenario, onReset }) => {
  return (
    <Stack space="space.300">
      <Heading size="large">Baseline Forecast</Heading>

      <Stack space="space.100">
        <Text>
          <Strong>Remaining Work:</Strong> {result.remainingWork} points ({result.remainingIssues} issues)
        </Text>
        <Text>
          <Strong>Unestimated:</Strong> {result.unestimatedIssues} issues
        </Text>
      </Stack>

      <Stack space="space.100">
        <Heading size="medium">Forecast</Heading>
        <Text>
          <Strong>50% confident:</Strong> Complete in {result.p50} weeks
        </Text>
        <Text>
          <Strong>80% confident:</Strong> Complete in {result.p80} weeks
        </Text>
        <Text>
          <Strong>95% confident:</Strong> Complete in {result.p95} weeks
        </Text>
      </Stack>

      <Stack space="space.100">
        <Heading size="medium">Historical Throughput</Heading>
        <Text>
          <Strong>Median:</Strong> {result.throughputStats.median.toFixed(1)} points/week
        </Text>
        <Text>
          <Strong>Range:</Strong> {result.throughputStats.p20.toFixed(1)} - {result.throughputStats.p80.toFixed(1)}{" "}
          points/week
        </Text>
        <Text>
          <Strong>Data:</Strong> {result.throughputStats.weeks} weeks
        </Text>
      </Stack>

      <ButtonSet>
        <Button text="Create Scenario" appearance="primary" onClick={onCreateScenario} />
        <Button text="Change Scope" onClick={onReset} />
      </ButtonSet>
    </Stack>
  )
}

/**
 * Scenario View Component (stub for now)
 */
const ScenarioView = ({ baseline, scenario, deltas, onDeltasChange, onCompute, onBack, loading }) => {
  return (
    <Stack space="space.300">
      <Heading size="large">Scenario Editor</Heading>

      <Text>Scenario editor coming soon...</Text>
      <Text>Current deltas: {deltas.length}</Text>

      {scenario && (
        <Stack space="space.100">
          <Heading size="medium">Scenario Forecast</Heading>
          <Text>
            <Strong>P50:</Strong> {scenario.p50} weeks (Δ {scenario.deltaWeeks.p50 > 0 ? "+" : ""}
            {scenario.deltaWeeks.p50})
          </Text>
          <Text>
            <Strong>P80:</Strong> {scenario.p80} weeks (Δ {scenario.deltaWeeks.p80 > 0 ? "+" : ""}
            {scenario.deltaWeeks.p80})
          </Text>
        </Stack>
      )}

      <ButtonSet>
        <Button
          text="Compute Scenario"
          appearance="primary"
          onClick={onCompute}
          isDisabled={loading || deltas.length === 0}
        />
        <Button text="Back to Baseline" onClick={onBack} />
      </ButtonSet>
    </Stack>
  )
}

ForgeReconciler.render(<App />)
