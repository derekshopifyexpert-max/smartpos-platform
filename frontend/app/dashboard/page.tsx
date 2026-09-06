"use client";

import Link from "next/link";
import {
  CreditCard,
  Plus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

import { useDashboardMetrics } from "@/features/dashboard/hooks/use-dashboard-metrics";

function formatCurrency(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
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
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>

        <div className="shrink-0 rounded-lg bg-slate-100 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">{description}</p>
    </div>
  );
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
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Try Again
        </button>
      </div>
    );
  }

  const platformStatus = metrics.apiConnected ? "Connected" : "Unavailable";
  const platformStatusClasses = metrics.apiConnected
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className="space-y-6">
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
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <Plus className="h-4 w-4" />
            New Payment
          </Link>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
        <StatCard
          title="Settled Revenue"
          value={
            metrics.currencySummaries.length > 0
              ? metrics.currencySummaries
                  .map((summary) => formatCurrency(summary.revenue, summary.currency))
                  .join(" | ")
              : "No settled revenue"
          }
          description="Settled revenue in last 24 hours"
          icon={TrendingUp}
        />

        <StatCard
          title="Transactions Today"
          value={
            metrics.currencySummaries.length > 0
              ? metrics.currencySummaries
                  .map((summary) => `${summary.transactions.toLocaleString()} ${summary.currency}`)
                  .join(" | ")
              : "0"
          }
          description="Successful payments today by currency"
          icon={CreditCard}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Platform status
            </h2>

            <p className="text-sm text-slate-500">
              Current SmartPOS platform overview.
            </p>
          </div>

          <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${platformStatusClasses}`}>
            {platformStatus}
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.currencySummaries.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
              No successful transactions recorded today.
            </div>
          ) : (
            metrics.currencySummaries.map((summary) => (
              <div key={summary.currency} className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">
                  {summary.currency}
                </p>

                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatCurrency(summary.revenue, summary.currency)}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {summary.transactions.toLocaleString()} successful transactions
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}