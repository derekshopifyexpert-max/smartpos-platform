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
  Trash2,
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
  getWallets,
  deleteWallet,
} from "@/features/wallets/services/wallet.service";

import type {
  WalletRecord,
} from "@/features/wallets/types/wallet";

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
  const directAddress =
    typeof wallet.address === "string"
      ? wallet.address.trim()
      : "";

  if (directAddress) {
    return directAddress;
  }

  const activeAddress =
    wallet.walletAddresses?.find(
      (item) =>
        item &&
        item.isActive !== false &&
        typeof item.address === "string" &&
        item.address.trim()
    );

  if (activeAddress?.address?.trim()) {
    return activeAddress.address.trim();
  }

  const firstAddress =
    wallet.walletAddresses?.find(
      (item) =>
        item &&
        typeof item.address === "string" &&
        item.address.trim()
    );

  return firstAddress?.address?.trim() ?? "";
}

function getWalletAsset(
  wallet: WalletRecord
): string {
  const metadataAsset =
    wallet.metadata?.asset;

  if (
    typeof metadataAsset === "string" &&
    metadataAsset.trim()
  ) {
    return metadataAsset
      .trim()
      .toUpperCase();
  }

  if (
    typeof wallet.asset === "string" &&
    wallet.asset.trim()
  ) {
    return wallet.asset
      .trim()
      .toUpperCase();
  }

  if (
    wallet.currency !== null &&
    wallet.currency !== undefined
  ) {
    return String(wallet.currency)
      .trim()
      .toUpperCase();
  }

  return "";
}

function getWalletNetwork(
  wallet: WalletRecord
): string {
  const metadataNetwork =
    wallet.metadata?.network;

  if (
    typeof metadataNetwork === "string" &&
    metadataNetwork.trim()
  ) {
    return metadataNetwork
      .trim()
      .toUpperCase();
  }

  if (
    typeof wallet.network === "string" &&
    wallet.network.trim()
  ) {
    return wallet.network
      .trim()
      .toUpperCase();
  }

  if (
    wallet.blockchain?.name &&
    String(wallet.blockchain.name).trim()
  ) {
    return String(wallet.blockchain.name)
      .trim()
      .toUpperCase();
  }

  return "";
}

function getNetworkLabel(
  network: string
): string {
  const normalized =
    network.trim().toUpperCase();

  const match = NETWORKS.find(
    (item) =>
      item.value === normalized
  );

  return (
    match?.label ??
    network
  );
}

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message.trim();
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

  const normalizedNetwork =
    network.trim().toUpperCase();

  if (
    normalizedNetwork === "ETHEREUM" ||
    normalizedNetwork === "BSC"
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
    deletingWalletId,
    setDeletingWalletId,
  ] = useState<string | null>(
    null
  );

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
      setLoading(true);
      setError(null);

      try {
        /*
         * The authenticated API session determines which
         * wallets are returned. No merchantId is required
         * by the frontend.
         */
        const result =
          await getWallets();

        if (!cancelled) {
          setWallets(result);
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
  }, []);

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

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  async function handleSaveWallet() {
    clearMessages();

    const walletName =
      name.trim();

    if (!walletName) {
      setError(
        "Enter a wallet name."
      );
      return;
    }

    if (!asset.trim()) {
      setError(
        "Select a crypto asset."
      );
      return;
    }

    if (!network.trim()) {
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
      setError(
        addressError
      );
      return;
    }

    setSaving(true);

    try {
      const normalizedAsset =
        asset.trim().toUpperCase();

      const normalizedNetwork =
        network.trim().toUpperCase();

      const publicAddress =
        address.trim();

      const saved =
        await createWallet({
          name: walletName,

          currency:
            normalizedAsset,

          blockchain:
            normalizedNetwork,

          network:
            normalizedNetwork,

          asset:
            normalizedAsset,

          address:
            publicAddress,

          type: "CRYPTO",

          metadata: {
            asset:
              normalizedAsset,

            network:
              normalizedNetwork,

            source:
              "user-provided",

            walletGenerated:
              false,

            walletType:
              "EXTERNAL_SETTLEMENT",

            purpose:
              "crypto-settlement",

            custody:
              "external",
          },
        });

      /*
       * Put the server-returned wallet at the front
       * immediately. The returned record is the source
       * of truth, including its persisted address.
       */
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
        getErrorMessage(
          caught
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyAddress(
    wallet: WalletRecord
  ) {
    clearMessages();

    const walletAddress =
      getWalletAddress(wallet);

    if (!walletAddress) {
      setError(
        "This wallet does not have a saved public address."
      );

      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard
    ) {
      setError(
        "Clipboard access is unavailable in this browser."
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

  async function handleDeleteWallet(
    wallet: WalletRecord
  ) {
    const confirmed =
      window.confirm(
        `Delete "${wallet.name}"?\n\nThis removes the saved settlement destination from SmartPOS. This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    clearMessages();
    setDeletingWalletId(
      wallet.id
    );

    try {
      await deleteWallet(
        wallet.id
      );

      setWallets(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              wallet.id
          )
      );

      setSuccess(
        "Wallet deleted successfully."
      );
    } catch (caught) {
      setError(
        getErrorMessage(
          caught
        )
      );
    } finally {
      setDeletingWalletId(
        null
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
            Save existing public cryptocurrency
            addresses that SmartPOS should use
            as settlement destinations.
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

      <Card className="border border-slate-200 bg-white text-slate-900 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-slate-900">
            Add settlement wallet
          </CardTitle>

          <p className="text-sm leading-6 text-slate-500">
            Enter an existing public wallet
            address. SmartPOS stores the address
            you provide and does not generate or
            custody the wallet.
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
                onChange={(event) => {
                  setName(
                    event.target.value
                  );
                  clearMessages();
                }}
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
                onChange={(event) => {
                  setAsset(
                    event.target.value
                  );
                  clearMessages();
                }}
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
                onChange={(event) => {
                  setNetwork(
                    event.target.value
                  );
                  clearMessages();
                }}
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
                onChange={(event) => {
                  setAddress(
                    event.target.value
                  );
                  clearMessages();
                }}
                placeholder="0x..."
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Public address only. Never enter
                a private key or seed phrase.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
            SmartPOS saves the existing address
            you provide. It does not generate a
            wallet or require ownership of the
            address.
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
              disabled={saving}
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
          ) : wallets.length === 0 ? (
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
                    Save an existing public wallet
                    address to use it as a crypto
                    settlement destination.
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

                  const isDeleting =
                    deletingWalletId ===
                    wallet.id;

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
                            {getNetworkLabel(
                              walletNetwork
                            )}
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

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                            className="gap-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          >
                            {copiedWalletId ===
                            wallet.id ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}

                            {copiedWalletId ===
                            wallet.id
                              ? "Copied"
                              : "Copy address"}
                          </Button>
                        ) : null}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            isDeleting
                          }
                          onClick={() =>
                            void handleDeleteWallet(
                              wallet
                            )
                          }
                          className="gap-2 border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />

                          {isDeleting
                            ? "Deleting..."
                            : "Delete"}
                        </Button>
                      </div>
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