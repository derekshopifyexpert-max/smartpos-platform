"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePaymentIntent } from "@/features/payment-intents/hooks/use-payment-intent";
import { useCheckoutPaymentIntent } from "@/features/payment-intents/hooks/use-checkout-payment-intent";
import {
  chargeCustomerPaymentMethod,
  getCustomerPaymentMethods,
} from "@/features/payment-intents/services/payment-intent.service";
import type { CustomerPaymentMethod } from "@/features/payment-intents/types/payment-intent";

type PaymentViewState =
  | "initial"
  | "method-selected"
  | "input-required"
  | "submitting"
  | "processing"
  | "success"
  | "cancelled"
  | "failed"
  | "expired";

type PaymentMethodType = "card" | "bank-transfer" | "ussd";

function readMetadataValue(
  metadata: unknown,
  keys: string[]
): unknown {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const record = metadata as Record<string, unknown>;

  for (const key of keys) {
    const direct = record[key];
    if (direct !== undefined) {
      return direct;
    }

    const normalized = key.replace(/[-_\s]+/g, "").toLowerCase();

    for (const entryKey of Object.keys(record)) {
      if (entryKey.replace(/[-_\s]+/g, "").toLowerCase() === normalized) {
        return record[entryKey];
      }
    }
  }

  return undefined;
}

