"use client";

import { AlertCircle, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import type { SettlementStatus } from "@/features/crypto/types/settlement";

export interface SettlementStatusCardProps {
  status?: SettlementStatus;
  isLoading?: boolean;
  error?: string;
}

export function SettlementStatusCard({
  status,
  isLoading,
  error,
}: SettlementStatusCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Checking settlement status</p>
            <p className="text-xs text-slate-500">Waiting for backend state...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Settlement unavailable</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Settlement not started yet.</p>
      </div>
    );
  }

  const txHash = status.blockchainTransaction?.txHash;
  const confirmations = status.blockchainTransaction?.confirmations ?? 0;
  const statusLabel = status.progress?.stage || "payment_pending";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Blockchain settlement</h3>
        {status.progress?.completed ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Clock3 className="h-5 w-5 text-slate-400" />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600">Stage</span>
          <span className="font-medium text-slate-900 capitalize">{statusLabel.replace(/_/g, " ")}</span>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600">Status</span>
          <span className="font-medium text-slate-900">{status.conversion.status}</span>
        </div>

        {txHash ? (
          <div className="flex justify-between items-center text-sm break-all">
            <span className="text-slate-600">Transaction hash</span>
            <span className="font-medium text-slate-900">{txHash.slice(0, 10)}...</span>
          </div>
        ) : (
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Transaction hash</span>
            <span className="font-medium text-slate-500">Not broadcast yet</span>
          </div>
        )}

        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600">Confirmations</span>
          <span className="font-medium text-slate-900">{confirmations}</span>
        </div>
      </div>
    </div>
  );
}
