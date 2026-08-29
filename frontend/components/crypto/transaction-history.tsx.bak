"use client";

import { useState } from "react";
import { Loader2, ChevronRight, AlertCircle } from "lucide-react";
import { formatCrypto, formatFiat } from "@/features/exchange/lib/format";
import { useTransactionHistory } from "@/features/exchange/hooks/use-transaction-history";

export interface TransactionHistoryProps {
  onSelectTransaction?: (orderId: string) => void;
}

const statusColors: Record<string, string> = {
  FILLED: "bg-green-100 text-green-800",
  PARTIALLY_FILLED: "bg-amber-100 text-amber-800",
  PENDING: "bg-blue-100 text-blue-800",
  OPEN: "bg-blue-100 text-blue-800",
  CANCELED: "bg-gray-100 text-gray-800",
  REJECTED: "bg-red-100 text-red-800",
  FAILED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-800",
};

const settlementStatusColors: Record<string, string> = {
  SETTLED: "bg-green-50 text-green-700",
  CONFIRMED: "bg-green-50 text-green-700",
  CONFIRMING: "bg-blue-50 text-blue-700",
  BROADCASTED: "bg-blue-50 text-blue-700",
  PENDING: "bg-gray-50 text-gray-700",
  FAILED: "bg-red-50 text-red-700",
};

export function TransactionHistory({ onSelectTransaction }: TransactionHistoryProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useTransactionHistory(page, 10);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <h3 className="text-sm font-semibold text-slate-900">Loading transaction history...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Transaction History</h3>
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">Failed to load transaction history</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Transaction History</h3>
        <div className="text-center py-8">
          <p className="text-sm text-slate-500">No transactions yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Transaction History</h3>
        <p className="text-xs text-slate-500 mt-1">
          Showing {data.items.length} of {data.total} transactions
        </p>
      </div>

      <div className="divide-y divide-slate-200">
        {data.items.map((transaction) => (
          <button
            key={transaction.id}
            onClick={() => onSelectTransaction?.(transaction.orderId)}
            className="w-full px-6 py-4 text-left hover:bg-slate-50 transition-colors flex items-start justify-between group"
          >
            <div className="min-w-0 flex-1">
              {/* Header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    {transaction.type === "BUY" ? "Buy USDT" : "Sell USDT"}
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        statusColors[transaction.status] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {transaction.status}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-1">{transaction.orderId}</p>
                </div>
              </div>

              {/* Amount */}
              <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Requested</p>
                  <p className="font-medium text-slate-900">
                    {formatCrypto(transaction.requestedAmount, 2)} USDT
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Executed</p>
                  <p className="font-medium text-slate-900">
                    {formatCrypto(transaction.executedAmount, 2)} USDT
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Avg Price</p>
                  <p className="font-medium text-slate-900">
                    {formatCrypto(transaction.avgPrice, 6)}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{new Date(transaction.createdAt).toLocaleDateString()}</span>
                {transaction.provider && <span>{transaction.provider}</span>}
                {transaction.type === "BUY" && transaction.settlementStatus && (
                  <span
                    className={`px-2 py-0.5 rounded font-medium ${
                      settlementStatusColors[transaction.settlementStatus] ||
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    Settlement: {transaction.settlementStatus}
                  </span>
                )}
              </div>

              {/* Destination Wallet for BUY */}
              {transaction.type === "BUY" && transaction.destinationWallet && (
                <p className="text-xs text-slate-500 mt-2">
                  → {transaction.destinationWallet.name} ({transaction.destinationWallet.network})
                </p>
              )}
            </div>

            <ChevronRight className="h-5 w-5 text-slate-400 mt-1 flex-shrink-0 group-hover:text-slate-600 transition-colors" />
          </button>
        ))}
      </div>

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-xs text-slate-600">
            Page {data.page} of {data.pages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm font-medium text-slate-900 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(data.pages, page + 1))}
              disabled={page === data.pages}
              className="px-3 py-1.5 text-sm font-medium text-slate-900 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
