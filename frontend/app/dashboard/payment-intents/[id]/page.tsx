"use client";

import Link from "next/link";
import { ArrowLeft, CreditCard, ChevronRight, CheckCircle2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { usePaymentIntent } from "@/features/payment-intents/hooks/use-payment-intent";

export default function PaymentIntentDetailPage() {
  const params = useParams();
  const [showCheckout, setShowCheckout] = useState(false);

  const id = String(params.id);

  const {
    data: intent,
    isLoading,
    isError,
  } = usePaymentIntent(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/payment-intents"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Payment Intents
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          Loading payment intent...
        </div>
      </div>
    );
  }

  if (isError || !intent) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/payment-intents"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Payment Intents
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-red-700">
          Unable to load this payment intent.
        </div>
      </div>
    );
  }

  const isPaymentCompleted = intent.status === 'SETTLED' || intent.status === 'CAPTURED' || intent.status === 'AUTHORIZED';
  const canProceedToPayment = !isPaymentCompleted && intent.status !== 'FAILED' && intent.status !== 'CANCELLED';
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/payment-intents"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Payment Intents
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Payment Intent
              </h1>
            </div>

            <p className="mt-2 break-all font-mono text-sm text-slate-500">
              {intent.id}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Created
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDate(intent.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {canProceedToPayment && !showCheckout && (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900">Ready to Complete Payment?</h3>
              <p className="mt-1 text-sm text-blue-700">Click below to proceed to payment and enter your card details via Flutterwave.</p>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <CreditCard className="h-5 w-5" />
              Proceed to Payment
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {isPaymentCompleted && (
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-emerald-900">Payment Completed</h3>
              <p className="mt-1 text-sm text-emerald-700">This payment has been successfully processed.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <SummaryCard
          label="Amount"
          value={formatAmount(
            intent.amount,
            intent.currency
          )}
        />

        <SummaryCard
          label="Description"
          value={intent.description ?? "-"}
        />
      </div>

      {showCheckout && canProceedToPayment && (
        <section className="rounded-xl border-2 border-blue-200 bg-blue-50 shadow-sm">
          <div className="border-b border-blue-200 px-6 py-5 bg-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-blue-900">Payment Checkout</h2>
                <p className="mt-1 text-sm text-blue-700">Complete your payment via Flutterwave securely</p>
              </div>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-sm font-medium text-blue-600 hover:text-blue-900"
              >
                ✕ Close
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">You will be redirected to Flutterwave to complete your payment securely with your card details.</p>
            <Link
              href={`/checkout/${id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-4 font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <CreditCard className="h-5 w-5" />
              Proceed to Flutterwave Checkout
              <ChevronRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-slate-500 text-center">Payment is processed securely by Flutterwave. Your card details are never stored on our servers.</p>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Payment Intent Information
          </h2>

        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem
            label="Payment Intent ID"
            value={intent.id}
          />

          <InfoItem
            label="Amount"
            value={formatAmount(
              intent.amount,
              intent.currency
            )}
          />

          <InfoItem
            label="Currency"
            value={intent.currency}
          />

          <InfoItem
            label="Created"
            value={formatDate(intent.createdAt)}
          />

          <InfoItem
            label="Updated"
            value={formatDate(intent.updatedAt)}
          />

          <InfoItem
            label="Description"
            value={intent.description ?? "-"}
          />
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-3 truncate text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-medium text-slate-900">
        {value}
      </p>
    </div>
  );
}

function PaymentIntentStatus({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status.toUpperCase();

  const statusStyles =
    normalizedStatus === "SUCCEEDED" ||
    normalizedStatus === "SETTLED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalizedStatus === "PENDING"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : normalizedStatus === "FAILED"
          ? "border-red-200 bg-red-50 text-red-700"
          : normalizedStatus === "CANCELED" ||
              normalizedStatus === "CANCELLED"
            ? "border-slate-200 bg-slate-100 text-slate-700"
            : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles}`}
    >
      {normalizedStatus}
    </span>
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
