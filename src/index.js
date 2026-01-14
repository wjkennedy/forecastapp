import Resolver from "@forge/resolver"
import api, { route } from "@forge/api"
import { handler as fetchAndAggregateHandler } from "./backend/fetchAndAggregate.js"
import { handler as computeBaselineHandler } from "./backend/computeBaseline.js"
import { handler as computeScenarioHandler } from "./backend/computeScenario.js"

const resolver = new Resolver()

/**
 * Get list of projects accessible to the user
 */
resolver.define("getProjects", async ({ payload, context }) => {
  console.log("[v0] getProjects called")

  try {
    const response = await api.asUser().requestJira(route`/rest/api/3/project`, {
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`)
    }

    const projects = await response.json()

    console.log(`[v0] Found ${projects.length} projects`)

    return {
      success: true,
      projects: projects.map((p) => ({
        key: p.key,
        name: p.name,
        id: p.id,
      })),
    }
  } catch (error) {
    console.error("[v0] getProjects error:", error)
    return {
      success: false,
      error: error.message,
    }
  }
})

/**
 * Fetch issues and aggregate baseline data
 */
resolver.define("fetchAndAggregate", async ({ payload, context }) => {
  console.log("[v0] fetchAndAggregate called with payload:", JSON.stringify(payload))

  try {
    const result = await fetchAndAggregateHandler({ payload, context })
    console.log("[v0] fetchAndAggregate result:", result.success ? "success" : "failed")
    return result
  } catch (error) {
    console.error("[v0] fetchAndAggregate error:", error)
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
  console.log("[v0] computeBaseline called")

  try {
    const result = await computeBaselineHandler({ payload, context })
    console.log("[v0] computeBaseline result:", result.success ? "success" : "failed")
    return result
  } catch (error) {
    console.error("[v0] computeBaseline error:", error)
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
  console.log("[v0] computeScenario called")

  try {
    const result = await computeScenarioHandler({ payload, context })
    console.log("[v0] computeScenario result:", result.success ? "success" : "failed")
    return result
  } catch (error) {
    console.error("[v0] computeScenario error:", error)
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    }
  }
})

export const handler = resolver.getDefinitions()
