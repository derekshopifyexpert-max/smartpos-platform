"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createPaymentIntent } from "@/services/payment.service";

export default function NewPaymentPage() {
  const router = useRouter();

  const [merchantId, setMerchantId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!merchantId.trim()) {
      toast.error("Merchant ID is required.");
      return;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    if (!currency.trim()) {
      toast.error("Currency is required.");
      return;
    }

    try {
      setSubmitting(true);

      const paymentIntent = await createPaymentIntent({
        merchantId: merchantId.trim(),
        amount: numericAmount,
        currency: currency.trim().toUpperCase(),
        description: description.trim() || undefined,
      });

      toast.success("Payment created successfully.");

      router.push(
        `/dashboard/payment-intents/${paymentIntent.id}`
      );
    } catch (error: unknown) {
      console.error("Create payment failed:", error);

      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error
          ? (
              error as {
                response?: {
                  data?: {
                    message?: string;
                  };
                };
              }
            ).response?.data?.message
          : undefined;

      toast.error(
        message ?? "Unable to create payment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/payments"
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to payments
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Create Payment
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Create a payment intent for a merchant.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-2">
          <label
            htmlFor="merchantId"
            className="text-sm font-medium text-slate-700"
          >
            Merchant ID
          </label>

          <input
            id="merchantId"
            value={merchantId}
            onChange={(event) =>
              setMerchantId(event.target.value)
            }
            placeholder="e.g. cmsxkjeu3000fc1ts5o2zrciu"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            disabled={submitting}
          />

          <p className="text-xs text-slate-500">
            Enter the merchant that should own this payment.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="amount"
              className="text-sm font-medium text-slate-700"
            >
              Amount
            </label>

            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
              placeholder="1000.00"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="currency"
              className="text-sm font-medium text-slate-700"
            >
              Currency
            </label>

            <select
              id="currency"
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value)
              }
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              disabled={submitting}
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="description"
            className="text-sm font-medium text-slate-700"
          >
            Description
          </label>

          <textarea
            id="description"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Payment description"
            rows={4}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            disabled={submitting}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <Link
            href="/dashboard/payments"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            {submitting
              ? "Creating Payment..."
              : "Create Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}