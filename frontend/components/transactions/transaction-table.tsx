"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { useTransactions } from "@/features/transactions/hooks/use-transactions";
import {
  getTransactionRetention,
  setTransactionRetention,
} from "@/features/transactions/services/transaction.service";

export function TransactionTable() {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [retentionEnabled, setRetentionEnabled] = useState(true);
  const [isUpdatingRetention, setIsUpdatingRetention] = useState(false);

  const limit = 10;

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useTransactions(page, limit);

  const transactions = data?.items ?? [];
  const pagination = data?.pagination;

  useEffect(() => {
    void getTransactionRetention()
      .then((settings) => setRetentionEnabled(settings.enabled))
      .catch(() => setRetentionEnabled(true));
  }, []);

  const filteredTransactions = transactions;

  async function handleRetentionToggle() {
    setIsUpdatingRetention(true);
    try {
      const settings = await setTransactionRetention(!retentionEnabled);
      setRetentionEnabled(settings.enabled);
    } catch {
      // Keep the displayed state unchanged when the API cannot update it.
    } finally {
      setIsUpdatingRetention(false);
    }
  }

  function formatAmount(
    amount: number | string,
    currency: string
  ) {
    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount)) {
      return `${amount} ${currency}`;
    }

    try {
      return new Intl.NumberFormat(
        "en-US",
        {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }
      ).format(numericAmount);
    } catch {
      return `${numericAmount.toLocaleString()} ${currency}`;
    }
  }

  function formatDate(
    value: string
  ) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString();
  }

  function normalizeTransactionType(value?: string | null) {
    const raw = (value ?? "Card").trim();
    if (!raw) return "Card";
    const normalized = raw.toLowerCase();
    if (normalized.includes("card")) return "Card";
    if (normalized.includes("wallet")) return "Wallet";
    return "Card";
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">
          Loading transactions...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-red-700">
          Unable to load transactions.
        </p>
        <p className="mt-2 text-sm text-red-600">
          The transaction API is unavailable or the current session is not authorized.
        </p>

        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
        >
          <RefreshCw size={15} />
          Try again
        </button>
      </div>
    );
  }

  const totalPages =
    pagination?.pages ?? 1;

  const total =
    pagination?.total ?? 0;

  const currentPage =
    pagination?.page ?? page;

  return (
    <div className="space-y-4">
      <div className="flex justify-end rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={
              isFetching
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-amber-900">
          {retentionEnabled
            ? "Transactions are automatically deleted after 7 days."
            : "Automatic deletion is turned off. Transactions will remain until manually deleted."}
        </p>

        <button
          type="button"
          role="switch"
          aria-checked={retentionEnabled}
          onClick={() => void handleRetentionToggle()}
          disabled={isUpdatingRetention}
          className={`inline-flex items-center gap-2 text-sm font-semibold ${retentionEnabled ? "text-amber-800" : "text-slate-700"}`}
        >
          <span className={`relative h-6 w-11 rounded-full transition ${retentionEnabled ? "bg-amber-600" : "bg-slate-300"}`}>
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${retentionEnabled ? "left-6" : "left-1"}`} />
          </span>
          {retentionEnabled ? "On" : "Off"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Transaction
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center"
                  >
                    <p className="text-sm font-medium text-slate-700">
                      No transactions yet.
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Transactions will appear here after a payment is created.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(
                  (transaction) => (
                    <tr
                      key={transaction.id}
                      onClick={() =>
                        router.push(
                          `/dashboard/transactions/${transaction.id}`
                        )
                      }
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <p className="max-w-[220px] truncate text-sm font-semibold text-slate-900">
                          {transaction.reference ??
                            transaction.id}
                        </p>

                        <p className="mt-1 max-w-[220px] truncate font-mono text-xs text-slate-500">
                          {transaction.id}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatAmount(
                          transaction.amount,
                          transaction.currency
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {normalizeTransactionType(transaction.type)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {transaction.paymentMethod ??
                          "-"}
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge
                          status={
                            transaction.status
                          }
                        />
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {formatDate(
                          transaction.createdAt
                        )}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-700">
              {filteredTransactions.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-700">
              {total}
            </span>{" "}
            transactions
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={
                currentPage <= 1 ||
                isFetching
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="px-2 text-sm text-slate-600">
              Page{" "}
              <span className="font-semibold text-slate-900">
                {currentPage}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900">
                {totalPages}
              </span>
            </span>

            <button
              type="button"
              disabled={
                currentPage >=
                  totalPages ||
                isFetching
              }
              onClick={() =>
                setPage(
                  (current) =>
                    Math.min(
                      totalPages,
                      current + 1
                    )
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status?.toUpperCase() ??
    "UNKNOWN";

  const statusStyles =
    normalizedStatus === "SETTLED" ||
    normalizedStatus === "SUCCESS" ||
    normalizedStatus === "SUCCEEDED" ||
    normalizedStatus === "CAPTURED" ||
    normalizedStatus === "AUTHORIZED" ||
    normalizedStatus === "APPROVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalizedStatus === "PENDING" ||
          normalizedStatus === "PENDING_REVIEW"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : normalizedStatus === "FAILED" ||
            normalizedStatus === "DECLINED"
          ? "border-red-200 bg-red-50 text-red-700"
          : normalizedStatus === "CANCELLED" ||
              normalizedStatus === "CANCELED"
            ? "border-slate-200 bg-slate-100 text-slate-700"
            : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles}`}
    >
      {normalizedStatus}
    </span>
  );
}
