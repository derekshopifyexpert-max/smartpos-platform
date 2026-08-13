"use client";

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

import { useEffect, useState } from "react";
import { usePaymentIntent } from "@/features/payment-intents/hooks/use-payment-intent";

export default function CustomerPaymentPage() {
  const params = useParams();
  const id = String(params.id);

  const {
    data: intent,
    isLoading,
    isError,
  } = usePaymentIntent(id);

  const [currentTime, setCurrentTime] = useState<number | null>(null);

useEffect(() => {
  const interval = window.setInterval(() => {
    setCurrentTime(new Date().getTime());
  }, 1000);

  return () => {
    window.clearInterval(interval);
  };
}, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="animate-pulse space-y-5">
              <div className="h-5 w-28 rounded bg-slate-200" />
              <div className="h-8 w-64 rounded bg-slate-200" />
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="h-32 rounded-xl bg-slate-100" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (isError || !intent) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <CreditCard className="text-red-600" size={22} />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-slate-950">
              Payment unavailable
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              This payment request could not be loaded. It may be invalid,
              expired, or no longer available.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-950"
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

  const isCompleted =
    normalizedStatus === "SUCCEEDED" ||
    normalizedStatus === "SETTLED";

  const isExpired =
    Boolean(intent.expiresAt) &&
    currentTime !== null &&
    new Date(intent.expiresAt as string).getTime() <= currentTime;

  const isUnavailable =
    normalizedStatus !== "PENDING" || isExpired;

  const amount = formatAmount(
    intent.amount,
    intent.currency
  );

  const merchantName =
    intent.merchant?.name ?? "SmartPOS merchant";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <div className="border-b border-slate-100 bg-gradient-to-br from-white via-white to-blue-50/70 px-6 py-8 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg">
                  <Store size={21} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-950">
                    {merchantName}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Payment request
                  </p>
                </div>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                {isCompleted ? (
                  <>
                    <CheckCircle2
                      size={14}
                      className="text-emerald-600"
                    />
                    Payment completed
                  </>
                ) : isUnavailable ? (
                  <>
                    <LockKeyhole
                      size={14}
                      className="text-amber-600"
                    />
                    Payment unavailable
                  </>
                ) : (
                  <>
                    <ShieldCheck
                      size={14}
                      className="text-emerald-600"
                    />
                    Secure payment
                  </>
                )}
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Amount due
              </p>

              <p className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                {amount}
              </p>

              {intent.description ? (
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                  {intent.description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_280px]">
            <div>
              {isCompleted ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                    <CheckCircle2
                      size={24}
                      className="text-emerald-600"
                    />
                  </div>

                  <h2 className="mt-4 text-lg font-semibold text-emerald-950">
                    Payment completed
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-emerald-800">
                    This payment has already been completed and does not
                    require any further action.
                  </p>
                </div>
              ) : isUnavailable ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                    <LockKeyhole
                      size={22}
                      className="text-amber-600"
                    />
                  </div>

                  <h2 className="mt-4 text-lg font-semibold text-amber-950">
                    Payment request unavailable
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    This payment request is no longer available for
                    payment.
                  </p>
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Ready to pay?
                  </h2>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                    Continue to secure checkout to enter your customer
                    information and complete this payment.
                  </p>

                  <Link
                    href={`/checkout/${intent.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 sm:w-auto"
                  >
                    <ExternalLink size={16} />
                    Open Customer Checkout
                  </Link>

                  <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                    <LockKeyhole size={13} />
                    Secure checkout powered by SmartPOS and Paystack
                  </div>
                </div>
              )}
            </div>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Payment details
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs text-slate-500">
                    Merchant
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {merchantName}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Amount
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {amount}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Status
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {normalizedStatus}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Payment reference
                  </p>

                  <p className="mt-1 break-all font-mono text-xs text-slate-700">
                    {intent.id}
                  </p>
                </div>

                {intent.expiresAt ? (
                  <div>
                    <p className="text-xs text-slate-500">
                      Expires
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-950">
                      {formatDate(intent.expiresAt)}
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>
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

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}