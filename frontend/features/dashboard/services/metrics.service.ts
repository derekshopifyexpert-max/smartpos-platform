import type { DashboardMetrics } from "../types/metrics"
import { api } from "@/lib/api/client"
import { ENDPOINTS } from "@/lib/api/endpoints"

interface ObservabilityDashboardResponse {
  timestamp: string
  health: {
    status: string
    uptime: number
  }
  payments: Record<string, number>
  conversions: Record<string, number>
  blockchainTransactions: Record<string, number>
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await api.get<ObservabilityDashboardResponse>(
    ENDPOINTS.dashboard.metrics
  )

  const data = response.data

  const transactionsToday = Object.values(data.payments)
    .reduce((total, count) => total + Number(count), 0)

  const totalMerchants = 0
  const activeTerminals = 0
  const terminalCoverage = 0

  const revenue = 0

  const transactionStatusBreakdown = Object.entries(data.payments).map(
    ([status, count]) => ({
      status,
      count: Number(count),
    })
  )

  return {
    revenue,
    transactionsToday,
    totalMerchants,
    activeTerminals,
    terminalCoverage,

    platformActivity: {
      date: data.timestamp,
      totalTransactions: transactionsToday,
      hourly: [],
    },

    merchantInfrastructure: {
      registeredMerchants: totalMerchants,
      activeTerminals,
      terminalCoverage,
    },

    revenueSummary: {
      date: data.timestamp,
      revenue,
      currency: "USD",
    },

    transactionStatusBreakdown,
  }
}
