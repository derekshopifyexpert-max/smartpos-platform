"use client";

import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp } from "lucide-react";
import { formatCrypto, getTimeRemaining, formatTimeRemaining } from "@/features/exchange/lib/format";
import { useGetQuote } from "@/features/exchange/hooks/use-exchange";
import type { ExchangeQuote } from "@/features/exchange/types/exchange";

export interface LivePriceDisplayProps {
  asset?: string;
  currency?: string;
}

export function LivePriceDisplay({
  asset = "USDT",
  currency = "USD",
}: LivePriceDisplayProps) {
  const { mutate: getQuote, isPending, data: quote, error } = useGetQuote();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  // Fetch initial quote on mount
  useEffect(() => {
    getQuote({
      baseAsset: asset,
      quoteAsset: currency,
      side: "BUY",
      amount: "1",
      ttlSeconds: 30,
    });
  }, [asset, currency, getQuote]);

  // Update time remaining and expiry status
  useEffect(() => {
    if (!quote?.expiresAt) return;

    const interval = setInterval(() => {
      const remaining = getTimeRemaining(quote.expiresAt);
      setTimeRemaining(remaining);
      setIsExpired(remaining <= 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [quote?.expiresAt]);

  const handleRefresh = () => {
    getQuote({
      baseAsset: asset,
      quoteAsset: currency,
      side: "BUY",
      amount: "1",
      ttlSeconds: 30,
    });
  };

  if (isPending && !quote) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Live Price</h3>
          <TrendingUp className="h-4 w-4 text-slate-400" />
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-32 rounded bg-slate-200" />
          <div className="h-4 w-48 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">Live Price</h3>
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="p-1 hover:bg-red-100 rounded transition-colors"
          >
            <RefreshCw className={`h-4 w-4 text-red-600 ${isPending ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-sm text-red-700">
          {error instanceof Error
            ? error.message
            : "Live price unavailable. Exchange provider is currently unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Live Price</h3>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
          title="Refresh quote"
        >
          <RefreshCw className={`h-4 w-4 text-slate-600 ${isPending ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Price */}
        <div>
          <p className="text-sm text-slate-600 mb-1">
            {asset} / {currency}
          </p>
          <p className="text-2xl font-bold text-slate-900">
            {formatCrypto(quote.rate, 4)} {currency}
          </p>
        </div>

        {/* Provider and Fee */}
        <div className="pt-2 border-t border-slate-200 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Provider</span>
            <span className="font-medium text-slate-900 capitalize">{quote.provider}</span>
          </div>

          {quote.fee && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Fee</span>
              <span className="font-medium text-slate-900">
                {formatCrypto(quote.fee, 6)} {asset}
              </span>
            </div>
          )}
        </div>

        {/* Expiry Status */}
        <div className="pt-2 border-t border-slate-200">
          {isExpired ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Quote status</span>
              <span className="text-xs font-medium px-2 py-1 bg-red-50 text-red-700 rounded">
                Expired
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Quote valid for</span>
              <span className="text-xs font-medium px-2 py-1 bg-green-50 text-green-700 rounded">
                {formatTimeRemaining(timeRemaining)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
