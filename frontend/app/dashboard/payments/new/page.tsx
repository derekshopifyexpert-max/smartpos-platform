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

import type {
  WalletRecord,
} from "@/features/wallets/types/wallet";

import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import {
  useAuthStore,
} from "@/store/auth.store";

interface CreatePaymentIntentResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    id: string;
    amount: number | string;
    currency: string;
    status: string;
    metadata?: unknown;
  };
}

interface CheckoutResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
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

  return "";
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

      if (messages.length) {
        return messages.join(
          ", "
        );
      }
    }
  }

  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "The payment could not be started.";
}

function getResponseError(
  response: {
    message?: string;
    error?: string;
  }
): string {
  return (
    response.message ||
    response.error ||
    "The server rejected the payment request."
  );
}

export default function NewPaymentPage() {
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
  ] = useState("USD");

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
  ] = useState<WalletRecord[]>(
    []
  );

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

  useEffect(() => {
    let cancelled = false;

    async function loadWallets() {
      if (!merchantId) {
        setWallets([]);
        setSelectedWalletId("");
        return;
      }

      setLoadingWallets(true);
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
          setSelectedWalletId("");
          setError(
            getErrorMessage(
              caught
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingWallets(
            false
          );
        }
      }
    }

    void loadWallets();

    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const compatibleWallets =
    useMemo(() => {
      return wallets.filter(
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

          const assetMatches =
            walletAsset ===
              "" ||
            walletAsset ===
              asset.toUpperCase();

          const networkMatches =
            walletNetwork ===
              "" ||
            walletNetwork ===
              network.toUpperCase();

          return (
            Boolean(
              walletAddress
            ) &&
            assetMatches &&
            networkMatches
          );
        }
      );
    }, [
      wallets,
      asset,
      network,
    ]);

  useEffect(() => {
    if (!selectedWalletId) {
      return;
    }

    const exists =
      compatibleWallets.some(
        (wallet) =>
          wallet.id ===
          selectedWalletId
      );

    if (!exists) {
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

  function handleAssetChange(
    value: string
  ) {
    setAsset(value);
    setSelectedWalletId("");
    setError(null);
    setCheckoutMessage(null);
  }

  function handleNetworkChange(
    value: string
  ) {
    setNetwork(value);
    setSelectedWalletId("");
    setError(null);
    setCheckoutMessage(null);
  }

  async function handleCreatePayment() {
    setError(null);
    setCheckoutMessage(null);

    if (!merchantId) {
      setError(
        "Your authenticated account does not have a merchant account."
      );

      return;
    }

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
      walletAsset &&
      walletAsset !==
        asset.toUpperCase()
    ) {
      setError(
        `The selected wallet is configured for ${walletAsset}, not ${asset}.`
      );

      return;
    }

    if (
      walletNetwork &&
      walletNetwork !==
        network.toUpperCase()
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

            amount:
              numericAmount,

            currency:
              currency.toUpperCase(),

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
          }
        );

      if (
        !response.data?.success
      ) {
        throw new Error(
          getResponseError(
            response.data
          )
        );
      }

      const paymentIntent =
        response.data.data;

      if (
        !paymentIntent?.id
      ) {
        throw new Error(
          "The payment session was not created by the server."
        );
      }

      /*
       * The payment intent is now created.
       *
       * Checkout is handled by the real backend
       * orchestration flow. No frontend fee,
       * address, transaction hash, or success
       * value is fabricated here.
       */
      const checkout =
        await api.post<CheckoutResponse>(
          ENDPOINTS.paymentIntents.checkout(
            paymentIntent.id
          ),
          {
            email:
              customerEmail.trim(),
          }
        );

      if (
        !checkout.data?.success
      ) {
        throw new Error(
          getResponseError(
            checkout.data
          )
        );
      }

      const checkoutData =
        checkout.data.data;

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
        /*
         * Paystack inline checkout can be
         * handled later by the existing
         * customer checkout component.
         *
         * We do not fabricate a payment result
         * when the provider only returned an
         * access code.
         */
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
        getErrorMessage(
          caught
        )
      );
    } finally {
      setCreatingPayment(
        false
      );
    }
  }

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
            Create a payment and select the
            merchant settlement wallet that
            should receive the configured
            crypto settlement.
          </p>
        </div>
      </div>

      {!merchantId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          No merchant account is available
          for the current authenticated user.
        </div>
      ) : null}

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
                  onChange={(event) =>
                    setAmount(
                      event.target.value
                    )
                  }
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
                  value={currency}
                  onChange={(event) =>
                    setCurrency(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="USD">
                    USD
                  </option>
                  <option value="EUR">
                    EUR
                  </option>
                  <option value="GBP">
                    GBP
                  </option>
                </select>
              </div>

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
                onChange={(event) =>
                  setCustomerEmail(
                    event.target.value
                  )
                }
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
                    Select one of the saved
                    merchant wallets compatible
                    with the selected asset and
                    network.
                  </p>
                </div>

                <Wallet className="h-5 w-5 text-blue-700" />
              </div>

              <div className="mt-5">
                {loadingWallets ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                    Loading saved wallets...
                  </div>
                ) : wallets.length ===
                  0 ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="font-medium text-slate-900">
                      No saved wallets yet.
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Save a public settlement
                      address before creating
                      this payment.
                    </p>

                    <Link
                      href="/dashboard/wallets"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                    >
                      Create one
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : compatibleWallets.length ===
                  0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="font-medium text-amber-900">
                      No compatible saved
                      wallet
                    </p>

                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      There is no saved wallet
                      matching{" "}
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
                            onClick={() =>
                              setSelectedWalletId(
                                wallet.id
                              )
                            }
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
                                  ) ||
                                    asset}{" "}
                                  ·{" "}
                                  {getWalletNetwork(
                                    wallet
                                  ) ||
                                    network}
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
                {checkoutMessage}
              </div>
            ) : null}

            <Button
              type="button"
              onClick={() =>
                void handleCreatePayment()
              }
              disabled={
                creatingPayment ||
                !merchantId ||
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
              value={`${currency} ${amount || "0"}`}
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

            <ReviewRow
              label="Customer"
              value={
                customerEmail.trim() ||
                "Not provided"
              }
            />

            <ReviewRow
              label="Fee"
              value="Calculated by the server during checkout"
            />

            <div className="border-t border-slate-200 pt-5">
              <p className="text-xs leading-5 text-slate-500">
                SmartPOS does not fabricate
                wallet addresses, transaction
                hashes, gateway results, or
                frontend fee values. The backend
                remains the source of truth for
                checkout and server-side quote
                data.
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
        className={`max-w-[65%] text-right text-sm font-semibold text-slate-900 ${
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