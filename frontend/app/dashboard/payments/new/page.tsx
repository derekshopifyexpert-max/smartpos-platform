"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getMerchantWallets } from "@/features/wallets/services/wallet.service";
import type { WalletRecord } from "@/features/wallets/types/wallet";
import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { useAuthStore } from "@/store/auth.store";

interface CreatePaymentIntentResponse {
  success: boolean;
  data: {
    id: string;
    amount: number | string;
    currency: string;
    status: string;
    metadata?: unknown;
  };
}

interface CheckoutResponse {
  success: boolean;
  data: {
    paymentIntent?: {
      id?: string;
      status?: string;
    };
    transaction?: {
      id?: string;
      status?: string;
    };
    gateway?: {
      transactionId?: string | null;
      paymentUrl?: string | null;
      accessCode?: string | null;
      authorizationCode?: string | null;
    };
    quote?: unknown;
  };
}

function getWalletAddress(wallet: WalletRecord | null) {
  if (!wallet) {
    return "";
  }

  return (
    wallet.address ??
    wallet.walletAddresses?.find((address) => address.isActive)?.address ??
    wallet.walletAddresses?.[0]?.address ??
    ""
  );
}

function getWalletAsset(wallet: WalletRecord) {
  const asset = wallet.metadata?.asset;

  return typeof asset === "string"
    ? asset.toUpperCase()
    : "";
}

function getWalletNetwork(wallet: WalletRecord) {
  const metadataNetwork = wallet.metadata?.network;

  if (typeof metadataNetwork === "string" && metadataNetwork.trim()) {
    return metadataNetwork.toUpperCase();
  }

  return wallet.blockchain?.name?.toUpperCase() ?? "";
}

