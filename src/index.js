import Resolver from "@forge/resolver"
import api, { route } from "@forge/api"
import { handler as fetchAndAggregateHandler } from "./backend/fetchAndAggregate.js"
import { handler as computeBaselineHandler } from "./backend/computeBaseline.js"
import { handler as computeScenarioHandler } from "./backend/computeScenario.js"

const resolver = new Resolver()

console.log("[v0] Backend resolver initialized at:", new Date().toISOString())

/**
 * Get list of projects accessible to the user
 */
resolver.define("getProjects", async ({ payload, context }) => {
  console.log("[v0] ====== getProjects called ======")
  console.log("[v0] getProjects: Payload:", JSON.stringify(payload, null, 2))
  console.log("[v0] getProjects: Context keys:", Object.keys(context))

  try {
    console.log("[v0] getProjects: Making Jira API request")
    const response = await api.asUser().requestJira(route`/rest/api/3/project`, {
      headers: {
        Accept: "application/json",
      },
    })

    console.log("[v0] getProjects: Response status:", response.status)
    console.log("[v0] getProjects: Response ok:", response.ok)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] getProjects: Error response body:", errorText)
      throw new Error(`Failed to fetch projects: ${response.status} - ${errorText}`)
    }

    const projects = await response.json()

    console.log(`[v0] getProjects: Successfully fetched ${projects.length} projects`)
    console.log(`[v0] getProjects: Project keys:`, projects.map((p) => p.key).join(", "))

    return {
      success: true,
      projects: projects.map((p) => ({
        key: p.key,
        name: p.name,
        id: p.id,
      })),
    }
  } catch (error) {
    console.error("[v0] getProjects ERROR:", error.message)
    console.error("[v0] getProjects ERROR stack:", error.stack)
    return {
      success: false,
      error: error.message,
      stack: error.stack,
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

console.log("[v0] All resolvers defined:", Object.keys(resolver.getDefinitions()))

export const handler = resolver.getDefinitions()
