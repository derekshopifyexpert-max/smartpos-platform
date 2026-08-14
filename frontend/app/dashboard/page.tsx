"use client";

import Link from "next/link";
import {
  Activity,
  CreditCard,
  Plus,
  RefreshCw,
  Store,
  Terminal,
  TrendingUp,
} from "lucide-react";

import { useDashboardMetrics } from "@/features/dashboard/hooks/use-dashboard-metrics";

function formatCurrency(
  amount: number,
  currency = "USD"
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>

        <div className="rounded-lg bg-slate-100 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

function getStatusStyles(status: string) {
  switch (status.toUpperCase()) {
    case "SETTLED":
    case "SUCCESS":
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "FAILED":
    case "DECLINED":
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export default function DashboardPage() {
  const {
    data: metrics,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useDashboardMetrics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            SmartPOS Platform overview.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-900">
          Unable to load dashboard
        </h2>

        <p className="mt-2 text-sm text-red-700">
          The dashboard data could not be loaded from the SmartPOS API.
        </p>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              isFetching ? "animate-spin" : ""
            }`}
          />
          Try Again
        </button>
      </div>
    );
  }

  const currency =
    metrics.revenueSummary?.currency || "USD";

  const hourlyActivity =
    metrics.platformActivity?.hourly ?? [];

  const maxHourlyTransactions = Math.max(
    ...hourlyActivity.map(
      (item) => item.transactions
    ),
    0
  );

  const statusBreakdown =
    metrics.transactionStatusBreakdown ?? [];

  const totalStatusTransactions =
    statusBreakdown.reduce(
      (total, item) => total + item.count,
      0
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            SmartPOS Platform overview.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/payments/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="h-4 w-4" />
            New Payment
          </Link>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                isFetching ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(
            metrics.revenue,
            currency
          )}
          description="Total settled transaction revenue today"
          icon={TrendingUp}
        />

        <StatCard
          title="Transactions Today"
          value={metrics.transactionsToday.toLocaleString()}
          description="Transactions processed today"
          icon={CreditCard}
        />

        <StatCard
          title="Total Merchants"
          value={metrics.totalMerchants.toLocaleString()}
          description="Registered merchants on the platform"
          icon={Store}
        />

        <StatCard
          title="Active Terminals"
          value={metrics.activeTerminals.toLocaleString()}
          description={`${metrics.terminalCoverage}% terminal coverage`}
          icon={Terminal}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-slate-700" />

            <div>
              <h2 className="font-semibold text-slate-900">
                Platform Activity
              </h2>

              <p className="text-sm text-slate-500">
                Transactions processed today by hour.
              </p>
            </div>
          </div>

          <div className="mt-6">
            {metrics.platformActivity?.totalTransactions === 0 ? (
              <div className="flex min-h-48 items-center justify-center rounded-lg bg-slate-50 px-6 text-center">
                <div>
                  <p className="font-medium text-slate-700">
                    No transactions today
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Transaction activity will appear here as payments are processed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {hourlyActivity.map((item) => {
                  const width =
                    maxHourlyTransactions > 0
                      ? (item.transactions /
                          maxHourlyTransactions) *
                        100
                      : 0;

                  return (
                    <div
                      key={item.hour}
                      className="flex items-center gap-3"
                    >
                      <span className="w-12 text-xs text-slate-500">
                        {String(item.hour).padStart(2, "0")}:00
                      </span>

                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${width}%`,
                          }}
                        />
                      </div>

                      <span className="w-8 text-right text-xs font-medium text-slate-700">
                        {item.transactions}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">
              Merchant Infrastructure
            </h2>

            <p className="text-sm text-slate-500">
              Current platform merchant and terminal coverage.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Registered Merchants
              </span>

              <span className="font-semibold text-slate-900">
                {metrics.merchantInfrastructure.registeredMerchants}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                Active Terminals
              </span>

              <span className="font-semibold text-slate-900">
                {metrics.merchantInfrastructure.activeTerminals}
              </span>
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Terminal Coverage
                </span>

                <span className="font-semibold text-slate-900">
                  {metrics.merchantInfrastructure.terminalCoverage}%
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(
                      Math.max(
                        metrics.merchantInfrastructure
                          .terminalCoverage,
                        0
                      ),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">
              Revenue Summary
            </h2>

            <p className="text-sm text-slate-500">
              Today&apos;s platform revenue.
            </p>
          </div>

          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold text-slate-900">
                {formatCurrency(
                  metrics.revenueSummary.revenue,
                  metrics.revenueSummary.currency
                )}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {metrics.revenueSummary.currency}
              </p>
            </div>

            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Today
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">
              Transaction Status
            </h2>

            <p className="text-sm text-slate-500">
              Current transaction status distribution.
            </p>
          </div>

          {statusBreakdown.length === 0 ? (
            <div className="mt-6 flex min-h-32 items-center justify-center rounded-lg bg-slate-50 text-center">
              <p className="text-sm text-slate-500">
                No transaction status data available.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {statusBreakdown.map((item) => {
                const percentage =
                  totalStatusTransactions > 0
                    ? (item.count /
                        totalStatusTransactions) *
                      100
                    : 0;

                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between gap-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyles(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>

                      <span className="text-sm font-semibold text-slate-900">
                        {item.count.toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>

                    <p className="mt-1 text-right text-xs text-slate-500">
                      {percentage.toFixed(1)}%
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
