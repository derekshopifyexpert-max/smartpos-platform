import type { DashboardMetrics } from "../types/metrics"

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not configured")
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await fetch(`${API_URL}/metrics`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch dashboard metrics: ${response.status} ${response.statusText}`
    )
  }

  const result = await response.json()

  if (!result.success || !result.data) {
    throw new Error("Invalid dashboard metrics response")
  }

  return result.data
}
