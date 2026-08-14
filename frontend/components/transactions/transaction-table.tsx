"use client";

import { useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { useTransactions } from "@/features/transactions/hooks/use-transactions";

export function TransactionTable() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

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

  const filteredTransactions = (() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        transaction.status?.toUpperCase() === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableValues = [
        transaction.id,
        transaction.reference,
        transaction.merchant?.name,
        transaction.merchantId,
        transaction.type,
        transaction.paymentMethod,
        transaction.status,
        transaction.currency,
      ];

      return searchableValues.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  })();

  function handleSearchChange(
    value: string
  ) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(
    value: string
  ) {
    setStatusFilter(value);
    setPage(1);
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
          The transaction API is unavailable or the merchant session is not authorized.
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
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              handleSearchChange(
                event.target.value
              )
            }
            placeholder="Search transactions..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            handleStatusChange(
              event.target.value
            )
          }
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="ALL">
            All statuses
          </option>

          <option value="SETTLED">
            Settled
          </option>

          <option value="PENDING">
            Pending
          </option>

          <option value="FAILED">
            Failed
          </option>

          <option value="DECLINED">
            Declined
          </option>

          <option value="CANCELLED">
            Cancelled
          </option>
        </select>

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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Transaction
                </th>

                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Merchant
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
                    colSpan={7}
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

                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {transaction.merchant?.name ??
                          transaction.merchantId ??
                          "-"}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatAmount(
                          transaction.amount,
                          transaction.currency
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-700">
                        {transaction.type ??
                          "-"}
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
    normalizedStatus === "SUCCEEDED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalizedStatus === "PENDING"
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
