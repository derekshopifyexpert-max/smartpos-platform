"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  Wallet,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  getMerchantWallets,
} from "@/features/wallets/services/wallet.service";

import { PaymentProviderAccountSelector } from "@/features/payment/components/payment-provider-account-selector";

import type {
  WalletRecord,
} from "@/features/wallets/types/wallet";

import {
  api,
  getApiErrorMessage,
} from "@/lib/api/client";

import { ENDPOINTS } from "@/lib/api/endpoints";

import {
  useAuthStore,
} from "@/store/auth.store";

interface PaymentQuote {
  fee?: string | number | null;
  feeAmount?: string | number | null;
  total?: string | number | null;
  cryptoAmount?: string | number | null;
  [key: string]: unknown;
}

interface PaymentIntentData {
  id: string;
  amount: number | string;
  currency: string;
  status: string;
  metadata?: unknown;
}

interface CreatePaymentIntentResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: PaymentIntentData;
}

interface CheckoutData {
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

  quote?: PaymentQuote | null;
}

interface CheckoutResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: CheckoutData;
}

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
  wallet: WalletRecord | null
): string {
  if (!wallet) {
    return "";
  }

  const directAddress =
    wallet.address?.trim();

  if (directAddress) {
    return directAddress;
  }

  const activeAddress =
    wallet.walletAddresses?.find(
      (item) =>
        item.isActive !== false &&
        Boolean(item.address?.trim())
    );

  if (activeAddress?.address?.trim()) {
    return activeAddress.address.trim();
  }

  const firstAddress =
    wallet.walletAddresses?.find(
      (item) =>
        Boolean(item.address?.trim())
    );

  return (
    firstAddress?.address?.trim() ?? ""
  );
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
    typeof wallet.currency === "string" &&
    wallet.currency.trim()
  ) {
    return wallet.currency
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
    typeof wallet.blockchain ===
      "object" &&
    wallet.blockchain?.name
  ) {
    return wallet.blockchain.name
      .toString()
      .trim()
      .toUpperCase();
  }

  return "";
}

function formatAddress(
  address: string
): string {
  if (address.length <= 18) {
    return address;
  }

  return `${address.slice(
    0,
    10
  )}...${address.slice(-8)}`;
}

function formatMoneyValue(
  value:
    | string
    | number
    | null
    | undefined,
  currency: string
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Unavailable";
  }

  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return `${currency} ${String(value)}`;
  }

  return `${currency} ${numeric.toFixed(2)}`;
}

function getResponseError(
  response:
    | {
        message?: string;
        error?: string;
      }
    | undefined
): string {
  if (
    response?.message &&
    response.message.trim()
  ) {
    return response.message;
  }

  if (
    response?.error &&
    response.error.trim()
  ) {
    return response.error;
  }

  return "The server rejected the payment request.";
}

