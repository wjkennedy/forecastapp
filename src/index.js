import Resolver from "@forge/resolver"
import api, { route } from "@forge/api"
import { handler as fetchAndAggregateHandler } from "./backend/fetchAndAggregate.js"
import { handler as computeBaselineHandler } from "./backend/computeBaseline.js"
import { handler as computeScenarioHandler } from "./backend/computeScenario.js"

console.log("[v0] ==========================================")
console.log("[v0] ===== RESOLVER MODULE LOADING =====")
console.log("[v0] Time:", new Date().toISOString())
console.log("[v0] Node version:", process.version)
console.log("[v0] ==========================================")

const resolver = new Resolver()

console.log("[v0] Resolver instance created:", typeof resolver)
console.log("[v0] Resolver has define method:", typeof resolver.define === "function")
console.log("[v0] Resolver has getDefinitions:", typeof resolver.getDefinitions === "function")

console.log("[v0] ========================================")
console.log("[v0] RESOLVER MODULE LOADED")
console.log("[v0] Time:", new Date().toISOString())
console.log("[v0] ========================================")

/**
 * Get list of projects accessible to the user
 */
resolver.define("getProjects", async ({ context }) => {
  console.log("[v0] ====== getProjects called ======")
  console.log("[v0] Context:", JSON.stringify(context, null, 2))
  
  try {
    const response = await api.asUser().requestJira(route`/rest/api/3/project/search`, {
      headers: {
        'Accept': 'application/json'
      }
    })
    
    console.log("[v0] Jira API response status:", response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Jira API error:", errorText)
      return {
        success: false,
        error: `Jira API error: ${response.status}`,
        projects: []
      }
    }
    
    const data = await response.json()
    console.log("[v0] Projects found:", data.values?.length || 0)
    
    const projects = (data.values || []).map(p => ({
      key: p.key,
      name: p.name,
      id: p.id
    }))
    
    console.log("[v0] Returning projects:", JSON.stringify(projects))
    
    return {
      success: true,
      projects: projects
    }
  } catch (error) {
    console.error("[v0] getProjects EXCEPTION:", error.message)
    console.error("[v0] getProjects stack:", error.stack)
    return {
      success: false,
      error: error.message,
      projects: []
    }
  }
})

/**
 * Fetch issues and aggregate baseline data
 */
resolver.define("fetchAndAggregate", async ({ payload, context }) => {
  console.log("[v0] ====== fetchAndAggregate called ======")
  console.log("[v0] fetchAndAggregate: Payload:", JSON.stringify(payload, null, 2))

  try {
    const result = await fetchAndAggregateHandler({ payload, context })
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
    const result = await computeBaselineHandler({ payload, context })
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
    const result = await computeScenarioHandler({ payload, context })
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
  console.log("[v0] ==========================================")
  console.log("[v0] ===== TEST RESOLVER CALLED!!! =====")
  console.log("[v0] Time:", new Date().toISOString())
  console.log("[v0] Payload:", JSON.stringify(payload, null, 2))
  console.log("[v0] ==========================================")

  const result = {
    success: true,
    message: "Backend is ALIVE and WORKING!",
    timestamp: new Date().toISOString(),
    payload: payload,
  }

  console.log("[v0] Returning result:", JSON.stringify(result))
  return result
})

console.log("[v0] All resolvers defined")
console.log("[v0] Calling getDefinitions()...")

const definitions = resolver.getDefinitions()

console.log("[v0] getDefinitions() returned:", typeof definitions)
console.log("[v0] Exporting handler...")
console.log("[v0] ==========================================")
console.log("[v0] ===== MODULE EXPORT COMPLETE =====")
console.log("[v0] ==========================================")

export const handler = definitions
