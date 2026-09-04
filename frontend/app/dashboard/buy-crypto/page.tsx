"use client";

import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";

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
          Buy cryptocurrencies like USDT and other assets through our integrated trading platform.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <TrendingUp className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900">
                Use Crypto Trading
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Our crypto trading page provides live prices, trading forms, and direct integration with our exchange providers for seamless USDT and crypto purchases.
              </p>

              <Link
                href="/dashboard/crypto"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                Go to Crypto Trading
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h3 className="font-semibold text-emerald-900">Quick Start</h3>
          <ul className="mt-4 space-y-2 text-sm text-emerald-800">
            <li>✓ View live crypto prices</li>
            <li>✓ Check provider balance</li>
            <li>✓ Buy or sell USDT</li>
            <li>✓ Track transaction history</li>
          </ul>
          <p className="mt-4 text-xs text-emerald-700">
            Navigate to the Crypto Trading section to get started.
          </p>
        </div>
      </div>
    </div>
  );
}