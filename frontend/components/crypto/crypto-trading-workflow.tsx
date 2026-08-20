"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, Loader2, RefreshCw } from "lucide-react";

import { useGetQuote } from "@/features/exchange/hooks/use-exchange";
import type { ExchangeQuote } from "@/features/exchange/types/exchange";
import { formatCrypto, formatFiat, formatTimeRemaining, getTimeRemaining, validateDecimalAmount } from "@/features/exchange/lib/format";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The backend did not return a safe error message.";
}

export function CryptoTradingWorkflow() {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<ExchangeQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteRemaining, setQuoteRemaining] = useState(0);
  const [destinationAddress, setDestinationAddress] = useState("");
  const quoteMutation = useGetQuote();

  const amountError = useMemo(() => validateDecimalAmount(amount), [amount]);
  const quoteExpired = Boolean(quote) && quoteRemaining <= 0;

  useEffect(() => {
    if (!quote?.expiresAt) return;
    const update = () => setQuoteRemaining(getTimeRemaining(quote.expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [quote?.expiresAt]);

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
  }, [amount, side, destinationAddress]);

  async function requestQuote() {
    if (amountError) {
      setQuoteError(amountError);
      return;
    }

    setQuote(null);
    setQuoteError(null);
    try {
      const result = await quoteMutation.mutateAsync({
        baseAsset: "USDT",
        quoteAsset: "USD",
        side,
        amount,
        ttlSeconds: 30,
      });
      setQuote(result);
    } catch (error) {
      setQuoteError(errorMessage(error));
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Quidax crypto operation</h2>
          <p className="mt-1 text-sm text-slate-600">
            Provider-backed quotes and orders only. Fiat on-ramp quotes require the separate Quidax Ramp Merchant API capability.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-1" role="group" aria-label="Trading side">
          {(["BUY", "SELL"] as const).map((option) => (
            <button key={option} type="button" onClick={() => setSide(option)} className={`rounded-md px-4 py-2 text-sm font-medium ${side === option ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {option === "BUY" ? "Buy USDT" : "Sell USDT"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="crypto-amount" className="mb-2 block text-sm font-medium text-slate-700">
            {side === "BUY" ? "Fiat amount" : "USDT amount"}
          </label>
          <div className="flex gap-2">
            <input id="crypto-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-describedby="amount-error" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="100.00" />
            <span className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-700">{side === "BUY" ? "USD" : "USDT"}</span>
          </div>
          {amountError && <p id="amount-error" className="mt-2 text-sm text-red-600">{amountError}</p>}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Provider</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Quidax</div>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="wallet-destination" className="mb-2 block text-sm font-medium text-slate-700">External customer wallet</label>
        <input id="wallet-destination" value={destinationAddress} onChange={(event) => setDestinationAddress(event.target.value)} placeholder="Required for crypto delivery when supported" className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
        <p className="mt-2 text-xs text-slate-500">SmartPOS does not generate or custody this wallet.</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={requestQuote} disabled={quoteMutation.isPending || Boolean(amountError)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {quoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {quoteMutation.isPending ? "Getting quote..." : "Get live quote"}
        </button>
        {quoteMutation.isPending && <span className="text-sm text-slate-500">Waiting for Quidax-backed pricing...</span>}
      </div>

      {quoteError && <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="h-4 w-4 shrink-0" />{quoteError}</div>}

      {quote && (
        <div className={`mt-6 rounded-lg border p-4 ${quoteExpired ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-600">Provider quote · {quote.provider}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatCrypto(quote.rate, 8)} USD / USDT</p>
              <p className="mt-1 text-sm text-slate-600">Input {formatFiat(quote.amount, "USD")} · Output {formatCrypto(quote.quoteAmount, 8)} {side === "BUY" ? "USDT" : "USD"}</p>
              {quote.fee && <p className="mt-1 text-sm text-slate-600">Provider fee: {formatCrypto(quote.fee, 8)}</p>}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><Clock3 className="h-4 w-4" />{quoteExpired ? "Quote expired" : `Expires in ${formatTimeRemaining(quoteRemaining)}`}</div>
          </div>
        </div>
      )}
    </section>
  );
}
