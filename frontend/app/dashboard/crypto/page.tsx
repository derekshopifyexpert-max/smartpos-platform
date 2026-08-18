"use client";

import { TrendingUp } from "lucide-react";

import { LivePriceDisplay } from "@/components/crypto/live-price-display";
import { ProviderBalanceDisplay } from "@/components/crypto/provider-balance-display";
import { PaystackAccountList } from "@/components/crypto/paystack-account-list";
import { WalletDestinationSelector } from "@/components/crypto/wallet-destination-selector";
import { SettlementStatusCard } from "@/components/crypto/settlement-status-card";
import { CryptoTradingWorkflow } from "@/components/crypto/crypto-trading-workflow";
import { TransactionHistory } from "@/components/crypto/transaction-history";

export default function CryptoTradingPage() {
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

      <div className="space-y-6">
        <CryptoTradingWorkflow />

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
            <TransactionHistory />
        </div>
      </div>
    </div>
  );
}
