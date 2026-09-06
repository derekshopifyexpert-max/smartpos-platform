import type { DashboardMetrics } from "../types/metrics"
import { api } from "@/lib/api/client"
import { ENDPOINTS } from "@/lib/api/endpoints"

interface ObservabilityDashboardResponse {
  timestamp: string
  health: {
    status: string
    uptime: number
  }
  revenue: number
  transactionsToday: number
  currencySummaries: Array<{
    currency: string
    revenue: number
    transactions: number
  }>
  payments: Record<string, number>
  conversions: Record<string, number>
  blockchainTransactions: Record<string, number>
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await api.get<ObservabilityDashboardResponse>(
    ENDPOINTS.dashboard.metrics
  )

  const data = response.data

  const revenue = data.revenue || 0
  const transactionsToday = data.transactionsToday || 0
  const currencySummaries = data.currencySummaries || []

  const transactionStatusBreakdown = Object.entries(data.payments || {}).map(
    ([status, count]) => ({
      status,
      count: Number(count),
    })
  )

  return {
    apiConnected: data.health.status === "operational",
    revenue,
    transactionsToday,
    currencySummaries,
    totalMerchants: 0,
    activeTerminals: 0,
    terminalCoverage: 0,

    platformActivity: {
      date: data.timestamp,
      totalTransactions: transactionsToday,
      hourly: [],
    },

    merchantInfrastructure: {
      registeredMerchants: 0,
      activeTerminals: 0,
      terminalCoverage: 0,
    },

    revenueSummary: {
      date: data.timestamp,
      revenue,
      currency: "USD",
    },

    transactionStatusBreakdown,
  }
}
