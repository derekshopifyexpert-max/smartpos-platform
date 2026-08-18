"use client";

import { CheckCircle, Clock, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { formatCrypto } from "@/features/exchange/lib/format";

export interface SettlementStatusCardProps {
  orderId?: string;
  isLoading?: boolean;
  error?: string;
  settlement?: {
    status: "PENDING" | "BROADCASTED" | "CONFIRMING" | "CONFIRMED" | "FAILED" | "SETTLED";
    transactionHash?: string;
    confirmations?: number;
    requiredConfirmations?: number;
    destinationWallet?: {
      id: string;
      name: string;
      address: string;
      network: string;
      asset: string;
    };
    amount?: string;
    updatedAt?: string;
  };
}

const statusColors: Record<string, { bg: string; text: string; icon: any; description: string }> = {
  PENDING: { 
    bg: "bg-gray-50", 
    text: "text-gray-700", 
    icon: Clock,
    description: "Waiting to broadcast blockchain transaction"
  },
  BROADCASTED: { 
    bg: "bg-blue-50", 
    text: "text-blue-700", 
    icon: Loader2,
    description: "Transaction broadcast to blockchain"
  },
  CONFIRMING: { 
    bg: "bg-amber-50", 
    text: "text-amber-700", 
    icon: Clock,
    description: "Awaiting blockchain confirmations"
  },
  CONFIRMED: { 
    bg: "bg-green-50", 
    text: "text-green-700", 
    icon: CheckCircle,
    description: "Blockchain transaction confirmed"
  },
  SETTLED: { 
    bg: "bg-green-50", 
    text: "text-green-700", 
    icon: CheckCircle,
    description: "Settlement complete"
  },
  FAILED: { 
    bg: "bg-red-50", 
    text: "text-red-700", 
    icon: AlertCircle,
    description: "Settlement failed"
  },
};

function getExplorerUrl(txHash: string, network: string): string {
  const networks: Record<string, string> = {
    ethereum: "https://etherscan.io/tx",
    bsc: "https://bscscan.com/tx",
    polygon: "https://polygonscan.com/tx",
    arbitrum: "https://arbiscan.io/tx",
    optimism: "https://optimistic.etherscan.io/tx",
  };
  
  const baseUrl = networks[network?.toLowerCase()] || "https://etherscan.io/tx";
  return `${baseUrl}/${txHash}`;
}

export function SettlementStatusCardImproved({
  orderId,
  isLoading,
  error,
  settlement,
}: SettlementStatusCardProps) {
  if (!orderId && !settlement) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Settlement Status</h3>
        <div className="text-sm text-slate-500 p-4 bg-slate-50 rounded-lg">
          Settlement will appear after BUY order is filled.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <h3 className="text-sm font-semibold text-slate-900">Loading settlement status...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Settlement Status</h3>
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Settlement Status</h3>
        <div className="text-sm text-slate-500 p-4 bg-slate-50 rounded-lg">
          No settlement data available yet.
        </div>
      </div>
    );
  }

  const statusConfig = statusColors[settlement.status] || statusColors.PENDING;
  const StatusIcon = statusConfig.icon;
  const isTerminal = ["SETTLED", "CONFIRMED", "FAILED"].includes(settlement.status);
  const displayConfirmations = settlement.confirmations || 0;
  const displayRequired = settlement.requiredConfirmations || 12;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Settlement Status</h3>
          <p className="text-xs text-slate-500 mt-1">{statusConfig.description}</p>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bg}`}>
          {!isTerminal ? (
            <Loader2 className={`h-4 w-4 animate-spin ${statusConfig.text}`} />
          ) : (
            <StatusIcon className={`h-4 w-4 ${statusConfig.text}`} />
          )}
          <span className={statusConfig.text}>{settlement.status}</span>
        </div>
      </div>

      <div className="space-y-4 text-sm">
        {/* Destination Wallet */}
        {settlement.destinationWallet && (
          <>
            <div className="pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Destination Wallet</p>
                <p className="font-medium text-slate-900">{settlement.destinationWallet.name}</p>
                <p className="text-xs text-slate-500 font-mono mt-1 break-all">
                  {settlement.destinationWallet.address}
                </p>
                <div className="flex gap-3 mt-2">
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                    {settlement.destinationWallet.network}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                    {settlement.destinationWallet.asset}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Amount */}
        {settlement.amount && (
          <div className="pb-4 border-b border-slate-200">
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Settlement Amount</p>
            <p className="font-medium text-slate-900">
              {formatCrypto(settlement.amount, 2)} USDT
            </p>
          </div>
        )}

        {/* Transaction Hash */}
        {settlement.transactionHash && (
          <div className="pb-4 border-b border-slate-200">
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Transaction Hash</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-900 font-mono break-all pr-2">
                {settlement.transactionHash.slice(0, 16)}...{settlement.transactionHash.slice(-8)}
              </p>
              <a
                href={getExplorerUrl(settlement.transactionHash, settlement.destinationWallet?.network || "ethereum")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                title="View on explorer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {/* Confirmations */}
        {settlement.status === "CONFIRMING" && (
          <div className="pb-4 border-b border-slate-200">
            <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">Confirmations</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">
                  {displayConfirmations} / {displayRequired}
                </span>
                <span className="text-xs text-slate-500">
                  {Math.round((displayConfirmations / displayRequired) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${Math.min((displayConfirmations / displayRequired) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {settlement.status === "CONFIRMED" && (
          <div className="text-xs text-green-600 font-medium px-3 py-2 bg-green-50 rounded">
            ✓ All confirmations received
          </div>
        )}

        {/* Last Updated */}
        {settlement.updatedAt && (
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
            Last updated {new Date(settlement.updatedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
