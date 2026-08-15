"use client";

import Link from "next/link";
import {
  CreditCard,
  Plus,
  RefreshCw,
  Store,
  Terminal,
  TrendingUp,
} from "lucide-react";

import { useDashboardMetrics } from "@/features/dashboard/hooks/use-dashboard-metrics";

function formatCurrency(amount: number, currency = "USD") {
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

  const currency = metrics.revenueSummary?.currency || "USD";

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(metrics.revenue, currency)}
          description="Settled revenue today"
          icon={TrendingUp}
        />

        <StatCard
          title="Transactions Today"
          value={metrics.transactionsToday.toLocaleString()}
          description="Payments processed today"
          icon={CreditCard}
        />

        <StatCard
          title="Total Merchants"
          value={metrics.totalMerchants.toLocaleString()}
          description="Registered merchants"
          icon={Store}
        />

        <StatCard
          title="Active Terminals"
          value={metrics.activeTerminals.toLocaleString()}
          description={`${metrics.terminalCoverage}% terminal coverage`}
          icon={Terminal}
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

          <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Operational
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">
              Revenue
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatCurrency(metrics.revenue, currency)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">
              Transactions
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-900">
              {metrics.transactionsToday.toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">
              Terminal coverage
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-900">
              {metrics.terminalCoverage}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}