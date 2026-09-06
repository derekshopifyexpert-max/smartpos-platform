"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Trash2,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTransaction } from "@/features/transactions/hooks/use-transaction";
import { deleteTransactions } from "@/features/transactions/services/transaction.service";
import { getApiErrorMessage } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth.store";

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = String(params.id);
  const user = useAuthStore((state) => state.user);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState(user?.email ?? "");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const status = transaction.status?.toUpperCase() ?? "UNKNOWN";

  async function handleDelete() {
    if (!deleteEmail.trim() || deletePassword.length < 8) {
      setDeleteError("Enter your current email and password.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteTransactions({
        currentEmail: deleteEmail.trim(),
        currentPassword: deletePassword,
        ids: [id],
      });

      await queryClient.invalidateQueries({
        queryKey: ["transactions"],
      });
      queryClient.removeQueries({
        queryKey: ["transaction", id],
      });

      router.replace("/dashboard/transactions");
    } catch (requestError) {
      setDeleteError(getApiErrorMessage(requestError, "Unable to delete transaction."));
      setIsDeleting(false);
    }
  }

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
              {transaction.reference ?? transaction.id}
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

          <button
            type="button"
            onClick={() => {
              setDeleteEmail(user?.email ?? "");
              setDeletePassword("");
              setDeleteError(null);
              setShowDeleteDialog(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete transaction
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SummaryCard
          label="Amount"
          value={formatAmount(
            transaction.amount,
            transaction.currency
          )}
          icon={<CreditCard size={20} />}
        />

        <SummaryCard
          label="Payment Method"
          value={transaction.paymentMethod ?? "-"}
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
            value={transaction.reference ?? "-"}
            mono
          />

          <InfoItem
            label="Payment Intent ID"
            value={transaction.paymentIntentId ?? "-"}
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
            value={transaction.type ?? "-"}
          />

          <InfoItem
            label="Payment Method"
            value={transaction.paymentMethod ?? "-"}
          />

          <InfoItem
            label="Created"
            value={formatDate(transaction.createdAt)}
          />

          <InfoItem
            label="Updated"
            value={
              transaction.updatedAt
                ? formatDate(transaction.updatedAt)
                : "-"
            }
          />

        </div>
      </section>

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

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-transaction-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h2 id="delete-transaction-title" className="text-lg font-semibold text-slate-900">
              Delete this transaction?
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Enter your current login details to confirm this deletion.
            </p>

            <div className="mt-5 space-y-3">
              <input
                type="email"
                value={deleteEmail}
                onChange={(event) => setDeleteEmail(event.target.value)}
                placeholder="Current email"
                autoComplete="email"
                autoFocus
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {deleteError && <p className="mt-3 text-sm text-red-600" role="alert">{deleteError}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete transaction
              </button>
            </div>
          </div>
        </div>
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
  const normalized = status.toUpperCase();

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
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toLocaleString()} ${currency}`;
  }
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}
