"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { usePaymentProviderAccounts } from "@/features/payment/hooks/use-payment-provider-accounts";
import { getWallets } from "@/features/wallets/services/wallet.service";
import type { WalletRecord } from "@/features/wallets/types/wallet";
import { useBuyUsdt, useGetOrderStatus, useGetQuote, useSellUsdt } from "@/features/exchange/hooks/use-exchange";
import type { ExchangeOrder, ExchangeQuote } from "@/features/exchange/types/exchange";
import { formatCrypto, formatFiat, formatTimeRemaining, getTimeRemaining, validateDecimalAmount } from "@/features/exchange/lib/format";
import { OrderConfirmationModal } from "./order-confirmation-modal";

function walletAddress(wallet: WalletRecord): string {
  if (wallet.address?.trim()) return wallet.address.trim();
  return wallet.walletAddresses?.find((item) => item.isActive !== false && item.address.trim())?.address || "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The backend did not return a safe error message.";
}

function makeClientOrderId(side: "BUY" | "SELL"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${side}:${crypto.randomUUID()}`;
  }
  return `${side}:${Date.now()}`;
}

export function CryptoTradingWorkflow() {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<ExchangeQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteRemaining, setQuoteRemaining] = useState(0);
  const [selectedWallet, setSelectedWallet] = useState<WalletRecord | null>(null);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<ExchangeOrder | null>(null);
  const [clientOrderId, setClientOrderId] = useState<string | null>(null);

  const quoteMutation = useGetQuote();
  const buyMutation = useBuyUsdt();
  const sellMutation = useSellUsdt();
  const orderQuery = useGetOrderStatus(submittedOrder?.orderId || undefined);
  const accountsQuery = usePaymentProviderAccounts();

  useEffect(() => {
    let active = true;
    getWallets()
      .then((items) => active && setWallets(items.filter((wallet) => walletAddress(wallet))))
      .catch((error) => active && setWalletError(errorMessage(error)));
    return () => {
      active = false;
    };
  }, []);

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
    setConfirmationOpen(false);
  }, [amount, side, selectedWallet?.id, selectedAccountId]);

  const amountError = useMemo(() => validateDecimalAmount(amount), [amount]);
  const quoteExpired = quoteRemaining <= 0;
  const currentOrder = orderQuery.data || submittedOrder;
  const isSubmitting = buyMutation.isPending || sellMutation.isPending;
  const isWalletCompatible = !selectedWallet ||
    ((selectedWallet.asset || "USDT").toUpperCase() === "USDT" &&
      (selectedWallet.network || selectedWallet.blockchain?.name || "").toUpperCase() !== "");

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

  async function submitOrder() {
    if (!quote || quoteExpired || amountError || isSubmitting) return;
    const stableClientOrderId = clientOrderId || makeClientOrderId(side);
    setClientOrderId(stableClientOrderId);

    try {
      const request = {
        baseAsset: "USDT",
        quoteAsset: "USD",
        amount,
        quoteId: quote.id,
        clientOrderId: stableClientOrderId,
      };
      const order = side === "BUY"
        ? await buyMutation.mutateAsync(request)
        : await sellMutation.mutateAsync(request);
      setSubmittedOrder(order);
      setConfirmationOpen(false);
      toast.success(`${side} order submitted`, { description: order.orderId || order.id });
    } catch (error) {
      toast.error(`${side} order failed`, { description: errorMessage(error) });
    }
  }

  const displayedOrder = currentOrder;
  const orderError = buyMutation.error || sellMutation.error || orderQuery.error;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Trade details</h2>
            <p className="mt-1 text-sm text-slate-600">
              Quotes and execution come from the configured exchange provider. The asset is USDT and the quote currency is USD when supported by the provider.
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-200 p-1" role="group" aria-label="Trading side">
            {(["BUY", "SELL"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSide(option)}
                className={`rounded-md px-4 py-2 text-sm font-medium ${side === option ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {option === "BUY" ? "Buy USDT" : "Sell USDT"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="crypto-amount" className="mb-2 block text-sm font-medium text-slate-700">
              {side === "BUY" ? "Amount to spend" : "USDT amount to sell"}
            </label>
            <div className="flex gap-2">
              <input
                id="crypto-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-describedby="amount-error"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={side === "BUY" ? "100.00" : "10.00"}
              />
              <span className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                {side === "BUY" ? "USD" : "USDT"}
              </span>
            </div>
            {amountError && <p id="amount-error" className="mt-2 text-sm text-red-600">{amountError}</p>}
          </div>

          <div>
            <label htmlFor="payment-account" className="mb-2 block text-sm font-medium text-slate-700">
              {side === "BUY" ? "Payment account" : "Destination account"}
            </label>
            <select
              id="payment-account"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select configured account</option>
              {(accountsQuery.data || []).map((account) => (
                <option key={account.id} value={account.id} disabled={!account.configured || account.status !== "ACTIVE"}>
                  {account.displayName || account.name} · {account.currency} · {account.configured && account.status === "ACTIVE" ? "Active" : "Not configured"}
                </option>
              ))}
            </select>
            {accountsQuery.isLoading && <p className="mt-2 text-xs text-slate-500">Loading payment accounts...</p>}
            {accountsQuery.error && <p className="mt-2 text-xs text-red-600">{errorMessage(accountsQuery.error)}</p>}
            {!accountsQuery.isLoading && !accountsQuery.data?.length && <p className="mt-2 text-xs text-amber-700">No Paystack destination accounts configured.</p>}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="wallet-destination" className="mb-2 block text-sm font-medium text-slate-700">
            Merchant wallet destination {side === "SELL" && <span className="font-normal text-slate-500">(not used by the exchange SELL endpoint)</span>}
          </label>
          <select
            id="wallet-destination"
            value={selectedWallet?.id || ""}
            onChange={(event) => setSelectedWallet(wallets.find((wallet) => wallet.id === event.target.value) || null)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select saved merchant wallet</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} · {wallet.asset || "USDT"} · {wallet.network || wallet.blockchain?.name || "Unknown network"}
              </option>
            ))}
          </select>
          {walletError && <p className="mt-2 text-sm text-red-600">{walletError}</p>}
          {!walletError && !wallets.length && <p className="mt-2 text-sm text-amber-700">No saved merchant wallets are available.</p>}
          {selectedWallet && <p className="mt-2 break-all text-xs text-slate-500">Destination: {walletAddress(selectedWallet)}</p>}
          {!isWalletCompatible && <p className="mt-2 text-sm text-red-600">Selected wallet is not compatible with USDT settlement.</p>}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={requestQuote}
            disabled={quoteMutation.isPending || Boolean(amountError)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {quoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {quoteMutation.isPending ? "Getting live quote..." : quote ? "Get new quote" : "Get live quote"}
          </button>
          {quoteMutation.isPending && <span className="self-center text-sm text-slate-500">Previous quote is not active while refreshing.</span>}
        </div>

        {quoteError && <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{quoteError}</div>}

        {quote && (
          <div className={`mt-6 rounded-lg border p-4 ${quoteExpired ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-600">Live quote · {quote.provider}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatCrypto(quote.rate, 8)} USD / USDT</p>
                <p className="mt-1 text-sm text-slate-600">Input {formatFiat(quote.amount, 2, "USD")} · Estimated output {formatCrypto(quote.quoteAmount, 8)} {side === "BUY" ? "USDT" : "USD"}</p>
                {quote.fee && <p className="mt-1 text-sm text-slate-600">Provider fee: {formatCrypto(quote.fee, 8)} </p>}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700"><Clock3 className="h-4 w-4" />{quoteExpired ? "Quote expired" : `Expires in ${formatTimeRemaining(quoteRemaining)}`}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => setConfirmationOpen(true)} disabled={quoteExpired || Boolean(amountError) || !isWalletCompatible} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300">Review {side} trade</button>
              {quoteExpired && <span className="self-center text-sm text-amber-800">Get a new quote before confirming.</span>}
            </div>
          </div>
        )}
      </section>

      {displayedOrder && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-slate-900">Order status</h2><p className="mt-1 break-all font-mono text-xs text-slate-500">Provider order ID: {displayedOrder.orderId || "Unavailable"}</p></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{displayedOrder.status}</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs uppercase text-slate-500">Requested</p><p className="mt-1 font-medium text-slate-900">{formatCrypto(displayedOrder.amount, 8)}</p></div>
            <div><p className="text-xs uppercase text-slate-500">Executed</p><p className="mt-1 font-medium text-slate-900">{formatCrypto(displayedOrder.filledAmount, 8)}</p></div>
            <div><p className="text-xs uppercase text-slate-500">Average price</p><p className="mt-1 font-medium text-slate-900">{displayedOrder.avgPrice ? formatCrypto(displayedOrder.avgPrice, 8) : "Unavailable"}</p></div>
            <div><p className="text-xs uppercase text-slate-500">Updated</p><p className="mt-1 font-medium text-slate-900">{displayedOrder.updatedAt ? new Date(displayedOrder.updatedAt).toLocaleString() : "Unavailable"}</p></div>
          </div>
          {orderQuery.isFetching && <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Refreshing provider order status...</p>}
          {orderError && <p className="mt-4 flex gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{errorMessage(orderError)}</p>}
          {displayedOrder.status === "FILLED" && side === "BUY" && <p className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="h-4 w-4 shrink-0" />Exchange fill confirmed. Blockchain settlement status is not available from the current exchange order API.</p>}
          {displayedOrder.status === "FILLED" && side === "SELL" && <p className="mt-4 flex gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800"><CheckCircle2 className="h-4 w-4 shrink-0" />USDT sale completed at the liquidity provider. Fiat payout is not reported by this exchange endpoint.</p>}
          {displayedOrder.orderId && <button type="button" onClick={() => navigator.clipboard?.writeText(displayedOrder.orderId || "").then(() => toast.success("Order ID copied"))} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600"><Copy className="h-4 w-4" />Copy order ID</button>}
        </section>
      )}

      <OrderConfirmationModal
        isOpen={confirmationOpen}
        isLoading={isSubmitting}
        order={{
          side,
          amount,
          quotePrice: quote?.rate || "",
          estimatedCrypto: side === "BUY" ? quote?.quoteAmount : amount,
          estimatedFiat: side === "SELL" ? quote?.quoteAmount : amount,
          fee: quote?.fee,
          currency: "USD",
          walletAddress: selectedWallet ? walletAddress(selectedWallet) : undefined,
          walletName: selectedWallet?.name,
          network: selectedWallet?.network || selectedWallet?.blockchain?.name || undefined,
          quoteExpiration: quote?.expiresAt,
        }}
        onConfirm={submitOrder}
        onCancel={() => setConfirmationOpen(false)}
      />
    </div>
  );
}
