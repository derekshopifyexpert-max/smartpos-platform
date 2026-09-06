"use client";

import Link from "next/link";
import {
  Plus,
} from "lucide-react";
import { usePaymentIntents } from "@/features/payment-intents/hooks/use-payment-intents";

export default function PaymentsPage() {
  const { data: paymentIntents, isLoading: paymentsLoading } = usePaymentIntents();

  const payments = paymentIntents?.items ?? [];

  return (
    <div className="space-y-6 bg-slate-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Payments
          </h1>
        </div>

        <Link
          href="/dashboard/payments/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New payment
        </Link>
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
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Created</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.map((payment: any) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
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
                      <Link href={`/dashboard/payment-intents/${payment.id}`} className="text-sm font-medium text-blue-700 hover:text-blue-800">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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