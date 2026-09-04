"use client";

import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  Plus,
  Wallet,
} from "lucide-react";
import { usePaymentIntents } from "@/features/payment-intents/hooks/use-payment-intents";

export default function PaymentsPage() {
  const { data: paymentIntents, isLoading: paymentsLoading } = usePaymentIntents();

  const payments = paymentIntents?.data || [];

  return (
    <div className="space-y-6 bg-slate-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">
            SmartPOS
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Payments
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Create customer payments and send customers to secure Flutterwave card checkout.
          </p>
        </div>

        <Link
          href="/dashboard/payments/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New payment
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <CreditCard className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                Create a payment
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Set the amount, fiat currency, and customer details for the payment request.
              </p>

              <Link
                href="/dashboard/payments/new"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                Start a payment
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-700">
              <Wallet className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                Saved wallets
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Manage the existing public wallet
                addresses used as crypto
                settlement destinations.
              </p>

              <Link
                href="/dashboard/wallets"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                Open wallets
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Payment History</h2>
          <p className="mt-1 text-sm text-slate-500">Recent payments you've created</p>
        </div>

        {paymentsLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading payments...</div>
        )}

        {!paymentsLoading && (!payments || payments.length === 0) && (
          <div className="p-8 text-center text-sm text-slate-500">
            <p>No payments yet. Create your first payment to get started.</p>
            <Link href="/dashboard/payments/new" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800">
              <Plus className="h-4 w-4" />
              Create Payment
            </Link>
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
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Payment workflow
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              SmartPOS creates the payment session and sends the customer to Flutterwave for card payment.
            </p>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Card checkout via Flutterwave
          </div>
        </div>
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