export default function NewPaymentPage() {
  /*
   * Authentication is still required to use the
   * dashboard, but merchantId is NOT required by
   * the frontend to load saved wallets.
   *
   * The backend remains responsible for resolving
   * the authenticated merchant context.
   */
  const merchantId =
    useAuthStore(
      (state) =>
        state.user?.merchantId?.trim() ??
        ""
    );

  const [
    amount,
    setAmount,
  ] = useState("100");

  const [
    currency,
    setCurrency,
  ] = useState("NGN");

  const [
    paymentProviderAccountId,
    setPaymentProviderAccountId,
  ] = useState<string | null>(null);

  const [
    asset,
    setAsset,
  ] = useState("USDT");

  const [
    network,
    setNetwork,
  ] = useState("ETHEREUM");

  const [
    customerEmail,
    setCustomerEmail,
  ] = useState("");

  const [
    wallets,
    setWallets,
  ] = useState<WalletRecord[]>([]);

  const [
    selectedWalletId,
    setSelectedWalletId,
  ] = useState("");

  const [
    loadingWallets,
    setLoadingWallets,
  ] = useState(false);

  const [
    creatingPayment,
    setCreatingPayment,
  ] = useState(false);

  const [
    quote,
    setQuote,
  ] = useState<PaymentQuote | null>(
    null
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    checkoutMessage,
    setCheckoutMessage,
  ] = useState<string | null>(
    null
  );

  /*
   * Load saved wallets directly from the
   * authenticated wallet endpoint.
   *
   * IMPORTANT:
   * Do NOT pass merchantId here.
   *
   * The wallet service already loads the
   * authenticated user's available wallets.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadWallets() {
      setLoadingWallets(true);

      setError(null);

      try {
        const result =
          await getMerchantWallets();

        if (cancelled) {
          return;
        }

        setWallets(
          Array.isArray(result)
            ? result
            : []
        );

        /*
         * If the selected wallet still exists,
         * preserve it. Otherwise clear it.
         */
        setSelectedWalletId(
          (currentId) => {
            if (!currentId) {
              return "";
            }

            const exists =
              result.some(
                (wallet) =>
                  wallet.id === currentId
              );

            return exists
              ? currentId
              : "";
          }
        );
      } catch (caught) {
        if (cancelled) {
          return;
        }

        setWallets([]);

        setSelectedWalletId("");

        setError(
          getApiErrorMessage(
            caught,
            "Unable to load saved wallets."
          )
        );
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
  }, []);

  /*
   * Only wallets with an actual saved public
   * address can be used as payment destinations.
   */
  const walletsWithAddresses =
    useMemo(() => {
      return wallets.filter(
        (wallet) =>
          Boolean(
            getWalletAddress(wallet)
          )
      );
    }, [wallets]);

  /*
   * Only show wallets compatible with the
   * currently selected asset and network.
   */
  const compatibleWallets =
    useMemo(() => {
      const selectedAsset =
        asset.toUpperCase();

      const selectedNetwork =
        network.toUpperCase();

      return walletsWithAddresses.filter(
        (wallet) => {
          const walletAsset =
            getWalletAsset(wallet);

          const walletNetwork =
            getWalletNetwork(wallet);

          /*
           * Asset and network are deliberately
           * strict when the saved wallet contains
           * those values.
           */
          const assetMatches =
            walletAsset ===
            selectedAsset;

          const networkMatches =
            walletNetwork ===
            selectedNetwork;

          return (
            assetMatches &&
            networkMatches
          );
        }
      );
    }, [
      walletsWithAddresses,
      asset,
      network,
    ]);

  /*
   * Clear the selected wallet whenever the
   * current asset/network combination makes
   * it incompatible.
   */
  useEffect(() => {
    if (!selectedWalletId) {
      return;
    }

    const stillCompatible =
      compatibleWallets.some(
        (wallet) =>
          wallet.id ===
          selectedWalletId
      );

    if (!stillCompatible) {
      setSelectedWalletId("");
    }
  }, [
    compatibleWallets,
    selectedWalletId,
  ]);

  const selectedWallet =
    useMemo(
      () =>
        compatibleWallets.find(
          (wallet) =>
            wallet.id ===
            selectedWalletId
        ) ?? null,
      [
        compatibleWallets,
        selectedWalletId,
      ]
    );

  /*
   * Destination is always taken from the
   * persisted backend wallet.
   */
  const destinationAddress =
    getWalletAddress(
      selectedWallet
    );

  const numericAmount =
    Number(amount);

  const amountIsValid =
    Number.isFinite(
      numericAmount
    ) &&
    numericAmount > 0;

  const emailIsValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      customerEmail.trim()
    );

  function resetMessages() {
    setError(null);
    setCheckoutMessage(null);
    setQuote(null);
  }

  function handleAssetChange(
    value: string
  ) {
    setAsset(
      value.toUpperCase()
    );

    setSelectedWalletId("");

    resetMessages();
  }

  function handleNetworkChange(
    value: string
  ) {
    setNetwork(
      value.toUpperCase()
    );

    setSelectedWalletId("");

    resetMessages();
  }

  async function handleCreatePayment() {
    resetMessages();

    if (!amountIsValid) {
      setError(
        "Enter a valid payment amount greater than zero."
      );
      return;
    }

    if (!emailIsValid) {
      setError(
        "Enter a valid customer email address."
      );
      return;
    }

    if (!paymentProviderAccountId) {
      setError(
        "Select a payment account before continuing."
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

    const walletAsset =
      getWalletAsset(
        selectedWallet
      );

    const walletNetwork =
      getWalletNetwork(
        selectedWallet
      );

    if (
      walletAsset !==
      asset.toUpperCase()
    ) {
      setError(
        `The selected wallet is configured for ${walletAsset || "an unknown asset"}, not ${asset}.`
      );
      return;
    }

    if (
      walletNetwork !==
      network.toUpperCase()
    ) {
      setError(
        `The selected wallet is configured for ${walletNetwork || "an unknown network"}, not ${network}.`
      );
      return;
    }

    setCreatingPayment(true);

    try {
      /*
       * Use the merchant ID when the authenticated
       * user already has one, or when the selected
       * wallet contains one.
       *
       * There is intentionally NO frontend
       * restriction requiring merchantId.
       *
       * The backend remains the final authority
       * for authenticated merchant resolution.
       */
      const resolvedMerchantId =
        merchantId ||
        selectedWallet.merchantId ||
        undefined;

      const paymentIntentPayload: Record<
        string,
        unknown
      > = {
        amount:
          numericAmount,

        currency:
          currency.toUpperCase(),

        paymentProviderAccountId:
          paymentProviderAccountId,

        description:
          `SmartPOS payment for ${currency.toUpperCase()} ${numericAmount}`,

        metadata: {
          cryptoDestination: {
            asset:
              asset.toUpperCase(),

            network:
              network.toUpperCase(),

            walletId:
              selectedWallet.id,

            address:
              destinationAddress,

            amount:
              numericAmount,

            currency:
              currency.toUpperCase(),
          },
        },
      };

      /*
       * Only include merchantId when one is actually
       * available. Never send an empty or fake ID.
       */
      if (resolvedMerchantId) {
        paymentIntentPayload.merchantId =
          resolvedMerchantId;
      }

      const paymentIntentResponse =
        await api.post<CreatePaymentIntentResponse>(
          ENDPOINTS.paymentIntents.list,
          paymentIntentPayload
        );

      const paymentIntentResponseData =
        paymentIntentResponse.data;

      if (
        !paymentIntentResponseData?.success
      ) {
        throw new Error(
          getResponseError(
            paymentIntentResponseData
          )
        );
      }

      const paymentIntent =
        paymentIntentResponseData.data;

      if (!paymentIntent?.id) {
        throw new Error(
          "The payment session was not created by the server."
        );
      }

      const checkoutResponse =
        await api.post<CheckoutResponse>(
          ENDPOINTS.paymentIntents.checkout(
            paymentIntent.id
          ),
          {
            email:
              customerEmail.trim(),

            walletId:
              selectedWallet.id,

            destinationAddress,

            asset:
              asset.toUpperCase(),

            network:
              network.toUpperCase(),
          }
        );

      const checkoutResponseData =
        checkoutResponse.data;

      if (
        !checkoutResponseData?.success
      ) {
        throw new Error(
          getResponseError(
            checkoutResponseData
          )
        );
      }

      const checkoutData =
        checkoutResponseData.data;

      const serverQuote =
        checkoutData?.quote ?? null;

      setQuote(serverQuote);

      const paymentUrl =
        checkoutData?.gateway
          ?.paymentUrl;

      const accessCode =
        checkoutData?.gateway
          ?.accessCode;

      if (paymentUrl) {
        window.location.href =
          paymentUrl;

        return;
      }

      if (accessCode) {
        setCheckoutMessage(
          "Payment session created. Continue through the secure payment checkout."
        );

        return;
      }

      setCheckoutMessage(
        "Payment session created by the server, but the configured payment provider did not return a checkout URL."
      );
    } catch (caught) {
      setError(
        getApiErrorMessage(
          caught,
          "The payment could not be started."
        )
      );
    } finally {
      setCreatingPayment(false);
    }
  }

  const feeValue =
    quote?.feeAmount ??
    quote?.fee ??
    null;

  const totalValue =
    quote?.total ?? null;

  const cryptoAmount =
    quote?.cryptoAmount ?? null;

  return (
    <div className="space-y-6 bg-slate-50">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/payments"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to payments
        </Link>

        <div>
          <p className="text-sm font-medium text-blue-700">
            Payments
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            New payment
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Create a payment using one of the
            merchant's saved settlement wallets.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border border-slate-200 bg-white text-slate-900 shadow-sm">
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
                  onChange={(event) => {
                    setAmount(
                      event.target.value
                    );
                    resetMessages();
                  }}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="payment-currency"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Fiat currency
                </label>

                <select
                  id="payment-currency"
                  suppressHydrationWarning={true}
                  value={currency}
                  onChange={(event) => {
                    setCurrency(
                      event.target.value
                    );
                    resetMessages();
                  }}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="NGN">
                    NGN
                  </option>
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  Payments are processed in Naira (NGN) for Paystack-supported merchants.
                </p>
              </div>
            </div>

            <div>
              <PaymentProviderAccountSelector
                provider="PAYSTACK"
                selectedAccountId={paymentProviderAccountId}
                onAccountSelect={setPaymentProviderAccountId}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="payment-asset"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Crypto asset
                </label>

                <select
                  id="payment-asset"
                  value={asset}
                  onChange={(event) =>
                    handleAssetChange(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  htmlFor="payment-network"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Network
                </label>

                <select
                  id="payment-network"
                  value={network}
                  onChange={(event) =>
                    handleNetworkChange(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                onChange={(event) => {
                  setCustomerEmail(
                    event.target.value
                  );
                  resetMessages();
                }}
                placeholder="customer@example.com"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Destination wallet
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Select a saved wallet
                    compatible with the
                    selected asset and network.
                  </p>
                </div>

                <Wallet className="h-5 w-5 text-blue-700" />
              </div>

              <div className="mt-5">
                {loadingWallets ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                    Loading saved wallets...
                  </div>
                ) : wallets.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="font-medium text-slate-900">
                      No saved wallets yet.
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Create or save a settlement
                      wallet before creating this
                      payment.
                    </p>

                    <Link
                      href="/dashboard/wallets"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                    >
                      Create one
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : compatibleWallets.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="font-medium text-amber-900">
                      No compatible saved wallet
                    </p>

                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      No saved wallet matches{" "}
                      {asset} on{" "}
                      {network}.
                    </p>

                    <Link
                      href="/dashboard/wallets"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                    >
                      Manage wallets
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {compatibleWallets.map(
                      (wallet) => {
                        const walletAddress =
                          getWalletAddress(
                            wallet
                          );

                        const isSelected =
                          wallet.id ===
                          selectedWalletId;

                        return (
                          <button
                            key={
                              wallet.id
                            }
                            type="button"
                            onClick={() => {
                              setSelectedWalletId(
                                wallet.id
                              );

                              resetMessages();
                            }}
                            className={`w-full rounded-xl border p-4 text-left transition ${
                              isSelected
                                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">
                                  {
                                    wallet.name
                                  }
                                </p>

                                <p className="mt-1 text-sm text-slate-500">
                                  {getWalletAsset(
                                    wallet
                                  )}{" "}
                                  ·{" "}
                                  {getWalletNetwork(
                                    wallet
                                  )}
                                </p>

                                <p className="mt-2 break-all font-mono text-xs text-slate-700">
                                  {
                                    walletAddress
                                  }
                                </p>
                              </div>

                              {isSelected ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />
                              ) : null}
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {error}
              </div>
            ) : null}

            {checkoutMessage ? (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

                <span>
                  {checkoutMessage}
                </span>
              </div>
            ) : null}

            <Button
              type="button"
              onClick={() =>
                void handleCreatePayment()
              }
              disabled={
                creatingPayment ||
                !amountIsValid ||
                !emailIsValid ||
                !selectedWallet ||
                !destinationAddress
              }
              className="h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              {creatingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating payment...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Continue to payment
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit border border-slate-200 bg-white text-slate-900 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-slate-900">
              Review
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            <ReviewRow
              label="Amount"
              value={`${currency} ${
                amount || "0"
              }`}
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
              label="Wallet"
              value={
                selectedWallet?.name ??
                "Not selected"
              }
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

            {cryptoAmount !== null ? (
              <ReviewRow
                label="Crypto amount"
                value={String(
                  cryptoAmount
                )}
              />
            ) : null}

            <ReviewRow
              label="Customer"
              value={
                customerEmail.trim() ||
                "Not provided"
              }
            />

            <ReviewRow
              label="Fee"
              value={
                feeValue !== null
                  ? formatMoneyValue(
                      feeValue,
                      currency
                    )
                  : "Calculated by server"
              }
            />

            {totalValue !== null ? (
              <ReviewRow
                label="Total"
                value={formatMoneyValue(
                  totalValue,
                  currency
                )}
              />
            ) : null}

            <div className="border-t border-slate-200 pt-5">
              <p className="text-xs leading-5 text-slate-500">
                Wallet destination comes from
                the selected backend wallet
                record. Fee and quote values are
                displayed only when returned by
                the server.
              </p>
            </div>
          </CardContent>
        </Card>
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
        className={`max-w-[65%] break-words text-right text-sm font-semibold text-slate-900 ${
          mono
            ? "font-mono"
            : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}