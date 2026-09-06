export interface PlatformActivity {
  date: string
  totalTransactions: number
  hourly: Array<{
    hour: number
    transactions: number
  }>
}

export interface MerchantInfrastructure {
  registeredMerchants: number
  activeTerminals: number
  terminalCoverage: number
}

export interface RevenueSummary {
  date: string
  revenue: number
  currency: string
}

export interface TransactionStatusBreakdown {
  status: string
  count: number
}

export interface CurrencySummary {
  currency: string
  revenue: number
  transactions: number
}

export interface DashboardMetrics {
  apiConnected: boolean
  revenue: number
  transactionsToday: number
  currencySummaries: CurrencySummary[]
  totalMerchants: number
  activeTerminals: number
  terminalCoverage: number
  platformActivity: PlatformActivity
  merchantInfrastructure: MerchantInfrastructure
  revenueSummary: RevenueSummary
  transactionStatusBreakdown: TransactionStatusBreakdown[]
}
