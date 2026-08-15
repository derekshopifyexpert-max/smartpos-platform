"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Plus, Wallet as WalletIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createWallet,
  getMerchantWallets,
} from "@/features/wallets/services/wallet.service";
import type { WalletRecord } from "@/features/wallets/types/wallet";
import { useAuthStore } from "@/store/auth.store";

export default function WalletsPage() {
  const user = useAuthStore((state) => state.user);

  /*
   * The wallet page is available after login.
   *
   * merchantId is still included in API requests when the authenticated
   * user has one, but it does not disable or hide the wallet UI.
   */
  const merchantId = user?.merchantId ?? "";

  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("USDT Settlement Wallet");
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("ETHEREUM");
  const [address, setAddress] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        /*
         * The API currently expects a merchant id for listing wallets.
         * If the logged-in user has one, load their saved wallets.
         *
         * Importantly, the absence of merchantId does not block the page.
         */
        if (!merchantId) {
          setWallets([]);
          return;
        }

        const data = await getMerchantWallets(merchantId);
        setWallets(data ?? []);
      } catch (caught) {
        console.error("Failed to load wallets:", caught);

        const err = caught as any;

        const backendMessage =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          (err instanceof Error ? err.message : null);

        setError(backendMessage ?? "Unable to load wallets.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [merchantId]);

  const walletSummary = useMemo(() => {
    if (wallets.length === 0) {
      return "No wallet records yet.";
    }

    return `${wallets.length} wallet${
      wallets.length === 1 ? "" : "s"
    } saved for settlement.`;
  }, [wallets.length]);

  function getWalletAddress(wallet: WalletRecord): string {
    return (
      wallet.address ??
      wallet.walletAddresses?.find((item) => item.isActive !== false)
        ?.address ??
      wallet.walletAddresses?.[0]?.address ??
      ""
    );
  }

  function validateAddress() {
    const trimmedAddress = address.trim();

    if (!trimmedAddress) {
      return "Enter the wallet address.";
    }

    if (network === "ETHEREUM" || network === "BSC") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
        return "Enter a valid EVM wallet address beginning with 0x.";
      }
    }

    return null;
  }

  async function handleCreateWallet() {
    setError(null);
    setSuccess(null);

    const validationError = validateAddress();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const trimmedAddress = address.trim();

      const created = await createWallet({
        /*
         * The backend may use the authenticated merchant context.
         * When merchantId exists, we continue sending it for compatibility
         * with the current API contract.
         */
        ...(merchantId ? { merchantId } : {}),

        name: name.trim() || `${asset} Settlement Wallet`,
        currency: "USD",
        blockchain: network,
        network,
        asset,
        type: "CRYPTO",

        /*
         * This is the merchant's actual payout destination.
         */
        address: trimmedAddress,
        walletAddress: trimmedAddress,

        metadata: {
          asset,
          network,
          source: "merchant-settlement-wallet",
          purpose: "crypto-settlement",
        },
      });

      setWallets((current) => [created, ...current]);

      setName("USDT Settlement Wallet");
      setAsset("USDT");
      setNetwork("ETHEREUM");
      setAddress("");

      setSuccess("Settlement wallet saved successfully.");
    } catch (caught) {
      console.error("Wallet creation failed:", caught);

      const err = caught as any;

      const backendMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (err instanceof Error ? err.message : null);

      setError(backendMessage ?? "Unable to save the wallet.");
    } finally {
      setSaving(false);
    }
  }

  async function copyAddress(wallet: WalletRecord) {
    const walletAddress = getWalletAddress(wallet);

    if (!walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(walletAddress);

      setCopiedWalletId(wallet.id);

      window.setTimeout(() => {
        setCopiedWalletId(null);
      }, 2000);
    } catch {
      setError("Unable to copy the wallet address.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">
          Wallet management
        </p>

        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          Wallets
        </h1>

        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Save the cryptocurrency wallet addresses that SmartPOS should use
          when settling payments.
        </p>
      </div>

      <Card className="bg-white text-slate-900 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-slate-900">
            Add settlement wallet
          </CardTitle>

          <p className="text-sm text-slate-500">
            Add a wallet address owned or controlled by the merchant.
            SmartPOS uses the saved address as the settlement destination.
          </p>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="wallet-name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Wallet name
              </label>

              <input
                id="wallet-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="USDT Settlement Wallet"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="wallet-asset"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Asset
              </label>

              <select
                id="wallet-asset"
                value={asset}
                onChange={(event) => setAsset(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="wallet-network"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Network
              </label>

              <select
                id="wallet-network"
                value={network}
                onChange={(event) => setNetwork(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="ETHEREUM">Ethereum</option>
                <option value="BSC">BNB Smart Chain</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="wallet-address"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Wallet address
              </label>

              <input
                id="wallet-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="0x..."
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs text-slate-500">
                Enter the public wallet address that should receive
                settlements. Never enter a seed phrase or private key.
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <Check className="h-4 w-4 shrink-0" />
              {success}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleCreateWallet()}
              disabled={saving}
              className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />

              {saving ? "Saving wallet..." : "Save wallet"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white text-slate-900 shadow-sm ring-1 ring-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-slate-900">
              Saved wallets
            </CardTitle>

            <span className="text-sm text-slate-500">
              {walletSummary}
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          {loading ? (
            <p className="text-sm text-slate-500">
              Loading wallets...
            </p>
          ) : wallets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-white p-2 text-slate-600 ring-1 ring-slate-200">
                  <WalletIcon className="h-5 w-5" />
                </div>

                <div>
                  <p className="font-medium text-slate-900">
                    No settlement wallets yet
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Add the wallet address that should receive
                    cryptocurrency settlements.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {wallets.map((wallet) => {
                const walletAddress = getWalletAddress(wallet);

                return (
                  <div
                    key={wallet.id}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-lg bg-slate-50 p-2 text-slate-700 ring-1 ring-slate-200">
                        <WalletIcon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {wallet.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {String(
                            wallet.metadata?.asset ??
                              wallet.name
                          )}{" "}
                          ·{" "}
                          {String(
                            wallet.blockchain?.name ??
                              wallet.metadata?.network ??
                              "Ethereum"
                          )}
                        </p>

                        <p className="mt-2 break-all font-mono text-xs text-slate-700">
                          {walletAddress || "No public address"}
                        </p>
                      </div>
                    </div>

                    {walletAddress ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyAddress(wallet)}
                        className="shrink-0 gap-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <Copy className="h-3.5 w-3.5" />

                        {copiedWalletId === wallet.id
                          ? "Copied"
                          : "Copy address"}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}