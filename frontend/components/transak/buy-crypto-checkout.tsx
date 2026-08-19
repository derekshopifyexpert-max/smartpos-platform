"use client";

import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { transakService } from "@/features/transak/services/transak.service";
import { useTransakCapabilities, useTransakTransaction } from "@/features/transak/hooks/use-transak";
import type { TransakQuote } from "@/features/transak/types";

function valueOf(item: { code?: string; symbol?: string; id?: string; name?: string }) {
  return item.code || item.symbol || item.id || item.name || "";
}

function validateAmount(value: string) {
  if (!value.trim()) return "Enter an amount greater than zero.";
  if (!/^\d+(\.\d{1,8})?$/.test(value)) return "Enter a valid amount with no more than 8 decimal places.";
  if (/^0+(\.0{1,8})?$/.test(value)) return "Enter an amount greater than zero.";
  return null;
}

function remainingSeconds(expiresAt?: string) {
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function BuyCryptoCheckout() {
  const { data: capabilities, isLoading: capabilitiesLoading, error: capabilitiesError } = useTransakCapabilities();
  const [country, setCountry] = useState("");
  const [fiatCurrency, setFiatCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState("");
  const [network, setNetwork] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletVerified, setWalletVerified] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");
  const [quote, setQuote] = useState<TransakQuote | null>(null);
  const [quoteSeconds, setQuoteSeconds] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionUrl, setSessionUrl] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [error, setError] = useState("");
  const transaction = useTransakTransaction(transactionId);

  useEffect(() => {
    if (!capabilities) return;
    const firstCountry = capabilities.countries[0];
    const firstFiat = capabilities.fiatCurrencies[0];
    const usdt = capabilities.cryptoCurrencies.find((item) => valueOf(item).toUpperCase() === "USDT") || capabilities.cryptoCurrencies[0];
    setCountry((current) => current || valueOf(firstCountry || {}));
    setFiatCurrency((current) => current || valueOf(firstFiat || {}));
    setCryptoCurrency((current) => current || valueOf(usdt || {}));
    setNetwork((current) => current || valueOf(capabilities.networks[0] || {}));
  }, [capabilities]);

  useEffect(() => {
    if (!quote?.expiresAt) return;
    const update = () => setQuoteSeconds(remainingSeconds(quote.expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [quote]);

  const expired = quoteSeconds !== null && quoteSeconds <= 0;
  const selectedCountry = country.trim();
  const amountError = validateAmount(amount);

  function resetQuote() {
    setQuote(null);
    setQuoteSeconds(null);
    setWalletVerified(false);
    setWalletMessage("");
    setSessionUrl("");
    setError("");
  }

  async function verifyWallet() {
    setError("");
    setWalletMessage("");
    if (!walletAddress.trim()) return setWalletMessage("Enter your external wallet address.");
    try {
      const result = await transakService.verifyWallet({ walletAddress: walletAddress.trim(), cryptoCurrency, network, countryCode: selectedCountry });
      setWalletVerified(result.valid);
      setWalletMessage(result.message || (result.valid ? "Wallet verified." : "Wallet verification failed."));
    } catch (caught) {
      setWalletVerified(false);
      setError(caught instanceof Error ? caught.message : "Wallet verification failed.");
    }
  }

  async function getQuote() {
    setError("");
    setSessionUrl("");
    const validationError = validateAmount(amount);
    if (validationError) return setError(validationError);
    if (!walletVerified) return setError("Verify your external wallet before requesting a quote.");
    setQuoteLoading(true);
    try {
      const result = await transakService.getQuote({ fiatCurrency, fiatAmount: amount, cryptoCurrency, network, countryCode: selectedCountry, walletAddress: walletAddress.trim() });
      setQuote(result);
      setQuoteSeconds(remainingSeconds(result.expiresAt));
    } catch (caught) {
      setQuote(null);
      setError(caught instanceof Error ? caught.message : "Transak quote is unavailable.");
    } finally {
      setQuoteLoading(false);
    }
  }

  async function continueToPayment() {
    setError("");
    if (!quote || expired) return setError("Your quote expired. Request a new quote.");
    if (!walletVerified) return setError("Verify your external wallet before continuing.");
    setSessionLoading(true);
    try {
      const session = await transakService.createPaymentSession({ quoteId: quote.quoteId, fiatCurrency, fiatAmount: amount, cryptoCurrency, network, walletAddress: walletAddress.trim(), countryCode: selectedCountry, cryptoAmount: quote.cryptoAmount, quoteRate: quote.rate, feeAmount: quote.fees?.find((fee) => fee.amount)?.amount, feeCurrency: quote.fees?.find((fee) => fee.amount)?.currency });
      setTransactionId(session.transactionId);
      setSessionUrl(session.widgetUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Secure payment session could not be created.");
    } finally {
      setSessionLoading(false);
    }
  }

  if (capabilitiesLoading) return <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-600"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading supported payment options...</div>;
  if (capabilitiesError || !capabilities) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mr-2 inline h-4 w-4" /> {capabilitiesError instanceof Error ? capabilitiesError.message : "Transak capabilities are unavailable."}</div>;

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <section className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      <div><h2 className="text-xl font-semibold text-slate-900">Buy Crypto</h2><p className="mt-1 text-sm text-slate-600">Pay securely with your card and send crypto directly to your external wallet.</p></div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mr-2 inline h-4 w-4" /> {error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Country<select value={country} onChange={(event) => { setCountry(event.target.value); resetQuote(); }} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="">Select country</option>{capabilities.countries.map((item, index) => <option key={`${valueOf(item)}-${index}`} value={valueOf(item)}>{item.name || valueOf(item)}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Amount<input value={amount} onChange={(event) => { setAmount(event.target.value); resetQuote(); }} inputMode="decimal" placeholder="100.00" className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" />{amountError && <span className="mt-1 block text-xs font-normal text-red-600">{amountError}</span>}</label>
        <label className="text-sm font-medium text-slate-700">Fiat currency<select value={fiatCurrency} onChange={(event) => { setFiatCurrency(event.target.value); resetQuote(); }} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="">Select fiat</option>{capabilities.fiatCurrencies.map((item, index) => <option key={`${valueOf(item)}-${index}`} value={valueOf(item)}>{item.name || valueOf(item)}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Crypto asset<select value={cryptoCurrency} onChange={(event) => { setCryptoCurrency(event.target.value); resetQuote(); }} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="">Select asset</option>{capabilities.cryptoCurrencies.map((item, index) => <option key={`${valueOf(item)}-${index}`} value={valueOf(item)}>{item.name || valueOf(item)}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Network<select value={network} onChange={(event) => { setNetwork(event.target.value); resetQuote(); }} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="">Select network</option>{capabilities.networks.map((item, index) => <option key={`${valueOf(item)}-${index}`} value={valueOf(item)}>{item.name || valueOf(item)}</option>)}</select></label>
      </div>
      <div className="rounded-lg border border-slate-200 p-4"><label className="text-sm font-medium text-slate-700">Your external wallet<input value={walletAddress} onChange={(event) => { setWalletAddress(event.target.value); setWalletVerified(false); setWalletMessage(""); setQuote(null); }} placeholder="Enter your wallet address" className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" /></label><p className="mt-2 text-xs text-slate-500">Crypto will be delivered to this wallet by Transak. SmartPOS does not generate or custody it.</p><button onClick={verifyWallet} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"><ShieldCheck className="h-4 w-4" /> Verify wallet</button>{walletMessage && <p className={`mt-2 text-sm ${walletVerified ? "text-green-700" : "text-red-700"}`}>{walletVerified && <CheckCircle2 className="mr-1 inline h-4 w-4" />}{walletMessage}</p>}</div>
      <div className="flex flex-wrap gap-3"><button onClick={getQuote} disabled={quoteLoading || !walletVerified || Boolean(amountError)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">{quoteLoading ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Getting live quote...</> : "Get live quote"}</button>{quote && <button onClick={getQuote} disabled={quoteLoading} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Refresh quote</button>}</div>
    </section>
    <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold text-slate-900">Review</h2>{quote ? <><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-600">You pay</span><strong>{quote.fiatAmount} {quote.fiatCurrency}</strong></div><div className="flex justify-between"><span className="text-slate-600">You receive</span><strong>{quote.cryptoAmount || "Not available"} {quote.cryptoCurrency}</strong></div><div className="flex justify-between"><span className="text-slate-600">Rate</span><span>{quote.rate || "Not available"}</span></div><div className="flex justify-between"><span className="text-slate-600">Network</span><span>{quote.network}</span></div><div><span className="text-slate-600">Wallet</span><p className="mt-1 break-all font-mono text-xs">{walletAddress}</p></div>{quote.fees?.map((fee, index) => <div key={`${fee.type}-${index}`} className="flex justify-between"><span className="text-slate-600">{fee.type || "Provider fee"}</span><span>{fee.amount || "Fee unavailable"} {fee.currency || ""}</span></div>)}</div><div className={`rounded-lg p-3 text-sm ${expired ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{expired ? "Quote expired. Request a new quote." : quoteSeconds === null ? "Quote expiration unavailable" : `Quote valid for ${quoteSeconds} seconds`}</div><button onClick={continueToPayment} disabled={sessionLoading || expired || !walletVerified} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">{sessionLoading ? "Preparing secure payment..." : "Continue to payment"}</button></> : <p className="text-sm text-slate-500">Verify your wallet and request a live quote to review this purchase.</p>}{sessionUrl && <div className="border-t border-slate-200 pt-4"><p className="text-sm font-medium text-slate-900">Secure Transak payment</p><p className="mt-1 text-xs text-slate-500">Card details are securely handled by Transak. SmartPOS does not receive your card number or CVV.</p><iframe title="Secure Transak payment" src={sessionUrl} className="mt-3 h-[560px] w-full rounded-lg border border-slate-200" /></div>}{transactionId && <p className="text-xs text-slate-500">SmartPOS transaction status: <strong>{transaction.data?.status || "Preparing"}</strong></p>}</aside>
  </div>;
}
