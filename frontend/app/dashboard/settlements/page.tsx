"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useSettlements } from "@/features/exchange/hooks/use-settlements";
import { formatCrypto, formatFiat } from "@/features/exchange/lib/format";
import { SettlementStatusBadge } from "@/components/settlements/settlement-status-badge";

export default function SettlementsPage() {
  const { data, isLoading, isError, error, refetch } = useSettlements();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">SmartPOS</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Settlement Operations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Follow each real payment from the selected Paystack account through exchange execution and blockchain settlement.
          </p>
        </div>
        <button onClick={() => refetch()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-600">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading settlements...
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mr-2 inline h-4 w-4" /> {error instanceof Error ? error.message : "Unable to load settlements."}
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">No settlements yet</h2>
          <p className="mt-2 text-sm text-slate-600">Completed crypto payment settlements will appear here.</p>
          <Link href="/dashboard/payments/new" className="mt-4 inline-flex text-sm font-medium text-blue-700 hover:text-blue-800">Create a payment <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4">
          {data.map((settlement) => (
            <Link key={settlement.id} href={`/dashboard/settlements/${settlement.id}`} className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">Payment {settlement.payment.id}</h2>
                    <SettlementStatusBadge status={settlement.settlement.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Created {new Date(settlement.payment.createdAt).toLocaleString()}</p>
                </div>
                <ArrowRight className="hidden h-5 w-5 text-slate-400 lg:block" />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div><p className="text-xs text-slate-500">Payment</p><p className="mt-1 font-medium text-slate-900">{formatFiat(settlement.payment.amount, settlement.payment.currency)}</p><p className="text-xs text-slate-500">{settlement.payment.status}</p></div>
                <div><p className="text-xs text-slate-500">Paystack account</p><p className="mt-1 font-medium text-slate-900">{settlement.paymentProviderAccount?.displayName || "Unavailable"}</p><p className="text-xs text-slate-500">{settlement.paymentProviderAccount?.status || "Not recorded"}</p></div>
                <div><p className="text-xs text-slate-500">Acquired crypto</p><p className="mt-1 font-medium text-slate-900">{settlement.conversion ? `${formatCrypto(settlement.conversion.acquiredAmount, 6)} ${settlement.conversion.toCurrency}` : "Not available"}</p></div>
                <div><p className="text-xs text-slate-500">Exchange order</p><p className="mt-1 break-all font-mono text-xs text-slate-900">{settlement.order?.providerOrderId || settlement.order?.id || "Not available"}</p><p className="text-xs text-slate-500">{settlement.order?.status || "Not recorded"}</p></div>
                <div><p className="text-xs text-slate-500">Blockchain</p><p className="mt-1 font-medium text-slate-900">{settlement.blockchain?.network || "Not broadcast"}</p><p className="text-xs text-slate-500">{settlement.blockchain ? `${settlement.blockchain.confirmations} confirmations` : "Waiting for transaction"}</p></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
