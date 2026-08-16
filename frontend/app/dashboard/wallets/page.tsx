"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Check,
  Copy,
  Plus,
  Wallet as WalletIcon,
} from "lucide-react";

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

import type {
  WalletRecord,
} from "@/features/wallets/types/wallet";

import {
  useAuthStore,
} from "@/store/auth.store";

const ASSETS = [
  {
    value: "USDT",
    label: "USDT",
  },
  {
    value: "USDC",
    label: "USDC",
  },
  {
    value: "ETH",
    label: "ETH",
  },
] as const;

const NETWORKS = [
  {
    value: "ETHEREUM",
    label: "Ethereum",
  },
  {
    value: "BSC",
    label: "BNB Smart Chain",
  },
] as const;

function getWalletAddress(
  wallet: WalletRecord
): string {
  return (
    wallet.address?.trim() ??
    wallet.walletAddresses?.find(
      (item) =>
        item.isActive !== false &&
        Boolean(item.address?.trim())
    )?.address?.trim() ??
    wallet.walletAddresses?.[0]?.address?.trim() ??
    ""
  );
}

function getWalletAsset(
  wallet: WalletRecord
): string {
  const metadataAsset =
    wallet.metadata?.asset;

  if (
    typeof metadataAsset ===
      "string" &&
    metadataAsset.trim()
  ) {
    return metadataAsset
      .trim()
      .toUpperCase();
  }

  return (
    wallet.currency
      ?.toString()
      .toUpperCase() ?? ""
  );
}

function getWalletNetwork(
  wallet: WalletRecord
): string {
  const metadataNetwork =
    wallet.metadata?.network;

  if (
    typeof metadataNetwork ===
      "string" &&
    metadataNetwork.trim()
  ) {
    return metadataNetwork
      .trim()
      .toUpperCase();
  }

  return (
    wallet.blockchain?.name
      ?.toString()
      .toUpperCase() ?? ""
  );
}

function getErrorMessage(
  error: unknown
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: unknown;
            error?: unknown;
            details?: unknown;
          };
        };
      }
    ).response;

    const data = response?.data;

    if (
      typeof data?.message ===
      "string" &&
      data.message.trim()
    ) {
      return data.message;
    }

    if (
      typeof data?.error ===
      "string" &&
      data.error.trim()
    ) {
      return data.error;
    }

    if (
      Array.isArray(data?.details)
    ) {
      const messages =
        data.details
          .map((item) => {
            if (
              typeof item ===
                "object" &&
              item !== null &&
              "message" in item
            ) {
              const message =
                (
                  item as {
                    message?: unknown;
                  }
                ).message;

              return typeof message ===
                "string"
                ? message
                : null;
            }

            return typeof item ===
              "string"
              ? item
              : null;
          })
          .filter(
            (
              item
            ): item is string =>
              Boolean(item)
          );

      if (messages.length > 0) {
        return messages.join(", ");
      }
    }
  }

  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Wallet request failed.";
}

function validatePublicAddress(
  network: string,
  address: string
): string | null {
  const value =
    address.trim();

  if (!value) {
    return "Enter the existing public wallet address.";
  }

  if (
    network === "ETHEREUM" ||
    network === "BSC"
  ) {
    if (
      !/^0x[a-fA-F0-9]{40}$/.test(
        value
      )
    ) {
      return (
        "Enter a valid EVM public address. " +
        "It must start with 0x and contain exactly 40 hexadecimal characters after the prefix."
      );
    }

    return null;
  }

  return `The ${network} network is not supported for wallet storage.`;
}