export default function CustomerPaymentCheckout() {
  const params = useParams();
  const id = String(params.id);

  const {
    data: intent,
    isLoading,
    isError,
    refetch,
  } = usePaymentIntent(id);

  const checkoutMutation = useCheckoutPaymentIntent();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cryptoAsset, setCryptoAsset] = useState("USDT");
  const [cryptoNetwork, setCryptoNetwork] = useState("TRON");
  const [cryptoDestinationAddress, setCryptoDestinationAddress] = useState("");

  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethodType>("card");
  const [paymentState, setPaymentState] =
    useState<PaymentViewState>("initial");

  const [paymentError, setPaymentError] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<
    CustomerPaymentMethod[]
  >([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isLoadingSavedMethods, setIsLoadingSavedMethods] = useState(false);

  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(Date.now());
    };

    updateTime();

    const interval = window.setInterval(updateTime, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!intent?.id) {
      return;
    }

    const currentIntentId = intent.id;
    let active = true;

    async function loadSavedMethods() {
      setIsLoadingSavedMethods(true);

      try {
        const methods = await getCustomerPaymentMethods(currentIntentId);

        if (active) {
          setSavedPaymentMethods(methods || []);
          if (methods?.[0]?.id) {
            setSelectedPaymentMethodId(methods[0].id);
          }
        }
      } catch {
        if (active) {
          setSavedPaymentMethods([]);
          setSelectedPaymentMethodId(null);
        }
      } finally {
        if (active) {
          setIsLoadingSavedMethods(false);
        }
      }
    }

    void loadSavedMethods();

    return () => {
      active = false;
    };
  }, [intent?.id]);

  const amount = useMemo(() => {
    if (!intent) {
      return "";
    }

    const numericAmount = Number(intent.amount);

    if (Number.isNaN(numericAmount)) {
      return `${intent.amount} ${intent.currency}`;
    }

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: intent.currency,
        maximumFractionDigits: 2,
      }).format(numericAmount);
    } catch {
      return `${numericAmount.toLocaleString()} ${intent.currency}`;
    }
  }, [intent]);

  const metadata = useMemo(() => {
    if (!intent) {
      return {} as Record<string, unknown>;
    }

    return (intent.metadata as Record<string, unknown>) ?? {};
  }, [intent]);

  useEffect(() => {
    const destination =
      (metadata.cryptoDestination as Record<string, unknown> | undefined) ??
      (metadata.crypto_destination as Record<string, unknown> | undefined) ??
      (metadata.destination as Record<string, unknown> | undefined);

    if (!destination || typeof destination !== "object") {
      return;
    }

    const asset = typeof destination.asset === "string" ? destination.asset : "USDT";
    const network = typeof destination.network === "string" ? destination.network : "TRON";
    const address = typeof destination.address === "string" ? destination.address : "";

    if (asset) {
      setCryptoAsset(asset.toUpperCase());
    }

    if (network) {
      setCryptoNetwork(network.toUpperCase());
    }

    if (address) {
      setCryptoDestinationAddress(address);
    }
  }, [metadata]);

  const quoteDisplay = useMemo(() => {
    const destination =
      (metadata.cryptoDestination as Record<string, unknown> | undefined) ??
      (metadata.crypto_destination as Record<string, unknown> | undefined) ??
      (metadata.destination as Record<string, unknown> | undefined);

    const quoteAmount =
      typeof destination?.quoteAmount === "number"
        ? destination.quoteAmount
        : typeof destination?.cryptoAmount === "number"
          ? destination.cryptoAmount
          : null;

    if (!quoteAmount) {
      return `Quote pending · ${cryptoAsset}`;
    }

    return `≈ ${quoteAmount.toFixed(2)} ${cryptoAsset}`;
  }, [cryptoAsset, metadata]);

  const methodAvailability = useMemo(() => {
    const bankTransferAvailable = Boolean(
      readMetadataValue(metadata, ["bankTransfer", "bank_transfer", "bankTransferDetails", "transferDetails"]) ||
      readMetadataValue(metadata, ["bankAccount", "bankName", "accountNumber", "accountName"])
    );

    const ussdAvailable = Boolean(
      readMetadataValue(metadata, ["ussd", "ussdDetails", "ussdCode", "ussdCodeDetails"]) ||
      readMetadataValue(metadata, ["ussdBank", "ussdBankCode", "ussdInstructions"])
    );

    return {
      card: true,
      "bank-transfer": bankTransferAvailable,
      ussd: ussdAvailable,
    } as const;
  }, [metadata]);

  const bankTransferDetails = useMemo(() => {
    const nested = (metadata as Record<string, unknown>) ?? {};
    const candidate =
      nested.bankTransfer ??
      nested.bank_transfer ??
      nested.transferDetails ??
      nested.bankTransferDetails;

    return candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
  }, [metadata]);

  const ussdDetails = useMemo(() => {
    const nested = (metadata as Record<string, unknown>) ?? {};
    const candidate =
      nested.ussd ??
      nested.ussdDetails ??
      nested.ussdCode ??
      nested.ussdInstructions;

    return candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
  }, [metadata]);

  function handleMethodSelect(method: PaymentMethodType) {
    setSelectedMethod(method);
    setPaymentError("");
    setPaymentReference("");

    if (method === "card") {
      setPaymentState("input-required");
      return;
    }

    if (methodAvailability[method]) {
      setPaymentState("method-selected");
      return;
    }

    setPaymentState("failed");
    setPaymentError("This payment method is not currently available for this payment request.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!intent) {
      return;
    }

    if (checkoutMutation.isPending) {
      return;
    }

    setPaymentError("");
    setPaymentReference("");

    if (!email.trim()) {
      setPaymentError("Email address is required.");
      setPaymentState("input-required");
      return;
    }

    setPaymentState("submitting");

    try {
      const destination =
        (metadata.cryptoDestination as Record<string, unknown> | undefined) ??
        (metadata.crypto_destination as Record<string, unknown> | undefined) ??
        (metadata.destination as Record<string, unknown> | undefined);

      const result = await checkoutMutation.mutateAsync({
        id: intent.id,
        payload: {
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
          cryptoDestination: {
            asset:
              cryptoAsset ||
              (typeof destination === "object" &&
              typeof destination.asset === "string"
                ? destination.asset
                : undefined),
            network:
              cryptoNetwork ||
              (typeof destination === "object" &&
              typeof destination.network === "string"
                ? destination.network
                : undefined),
            address:
              cryptoDestinationAddress.trim() ||
              (typeof destination === "object" &&
              typeof destination.address === "string"
                ? destination.address
                : undefined),
            walletId:
              typeof destination === "object" &&
              typeof destination.walletId === "string"
                ? destination.walletId
                : undefined,
            amount:
              typeof destination === "object" &&
              typeof destination.amount === "number"
                ? destination.amount
                : undefined,
            currency:
              typeof destination === "object" &&
              typeof destination.currency === "string"
                ? destination.currency
                : undefined,
            reference:
              typeof destination === "object" &&
              typeof destination.reference === "string"
                ? destination.reference
                : undefined,
          },
        },
      });

      const paymentUrl = result.gateway?.paymentUrl ?? null;
      const accessCode = result.gateway?.accessCode ?? null;

      if (!paymentUrl && !accessCode) {
        throw new Error(
          "The payment gateway did not return a valid checkout session."
        );
      }

      setPaymentState("processing");

      if (paymentUrl) {
        window.location.href = paymentUrl;
        return;
      }

      const PaystackModule = await import("@paystack/inline-js");

      const Paystack = PaystackModule.default;

      if (!Paystack) {
        throw new Error("Paystack checkout could not be loaded.");
      }

      const popup = new Paystack();
      popup.resumeTransaction(accessCode as string);
    } catch (error) {
      console.error("Customer checkout error:", error);

      setPaymentState("failed");

      setPaymentError(
        error instanceof Error
          ? error.message
          : "Unable to start the payment. Please try again."
      );
    }
  }

  async function handleTryAgain() {
    setPaymentError("");
    setPaymentReference("");
    setSelectedMethod("card");
    setPaymentState("initial");

    await refetch();
  }

  async function handleSavedAuthorizationCharge() {
    if (!intent || !selectedPaymentMethodId) {
      return;
    }

    if (checkoutMutation.isPending) {
      return;
    }

    setPaymentError("");
    setPaymentReference("");
    setPaymentState("submitting");

    try {
      const result = await chargeCustomerPaymentMethod(selectedPaymentMethodId, intent.id, {
        idempotencyKey: `checkout-saved-method:${intent.id}:${selectedPaymentMethodId}`,
      });

      if (result.duplicate) {
        setPaymentReference(result.transaction?.reference ?? intent.id);
        setPaymentState("success");
        return;
      }

      setPaymentReference(result.transaction?.reference ?? result.gateway?.transactionId ?? intent.id);
      setPaymentState("success");
    } catch (error) {
      console.error("Saved payment method charge error:", error);
      setPaymentState("failed");
      setPaymentError(
        error instanceof Error
          ? error.message
          : "The saved payment method could not be charged. Please try again."
      );
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="animate-pulse space-y-5">
              <div className="h-7 w-40 rounded bg-slate-200" />
              <div className="h-4 w-64 rounded bg-slate-200" />
              <div className="h-32 rounded-xl bg-slate-100" />
              <div className="h-12 rounded-lg bg-slate-200" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (isError || !intent) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">
              Payment unavailable
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              This payment request could not be loaded. It may be invalid,
              expired, or no longer available.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950"
            >
              <ArrowLeft size={16} />
              Return
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const normalizedStatus = intent.status.toUpperCase();

  const expiresAtMs =
    intent.expiresAt ? new Date(intent.expiresAt).getTime() : null;

  const isExpired =
    expiresAtMs !== null &&
    currentTime !== null &&
    expiresAtMs <= currentTime;

  const isUnavailable =
    normalizedStatus !== "PENDING" || isExpired;

  if (isUnavailable) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <LockKeyhole
                className="text-amber-600"
                size={22}
              />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-slate-900">
              Payment request unavailable
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              This payment request is no longer available for payment.
            </p>

            <div className="mt-6 rounded-xl bg-slate-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Amount
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {amount}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (paymentState === "success") {
    return (
      <PaymentResult
        type="success"
        amount={amount}
        merchantName={
          intent.merchant?.name ?? "SmartPOS merchant"
        }
        reference={paymentReference}
        onTryAgain={handleTryAgain}
      />
    );
  }

  if (paymentState === "cancelled") {
    return (
      <PaymentResult
        type="cancelled"
        amount={amount}
        merchantName={
          intent.merchant?.name ?? "SmartPOS merchant"
        }
        onTryAgain={handleTryAgain}
      />
    );
  }

  if (paymentState === "failed") {
    return (
      <PaymentResult
        type="failed"
        amount={amount}
        merchantName={
          intent.merchant?.name ?? "SmartPOS merchant"
        }
        error={paymentError}
        onTryAgain={handleTryAgain}
      />
    );
  }

  const isSubmitting =
    paymentState === "submitting" ||
    checkoutMutation.isPending;

  const isProcessing = paymentState === "processing";
  const hasSavedMethods = savedPaymentMethods.length > 0;

  const methodOptions: Array<{
    id: PaymentMethodType;
    label: string;
    detail: string;
    available: boolean;
    icon: typeof CreditCard;
  }> = [
    {
      id: "card",
      label: "Card",
      detail: "Pay securely with your card via Paystack.",
      available: methodAvailability.card,
      icon: CreditCard,
    },
    {
      id: "bank-transfer",
      label: "Bank Transfer",
      detail: "Use transfer instructions provided by the merchant.",
      available: methodAvailability["bank-transfer"],
      icon: ShieldCheck,
    },
    {
      id: "ussd",
      label: "USSD",
      detail: "Complete payment using a supported USSD flow.",
      available: methodAvailability.ussd,
      icon: LockKeyhole,
    },
  ];

  const selectedMethodDetails = (() => {
    if (selectedMethod === "bank-transfer") {
      return Object.entries(bankTransferDetails).length > 0
        ? bankTransferDetails
        : {};
    }

    if (selectedMethod === "ussd") {
      return Object.entries(ussdDetails).length > 0
        ? ussdDetails
        : {};
    }

    return {};
  })();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck size={20} />
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            SmartPOS
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Payment
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">
                  {intent.merchant?.name ?? "SmartPOS merchant"}
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {amount}
                </p>
              </div>

              <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {paymentState.toUpperCase()}
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Choose how to pay
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {methodOptions.map((method) => {
                  const Icon = method.icon;
                  const isSelected = selectedMethod === method.id;

                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => method.available && handleMethodSelect(method.id)}
                      disabled={!method.available}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : method.available
                            ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            : "cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`rounded-lg p-2 ${isSelected ? "bg-white/10" : "bg-slate-100"}`}>
                          <Icon size={15} />
                        </div>
                        <span className="text-sm font-semibold">{method.label}</span>
                      </div>

                      <p className={`mt-2 text-xs leading-5 ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                        {method.available ? method.detail : "Unavailable for this request"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentError ? (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {paymentError}
              </div>
            ) : null}

            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Receive crypto</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{quoteDisplay}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="crypto-asset" className="mb-2 block text-sm font-medium text-slate-700">Asset</label>
                  <select
                    id="crypto-asset"
                    value={cryptoAsset}
                    onChange={(event) => setCryptoAsset(event.target.value.toUpperCase())}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                  >
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                    <option value="ETH">ETH</option>
                    <option value="BTC">BTC</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="crypto-network" className="mb-2 block text-sm font-medium text-slate-700">Network</label>
                  <select
                    id="crypto-network"
                    value={cryptoNetwork}
                    onChange={(event) => setCryptoNetwork(event.target.value.toUpperCase())}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                  >
                    <option value="TRON">TRON</option>
                    <option value="ETHEREUM">ETHEREUM</option>
                    <option value="BSC">BSC</option>
                    <option value="SOLANA">SOLANA</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="crypto-destination" className="mb-2 block text-sm font-medium text-slate-700">Destination wallet</label>
                <input
                  id="crypto-destination"
                  value={cryptoDestinationAddress}
                  onChange={(event) => setCryptoDestinationAddress(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                  placeholder="T or wallet address"
                />
              </div>
            </div>

            {selectedMethod === "card" ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {hasSavedMethods ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Saved payment method</p>
                        <p className="text-xs text-slate-500">Use a saved authorization.</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        available
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {savedPaymentMethods.map((method) => (
                        <label
                          key={method.id}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-3 transition ${selectedPaymentMethodId === method.id ? "border-slate-900 bg-white" : "border-slate-200 bg-white"}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                              <CreditCard size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{method.label}</p>
                              <p className="text-xs text-slate-500">•••• •••• •••• {method.last4 ?? "saved"}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedPaymentMethodId(method.id)}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold ${selectedPaymentMethodId === method.id ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-700"}`}
                          >
                            {selectedPaymentMethodId === method.id ? "Selected" : "Use"}
                          </button>
                        </label>
                      ))}
                    </div>

                    {selectedPaymentMethodId ? (
                      <button
                        type="button"
                        onClick={handleSavedAuthorizationCharge}
                        disabled={isSubmitting || isProcessing || isLoadingSavedMethods}
                        className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmitting ? "Processing..." : `Pay with saved method · ${amount}`}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-slate-700">
                        First name
                      </label>
                      <input
                        id="firstName"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        autoComplete="given-name"
                        disabled={isSubmitting || isProcessing}
                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                        placeholder="John"
                      />
                    </div>

                    <div>
                      <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-slate-700">
                        Last name
                      </label>
                      <input
                        id="lastName"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        autoComplete="family-name"
                        disabled={isSubmitting || isProcessing}
                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      disabled={isSubmitting || isProcessing}
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">
                      Phone number
                      <span className="ml-1 font-normal text-slate-400">optional</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                      disabled={isSubmitting || isProcessing}
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                      placeholder="+234..."
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isProcessing}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Preparing secure payment..."
                    : isProcessing
                      ? "Processing payment..."
                      : `Pay ${amount}`}
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                {selectedMethod === "bank-transfer" ? (
                  methodAvailability["bank-transfer"] && Object.keys(selectedMethodDetails).length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">Bank transfer details</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-600">
                        {Object.entries(selectedMethodDetails).map(([key, value]) => (
                          <div key={key} className="flex items-start justify-between gap-4 rounded-lg bg-white p-3">
                            <span className="font-medium capitalize text-slate-500">{key}</span>
                            <span className="text-right font-medium text-slate-900">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
                      Bank transfer details are not available for this payment request. Please use a supported payment method.
                    </div>
                  )
                ) : null}

                {selectedMethod === "ussd" ? (
                  methodAvailability.ussd && Object.keys(selectedMethodDetails).length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">USSD payment details</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-600">
                        {Object.entries(selectedMethodDetails).map(([key, value]) => (
                          <div key={key} className="flex items-start justify-between gap-4 rounded-lg bg-white p-3">
                            <span className="font-medium capitalize text-slate-500">{key}</span>
                            <span className="text-right font-medium text-slate-900">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
                      USSD instructions are not available for this payment request. Please choose another method.
                    </div>
                  )
                ) : null}

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <LockKeyhole size={13} />
                  Secure checkout powered by Paystack
                </div>
              </div>
            )}
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Payment summary</p>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Amount</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{amount}</p>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Receive</span>
                <span className="font-semibold text-slate-900">{quoteDisplay}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Network</span>
                <span className="font-medium text-slate-900">{cryptoNetwork}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Destination</span>
                <span className="max-w-[180px] truncate font-medium text-slate-900" title={cryptoDestinationAddress || "Not provided"}>{cryptoDestinationAddress || "Not provided"}</span>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <div className="rounded-lg bg-white p-2 text-slate-700">
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Selected method</p>
                  <p className="mt-1 text-xs text-slate-500">{methodOptions.find((item) => item.id === selectedMethod)?.label ?? "Card"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <div className="rounded-lg bg-white p-2 text-slate-700">
                  <CheckCircle2 size={15} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Status</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {paymentState === "processing"
                      ? "Processing"
                      : paymentState === "submitting"
                        ? "Submitting"
                        : paymentState === "method-selected"
                          ? "Method selected"
                          : paymentState === "input-required"
                            ? "Input required"
                            : paymentState === "expired"
                              ? "Expired"
                              : "Ready"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Reference</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{intent.id}</p>
            </div>
          </aside>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">Powered by SmartPOS</p>
    </main>
  );
}

function PaymentResult({
  type,
  amount,
  merchantName,
  reference,
  error,
  onTryAgain,
}: {
  type: "success" | "cancelled" | "failed";
  amount: string;
  merchantName: string;
  reference?: string;
  error?: string;
  onTryAgain: () => void;
}) {
  const isSuccess = type === "success";
  const isCancelled = type === "cancelled";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-lg">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-10">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              isSuccess
                ? "bg-emerald-50"
                : isCancelled
                  ? "bg-amber-50"
                  : "bg-red-50"
            }`}
          >
            {isSuccess ? (
              <CheckCircle2
                size={32}
                className="text-emerald-600"
              />
            ) : isCancelled ? (
              <Clock3
                size={32}
                className="text-amber-600"
              />
            ) : (
              <XCircle
                size={32}
                className="text-red-600"
              />
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {merchantName}
            </p>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              {isSuccess
                ? "Payment completed"
                : isCancelled
                  ? "Payment cancelled"
                  : "Payment failed"}
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
              {isSuccess
                ? "Paystack reported that the payment was successfully completed."
                : isCancelled
                  ? "The payment window was closed before the payment was completed."
                  : error ||
                    "The payment could not be completed. You can try again."}
            </p>
          </div>

          <div className="mt-7 rounded-2xl bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">
                Amount
              </span>

              <span className="text-lg font-bold text-slate-950">
                {amount}
              </span>
            </div>

            {reference ? (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500">
                  Paystack reference
                </p>

                <p className="mt-1 break-all font-mono text-xs text-slate-700">
                  {reference}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-3">
            {!isSuccess ? (
              <button
                type="button"
                onClick={onTryAgain}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Try payment again
              </button>
            ) : null}

            <Link
              href="/"
              className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Return
            </Link>
          </div>
        </section>

        <div className="mt-6 flex items-center justify-center gap-5 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole size={12} />
            Encrypted
          </span>

          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} />
            Secure checkout
          </span>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Powered by SmartPOS
        </p>
      </div>
    </main>
  );
}