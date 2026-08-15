"use client";

import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  createWallet,
  getMerchantWallets,
} from "@/features/wallets/services/wallet.service";
import type { WalletRecord } from "@/features/wallets/types/wallet";
import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { useAuthStore } from "@/store/auth.store";

export default function NewPaymentPage() {
  const merchantId = useAuthStore(
    (state) => state.user?.merchantId ?? ""
  );

  const [amount, setAmount] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("ETHEREUM");
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [customerEmail, setCustomerEmail] = useState(
    "customer@example.com"
  );

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

        if (data?.[0]?.id) {
          setSelectedWalletId(data[0].id);
        }
      } catch {
        setWallets([]);
      } finally {
        setLoadingWallets(false);
      }
    };

    void run();
  }, [merchantId]);

  const selectedWallet = useMemo(
    () =>
      wallets.find(
        (wallet) => wallet.id === selectedWalletId
      ) ?? null,
    [selectedWalletId, wallets]
  );

  const destinationAddress = useMemo(() => {
    if (customAddress.trim()) {
      return customAddress.trim();
    }

    return (
      selectedWallet?.address ??
      selectedWallet?.walletAddresses?.[0]?.address ??
      ""
    );
  }, [customAddress, selectedWallet]);

  async function handleCreateWallet() {
    if (!merchantId) {
      setError(
        "The current merchant account is not available."
      );
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
      setError(
        caught instanceof Error
          ? caught.message
          : "Wallet creation failed."
      );
    } finally {
      setCreatingWallet(false);
    }
  }

  async function handleCreatePaymentIntent() {
    if (!merchantId) {
      setError(
        "The current merchant account is not available."
      );
      return;
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError(
        "Enter a valid payment amount greater than zero."
      );
      return;
    }

    if (!destinationAddress) {
      setError(
        "Select a saved wallet or provide a destination address."
      );
      return;
    }

    setCreatingPayment(true);
    setError(null);

    try {
      const response = await api.post<{
        success: boolean;
        data: {
          id: string;
          amount: number;
          currency: string;
          status: string;
        };
      }>(ENDPOINTS.paymentIntents.list, {
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
      });

      const paymentIntent = response.data.data;

      if (!paymentIntent?.id) {
        throw new Error(
          "Payment session could not be created."
        );
      }

      const checkout = await api.post<{
        success: boolean;
        data: {
          gateway?: {
            paymentUrl?: string;
            accessCode?: string;
          };
        };
      }>(
        ENDPOINTS.paymentIntents.checkout(
          paymentIntent.id
        ),
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

      const paymentUrl =
        checkout.data.data.gateway?.paymentUrl;

      const accessCode =
        checkout.data.data.gateway?.accessCode;

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
      setError(
        caught instanceof Error
          ? caught.message
          : "Payment session could not be created."
      );
    } finally {
      setCreatingPayment(false);
    }
  }

  const formattedAmount = new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }
  ).format(Number(amount || 0));

  return (
    <div className="space-y-6">
      {/* Back to payments */}
      <div>
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Payments
        </Link>
      </div>

      {/* Page heading */}
      <div>
        <p className="text-sm font-medium text-slate-500">
          SmartPOS terminal
        </p>

        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          New Payment
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Create a payment and send the customer to the secure
          Paystack checkout.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Payment details */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Payment details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter the payment information and destination.
            </p>
          </div>

          <div className="space-y-6 px-6 py-6">
            {/* Amount + currency */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="amount"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Amount
                </label>

                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label
                  htmlFor="currency"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Fiat currency
                </label>

                <select
                  id="currency"
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value)
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="USD">USD</option>
                  <option value="NGN">NGN</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {/* Crypto asset + network */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="asset"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Crypto asset
                </label>

                <select
                  id="asset"
                  value={asset}
                  onChange={(event) =>
                    setAsset(event.target.value)
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="network"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Network
                </label>

                <select
                  id="network"
                  value={network}
                  onChange={(event) =>
                    setNetwork(event.target.value)
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="ETHEREUM">
                    Ethereum
                  </option>

                  <option value="TRON" disabled>
                    TRON (unsupported)
                  </option>

                  <option value="BSC">BSC</option>
                </select>
              </div>
            </div>

            {/* Customer email */}
            <div>
              <label
                htmlFor="customerEmail"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Customer email
              </label>

              <input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(event) =>
                  setCustomerEmail(event.target.value)
                }
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            {/* Destination wallet */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-white p-2 text-slate-700 shadow-sm">
                  <Wallet className="h-4 w-4" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Destination wallet
                  </h3>

                  <p className="text-xs text-slate-500">
                    Choose where the crypto settlement will be sent.
                  </p>
                </div>
              </div>

              {loadingWallets ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">
                    Loading wallets...
                  </p>
                </div>
              ) : wallets.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-600">
                    No saved wallets yet.
                  </p>

                  <Link
                    href="/dashboard/wallets"
                    className="mt-1 inline-block text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-slate-600"
                  >
                    Add a wallet first
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {wallets.map((wallet) => {
                    const walletAddress =
                      wallet.address ??
                      wallet.walletAddresses?.[0]?.address ??
                      "";

                    return (
                      <label
                        key={wallet.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                          selectedWalletId === wallet.id
                            ? "border-slate-400 bg-white shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="wallet"
                          checked={
                            selectedWalletId === wallet.id
                          }
                          onChange={() =>
                            setSelectedWalletId(wallet.id)
                          }
                          className="mt-1"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">
                            {wallet.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {String(
                              wallet.blockchain?.name ??
                                network
                            )}{" "}
                            ·{" "}
                            {String(
                              wallet.metadata?.asset ??
                                asset
                            )}
                          </p>

                          <p className="mt-2 break-all font-mono text-xs text-slate-600">
                            {walletAddress ||
                              "Address missing"}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* External destination */}
              <div className="mt-5">
                <label
                  htmlFor="customAddress"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  External destination address
                </label>

                <input
                  id="customAddress"
                  value={customAddress}
                  onChange={(event) =>
                    setCustomAddress(event.target.value)
                  }
                  placeholder="Enter wallet address"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Use this when the destination wallet has not
                  been saved yet.
                </p>
              </div>

              {/* Temporary existing create-wallet action */}
              <div className="mt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreateWallet}
                  disabled={creatingWallet}
                  className="gap-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <Wallet className="h-4 w-4" />

                  {creatingWallet
                    ? "Creating wallet..."
                    : "Save wallet"}
                </Button>
              </div>
            </div>

            {/* Error */}
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            ) : null}

            {/* Continue */}
            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button
                onClick={handleCreatePaymentIntent}
                disabled={creatingPayment}
                className="gap-2"
              >
                {creatingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}

                {creatingPayment
                  ? "Creating payment..."
                  : "Continue to payment"}
              </Button>
            </div>
          </div>
        </div>

        {/* Review */}
        <div className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Review
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Check the payment before continuing.
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Amount
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formattedAmount}
              </p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">
                  Crypto
                </span>

                <span className="font-medium text-slate-900">
                  {asset}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">
                  Network
                </span>

                <span className="font-medium text-slate-900">
                  {network}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">
                    Destination
                  </span>

                  <span className="font-medium text-slate-900">
                    {destinationAddress
                      ? "Set"
                      : "Not set"}
                  </span>
                </div>

                {destinationAddress ? (
                  <p className="mt-2 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
                    {destinationAddress}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">
                  Fee
                </span>

                <span className="font-medium text-slate-900">
                  Calculated at payment
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs leading-5 text-slate-500">
                The customer will be redirected to the secure
                payment flow after the payment session is created.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}