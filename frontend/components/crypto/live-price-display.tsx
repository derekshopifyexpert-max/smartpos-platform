"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Clock3,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { useGetQuote } from "@/features/exchange/hooks/use-exchange";
import type { ExchangeQuote } from "@/features/exchange/types/exchange";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to retrieve the live Quidax price.";
}

function formatNumber(
  value: string | number | undefined,
  maximumFractionDigits = 8,
): string {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

function formatCurrency(
  value: string | number | undefined,
  currency: string,
): string {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function getTimeRemaining(
  expiresAt?: string,
): number {
  if (!expiresAt) {
    return 0;
  }

  const timestamp =
    new Date(expiresAt).getTime();

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (timestamp - Date.now()) / 1000,
    ),
  );
}

function formatTimeRemaining(
  seconds: number,
): string {
  if (seconds <= 0) {
    return "Expired";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    seconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

export function LivePriceDisplay() {
  const quoteMutation =
    useGetQuote();

  const [quote, setQuote] =
    useState<ExchangeQuote | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(null);

  const [remaining, setRemaining] =
    useState(0);

  const [amount, setAmount] =
    useState("100000");

  /*
   * Current supported Quidax Ramp
   * configuration.
   *
   * BUY:
   *   baseAsset  = USDT
   *   quoteAsset = NGN
   *   network    = trc20
   */
  const baseAsset = "USDT";
  const quoteAsset = "NGN";
  const side = "BUY";
  const network = "trc20";

  const amountError =
    useMemo(() => {
      if (!amount.trim()) {
        return "Amount is required.";
      }

      /*
       * Keep validation aligned with the
       * backend's positive decimal requirement.
       */
      const value = Number(amount);

      if (
        !Number.isFinite(value) ||
        value <= 0
      ) {
        return "Amount must be greater than zero.";
      }

      return null;
    }, [amount]);

  useEffect(() => {
    if (!quote?.expiresAt) {
      setRemaining(0);
      return;
    }

    const updateRemaining = () => {
      setRemaining(
        getTimeRemaining(
          quote.expiresAt,
        ),
      );
    };

    updateRemaining();

    const timer =
      window.setInterval(
        updateRemaining,
        1000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, [quote?.expiresAt]);

  const quoteExpired =
    Boolean(quote) &&
    remaining <= 0;

  async function loadLivePrice() {
    if (amountError) {
      setQuote(null);
      setError(amountError);
      return;
    }

    setQuote(null);
    setError(null);

    try {
      const result =
        await quoteMutation.mutateAsync({
          baseAsset,
          quoteAsset,
          side,
          amount,
          network,
          ttlSeconds: 30,
        });

      setQuote(result);
    } catch (requestError) {
      setQuote(null);

      setError(
        errorMessage(
          requestError,
        ),
      );
    }
  }

  /*
   * ExchangeQuote uses:
   *
   *   inputAmount
   *   outputAmount
   *   price
   *
   * It does NOT use:
   *
   *   amount
   *   quoteAmount
   *   rate
   *
   * For a BUY quote:
   *
   *   inputAmount  = NGN paid
   *   outputAmount = USDT received
   *   price        = NGN per USDT
   */
  const displayedRate =
    quote?.price !== undefined &&
    quote?.price !== null
      ? Number(quote.price)
      : quote &&
          Number(
            quote.outputAmount,
          ) > 0
        ? Number(
            quote.inputAmount,
          ) /
          Number(
            quote.outputAmount,
          )
        : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Live Price
          </h3>

          <p className="mt-1 text-sm text-slate-600">
            Live BUY pricing from
            Quidax Ramp.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Market
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            USDT / NGN
          </p>

          <p className="text-xs text-slate-500">
            {network.toUpperCase()}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <label
            htmlFor="live-price-amount"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Fiat amount
          </label>

          <div className="flex">
            <input
              id="live-price-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) =>
                setAmount(
                  event.target.value,
                )
              }
              className="min-w-0 flex-1 rounded-l-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="100000"
              aria-describedby="live-price-amount-error"
            />

            <span className="flex items-center rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-700">
              NGN
            </span>
          </div>

          {amountError && (
            <p
              id="live-price-amount-error"
              className="mt-2 text-xs text-red-600"
            >
              {amountError}
            </p>
          )}
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={loadLivePrice}
            disabled={
              quoteMutation.isPending ||
              Boolean(amountError)
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            {quoteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}

            {quoteMutation.isPending
              ? "Loading..."
              : "Refresh price"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

          <div>
            <p className="font-medium">
              Live price unavailable
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        </div>
      )}

      {quote && (
        <div
          className={`mt-5 rounded-lg border p-4 ${
            quoteExpired
              ? "border-amber-200 bg-amber-50"
              : "border-blue-200 bg-blue-50"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {quote.provider} ·{" "}
                {quote.baseAsset}/
                {quote.quoteAsset}
              </p>

              <div className="mt-2">
                <p className="text-2xl font-semibold text-slate-900">
                  {displayedRate !== null &&
                  Number.isFinite(
                    displayedRate,
                  )
                    ? formatCurrency(
                        displayedRate,
                        quote.quoteAsset,
                      )
                    : "—"}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  per {quote.baseAsset}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Clock3 className="h-4 w-4" />

              {quoteExpired
                ? "Quote expired"
                : `Expires in ${formatTimeRemaining(
                    remaining,
                  )}`}
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-slate-200/80 pt-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">
                Input
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(
                  quote.inputAmount,
                  quote.quoteAsset,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Estimated {quote.baseAsset}
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatNumber(
                  quote.outputAmount,
                  8,
                )}{" "}
                {quote.baseAsset}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Provider fee
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {quote.fee
                  ? formatCurrency(
                      quote.fee,
                      quote.feeCurrency ??
                        quote.quoteAsset,
                    )
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}