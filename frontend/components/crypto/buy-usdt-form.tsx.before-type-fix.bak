"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Loader2, ArrowRight } from "lucide-react";
import {
  formatCrypto,
  formatFiat,
  calculateEstimatedCrypto,
  parseDecimal,
  getTimeRemaining,
  formatTimeRemaining,
  isQuoteExpired,
} from "@/features/exchange/lib/format";
import { useGetQuote, useBuyUsdt } from "@/features/exchange/hooks/use-exchange";
import type { ExchangeQuote, ExecuteOrderRequest } from "@/features/exchange/types/exchange";

export interface BuyUsdtFormProps {
  onSuccess?: (order: any) => void;
}

export function BuyUsdtForm({ onSuccess }: BuyUsdtFormProps) {
  const [fiatAmount, setFiatAmount] = useState<string>("1000");
  const [selectedCurrency] = useState<string>("USD");
  const [quote, setQuote] = useState<ExchangeQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Mutation for getting quote
  const {
    mutate: getQuote,
    isPending: isGettingQuote,
  } = useGetQuote();

  // Mutation for buying
  const {
    mutate: buyOrder,
    isPending: isBuying,
    error: buyError,
  } = useBuyUsdt();

  // Fetch quote when fiat amount changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fiatAmount || parseFloat(fiatAmount) <= 0) {
        setQuote(null);
        setQuoteError("");
        return;
      }

      setQuoteError("");
      getQuote(
        {
          baseAsset: "USDT",
          quoteAsset: selectedCurrency,
          side: "BUY",
          amount: fiatAmount,
          ttlSeconds: 30,
        },
        {
          onSuccess: (data) => {
            setQuote(data);
            setQuoteError("");
          },
          onError: (error) => {
            setQuote(null);
            setQuoteError(
              error instanceof Error
                ? error.message
                : "Failed to get quote"
            );
          },
        }
      );
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [fiatAmount, selectedCurrency, getQuote]);

  // Update time remaining and expiry
  useEffect(() => {
    if (!quote?.expiresAt) return;

    const interval = setInterval(() => {
      const remaining = getTimeRemaining(quote.expiresAt);
      setTimeRemaining(remaining);
      setIsExpired(remaining <= 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [quote?.expiresAt]);

  const handleBuyClick = async () => {
    if (!quote || isExpired || isBuying || submitting) return;

    setSubmitting(true);

    try {
      const clientOrderId = `BUY:${Date.now()}`;

      const request: ExecuteOrderRequest = {
        baseAsset: "USDT",
        quoteAsset: selectedCurrency,
        amount: fiatAmount,
        quoteId: quote.quoteId,
        clientOrderId,
      };

      buyOrder(request, {
        onSuccess: (order) => {
          setFiatAmount("1000");
          setQuote(null);
          onSuccess?.(order);
        },
        onError: (error) => {
          console.error("Buy order failed:", error);
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedCrypto = quote
    ? calculateEstimatedCrypto(fiatAmount, (Number(quote.amount) / Number(quote.quoteAmount)))
    : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-6">Buy USDT</h3>

      <div className="space-y-6">
        {/* Fiat Amount Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Amount to spend
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={fiatAmount}
              onChange={(e) => setFiatAmount(e.target.value)}
              placeholder="1000"
              min="0"
              step="0.01"
              disabled={isGettingQuote || isBuying}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
            <div className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 flex items-center text-sm font-medium text-slate-700">
              {selectedCurrency}
            </div>
          </div>
        </div>

        {/* Quote Status */}
        {quoteError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{quoteError}</p>
            </div>
          </div>
        )}

        {isGettingQuote && !quote && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            <p className="text-sm text-blue-700">Getting live price...</p>
          </div>
        )}

        {/* Quote Details */}
        {quote && !isExpired && (
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-wide">Price</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {formatCrypto((Number(quote.amount) / Number(quote.quoteAmount)), 4)} {selectedCurrency} / USDT
              </p>
            </div>

            <div className="flex items-center justify-center py-2">
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </div>

            <div>
              <p className="text-xs text-slate-600 uppercase tracking-wide">You will receive</p>
              <p className="text-lg font-bold text-green-700 mt-1">
                {formatCrypto(estimatedCrypto, 2)} USDT
              </p>
            </div>

            {quote.fee && (
              <div className="pt-2 border-t border-blue-200 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Provider fee</span>
                  <span className="font-medium">{formatCrypto(quote.fee, 6)} USDT</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-blue-200 flex justify-between items-center">
              <span className="text-xs text-slate-600 uppercase tracking-wide">Quote expires in</span>
              <span className="text-xs font-bold px-2 py-1 bg-white rounded text-green-700">
                {formatTimeRemaining(timeRemaining)}
              </span>
            </div>
          </div>
        )}

        {quote && isExpired && (
          <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-yellow-700">Quote expired</p>
                <p className="text-xs text-yellow-600 mt-1">
                  Please change the amount to get a new quote
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Buy Error */}
        {buyError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                {buyError instanceof Error
                  ? buyError.message
                  : "Failed to execute buy order"}
              </p>
            </div>
          </div>
        )}

        {/* Buy Button */}
        <button
          onClick={handleBuyClick}
          disabled={!quote || isExpired || isBuying || isGettingQuote || submitting}
          className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
            !quote || isExpired || isBuying || isGettingQuote || submitting
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
          }`}
        >
          {isBuying || submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </span>
          ) : (
            "Buy USDT"
          )}
        </button>
      </div>
    </div>
  );
}
