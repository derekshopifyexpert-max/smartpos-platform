"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useQuidaxStatus } from "@/features/exchange/hooks/use-quidax-status";

export function QuidaxProviderStatus() {
  const { data, isLoading, error } = useQuidaxStatus();

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Quidax connection</h2>
          <p className="mt-1 text-xs text-slate-500">Provider execution and balances are server-side.</p>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : data?.connected ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div><p className="text-xs text-slate-500">Provider</p><p className="mt-1 font-medium text-slate-900">Quidax</p></div>
        <div><p className="text-xs text-slate-500">Environment</p><p className="mt-1 font-medium capitalize text-slate-900">{data?.environment || "Unavailable"}</p></div>
        <div><p className="text-xs text-slate-500">Connection</p><p className="mt-1 font-medium text-slate-900">{data?.connected ? "Connected" : "Unavailable"}</p></div>
      </div>
      {(error || data?.error) && <p className="mt-4 text-sm text-amber-700">{data?.error || "Quidax connection unavailable."}</p>}
    </section>
  );
}
