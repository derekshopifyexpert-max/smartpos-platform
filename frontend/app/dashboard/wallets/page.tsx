"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, Wallet as WalletIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createWallet, getMerchantWallets } from "@/features/wallets/services/wallet.service";
import type { WalletRecord } from "@/features/wallets/types/wallet";
import { useAuthStore } from "@/store/auth.store";

export default function WalletsPage() {
  const merchantId = useAuthStore((state) => state.user?.merchantId ?? "");
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("USDT Wallet");
  const [network, setNetwork] = useState("ETHEREUM");
  const [asset, setAsset] = useState("USDT");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;

    const run = async () => {
      setLoading(true);
      try {
        const data = await getMerchantWallets(merchantId);
        setWallets(data ?? []);
      } catch {
        setWallets([]);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [merchantId]);

  const walletSummary = useMemo(() => {
    if (wallets.length === 0) return "No wallet records yet.";
    return `${wallets.length} wallet${wallets.length > 1 ? "s" : ""} ready for settlement.`;
  }, [wallets.length]);

  async function handleCreateWallet() {
    if (!merchantId) {
      setError("The current merchant account is not available.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await createWallet({
        merchantId,
        name: name.trim() || `${asset} Wallet`,
        currency: "USD",
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
      setName("USDT Wallet");
      setNetwork("ETHEREUM");
      setAsset("USDT");
    } catch (caught) {
      const err = caught as any;
      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err instanceof Error ? err.message : null);

      setError(backendMessage ?? "Wallet creation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function copyAddress(address?: string | null) {
    if (!address) return;
    await navigator.clipboard.writeText(address);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Wallet management</p>
          <h1 className="text-3xl font-bold text-slate-900">Wallets</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Wallet name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Asset</label>
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button onClick={handleCreateWallet} disabled={saving || !merchantId} className="gap-2">
            <Plus className="h-4 w-4" />
            {saving ? "Creating wallet..." : "Create wallet"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Saved wallets</CardTitle>
            <span className="text-sm text-slate-500">{walletSummary}</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading wallets...</p>
          ) : wallets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No wallets yet. Create one to begin the crypto settlement flow.
            </div>
          ) : (
            <div className="space-y-3">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white p-2 text-slate-700">
                      <WalletIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{wallet.name}</p>
                      <p className="text-sm text-slate-500">
  {String(wallet.metadata?.asset ?? wallet.name)} · {String(wallet.blockchain?.name ?? wallet.metadata?.network ?? "Ethereum")}
</p>
                      <p className="mt-1 font-mono text-xs text-slate-700">{wallet.address ?? wallet.walletAddresses?.[0]?.address ?? "No public address"}</p>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" onClick={() => copyAddress(wallet.address ?? wallet.walletAddresses?.[0]?.address)} className="gap-2">
                    <Copy className="h-3.5 w-3.5" />
                    Copy address
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
