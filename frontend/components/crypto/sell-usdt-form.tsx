"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Loader2, ArrowRight } from "lucide-react";
import {
  formatCrypto,
  calculateEstimatedFiat,
  parseDecimal,
  getTimeRemaining,
  formatTimeRemaining,
  isQuoteExpired,
} from "@/features/exchange/lib/format";
import { useGetQuote, useSellUsdt } from "@/features/exchange/hooks/use-exchange";
import type { ExchangeQuote, ExecuteOrderRequest } from "@/features/exchange/types/exchange";

export interface SellUsdtFormProps {
  onSuccess?: (order: any) => void;
}

export function SellUsdtForm({ onSuccess }: SellUsdtFormProps) {
  const [cryptoAmount, setCryptoAmount] = useState<string>("100");
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

  // Mutation for selling
  const {
    mutate: sellOrder,
    isPending: isSelling,
    error: sellError,
  } = useSellUsdt();

  // Fetch quote when crypto amount changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!cryptoAmount || parseFloat(cryptoAmount) <= 0) {
        setQuote(null);
        setQuoteError("");
        return;
      }

      setQuoteError("");
      getQuote(
        {
          baseAsset: "USDT",
          quoteAsset: selectedCurrency,
          side: "SELL",
          amount: cryptoAmount,
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
  }, [cryptoAmount, selectedCurrency, getQuote]);

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

  const handleSellClick = async () => {
    if (!quote || isExpired || isSelling || submitting) return;

    setSubmitting(true);

    try {
      const clientOrderId = `SELL:${Date.now()}`;

      const request: ExecuteOrderRequest = {
        baseAsset: "USDT",
        quoteAsset: selectedCurrency,
        amount: cryptoAmount,
        quoteId: quote.id,
        clientOrderId,
      };

      sellOrder(request, {
        onSuccess: (order) => {
          setCryptoAmount("100");
          setQuote(null);
          onSuccess?.(order);
        },
        onError: (error) => {
          console.error("Sell order failed:", error);
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedFiat = quote
    ? calculateEstimatedFiat(cryptoAmount, quote.rate)
    : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-6">Sell USDT</h3>

      <div className="space-y-6">
        {/* Crypto Amount Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            USDT amount to sell
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={cryptoAmount}
              onChange={(e) => setCryptoAmount(e.target.value)}
              placeholder="100"
              min="0"
              step="0.01"
              disabled={isGettingQuote || isSelling}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
            <div className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 flex items-center text-sm font-medium text-slate-700">
              USDT
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
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-wide">Price</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {formatCrypto(quote.rate, 4)} {selectedCurrency} / USDT
              </p>
            </div>

            <div className="flex items-center justify-center py-2">
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </div>

            <div>
              <p className="text-xs text-slate-600 uppercase tracking-wide">You will receive</p>
              <p className="text-lg font-bold text-emerald-700 mt-1">
                {formatCrypto(estimatedFiat, 2)} {selectedCurrency}
              </p>
            </div>

            {quote.fee && (
              <div className="pt-2 border-t border-emerald-200 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Provider fee</span>
                  <span className="font-medium">{formatCrypto(quote.fee, 6)} USDT</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
              <span className="text-xs text-slate-600 uppercase tracking-wide">Quote expires in</span>
              <span className="text-xs font-bold px-2 py-1 bg-white rounded text-emerald-700">
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

        {/* Sell Error */}
        {sellError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                {sellError instanceof Error
                  ? sellError.message
                  : "Failed to execute sell order"}
              </p>
            </div>
          </div>
        )}

        {/* Sell Button */}
        <button
          onClick={handleSellClick}
          disabled={!quote || isExpired || isSelling || isGettingQuote || submitting}
          className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
            !quote || isExpired || isSelling || isGettingQuote || submitting
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
          }`}
        >
          {isSelling || submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </span>
          ) : (
            "Sell USDT"
          )}
        </button>

        {/* Info Note */}
        <p className="text-xs text-slate-500 text-center">
          Note: Only the exchange sell order is executed. Fiat received will be held
          by the exchange provider and requires manual withdrawal.
        </p>
      </div>
    </div>
  );
}
