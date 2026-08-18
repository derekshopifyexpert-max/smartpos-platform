"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { usePaymentProviderAccounts } from "@/features/payment/hooks/use-payment-provider-accounts";

export function PaystackAccountList() {
  const { data: accounts, isLoading, error } = usePaymentProviderAccounts();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">Loading payment accounts...</p>
        </div>
      </div>
    );
  }

  if (error || !accounts || accounts.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Payment accounts</h3>
            <p className="text-sm text-amber-700 mt-1">
              No configured Paystack accounts are currently available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Payment accounts</h3>

      <div className="space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className={`rounded-xl border p-4 ${
              account.configured ? "border-green-200 bg-green-50" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{account.displayName}</p>
                <p className="mt-1 text-xs text-slate-500">{account.provider}</p>
              </div>

              {account.configured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[10px] font-medium text-green-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-700">
                  <AlertCircle className="h-3 w-3" />
                  Not configured
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span>{account.currency}</span>
              <span>•</span>
              <span>{account.status}</span>
              {account.isDefault && <span>• Default account</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
