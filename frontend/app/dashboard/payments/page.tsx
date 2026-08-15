"use client";

import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  Plus,
  Wallet,
} from "lucide-react";

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            SmartPOS
          </p>

          <h1 className="text-3xl font-bold text-slate-900">
            Payments
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Create and manage customer payments.
          </p>
        </div>

        <Link
          href="/dashboard/payments/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Payment
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <CreditCard className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                New payment
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Create a payment, choose the destination wallet,
                and continue to the secure Paystack checkout.
              </p>

              <Link
                href="/dashboard/payments/new"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 transition-colors hover:text-blue-800"
              >
                Start a payment
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                Saved wallets
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Manage the existing wallets used as destinations
                for crypto settlement.
              </p>

              <Link
                href="/dashboard/wallets"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 transition-colors hover:text-blue-800"
              >
                Open wallets
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}