function formatAddress(address: string) {
  if (address.length <= 18) {
    return address;
  }

  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function getErrorMessage(error: unknown) {
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

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (typeof data?.error === "string") {
      return data.error;
    }

    if (Array.isArray(data?.details)) {
      const messages = data.details
        .map((detail) => {
          if (
            typeof detail === "object" &&
            detail !== null &&
            "message" in detail
          ) {
            const message = (detail as { message?: unknown }).message;

            return typeof message === "string"
              ? message
              : null;
          }

          return typeof detail === "string"
            ? detail
            : null;
        })
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join(", ");
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The payment could not be started.";
}

export default function NewPaymentPage() {
  const merchantId = useAuthStore(
    (state) => state.user?.merchantId ?? ""
  );

  const [amount, setAmount] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("ETHEREUM");
  const [customerEmail, setCustomerEmail] = useState("");

  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");

  const [loadingWallets, setLoadingWallets] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);

  const [walletError, setWalletError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) {
      setWallets([]);
      setSelectedWalletId("");
      return;
    }

    let cancelled = false;

    async function loadWallets() {
      setLoadingWallets(true);
      setWalletError(null);

      try {
        const result = await getMerchantWallets(merchantId);

        if (cancelled) {
          return;
        }

        setWallets(result ?? []);
      } catch (caught) {
        if (cancelled) {
          return;
        }

        setWallets([]);
        setSelectedWalletId("");
        setWalletError(getErrorMessage(caught));
      } finally {
        if (!cancelled) {
          setLoadingWallets(false);
        }
      }
    }

    void loadWallets();

    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const compatibleWallets = useMemo(() => {
    return wallets.filter((wallet) => {
      const walletAsset = getWalletAsset(wallet);
      const walletNetwork = getWalletNetwork(wallet);

      const assetMatches =
        !walletAsset ||
        walletAsset === asset.toUpperCase();

      const networkMatches =
        !walletNetwork ||
        walletNetwork === network.toUpperCase();

      const addressExists =
        getWalletAddress(wallet).trim().length > 0;

      return (
        assetMatches &&
        networkMatches &&
        addressExists
      );
    });
  }, [wallets, asset, network]);

  useEffect(() => {
    if (!selectedWalletId) {
      return;
    }

    const stillCompatible = compatibleWallets.some(
      (wallet) => wallet.id === selectedWalletId
    );

    if (!stillCompatible) {
      setSelectedWalletId("");
    }
  }, [compatibleWallets, selectedWalletId]);

  const selectedWallet = useMemo(
    () =>
      compatibleWallets.find(
        (wallet) => wallet.id === selectedWalletId
      ) ?? null,
    [compatibleWallets, selectedWalletId]
  );

  const destinationAddress =
    getWalletAddress(selectedWallet);

  const numericAmount = Number(amount);

  const amountIsValid =
    Number.isFinite(numericAmount) &&
    numericAmount > 0;

  const canCreatePayment =
    Boolean(merchantId) &&
    amountIsValid &&
    Boolean(customerEmail.trim()) &&
    Boolean(selectedWallet) &&
    Boolean(destinationAddress) &&
    !creatingPayment;

  function handleAssetChange(value: string) {
    setAsset(value);
    setSelectedWalletId("");
    setError(null);
  }

  function handleNetworkChange(value: string) {
    setNetwork(value);
    setSelectedWalletId("");
    setError(null);
  }

  async function handleCreatePayment() {
    setError(null);

    if (!merchantId) {
      setError(
        "Your authenticated account does not have a merchant account. Sign in with a merchant account before creating a payment."
      );
      return;
    }

    if (!amountIsValid) {
      setError(
        "Enter a valid payment amount greater than zero."
      );
      return;
    }

    if (!customerEmail.trim()) {
      setError(
        "Enter the customer's email address."
      );
      return;
    }

    if (!selectedWallet) {
      setError(
        `Select a saved ${asset} wallet on ${network} before continuing.`
      );
      return;
    }

    if (!destinationAddress) {
      setError(
        "The selected wallet does not have a saved public address."
      );
      return;
    }

    const walletAsset = getWalletAsset(selectedWallet);
    const walletNetwork = getWalletNetwork(selectedWallet);

    if (
      walletAsset &&
      walletAsset !== asset.toUpperCase()
    ) {
      setError(
        `The selected wallet is configured for ${walletAsset}, not ${asset}.`
      );
      return;
    }

    if (
      walletNetwork &&
      walletNetwork !== network.toUpperCase()
    ) {
      setError(
        `The selected wallet is configured for ${walletNetwork}, not ${network}.`
      );
      return;
    }

    setCreatingPayment(true);

    try {
      const response =
        await api.post<CreatePaymentIntentResponse>(
          ENDPOINTS.paymentIntents.list,
          {
            merchantId,
            amount: numericAmount,
            currency,

            description:
              `SmartPOS payment for ${currency} ${numericAmount}`,

            metadata: {
              cryptoDestination: {
                asset,
                network,
                walletId: selectedWallet.id,
                address: destinationAddress,
                amount: numericAmount,
                currency,
              },
            },
          }
        );

      const paymentIntent =
        response.data?.data;

      if (!paymentIntent?.id) {
        throw new Error(
          "The payment session was not created by the server."
        );
      }

      const checkout =
        await api.post<CheckoutResponse>(
          ENDPOINTS.paymentIntents.checkout(
            paymentIntent.id
          ),
          {
            email: customerEmail.trim(),
          }
        );

      const checkoutData =
        checkout.data?.data;

      const paymentUrl =
        checkoutData?.gateway?.paymentUrl;

      const accessCode =
        checkoutData?.gateway?.accessCode;

      /*
       * The backend is the source of truth for the
       * checkout result. Do not fabricate a success
       * state or fake gateway URL.
       */
      if (paymentUrl) {
        window.location.href = paymentUrl;
        return;
      }

      /*
       * The existing customer payment page knows how
       * to continue the checkout session using the
       * payment intent ID.
       */
      if (accessCode || paymentIntent.id) {
        window.location.href =
          `/pay/${paymentIntent.id}`;
        return;
      }

      throw new Error(
        "The payment was created but the server did not return a checkout destination."
      );
    } catch (caught) {
      console.error(
        "SmartPOS payment creation failed:",
        caught
      );

      setError(
        getErrorMessage(caught)
      );
    } finally {
      setCreatingPayment(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/dashboard/payments"
            className="inline-flex items-center gap-2 text-slate-500 transition hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Payments
          </Link>
        </div>

        <div>
          <p className="text-sm font-medium text-blue-600">
            SmartPOS terminal
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            New Payment
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Create a payment session and route the crypto
            settlement to one of your merchant's saved
            wallet addresses.
          </p>
        </div>

        {!merchantId ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

              <div>
                <p className="font-semibold text-amber-900">
                  Merchant account unavailable
                </p>

                <p className="mt-1 text-sm leading-6 text-amber-800">
                  The authenticated user does not currently
                  have a merchant ID. Sign in with the correct
                  merchant account before creating a payment.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <div>
                <p className="font-semibold text-red-900">
                  Payment could not be started
                </p>

                <p className="mt-1 text-sm leading-6 text-red-800">
                  {error}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-slate-900">
                Payment details
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="payment-amount"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Amount
                  </label>

                  <input
                    id="payment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(event) =>
                      setAmount(event.target.value)
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="fiat-currency"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Fiat currency
                  </label>

                  <select
                    id="fiat-currency"
                    value={currency}
                    onChange={(event) =>
                      setCurrency(event.target.value)
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="USD">
                      USD
                    </option>

                    <option value="NGN">
                      NGN
                    </option>

                    <option value="EUR">
                      EUR
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="crypto-asset"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Crypto asset
                  </label>

                  <select
                    id="crypto-asset"
                    value={asset}
                    onChange={(event) =>
                      handleAssetChange(
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="USDT">
                      USDT
                    </option>

                    <option value="USDC">
                      USDC
                    </option>

                    <option value="ETH">
                      ETH
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="crypto-network"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Network
                  </label>

                  <select
                    id="crypto-network"
                    value={network}
                    onChange={(event) =>
                      handleNetworkChange(
                        event.target.value
                      )
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="ETHEREUM">
                      Ethereum
                    </option>

                    <option value="BSC">
                      BSC
                    </option>

                    <option
                      value="TRON"
                      disabled
                    >
                      TRON (unsupported)
                    </option>
                  </select>

                  {network === "TRON" ? (
                    <p className="mt-2 text-xs text-red-600">
                      TRON settlement is not currently
                      supported by the wallet layer.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <label
                  htmlFor="customer-email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Customer email
                </label>

                <input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(event) =>
                    setCustomerEmail(
                      event.target.value
                    )
                  }
                  placeholder="customer@example.com"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white p-2 text-blue-600 shadow-sm">
                      <Wallet className="h-5 w-5" />
                    </div>

                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Settlement wallet
                      </h2>

                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        Select the merchant wallet that
                        matches the selected asset and network.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/dashboard/wallets"
                    className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Manage wallets
                  </Link>
                </div>

                {loadingWallets ? (
                  <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading saved wallets...
                  </div>
                ) : walletError ? (
                  <div className="mt-5 rounded-lg border border-red-200 bg-white p-4">
                    <p className="text-sm font-medium text-red-800">
                      Unable to load saved wallets.
                    </p>

                    <p className="mt-1 text-sm text-red-700">
                      {walletError}
                    </p>

                    <Link
                      href="/dashboard/wallets"
                      className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Open Wallets
                    </Link>
                  </div>
                ) : compatibleWallets.length === 0 ? (
                  <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 text-slate-400" />

                      <div>
                        <p className="font-medium text-slate-900">
                          No compatible saved wallet
                        </p>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          No saved wallet matches{" "}
                          <strong>
                            {asset}
                          </strong>{" "}
                          on{" "}
                          <strong>
                            {network}
                          </strong>
                          .
                        </p>

                        <Link
                          href="/dashboard/wallets"
                          className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Add a wallet address
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {compatibleWallets.map(
                      (wallet) => {
                        const address =
                          getWalletAddress(
                            wallet
                          );

                        const checked =
                          selectedWalletId ===
                          wallet.id;

                        return (
                          <label
                            key={wallet.id}
                            className={`block cursor-pointer rounded-xl border bg-white p-4 transition ${
                              checked
                                ? "border-blue-500 ring-2 ring-blue-100"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="settlement-wallet"
                                checked={checked}
                                onChange={() =>
                                  setSelectedWalletId(
                                    wallet.id
                                  )
                                }
                                className="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-semibold text-slate-900">
                                    {wallet.name}
                                  </p>

                                  {checked ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Selected
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-1 text-xs font-medium text-slate-500">
                                  {getWalletAsset(
                                    wallet
                                  ) || asset}{" "}
                                  ·{" "}
                                  {getWalletNetwork(
                                    wallet
                                  ) || network}
                                </p>

                                <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                                  {address}
                                </p>
                              </div>
                            </div>
                          </label>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm leading-6 text-blue-900">
                  SmartPOS does not generate a new wallet for this
                  payment. The selected saved public address is
                  passed to the backend as the settlement
                  destination.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleCreatePayment}
                  disabled={!canCreatePayment}
                  className="gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            </CardContent>
          </Card>

          <Card className="h-fit border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-slate-900">
                Review
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5 pt-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-500">
                  Amount
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {amountIsValid
                    ? (() => {
                        try {
                          return new Intl.NumberFormat(
                            "en-US",
                            {
                              style: "currency",
                              currency,
                              maximumFractionDigits: 2,
                            }
                          ).format(
                            numericAmount
                          );
                        } catch {
                          return `${numericAmount.toLocaleString()} ${currency}`;
                        }
                      })()
                    : `0.00 ${currency}`}
                </p>
              </div>

              <div className="space-y-4">
                <ReviewRow
                  label="Fiat currency"
                  value={currency}
                />

                <ReviewRow
                  label="Crypto"
                  value={asset}
                />

                <ReviewRow
                  label="Network"
                  value={network}
                />

                <ReviewRow
                  label="Destination"
                  value={
                    destinationAddress
                      ? formatAddress(
                          destinationAddress
                        )
                      : "Select a saved wallet"
                  }
                  mono
                />

                <ReviewRow
                  label="Wallet"
                  value={
                    selectedWallet?.name ??
                    "Not selected"
                  }
                />

                <ReviewRow
                  label="Fee"
                  value="Calculated by the server during checkout"
                />
              </div>

              <div className="border-t border-slate-200 pt-5">
                <p className="text-xs leading-5 text-slate-500">
                  The fee is not fabricated in the browser.
                  The backend exchange/payment flow is the
                  source of truth for server-side quote data.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span
        className={`max-w-[65%] text-right text-sm font-semibold text-slate-900 ${
          mono ? "break-all font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}