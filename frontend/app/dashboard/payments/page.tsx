"use client";

import Link from "next/link";
import {
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { usePaymentIntents } from "@/features/payment-intents/hooks/use-payment-intents";
import { deletePaymentIntents } from "@/features/payment-intents/services/payment-intent.service";
import { getApiErrorMessage } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth.store";

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { data: paymentIntents, isLoading: paymentsLoading } = usePaymentIntents();

  const payments = paymentIntents?.items ?? [];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [deleteEmail, setDeleteEmail] = useState(user?.email ?? "");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const allSelected = useMemo(
    () => payments.length > 0 && selectedIds.length === payments.length,
    [payments, selectedIds],
  );

  const openDeleteDialog = (ids: string[]) => {
    setPendingDeleteIds(ids);
    setDeleteEmail(user?.email ?? "");
    setDeletePassword("");
    setDeleteError(null);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteEmail.trim() || deletePassword.length < 8) {
      setDeleteError("Enter your current email and password.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deletePaymentIntents({
        currentEmail: deleteEmail.trim(),
        currentPassword: deletePassword,
        ids: pendingDeleteIds,
      });

      await queryClient.invalidateQueries({ queryKey: ["payment-intents"] });
      setSelectedIds([]);
      setPendingDeleteIds([]);
      setShowDeleteDialog(false);
      setDeletePassword("");
    } catch (requestError) {
      setDeleteError(getApiErrorMessage(requestError, "Unable to delete payment."));
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (paymentId: string) => {
    setSelectedIds((current) =>
      current.includes(paymentId)
        ? current.filter((id) => id !== paymentId)
        : [...current, paymentId],
    );
  };

  return (
    <div className="space-y-6 bg-slate-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Payments
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => openDeleteDialog(selectedIds)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete selected ({selectedIds.length})
            </button>
          )}

          <Link
            href="/dashboard/payments/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New payment
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {paymentsLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading payments...</div>
        )}

        {!paymentsLoading && (!payments || payments.length === 0) && (
          <div className="p-8 text-center text-sm text-slate-500">
            No payments yet.
          </div>
        )}

        {!paymentsLoading && payments && payments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={allSelected}
                      onChange={() =>
                        setSelectedIds((current) =>
                          current.length === payments.length
                            ? []
                            : payments.map((payment) => payment.id),
                        )
                      }
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Created</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.map((payment: any) => (
                  <tr key={payment.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.includes(payment.id)}
                        onChange={() => toggleSelect(payment.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-sm font-medium text-slate-900">{payment.id.slice(0, 8)}...</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {payment.amount} {payment.currency}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/dashboard/payment-intents/${payment.id}`} className="text-sm font-medium text-blue-700 hover:text-blue-800">
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => openDeleteDialog([payment.id])}
                          className="inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Delete payment{pendingDeleteIds.length > 1 ? "s" : ""}
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close delete dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Confirm your current email and password to delete {pendingDeleteIds.length} payment{pendingDeleteIds.length > 1 ? "s" : ""}.
            </p>

            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Email
                <input
                  value={deleteEmail}
                  onChange={(event) => setDeleteEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  type="email"
                  placeholder="admin@example.com"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Password
                <input
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                  type="password"
                  placeholder="Current password"
                />
              </label>

              {deleteError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {deleteError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteDialog(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toUpperCase();
  
  const statusStyles =
    normalizedStatus === 'SETTLED' || normalizedStatus === 'CAPTURED' || normalizedStatus === 'AUTHORIZED'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalizedStatus === 'PENDING'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : normalizedStatus === 'FAILED'
      ? 'border-red-200 bg-red-50 text-red-700'
      : normalizedStatus === 'CANCELLED'
      ? 'border-slate-200 bg-slate-100 text-slate-700'
      : 'border-blue-200 bg-blue-50 text-blue-700';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles}`}>
      {normalizedStatus}
    </span>
  );
}