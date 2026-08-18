"use client";

import { useState } from "react";
import { ArrowRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { LivePriceDisplay } from "@/components/crypto/live-price-display";
import { ProviderBalanceDisplay } from "@/components/crypto/provider-balance-display";
import { BuyUsdtForm } from "@/components/crypto/buy-usdt-form";
import { SellUsdtForm } from "@/components/crypto/sell-usdt-form";
import { PaystackAccountList } from "@/components/crypto/paystack-account-list";
import { WalletDestinationSelector } from "@/components/crypto/wallet-destination-selector";
import { SettlementStatusCard } from "@/components/crypto/settlement-status-card";

export default function CryptoTradingPage() {
  const [tab, setTab] = useState<"overview" | "buy" | "sell">("overview");

  const handleBuySuccess = (order: any) => {
    toast.success(`BUY order created: ${order.orderId}`, {
      description: `Filled: ${order.filledAmount} USDT`,
    });
    setTab("overview");
  };

  const handleSellSuccess = (order: any) => {
    toast.success(`SELL order created: ${order.orderId}`, {
      description: `Filled: ${order.filledAmount} USDT`,
    });
    setTab("overview");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">SmartPOS</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Crypto Trading</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Buy and sell USDT through live exchange providers, review real settlement state,
            and choose real destination wallets and configured payment accounts.
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 bg-white rounded-t-lg">
        <button
          onClick={() => setTab("overview")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "overview"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("buy")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "buy"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Buy USDT
        </button>
        <button
          onClick={() => setTab("sell")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            tab === "sell"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Sell USDT
        </button>
      </div>

      <div>
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <LivePriceDisplay asset="USDT" currency="USD" />
              <ProviderBalanceDisplay asset="USDT" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <PaystackAccountList />
              <WalletDestinationSelector />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Exchange activity</h3>
                <div className="space-y-3 text-sm text-slate-600">
                  <p>Real quote retrieval from the configured exchange provider.</p>
                  <p>Actual provider order creation and fill tracking.</p>
                  <p>Quote expiration and status displayed as backend state changes.</p>
                </div>
              </div>

              <SettlementStatusCard isLoading={false} error={undefined} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => setTab("buy")}
                className="group rounded-lg border border-slate-200 bg-white p-6 text-left transition hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-700">Buy USDT</h3>
                    <p className="mt-1 text-sm text-slate-600">Purchase USDT with live quote and real provider order.</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              <button
                onClick={() => setTab("sell")}
                className="group rounded-lg border border-slate-200 bg-white p-6 text-left transition hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-700">Sell USDT</h3>
                    <p className="mt-1 text-sm text-slate-600">Convert USDT back to fiat through the exchange provider.</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Real exchange provider</h4>
                    <p className="mt-1 text-sm text-slate-600">
                      All quotes and orders are executed through actual backend exchange integrations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50">
                    <TrendingUp className="h-5 w-5 text-green-600 rotate-180" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Actual fills</h4>
                    <p className="mt-1 text-sm text-slate-600">
                      The frontend displays only the amount actually filled by the exchange provider.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "buy" && (
          <div className="max-w-2xl">
            <BuyUsdtForm onSuccess={handleBuySuccess} />
          </div>
        )}

        {tab === "sell" && (
          <div className="max-w-2xl">
            <SellUsdtForm onSuccess={handleSellSuccess} />
          </div>
        )}
      </div>
    </div>
  );
}
