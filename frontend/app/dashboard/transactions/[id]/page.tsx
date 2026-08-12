"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Store,
  Terminal,
} from "lucide-react";
import { useParams } from "next/navigation";

import { useTransaction } from "@/features/transactions/hooks/use-transaction";

export default function TransactionDetailPage() {
  const params = useParams();

  const id = String(params.id);

  const {
    data: transaction,
    isLoading,
    isError,
  } = useTransaction(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-10 w-72 animate-pulse rounded bg-slate-200" />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
        </div>

        <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (isError || !transaction) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Transactions
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Unable to load this transaction.
        </div>
      </div>
    );
  }

  const status =
    transaction.status?.toUpperCase() ?? "UNKNOWN";

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/transactions"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Transactions
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <p className="text-sm font-medium text-blue-600">
                Transaction
              </p>

              <StatusBadge status={status} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {transaction.reference ??
                transaction.id}
            </h1>

            <p className="mt-2 font-mono text-sm text-slate-500">
              {transaction.id}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Transaction Date
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDate(transaction.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <SummaryCard
          label="Amount"
          value={formatAmount(
            transaction.amount,
            transaction.currency
          )}
          icon={<CreditCard size={20} />}
        />

        <SummaryCard
          label="Merchant"
          value={
            transaction.merchant?.name ??
            transaction.merchantId ??
            "-"
          }
          icon={<Store size={20} />}
        />

        <SummaryCard
          label="Payment Method"
          value={
            transaction.paymentMethod ??
            "-"
          }
          icon={<CreditCard size={20} />}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Transaction Information
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Core information associated with this transaction.
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem
            label="Transaction ID"
            value={transaction.id}
            mono
          />

          <InfoItem
            label="Reference"
            value={
              transaction.reference ??
              "-"
            }
            mono
          />

          <InfoItem
            label="Merchant"
            value={
              transaction.merchant?.name ??
              transaction.merchantId ??
              "-"
            }
          />

          <InfoItem
            label="Terminal ID"
            value={
              transaction.terminal?.serialNumber ??
              transaction.terminalId ??
              "-"
            }
          />

          <InfoItem
            label="Customer ID"
            value={
              transaction.customerId ??
              "-"
            }
          />

          <InfoItem
            label="Payment Intent ID"
            value={
              transaction.paymentIntentId ??
              "-"
            }
            mono
          />

          <InfoItem
            label="Amount"
            value={formatAmount(
              transaction.amount,
              transaction.currency
            )}
          />

          <InfoItem
            label="Currency"
            value={transaction.currency}
          />

          <InfoItem
            label="Status"
            value={status}
          />

          <InfoItem
            label="Type"
            value={
              transaction.type ??
              "-"
            }
          />

          <InfoItem
            label="Payment Method"
            value={
              transaction.paymentMethod ??
              "-"
            }
          />

          <InfoItem
            label="Gateway"
            value={
              transaction.gatewayProvider ??
              "-"
            }
          />

          <InfoItem
            label="Gateway Transaction"
            value={
              transaction.gatewayTransactionId ??
              "-"
            }
            mono
          />

          <InfoItem
            label="Payment URL"
            value={
              transaction.gatewayRequest
                ?.response
                ?.responseBody
                ?.paymentUrl ??
              "-"
            }
          />

          <InfoItem
            label="Created"
            value={formatDate(
              transaction.createdAt
            )}
          />

          <InfoItem
            label="Updated"
            value={
              transaction.updatedAt
                ? formatDate(
                    transaction.updatedAt
                  )
                : "-"
            }
          />

          <InfoItem
            label="Settlement Status"
            value={
              transaction.settlementStatus ??
              "-"
            }
          />

          <InfoItem
            label="Settlement Amount"
            value={
              transaction.settlementAmount !=
              null
                ? formatAmount(
                    transaction.settlementAmount,
                    transaction.settlementCurrency ??
                      transaction.currency
                  )
                : "-"
            }
          />

          <InfoItem
            label="Settlement Date"
            value={
              transaction.settlementDate
                ? formatDate(
                    transaction.settlementDate
                  )
                : "-"
            }
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <Store size={20} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Merchant
                </h2>

                <p className="text-sm text-slate-500">
                  Merchant associated with this transaction.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <InfoItem
              label="Business Name"
              value={
                transaction.merchant?.name ??
                "-"
              }
            />

            <InfoItem
              label="Merchant ID"
              value={
                transaction.merchantId ??
                "-"
              }
              mono
            />

            <InfoItem
              label="Email"
              value={
                transaction.merchantId ??
                "-"
              }
            />

            <InfoItem
              label="Phone"
              value={
                transaction.terminal?.serialNumber ??
                "-"
              }
            />

            {transaction.merchantId && (
              <Link
                href={`/dashboard/merchants/${transaction.merchantId}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                View Merchant
                <ExternalLink size={14} />
              </Link>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <Terminal size={20} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Terminal
                </h2>

                <p className="text-sm text-slate-500">
                  POS terminal associated with this transaction.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <InfoItem
              label="Terminal"
              value={
                transaction.terminal?.serialNumber ??
                transaction.terminalId ??
                "-"
              }
            />

            <InfoItem
              label="Terminal ID"
              value={
                transaction.terminalId ??
                "-"
              }
              mono
            />

            <InfoItem
              label="Status"
              value="-"
            />

            <InfoItem
              label="Last Activity"
              value={formatDate(
                transaction.createdAt
              )}
            />
          </div>
        </section>
      </div>

      {transaction.description && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Description
            </h2>
          </div>

          <div className="p-6 text-sm text-slate-700">
            {transaction.description}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">
          {label}
        </p>

        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          {icon}
        </div>
      </div>

      <p className="mt-4 truncate text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-sm font-medium text-slate-900 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status.toUpperCase();

  const styles =
    normalized === "SETTLED" ||
    normalized === "SUCCESS" ||
    normalized === "SUCCEEDED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "PENDING"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : normalized === "FAILED"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}
    >
      {normalized}
    </span>
  );
}

function formatAmount(
  amount: number | string,
  currency: string
) {
  const numericAmount =
    Number(amount);

  if (
    Number.isNaN(
      numericAmount
    )
  ) {
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
    ).format(
      numericAmount
    );
  } catch {
    return `${numericAmount.toLocaleString()} ${currency}`;
  }
}

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date.toLocaleString();
}
