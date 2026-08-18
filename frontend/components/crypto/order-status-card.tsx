"use client";

import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { formatCrypto, formatFiat } from "@/features/exchange/lib/format";

export interface OrderStatusCardProps {
  orderId: string;
  side: "BUY" | "SELL";
  status: string;
  requestedAmount: string;
  executedAmount: string;
  avgPrice: string;
  fee?: string;
  provider?: string;
  createdAt?: string;
  fills?: Array<{
    id: string;
    price: string;
    amount: string;
    fee: string;
    timestamp: string;
  }>;
  isLoading?: boolean;
  error?: string;
}

const statusColors: Record<string, { bg: string; text: string; icon: any }> = {
  PENDING: { bg: "bg-yellow-50", text: "text-yellow-700", icon: Clock },
  OPEN: { bg: "bg-blue-50", text: "text-blue-700", icon: Loader2 },
  PARTIALLY_FILLED: { bg: "bg-amber-50", text: "text-amber-700", icon: Clock },
  FILLED: { bg: "bg-green-50", text: "text-green-700", icon: CheckCircle },
  CANCELED: { bg: "bg-red-50", text: "text-red-700", icon: AlertCircle },
  REJECTED: { bg: "bg-red-50", text: "text-red-700", icon: AlertCircle },
  FAILED: { bg: "bg-red-50", text: "text-red-700", icon: AlertCircle },
  EXPIRED: { bg: "bg-gray-50", text: "text-gray-700", icon: AlertCircle },
};

export function OrderStatusCard({
  orderId,
  side,
  status,
  requestedAmount,
  executedAmount,
  avgPrice,
  fee,
  provider,
  createdAt,
  fills,
  isLoading,
  error,
}: OrderStatusCardProps) {
  const statusConfig = statusColors[status] || statusColors.PENDING;
  const StatusIcon = statusConfig.icon;

  const isTerminal = ["FILLED", "CANCELED", "REJECTED", "FAILED", "EXPIRED"].includes(status);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Order Details</h3>
          <p className="text-xs text-slate-500 font-mono mt-1">{orderId}</p>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bg}`}>
          {isLoading && !isTerminal ? (
            <Loader2 className={`h-4 w-4 animate-spin ${statusConfig.text}`} />
          ) : (
            <StatusIcon className={`h-4 w-4 ${statusConfig.text}`} />
          )}
          <span className={statusConfig.text}>{status}</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-4 text-sm">
        {/* Trade Info */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Side</p>
            <p className="font-medium text-slate-900">{side}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Provider</p>
            <p className="font-medium text-slate-900">{provider || "—"}</p>
          </div>
        </div>

        {/* Requested vs Executed */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Requested</p>
            <p className="font-medium text-slate-900">
              {formatCrypto(requestedAmount, 2)} {side === "BUY" ? "USDT" : "USDT"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Executed</p>
            <p className="font-medium text-slate-900">
              {formatCrypto(executedAmount, 2)} {side === "BUY" ? "USDT" : "USDT"}
            </p>
          </div>
        </div>

        {/* Price & Fee */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Avg Price</p>
            <p className="font-medium text-slate-900">{formatCrypto(avgPrice, 6)}</p>
          </div>
          {fee && (
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Fee</p>
              <p className="font-medium text-slate-900">{formatCrypto(fee, 6)} USDT</p>
            </div>
          )}
        </div>

        {/* Fills */}
        {fills && fills.length > 0 && (
          <div className="pt-2">
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-3">Fills</p>
            <div className="space-y-2">
              {fills.map((fill) => (
                <div key={fill.id} className="flex justify-between text-xs bg-slate-50 p-2 rounded">
                  <div>
                    <p className="text-slate-600">
                      {formatCrypto(fill.amount, 2)} @ {formatCrypto(fill.price, 6)}
                    </p>
                  </div>
                  <p className="text-slate-500">
                    Fee: {formatCrypto(fill.fee, 6)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Created Time */}
        {createdAt && (
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
            Created {new Date(createdAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
