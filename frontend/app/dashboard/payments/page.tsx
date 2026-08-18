"use client";

import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  Plus,
  Wallet,
} from "lucide-react";
import { useSettlements } from "@/features/exchange/hooks/use-settlements";
import { SettlementStatusBadge } from "@/components/settlements/settlement-status-badge";

export default function PaymentsPage() {
  const { data: settlements, isLoading: settlementsLoading } = useSettlements();

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
            Create customer payments and
            configure the saved settlement
            destination used by the payment
            flow.
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
                Set the amount, fiat currency,
                crypto asset, network, customer
                email, and saved destination
                wallet.
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

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Payment workflow
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              SmartPOS creates the payment session
              using the merchant's selected saved
              wallet. The destination address comes
              from the backend wallet record.
            </p>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Saved wallet required
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Crypto settlement operations</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Payments with real crypto settlement records appear here with their current backend status.
            </p>
          </div>
          <Link href="/dashboard/settlements" className="text-sm font-medium text-blue-700 hover:text-blue-800">
            Open all settlements
          </Link>
        </div>

        {settlementsLoading && <p className="mt-5 text-sm text-slate-500">Loading settlement status...</p>}
        {!settlementsLoading && settlements?.length === 0 && <p className="mt-5 text-sm text-slate-500">No crypto settlement records for these payments.</p>}
        {!settlementsLoading && settlements && settlements.length > 0 && (
          <div className="mt-5 grid gap-3">
            {settlements.slice(0, 5).map((settlement) => (
              <Link key={settlement.id} href={`/dashboard/settlements/${settlement.id}`} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 hover:border-blue-300 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Payment {settlement.payment.id}</p>
                  <p className="mt-1 text-xs text-slate-500">Payment status: {settlement.payment.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Settlement</span>
                  <SettlementStatusBadge status={settlement.settlement.status} />
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}