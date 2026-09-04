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
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { usePaymentIntent } from "@/features/payment-intents/hooks/use-payment-intent";
import { useCheckoutPaymentIntent } from "@/features/payment-intents/hooks/use-checkout-payment-intent";
import {
  getCustomerPaymentMethods,
} from "@/features/payment-intents/services/payment-intent.service";
import type {
  CustomerPaymentMethod,
} from "@/features/payment-intents/types/payment-intent";

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

export default function CustomerPaymentCheckout() {
  const params = useParams();
  const id = String(params.id);

  const {
    data: intent,
    isLoading,
    isError,
    refetch,
  } = usePaymentIntent(id);

  const checkoutMutation =
    useCheckoutPaymentIntent();

  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [paymentState, setPaymentState] =
    useState<PaymentViewState>("initial");

  const [paymentError, setPaymentError] =
    useState("");

  const [paymentReference, setPaymentReference] =
    useState("");

  const [
    savedPaymentMethods,
    setSavedPaymentMethods,
  ] = useState<CustomerPaymentMethod[]>([]);

  const [
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
  ] = useState<string | null>(null);

  const [
    isLoadingSavedMethods,
    setIsLoadingSavedMethods,
  ] = useState(false);

  const [currentTime, setCurrentTime] =
    useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(Date.now());
    };

    updateTime();

    const interval =
      window.setInterval(
        updateTime,
        1000,
      );

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  /*
   * Flutterwave Standard checkout does not
   * expose a reusable card authorization in
   * this SmartPOS integration.
   *
   * Therefore saved payment methods are no
   * longer loaded for this checkout page.
   */
  useEffect(() => {
    setSavedPaymentMethods([]);
    setSelectedPaymentMethodId(null);
    setIsLoadingSavedMethods(false);
  }, [intent?.id]);

  const amount = useMemo(() => {
    if (!intent) {
      return "";
    }

    const numericAmount =
      Number(intent.amount);

    if (
      Number.isNaN(numericAmount)
    ) {
      return `${intent.amount} ${intent.currency}`;
    }

    try {
      return new Intl.NumberFormat(
        "en-US",
        {
          style: "currency",
          currency: intent.currency,
          maximumFractionDigits: 2,
        },
      ).format(numericAmount);
    } catch {
      return `${numericAmount.toLocaleString()} ${intent.currency}`;
    }
  }, [intent]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!intent) {
      return;
    }

    if (
      checkoutMutation.isPending
    ) {
      return;
    }

    setPaymentError("");
    setPaymentReference("");

    if (!email.trim()) {
      setPaymentError(
        "Email address is required.",
      );
      setPaymentState(
        "input-required",
      );
      return;
    }

    setPaymentState("submitting");

    try {
      const result =
        await checkoutMutation.mutateAsync({
          id: intent.id,
          payload: {
            email: email.trim(),
            firstName:
              firstName.trim() || undefined,
            lastName:
              lastName.trim() || undefined,
            phone:
              phone.trim() || undefined,
          },
        });

      const paymentUrl =
        result.gateway?.paymentUrl ??
        null;

      if (!paymentUrl) {
        throw new Error(
          "Flutterwave did not return a valid hosted checkout URL.",
        );
      }

      setPaymentReference(
        result.gateway?.transactionId ??
          result.transaction.reference ??
          intent.id,
      );

      setPaymentState(
        "processing",
      );

      /*
       * Flutterwave Standard returns the
       * hosted checkout URL as:
       *
       * gateway.paymentUrl
       *
       * No Paystack SDK or access code is
       * required.
       */
      window.location.assign(
        paymentUrl,
      );
    } catch (error) {
      console.error(
        "Customer Flutterwave checkout error:",
        error,
      );

      setPaymentState("failed");

      setPaymentError(
        error instanceof Error
          ? error.message
          : "Unable to start the Flutterwave payment. Please try again.",
      );
    }
  }

  async function handleTryAgain() {
    setPaymentError("");
    setPaymentReference("");
    setPaymentState("initial");

    await refetch();
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
              This payment request could not be loaded.
              It may be invalid, expired, or no longer
              available.
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

  const normalizedStatus =
    intent.status.toUpperCase();

  const expiresAtMs =
    intent.expiresAt
      ? new Date(
          intent.expiresAt,
        ).getTime()
      : null;

  const isExpired =
    expiresAtMs !== null &&
    currentTime !== null &&
    expiresAtMs <= currentTime;

  const isUnavailable =
    normalizedStatus !== "PENDING" ||
    isExpired;

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
              This payment request is no longer available
              for payment.
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
          intent.merchant?.name ??
          "SmartPOS merchant"
        }
        reference={paymentReference}
        onTryAgain={
          handleTryAgain
        }
      />
    );
  }

  if (paymentState === "cancelled") {
    return (
      <PaymentResult
        type="cancelled"
        amount={amount}
        merchantName={
          intent.merchant?.name ??
          "SmartPOS merchant"
        }
        onTryAgain={
          handleTryAgain
        }
      />
    );
  }

  if (paymentState === "failed") {
    return (
      <PaymentResult
        type="failed"
        amount={amount}
        merchantName={
          intent.merchant?.name ??
          "SmartPOS merchant"
        }
        error={paymentError}
        onTryAgain={
          handleTryAgain
        }
      />
    );
  }

  const isSubmitting =
    paymentState === "submitting" ||
    checkoutMutation.isPending;

  const isProcessing =
    paymentState === "processing";

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
                  {intent.merchant?.name ??
                    "SmartPOS merchant"}
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

              <div className="mt-3 rounded-xl border border-primary bg-primary px-3 py-3 text-primary-foreground">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-white/10 p-2">
                    <CreditCard size={15} />
                  </div>
                  <span className="text-sm font-semibold">Card</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-200">
                  Pay securely with your card via Flutterwave.
                </p>
              </div>
            </div>

            {paymentError ? (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                {paymentError}
              </div>
            ) : null}

            <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white p-2 text-slate-700">
                      <CreditCard size={16} />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Flutterwave secure checkout
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        You will be redirected to
                        Flutterwave to securely complete
                        your card payment.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="firstName"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        First name
                      </label>

                      <input
                        id="firstName"
                        value={firstName}
                        onChange={(event) =>
                          setFirstName(
                            event.target.value,
                          )
                        }
                        autoComplete="given-name"
                        disabled={
                          isSubmitting ||
                          isProcessing
                        }
                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                        placeholder="John"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lastName"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Last name
                      </label>

                      <input
                        id="lastName"
                        value={lastName}
                        onChange={(event) =>
                          setLastName(
                            event.target.value,
                          )
                        }
                        autoComplete="family-name"
                        disabled={
                          isSubmitting ||
                          isProcessing
                        }
                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Email address
                    </label>

                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) =>
                        setEmail(
                          event.target.value,
                        )
                      }
                      autoComplete="email"
                      disabled={
                        isSubmitting ||
                        isProcessing
                      }
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Phone number
                      <span className="ml-1 font-normal text-slate-400">
                        optional
                      </span>
                    </label>

                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(
                          event.target.value,
                        )
                      }
                      autoComplete="tel"
                      disabled={
                        isSubmitting ||
                        isProcessing
                      }
                      className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                      placeholder="+234..."
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    isProcessing
                  }
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Preparing Flutterwave checkout..."
                    : isProcessing
                      ? "Redirecting to Flutterwave..."
                      : `Pay ${amount}`}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <LockKeyhole size={13} />
                  Secure checkout powered by Flutterwave
                </div>
              </form>
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Payment summary
            </p>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Amount
              </p>

              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                {amount}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <div className="rounded-lg bg-white p-2 text-slate-700">
                  <ShieldCheck size={15} />
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Selected method
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Card via Flutterwave
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <div className="rounded-lg bg-white p-2 text-slate-700">
                  <CheckCircle2 size={15} />
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Status
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {paymentState ===
                    "processing"
                      ? "Redirecting to Flutterwave"
                      : paymentState ===
                          "submitting"
                        ? "Submitting"
                        : paymentState ===
                            "method-selected"
                          ? "Method selected"
                          : paymentState ===
                              "input-required"
                            ? "Input required"
                            : paymentState ===
                                "expired"
                              ? "Expired"
                              : "Ready"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">
                Reference
              </p>

              <p className="mt-1 break-all font-mono text-xs text-slate-700">
                {intent.id}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Powered by SmartPOS
      </p>
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
  type:
    | "success"
    | "cancelled"
    | "failed";
  amount: string;
  merchantName: string;
  reference?: string;
  error?: string;
  onTryAgain: () => void;
}) {
  const isSuccess =
    type === "success";

  const isCancelled =
    type === "cancelled";

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
                ? "Flutterwave reported that the payment was successfully completed."
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
                  Flutterwave reference
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