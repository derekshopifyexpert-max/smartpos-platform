"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { useSettlement } from "@/features/exchange/hooks/use-settlements";
import { formatCrypto, formatFiat } from "@/features/exchange/lib/format";
import { SettlementStatusBadge } from "@/components/settlements/settlement-status-badge";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs text-slate-500">{label}</p><div className="mt-1 break-words text-sm font-medium text-slate-900">{value ?? "Not available"}</div></div>;
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return <button onClick={copy} className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800" aria-label={`Copy ${value}`}><Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}</button>;
}

export default function SettlementDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useSettlement(params.id);

  if (isLoading) return <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-600"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading settlement...</div>;
  if (isError || !data) return <div className="space-y-4"><Link href="/dashboard/settlements" className="inline-flex items-center text-sm font-medium text-blue-700"><ArrowLeft className="mr-2 h-4 w-4" /> Back to settlements</Link><div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mr-2 inline h-4 w-4" /> {error instanceof Error ? error.message : "Settlement not found."}</div></div>;

  const expectedAmount = data.conversion?.acquiredAmount;
  const transferredAmount = data.blockchain?.amount;
  const amountMismatch = Boolean(expectedAmount && transferredAmount && expectedAmount !== transferredAmount);
  const walletAddress = data.wallet?.address || undefined;
  const recipientMismatch = Boolean(walletAddress && data.blockchain?.toAddress && walletAddress.toLowerCase() !== data.blockchain.toAddress.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Link href="/dashboard/settlements" className="inline-flex items-center text-sm font-medium text-blue-700"><ArrowLeft className="mr-2 h-4 w-4" /> Back to settlements</Link><SettlementStatusBadge status={data.settlement.status} /></div>
      <div><h1 className="text-3xl font-bold text-slate-900">Settlement Detail</h1><p className="mt-2 text-sm text-slate-600">Payment-to-blockchain audit trail for {data.payment.id}.</p></div>

      {(amountMismatch || recipientMismatch || (data.order?.status === "FILLED" && !data.blockchain)) && <div className="space-y-2">{amountMismatch && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="mr-2 inline h-4 w-4" />Executed crypto amount does not match transferred amount.</div>}{recipientMismatch && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="mr-2 inline h-4 w-4" />Expected wallet and blockchain recipient do not match.</div>}{data.order?.status === "FILLED" && !data.blockchain && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="mr-2 inline h-4 w-4" />Exchange completed, blockchain settlement pending.</div>}</div>}

      <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold text-slate-900">Payment</h2><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Field label="Payment ID" value={<>{data.payment.id}<CopyValue value={data.payment.id} /></>} /><Field label="Status" value={data.payment.status} /><Field label="Amount" value={formatFiat(data.payment.amount, data.payment.currency)} /><Field label="Created" value={new Date(data.payment.createdAt).toLocaleString()} /><Field label="Customer email" value={data.payment.customerEmail} /><Field label="Paystack account" value={data.paymentProviderAccount ? `${data.paymentProviderAccount.displayName} (${data.paymentProviderAccount.status})` : "Account information unavailable for this payment"} /></div></section>

      <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold text-slate-900">Exchange</h2><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Field label="Provider" value={data.order?.provider} /><Field label="Symbol" value={data.order?.symbol} /><Field label="Side" value={data.order?.side} /><Field label="Requested" value={data.order ? `${formatCrypto(data.order.requestedAmount, 6)} ${data.conversion?.toCurrency || "USDT"}` : undefined} /><Field label="Executed" value={data.order ? `${formatCrypto(data.order.filledAmount, 6)} ${data.conversion?.toCurrency || "USDT"}` : undefined} /><Field label="Average price" value={data.order?.averagePrice} /><Field label="Order status" value={data.order?.status} /><Field label="Provider order ID" value={data.order?.providerOrderId ? <>{data.order.providerOrderId}<CopyValue value={data.order.providerOrderId} /></> : undefined} /><Field label="Quote ID" value={data.order?.quoteId || data.conversion?.quoteId} /><Field label="Quote expiry" value={data.conversion?.quoteExpiresAt ? new Date(data.conversion.quoteExpiresAt).toLocaleString() : undefined} /></div><div className="mt-6"><h3 className="text-sm font-semibold text-slate-900">Fills</h3>{!data.order?.fills.length ? <p className="mt-2 text-sm text-slate-500">No fills available.</p> : <div className="mt-3 divide-y divide-slate-100 rounded border border-slate-200">{data.order.fills.map((fill) => <div key={fill.id} className="grid gap-2 p-3 text-sm sm:grid-cols-4"><Field label="Fill ID" value={fill.tradeId || fill.id} /><Field label="Price" value={fill.price} /><Field label="Amount" value={fill.amount} /><Field label="Fee / time" value={`${fill.fee} / ${new Date(fill.timestamp).toLocaleString()}`} /></div>)}</div>}</div></section>

      <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold text-slate-900">Wallet destination</h2><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Field label="Wallet" value={data.wallet?.name} /><Field label="Asset" value={data.wallet?.currency} /><Field label="Status" value={data.wallet?.status} /><Field label="Address" value={walletAddress ? <>{walletAddress}<CopyValue value={walletAddress} /></> : undefined} /></div></section>

      <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold text-slate-900">Blockchain</h2><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Field label="Network" value={data.blockchain?.network} /><Field label="Token" value={data.blockchain?.currency} /><Field label="Amount transferred" value={data.blockchain ? `${formatCrypto(data.blockchain.amount, 6)} ${data.blockchain.currency}` : undefined} /><Field label="Transaction status" value={data.blockchain?.status} /><Field label="Transaction hash" value={data.blockchain?.txHash ? <>{data.blockchain.txHash}<CopyValue value={data.blockchain.txHash} />{data.blockchain.explorerUrl && <a className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700" href={`${data.blockchain.explorerUrl.replace(/\/$/, "")}/${data.blockchain.txHash}`} target="_blank" rel="noreferrer">View on explorer <ExternalLink className="h-3.5 w-3.5" /></a>}</> : "Waiting for broadcast"} /><Field label="Recipient" value={data.blockchain?.toAddress} /><Field label="Block number" value={data.blockchain?.blockNumber} /><Field label="Confirmations" value={data.blockchain ? `${data.blockchain.confirmations} / ${data.settlement.requiredConfirmations ?? "required value unavailable"}` : undefined} /><Field label="Fee" value={data.blockchain?.fee} /></div></section>

      <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold text-slate-900">Reconciliation</h2><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-5"><Field label="Payment amount" value={formatFiat(data.payment.amount, data.payment.currency)} /><Field label="Quoted crypto" value={data.conversion?.quotedAmount ? `${data.conversion.quotedAmount} ${data.conversion.toCurrency}` : undefined} /><Field label="Executed crypto" value={expectedAmount ? `${expectedAmount} ${data.conversion?.toCurrency}` : undefined} /><Field label="Transferred crypto" value={transferredAmount ? `${transferredAmount} ${data.blockchain?.currency}` : undefined} /><Field label="Confirmed crypto" value={data.blockchain?.status === "CONFIRMED" || data.blockchain?.status === "SETTLED" ? transferredAmount : "Not confirmed"} /></div></section>

      <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold text-slate-900">Lifecycle</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded bg-slate-50 p-3 text-sm"><Check className="mr-2 inline h-4 w-4 text-green-600" /> Payment record: {data.payment.status}</div><div className="rounded bg-slate-50 p-3 text-sm">Exchange: {data.order?.status || "Not started"}</div><div className="rounded bg-slate-50 p-3 text-sm">Blockchain: {data.blockchain?.status || "Not broadcast"}</div><div className="rounded bg-slate-50 p-3 text-sm">Settlement: {data.settlement.status}</div></div></section>
    </div>
  );
}
