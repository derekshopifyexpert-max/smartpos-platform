"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BuyCryptoPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Buy Crypto
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Crypto purchasing is currently unavailable.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Coming soon
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          The external crypto payment provider has been removed from
          SmartPOS. This feature will be connected to the native SmartPOS
          crypto flow separately.
        </p>

        <div className="mt-5">
          <Link
            href="/dashboard/payments"
            className="inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Payments
          </Link>
        </div>
      </div>
    </div>
  );
}