"use client";

import { useEffect } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { formatCrypto } from "@/features/exchange/lib/format";
import { useProviderBalance } from "@/features/exchange/hooks/use-exchange";

export interface ProviderBalanceDisplayProps {
  asset?: string;
}

export function ProviderBalanceDisplay({
  asset = "USDT",
}: ProviderBalanceDisplayProps) {
  const { data: balance, isPending, error } = useProviderBalance(asset);

  if (isPending && !balance) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Quidax Balance</h3>
        </div>
        <div className="flex items-center justify-center h-12">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !balance) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">Quidax Balance</h3>
            <p className="text-sm text-amber-700 mt-1">
              {error instanceof Error
                ? error.message
                : "Quidax balance unavailable. The provider is currently unreachable."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Quidax Balance</h3>

      <div className="space-y-3">
        {/* Available Balance */}
        <div>
          <p className="text-xs text-slate-600 uppercase tracking-wide">Available</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {formatCrypto(balance.available, 2)} {balance.asset}
          </p>
        </div>

        {/* Total Balance */}
        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-600 uppercase tracking-wide">Total</p>
          <p className="text-sm font-medium text-slate-700 mt-1">
            {formatCrypto(balance.total, 2)} {balance.asset}
          </p>
        </div>

        {/* Reserved (if applicable) */}
        {balance.reserved && parseFloat(balance.reserved) > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-600 uppercase tracking-wide">Reserved</p>
            <p className="text-sm font-medium text-slate-700 mt-1">
              {formatCrypto(balance.reserved, 2)} {balance.asset}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
