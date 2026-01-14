import Resolver from "@forge/resolver"

const resolver = new Resolver()

console.log("[v0] ========================================")
console.log("[v0] RESOLVER MODULE LOADED")
console.log("[v0] Time:", new Date().toISOString())
console.log("[v0] ========================================")

/**
 * Get list of projects accessible to the user
 */
resolver.define("getProjects", async () => {
  console.log("[v0] ====== getProjects called ======")
  return {
    success: true,
    projects: [{ key: "TEST", name: "Test Project", id: "1" }],
  }
})

/**
 * Fetch issues and aggregate baseline data
 */
resolver.define("fetchAndAggregate", async ({ payload, context }) => {
  console.log("[v0] ====== fetchAndAggregate called ======")
  console.log("[v0] fetchAndAggregate: Payload:", JSON.stringify(payload, null, 2))

  try {
    // Placeholder for fetchAndAggregateHandler
    const result = { success: true, message: "Fetch and Aggregate is working!" }
    console.log("[v0] fetchAndAggregate: Result success:", result.success)
    if (!result.success) {
      console.error("[v0] fetchAndAggregate: Error:", result.error)
    }
    return result
  } catch (error) {
    console.error("[v0] fetchAndAggregate EXCEPTION:", error.message)
    console.error("[v0] fetchAndAggregate EXCEPTION stack:", error.stack)
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    }
  }
})

/**
 * Compute baseline forecast
 */
resolver.define("computeBaseline", async ({ payload, context }) => {
  console.log("[v0] ====== computeBaseline called ======")
  console.log("[v0] computeBaseline: Payload:", JSON.stringify(payload, null, 2))

  try {
    // Placeholder for computeBaselineHandler
    const result = { success: true, message: "Compute Baseline is working!" }
    console.log("[v0] computeBaseline result:", result.success ? "success" : "failed")
    return result
  } catch (error) {
    console.error("[v0] computeBaseline EXCEPTION:", error.message)
    console.error("[v0] computeBaseline EXCEPTION stack:", error.stack)
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    }
  }
})

/**
 * Compute scenario forecast
 */
resolver.define("computeScenario", async ({ payload, context }) => {
  console.log("[v0] ====== computeScenario called ======")
  console.log("[v0] computeScenario: Payload:", JSON.stringify(payload, null, 2))

  try {
    // Placeholder for computeScenarioHandler
    const result = { success: true, message: "Compute Scenario is working!" }
    console.log("[v0] computeScenario result:", result.success ? "success" : "failed")
    return result
  } catch (error) {
    console.error("[v0] computeScenario EXCEPTION:", error.message)
    console.error("[v0] computeScenario EXCEPTION stack:", error.stack)
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    }
  }
})

// Simple test resolver
resolver.define("test", async ({ payload }) => {
  console.log("[v0] ====== TEST RESOLVER CALLED ======")
  console.log("[v0] Payload:", JSON.stringify(payload))
  return { success: true, message: "Backend is working!", timestamp: new Date().toISOString() }
})

console.log("[v0] Resolver definitions:", Object.keys(resolver.getDefinitions()))
console.log("[v0] ========================================")

export const handler = resolver.getDefinitions()
