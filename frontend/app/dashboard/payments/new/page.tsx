"use client";

import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createWallet, getMerchantWallets } from "@/features/wallets/services/wallet.service";
import type { WalletRecord } from "@/features/wallets/types/wallet";
import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { useAuthStore } from "@/store/auth.store";

export default function NewPaymentPage() {
  const merchantId = useAuthStore((state) => state.user?.merchantId ?? "");

  const [amount, setAmount] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("ETHEREUM");
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [customAddress, setCustomAddress] = useState("");
  const [customerEmail, setCustomerEmail] = useState("customer@example.com");
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;

    const run = async () => {
      setLoadingWallets(true);
      try {
        const data = await getMerchantWallets(merchantId);
        setWallets(data ?? []);
        if (data?.[0]?.id) setSelectedWalletId(data[0].id);
      } catch {
        setWallets([]);
      } finally {
        setLoadingWallets(false);
      }
    };

    void run();
  }, [merchantId]);

  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedWalletId) ?? null,
    [selectedWalletId, wallets]
  );

  const destinationAddress = useMemo(() => {
    if (customAddress.trim()) return customAddress.trim();
    return selectedWallet?.address ?? selectedWallet?.walletAddresses?.[0]?.address ?? "";
  }, [customAddress, selectedWallet]);

  async function handleCreateWallet() {
    if (!merchantId) {
      setError("The current merchant account is not available.");
      return;
    }

    setCreatingWallet(true);
    setError(null);

    try {
      const created = await createWallet({
        merchantId,
        name: `${asset} Wallet`,
        currency,
        blockchain: network,
        network,
        asset,
        type: "CRYPTO",
        metadata: {
          asset,
          network,
          source: "merchant-terminal",
        },
      });

      setWallets((current) => [created, ...current]);
      setSelectedWalletId(created.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet creation failed.");
    } finally {
      setCreatingWallet(false);
    }
  }

  async function handleCreatePaymentIntent() {
    if (!merchantId) {
      setError("The current merchant account is not available.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid payment amount greater than zero.");
      return;
    }

    if (!destinationAddress) {
      setError("Select a saved wallet or provide a destination address.");
      return;
    }

    setCreatingPayment(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: { id: string; amount: number; currency: string; status: string } }>(
        ENDPOINTS.paymentIntents.list,
        {
          merchantId,
          amount: numericAmount,
          currency,
          description: `SmartPOS payment for ${currency} ${numericAmount}`,
          metadata: {
            cryptoDestination: {
              asset,
              network,
              walletId: selectedWalletId || undefined,
              address: destinationAddress,
              amount: numericAmount,
              currency,
            },
          },
        }
      );

      const paymentIntent = response.data.data;

      if (!paymentIntent?.id) throw new Error("Payment session could not be created.");

      const checkout = await api.post<{ success: boolean; data: { gateway?: { paymentUrl?: string; accessCode?: string } } }>(
        ENDPOINTS.paymentIntents.checkout(paymentIntent.id),
        {
          email: customerEmail,
          cryptoDestination: {
            asset,
            network,
            walletId: selectedWalletId || undefined,
            address: destinationAddress,
            amount: numericAmount,
            currency,
          },
        }
      );

      const paymentUrl = checkout.data.data.gateway?.paymentUrl;
      const accessCode = checkout.data.data.gateway?.accessCode;

      if (paymentUrl) {
        window.location.href = paymentUrl;
        return;
      }

      if (accessCode) {
        window.location.href = `/pay/${paymentIntent.id}`;
        return;
      }

      window.location.href = `/pay/${paymentIntent.id}`;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment session could not be created.");
    } finally {
      setCreatingPayment(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/payments" className="inline-flex items-center gap-2 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Payments
        </Link>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-500">SmartPOS terminal</p>
        <h1 className="text-3xl font-bold text-slate-900">New Payment</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Payment details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Fiat currency</label>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="USD">USD</option>
                  <option value="NGN">NGN</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Crypto asset</label>
                <select
                  value={asset}
                  onChange={(event) => setAsset(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Network</label>
                <select
                  value={network}
                  onChange={(event) => setNetwork(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="ETHEREUM">Ethereum</option>
                  <option value="TRON">TRON</option>
                  <option value="BSC">BSC</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Customer email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
                <Wallet className="h-4 w-4" />
                Destination wallet
              </div>

              {loadingWallets ? (
                <p className="text-sm text-slate-500">Loading wallets...</p>
              ) : wallets.length === 0 ? (
                <p className="text-sm text-slate-600">No saved wallets yet. Create one to continue.</p>
              ) : (
                <div className="space-y-3">
                  {wallets.map((wallet) => (
                    <label key={wallet.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                      <input
                        type="radio"
                        name="wallet"
                        checked={selectedWalletId === wallet.id}
                        onChange={() => setSelectedWalletId(wallet.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{wallet.name}</p>
                        <p className="text-xs text-slate-500">
  {String(wallet.blockchain?.name ?? network)} · {String(wallet.metadata?.asset ?? asset)}
</p>
                        <p className="mt-1 truncate font-mono text-xs text-slate-700">{wallet.address ?? wallet.walletAddresses?.[0]?.address ?? "Address missing"}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-3">
                <input
                  value={customAddress}
                  onChange={(event) => setCustomAddress(event.target.value)}
                  placeholder="Or enter external destination address"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                />
              </div>

              <div className="mt-4">
                <Button type="button" variant="outline" onClick={handleCreateWallet} disabled={creatingWallet} className="gap-2">
                  <Wallet className="h-4 w-4" />
                  {creatingWallet ? "Creating wallet..." : "Create New Wallet"}
                </Button>
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end">
              <Button onClick={handleCreatePaymentIntent} disabled={creatingPayment} className="gap-2">
                {creatingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {creatingPayment ? "Creating payment..." : "Continue to payment"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Amount</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount || 0))}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Crypto</span><span className="font-medium text-slate-900">{asset}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Network</span><span className="font-medium text-slate-900">{network}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Destination</span><span className="max-w-[180px] truncate font-medium text-slate-900" title={destinationAddress}>{destinationAddress || "Not set"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Fee</span><span className="font-medium text-slate-900">Calculated at payment</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