export default function WalletsPage() {
  const user =
    useAuthStore(
      (state) => state.user
    );

  const merchantId =
    user?.merchantId?.trim() ?? "";

  const [
    wallets,
    setWallets,
  ] = useState<WalletRecord[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    name,
    setName,
  ] = useState(
    "USDT Settlement Wallet"
  );

  const [
    asset,
    setAsset,
  ] = useState("USDT");

  const [
    network,
    setNetwork,
  ] = useState("ETHEREUM");

  const [
    address,
    setAddress,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    success,
    setSuccess,
  ] = useState<string | null>(
    null
  );

  const [
    copiedWalletId,
    setCopiedWalletId,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWallets() {
      if (!merchantId) {
        setWallets([]);

        setError(
          "No merchant account is associated with this signed-in user."
        );

        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await getMerchantWallets(
            merchantId
          );

        if (!cancelled) {
          setWallets(
            result ?? []
          );
        }
      } catch (caught) {
        if (!cancelled) {
          setWallets([]);

          setError(
            getErrorMessage(
              caught
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWallets();

    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const walletSummary =
    useMemo(() => {
      if (wallets.length === 0) {
        return "No wallet records yet.";
      }

      return `${wallets.length} wallet${
        wallets.length === 1
          ? ""
          : "s"
      } saved for settlement.`;
    }, [wallets.length]);

  function handleNetworkChange(
    value: string
  ) {
    setNetwork(value);
    setError(null);
    setSuccess(null);

    /*
     * SmartPOS currently supports public
     * EVM addresses for Ethereum and BNB
     * Smart Chain only.
     *
     * Do not allow an EVM address to be
     * labelled as TRON, Solana, Bitcoin,
     * Cardano, or another network.
     */
    if (
      value !== "ETHEREUM" &&
      value !== "BSC"
    ) {
      setAddress("");
    }
  }

  function handleAssetChange(
    value: string
  ) {
    setAsset(value);
    setError(null);
    setSuccess(null);
  }

  async function handleSaveWallet() {
    setError(null);
    setSuccess(null);

    if (!merchantId) {
      setError(
        "Your authenticated account does not have a merchant account."
      );

      return;
    }

    const walletName =
      name.trim();

    if (!walletName) {
      setError(
        "Enter a wallet name."
      );

      return;
    }

    if (!asset) {
      setError(
        "Select a crypto asset."
      );

      return;
    }

    if (!network) {
      setError(
        "Select a blockchain network."
      );

      return;
    }

    const addressError =
      validatePublicAddress(
        network,
        address
      );

    if (addressError) {
      setError(addressError);
      return;
    }

    setSaving(true);

    try {
      const saved =
        await createWallet({
          merchantId,

          name:
            walletName,

          currency:
            "USD",

          blockchain:
            network,

          network,

          asset,

          type:
            "CRYPTO",

          /*
           * This is the ONLY wallet address
           * involved in wallet creation.
           *
           * SmartPOS stores the address supplied
           * by the merchant. It does not generate
           * one.
           */
          address:
            address.trim(),

          metadata: {
            asset:
              asset.toUpperCase(),

            network:
              network.toUpperCase(),

            source:
              "merchant-settlement-wallet",

            walletGenerated:
              false,

            walletType:
              "EXTERNAL_SETTLEMENT",

            purpose:
              "crypto-settlement",
          },
        });

      setWallets(
        (current) => [
          saved,
          ...current.filter(
            (wallet) =>
              wallet.id !==
              saved.id
          ),
        ]
      );

      setName(
        "USDT Settlement Wallet"
      );

      setAsset("USDT");
      setNetwork("ETHEREUM");
      setAddress("");

      setSuccess(
        "Wallet saved successfully."
      );
    } catch (caught) {
      setError(
        getErrorMessage(caught)
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyAddress(
    wallet: WalletRecord
  ) {
    const walletAddress =
      getWalletAddress(wallet);

    if (!walletAddress) {
      setError(
        "This wallet does not have a saved public address."
      );

      return;
    }

    try {
      await navigator.clipboard.writeText(
        walletAddress
      );

      setCopiedWalletId(
        wallet.id
      );

      window.setTimeout(
        () => {
          setCopiedWalletId(
            null
          );
        },
        2000
      );
    } catch {
      setError(
        "Unable to copy the wallet address."
      );
    }
  }

  return (
    <div className="space-y-6 bg-slate-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">
            Settlement
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Wallets
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Save the public cryptocurrency
            addresses that SmartPOS should
            use as settlement destinations.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Saved wallets
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {walletSummary}
          </p>
        </div>
      </div>

      {!merchantId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No merchant account is associated
          with the current authenticated user.
          Sign in with a merchant account before
          saving a settlement wallet.
        </div>
      ) : null}

      <Card className="border border-slate-200 bg-white text-slate-900 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-slate-900">
            Add settlement wallet
          </CardTitle>

          <p className="text-sm leading-6 text-slate-500">
            Enter an existing public wallet
            address controlled by the merchant.
            SmartPOS only validates and saves
            the address.
          </p>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-5 md:grid-cols-2">
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
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
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
                onChange={(event) =>
                  handleAssetChange(
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {ASSETS.map(
                  (item) => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {item.label}
                    </option>
                  )
                )}
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
                onChange={(event) =>
                  handleNetworkChange(
                    event.target.value
                  )
                }
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {NETWORKS.map(
                  (item) => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="wallet-address"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Public wallet address
              </label>

              <input
                id="wallet-address"
                value={address}
                onChange={(event) =>
                  setAddress(
                    event.target.value
                  )
                }
                placeholder="0x..."
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Enter only the public address.
                Never enter a private key,
                seed phrase, mnemonic, or secret.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
            SmartPOS does not generate or
            custody wallet addresses. The
            address you provide becomes the
            saved settlement destination.
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
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
              onClick={() =>
                void handleSaveWallet()
              }
              disabled={
                saving ||
                !merchantId
              }
              className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />

              {saving
                ? "Saving wallet..."
                : "Save wallet"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 bg-white text-slate-900 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-slate-900">
            Saved wallets
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6">
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              Loading saved wallets...
            </div>
          ) : wallets.length ===
            0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-white p-2 text-blue-700 ring-1 ring-slate-200">
                  <WalletIcon className="h-5 w-5" />
                </div>

                <div>
                  <p className="font-semibold text-slate-900">
                    No wallets yet
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Save an existing public
                    wallet address to use it
                    as a crypto settlement
                    destination.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {wallets.map(
                (wallet) => {
                  const walletAddress =
                    getWalletAddress(
                      wallet
                    );

                  const walletAsset =
                    getWalletAsset(
                      wallet
                    );

                  const walletNetwork =
                    getWalletNetwork(
                      wallet
                    );

                  return (
                    <div
                      key={
                        wallet.id
                      }
                      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-lg bg-blue-50 p-2 text-blue-700 ring-1 ring-blue-100">
                          <WalletIcon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">
                              {
                                wallet.name
                              }
                            </p>

                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Ready
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            {walletAsset ||
                              "Crypto"}{" "}
                            ·{" "}
                            {walletNetwork ||
                              "Network unavailable"}
                          </p>

                          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-xs font-medium text-slate-500">
                              Public address
                            </p>

                            <p className="mt-1 break-all font-mono text-xs text-slate-800">
                              {walletAddress ||
                                "No public address returned by the server."}
                            </p>
                          </div>
                        </div>
                      </div>

                      {walletAddress ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void copyAddress(
                              wallet
                            )
                          }
                          className="shrink-0 gap-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        >
                          <Copy className="h-3.5 w-3.5" />

                          {copiedWalletId ===
                          wallet.id
                            ? "Copied"
                            : "Copy address"}
                        </Button>
                      ) : null}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}