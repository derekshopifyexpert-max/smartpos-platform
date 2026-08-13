"use client";


import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Store,
} from "lucide-react";

import { usePaymentIntent } from "@/features/payment-intents/hooks/use-payment-intent";
import { useCheckoutPaymentIntent } from "@/features/payment-intents/hooks/use-checkout-payment-intent";

export default function CustomerPaymentPage() {
  const params = useParams();
  const id = String(params.id);

  const {
    data: intent,
    isLoading,
    isError,
  } = usePaymentIntent(id);

  <Link
  href={`/checkout/${intent.id}`}
  target="_blank"
  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
>
  <ExternalLink size={16} />
  Open Customer Checkout
</Link>

  const checkoutMutation = useCheckoutPaymentIntent();

  const [firstName, setFirstName] = useState(
    intent?.customer?.firstName ?? ""
  );
  const [lastName, setLastName] = useState(
    intent?.customer?.lastName ?? ""
  );
  const [email, setEmail] = useState(
    intent?.customer?.email ?? ""
  );
  const [phone, setPhone] = useState("");

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
            <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-slate-200" />
            <div className="mx-auto mt-5 h-6 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mx-auto mt-3 h-4 w-64 animate-pulse rounded bg-slate-200" />
            <div className="mt-8 h-24 animate-pulse rounded-2xl bg-slate-100" />
            <div className="mt-6 h-12 animate-pulse rounded-xl bg-slate-200" />
          </div>
        </div>
      </main>
    );
  }
  if (isError || !intent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <CreditCard size={22} />
          </div>

          <h1 className="mt-5 text-xl font-semibold text-slate-950">
            Payment unavailable
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            We could not load this payment request.
          </p>

          <Link
            href="/pay"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <ArrowLeft size={16} />
            Back to payment requests
          </Link>
        </div>
      </main>
    );
  }

  const merchantName =
    intent.merchant?.name ??
    intent.merchantId ??
    "SmartPOS Merchant";

  const amount = formatAmount(
    intent.amount,
    intent.currency
  );

  const status =
    intent.status?.toUpperCase() ?? "UNKNOWN";

  const isCompleted =
    status === "SUCCEEDED" ||
    status === "SETTLED";

  const isFailed =
    status === "FAILED" ||
    status === "CANCELED" ||
    status === "CANCELLED";

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    checkoutMutation.reset();

    try {
      const result = await checkoutMutation.mutateAsync({
        id,
        payload: {
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
        },
      });

      const paymentUrl = result.gateway?.paymentUrl;

      if (!paymentUrl) {
        throw new Error(
          "The payment provider did not return a payment URL."
        );
      }

      window.location.assign(paymentUrl);
    } catch {
      // The mutation error is displayed below the form.
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">

          <div className="mb-5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <LockKeyhole size={13} />
            Secure payment
          </div>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50">

            <div className="border-b border-slate-100 bg-gradient-to-br from-white via-white to-blue-50/80 px-6 pb-7 pt-7">

              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  <Store size={20} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {merchantName}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Payment request
                  </p>
                </div>
              </div>

              <div className="mt-7 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Amount due
                </p>

                <p className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
                  {amount}
                </p>

                {intent.description ? (
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
                    {intent.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="p-6">

              {isCompleted ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                  <CheckCircle2
                    className="mx-auto text-emerald-600"
                    size={30}
                  />

                  <h2 className="mt-3 font-semibold text-emerald-950">
                    Payment completed
                  </h2>

                  <p className="mt-1 text-sm text-emerald-700">
                    This payment has already been completed.
                  </p>
                </div>
              ) : isFailed ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
                  <h2 className="font-semibold text-red-950">
                    Payment unavailable
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-red-700">
                    This payment request can no longer be completed.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCheckout}>

                  <div>
                    <h2 className="text-sm font-semibold text-slate-950">
                      Your information
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Enter your details before continuing to secure payment.
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">

                    <div>
                      <label
                        htmlFor="firstName"
                        className="text-xs font-semibold text-slate-700"
                      >
                        First name
                      </label>

                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(event) =>
                          setFirstName(event.target.value)
                        }
                        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        placeholder="John"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lastName"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Last name
                      </label>

                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(event) =>
                          setLastName(event.target.value)
                        }
                        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        placeholder="Doe"
                      />
                    </div>

                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="email"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Email address
                    </label>

                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="phone"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Phone number
                      <span className="ml-1 font-normal text-slate-400">
                        (optional)
                      </span>
                    </label>

                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(event.target.value)
                      }
                      className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                      placeholder="+234..."
                    />
                  </div>

                  {checkoutMutation.isError ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-sm font-medium text-red-900">
                        {getErrorMessage(checkoutMutation.error)}
                      </p>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={checkoutMutation.isPending}
                    className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {checkoutMutation.isPending
                      ? "Preparing secure payment..."
                      : "Continue to payment"}
                  </button>

                  <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                    You will be redirected to our secure payment provider to
                    complete your payment.
                  </p>

                </form>
              )}

              <div className="mt-6 flex items-center justify-center gap-5 border-t border-slate-100 pt-5 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <LockKeyhole size={12} />
                  Encrypted
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} />
                  Secure checkout
                </span>
              </div>
            </div>
          </section>

          <p className="mt-5 text-center text-xs text-slate-400">
            Powered by SmartPOS
          </p>
        </div>
      </div>
    </main>
  );
}

function formatAmount(
  amount: number | string,
  currency: string
) {
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toLocaleString()} ${currency}`;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string;
          };
        };
      }
    ).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return "We could not start the payment. Please try again.";
}
