"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePaymentIntent } from "@/features/payment-intents/hooks/use-payment-intent";
import { useCheckoutPaymentIntent } from "@/features/payment-intents/hooks/use-checkout-payment-intent";

type PaymentViewState =
  | "form"
  | "preparing"
  | "opening"
  | "success"
  | "cancelled"
  | "failed";

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

  const [paymentState, setPaymentState] =
    useState<PaymentViewState>("form");

  const [paymentError, setPaymentError] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(Date.now());
    };

    const interval = window.setInterval(updateTime, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

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
      return;
    }

    setPaymentState("preparing");

    try {
      const result = await checkoutMutation.mutateAsync({
        id: intent.id,
        payload: {
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
        },
      });

      const paymentUrl = result.gateway?.paymentUrl ?? null;
      const accessCode = result.gateway?.accessCode ?? null;

      if (!paymentUrl && !accessCode) {
        throw new Error(
          "The payment gateway did not return a valid checkout session."
        );
      }

      setPaymentState("opening");

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

      /*
       * Paystack inline-js resumes the transaction using the access code
       * returned by the backend when the authorization URL is not used.
       */
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
    setPaymentState("form");

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

  const isExpired =
    Boolean(intent.expiresAt) &&
    currentTime !== null &&
    new Date(intent.expiresAt as string).getTime() <= currentTime;

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

  const isPreparing =
    paymentState === "preparing" ||
    checkoutMutation.isPending;

  const isOpening = paymentState === "opening";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
            <ShieldCheck size={22} />
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Complete your payment
          </h1>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Enter your details below, then continue to secure payment.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-7">
              <h2 className="text-lg font-semibold text-slate-950">
                Customer information
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                These details will be associated with this payment.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
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
                      setFirstName(event.target.value)
                    }
                    autoComplete="given-name"
                    disabled={isPreparing || isOpening}
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
                      setLastName(event.target.value)
                    }
                    autoComplete="family-name"
                    disabled={isPreparing || isOpening}
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
                    setEmail(event.target.value)
                  }
                  autoComplete="email"
                  disabled={isPreparing || isOpening}
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
                    setPhone(event.target.value)
                  }
                  autoComplete="tel"
                  disabled={isPreparing || isOpening}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  placeholder="+234..."
                />
              </div>

              {paymentError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  {paymentError}
                </div>
              ) : null}

              {isOpening ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                  Secure payment is opening. Complete your payment in the
                  Paystack window.
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isPreparing || isOpening}
                className="flex h-13 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPreparing
                  ? "Preparing secure payment..."
                  : isOpening
                    ? "Payment window open..."
                    : `Continue to payment · ${amount}`}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <LockKeyhole size={13} />
                Secure payment powered by Paystack
              </div>
            </form>
          </section>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment summary
            </p>

            <div className="mt-5">
              <p className="text-sm text-slate-500">
                {intent.merchant?.name ?? "SmartPOS merchant"}
              </p>

              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                {amount}
              </p>

              {intent.description ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {intent.description}
                </p>
              ) : null}
            </div>

            <div className="my-6 h-px bg-slate-200" />

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-slate-100 p-2">
                  <LockKeyhole
                    size={15}
                    className="text-slate-700"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Secure checkout
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Your payment details are entered in Paystack&apos;s
                    secure payment interface.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-slate-100 p-2">
                  <CheckCircle2
                    size={15}
                    className="text-slate-700"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Payment confirmation
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    A successful payment returns a Paystack reference
                    that can be verified by SmartPOS.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Payment reference
              </p>

              <p className="mt-1 break-all font-mono text-xs text-slate-700">
                {intent.id}
              </p>
            </div>
          </aside>
        </div>
      </div>

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
                className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
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